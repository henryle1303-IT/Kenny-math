import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Question } from '@prisma/client';
import { prisma } from '@/lib/db';
import { analyzeImport, commitImport } from '@/lib/services/importer';
import { publishBank, validateBankById, exportBankCsv } from '@/lib/services/banks';
import { finalizeAttempt, getAttemptResult, saveAnswer, startAttempt } from '@/lib/services/attempts';
import { createUser } from '@/lib/services/users';
import { ensureActiveBank } from './helpers';
import { typeOf } from '@/lib/question-types';

const USERNAME = 'au-student';
let STUDENT = '';
let bankId = '';

function right(q: Question): string {
  const d = q.answerData ? JSON.parse(q.answerData) : null;
  switch (typeOf(q.questionType)) {
    case 'MCQ': return q.correctAnswer;
    case 'NUMERIC_INPUT': case 'SHORT_TEXT': return d.accepted[0];
    case 'TRUE_FALSE': return JSON.stringify(d.statements.map((s: { truth: boolean }) => s.truth));
    case 'MULTI_SELECT': return JSON.stringify([...d.correct].sort((a: number, b: number) => a - b));
    case 'FILL_BLANK': return JSON.stringify(d.blanks.map((b: { accepted: string[] }) => b.accepted[0]));
    case 'ORDERING': return JSON.stringify(d.items.map((_: unknown, i: number) => i));
  }
}

beforeAll(async () => {
  await ensureActiveBank();
  await prisma.student.deleteMany({ where: { username: USERNAME } });
  const u = await createUser({ username: USERNAME, name: 'AU', password: '123' });
  STUDENT = u.id;
});

describe('importing kenny-math-v2.csv as uploaded in Admin', () => {
  it('validates, saves as a private bank for one user, and publishes without review warnings', async () => {
    const bytes = new Uint8Array(fs.readFileSync(path.resolve('exports/kenny-math-v2.csv')));
    const user = await prisma.student.findUniqueOrThrow({ where: { id: STUDENT } });
    const { jobId, report } = await analyzeImport({ name: 'kenny-math-v2.csv', bytes }, 'NEW_BANK', { targetStudentId: user.id });
    expect(report.headerProblems).toEqual([]);
    expect(report.rowProblems).toEqual([]);
    expect(report.totalRows).toBe(900);
    expect(report.ok).toBe(true);
    expect(report.canCommit).toBe(true);
    const done = await commitImport(jobId, { name: 'Australian Year 5 v2' });
    bankId = done.bankId;
    const validation = await validateBankById(bankId);
    expect(validation.ok).toBe(true);
    expect(validation.verifiedRows).toBe(900);
    await publishBank(bankId, {});
    const bank = await prisma.questionBank.findUniqueOrThrow({ where: { id: bankId } });
    expect(bank.status).toBe('PUBLISHED');
    const assigned = await prisma.studentBankAssignment.findUnique({ where: { studentId: user.id } });
    expect(assigned?.bankId).toBe(bankId);
    const types = await prisma.question.groupBy({ by: ['questionType'], where: { bankId }, _count: true });
    expect(Object.fromEntries(types.map((t) => [t.questionType, t._count]))).toEqual({ MCQ: 450, NUMERIC_INPUT: 190, TRUE_FALSE: 80, MULTI_SELECT: 60, FILL_BLANK: 60, ORDERING: 30, SHORT_TEXT: 30 });
  });

  it('can be exported again and read back with the same questions', async () => {
    const { csv, count } = await exportBankCsv(bankId);
    expect(count).toBe(900);
    const original = fs.readFileSync(path.resolve('exports/kenny-math-v2.csv'), 'utf8').split('\r\n')[1];
    expect(csv).toContain(original.slice(0, 80));
  });

  it('gives a perfect score on every test when every answer is right', async () => {
    for (const t of [1, 8, 15, 22, 30]) {
      const { attemptId } = await startAttempt(t, STUDENT);
      const a = await prisma.testAttempt.findUniqueOrThrow({ where: { id: attemptId } });
      const order: string[] = JSON.parse(a.questionOrder);
      const qs = new Map((await prisma.question.findMany({ where: { id: { in: order } } })).map((q) => [q.id, q]));
      for (const id of order) await saveAnswer(attemptId, id, right(qs.get(id)!), STUDENT);
      await finalizeAttempt(attemptId);
      const res = await getAttemptResult(attemptId, STUDENT);
      expect(res.grade.correct, `test ${t}`).toBe(30);
      expect(res.grade.incorrect).toBe(0);
    }
  });
});
