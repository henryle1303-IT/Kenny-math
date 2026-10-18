import fs from 'node:fs';
import { expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { createUser, assignBank } from '@/lib/services/users';
import { studentLogin, studentFromToken } from '@/lib/services/student-auth';
import { analyzeImport, commitImport } from '@/lib/services/importer';
import { publishBank } from '@/lib/services/banks';
import { getActiveBank, startAttempt, getAttemptForTaking, saveAnswer, submitAttempt } from '@/lib/services/attempts';
import { ensureActiveBank } from './helpers';

it('imports both EQ banks privately, assigns set 1 and lets Tuan answer a question', async () => {
  const shared = await ensureActiveBank();
  const user = await createUser({ username: 'tuan-eq-test', name: 'Tuan', password: '123', lang: 'vi' });
  const ids: string[] = [];
  for (const n of [1, 2]) {
    const name = `eq-hieutruong-bo${n}`;
    const { jobId, report } = await analyzeImport({ name: `${name}.csv`, bytes: new Uint8Array(fs.readFileSync(`exports/tuan/${name}.csv`)) }, 'NEW_BANK', { targetStudentId: user.id });
    expect(report.ok).toBe(true);
    expect(report.totalRows).toBe(900);
    expect(report.invalidRows).toBe(0);
    const result = await commitImport(jobId, { name });
    await publishBank(result.bankId, { acknowledgeReview: true });
    ids.push(result.bankId);
    expect(await prisma.question.count({ where: { bankId: result.bankId } })).toBe(900);
    expect((await prisma.questionBank.findUniqueOrThrow({ where: { id: result.bankId } })).ownerId).toBe(user.id);
  }
  await assignBank(user.id, ids[0]);
  expect((await getActiveBank(user.id))?.id).toBe(ids[0]);
  expect((await prisma.questionBank.findUniqueOrThrow({ where: { id: shared.id } })).isActive).toBe(true);
  const login = await studentLogin('tuan-eq-test', '123', 'eq-fixture');
  expect((await studentFromToken(login.token))?.id).toBe(user.id);
  const attempt = await startAttempt(1, user.id);
  const taking = await getAttemptForTaking(attempt.attemptId, user.id);
  expect(taking.questions).toHaveLength(30);
  const first = await prisma.question.findUniqueOrThrow({ where: { id: taking.questions[0].id } });
  expect(first.questionId).toMatch(/^T01-/);
  await saveAnswer(attempt.attemptId, first.id, first.correctAnswer, user.id);
  await submitAttempt(attempt.attemptId, user.id);
  const stored = await prisma.testAttempt.findUniqueOrThrow({ where: { id: attempt.attemptId } });
  expect(stored.bankId).toBe(ids[0]);
  expect(stored.score).toBe(1);
});
