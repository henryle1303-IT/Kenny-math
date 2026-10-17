import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { ensureActiveBank } from './helpers';
import { initializeStudents, createUser, updateUser, assignBank, findUser } from '@/lib/services/users';
import { studentLogin, studentFromToken, setStudentPassword, requireStudent } from '@/lib/services/student-auth';
import { getActiveBank, startAttempt, getAttemptForTaking, saveAnswer, submitAttempt, getAttemptResult } from '@/lib/services/attempts';
import { createSmartSession, getReviewSession, answerReviewQuestion, createSimilarSession } from '@/lib/services/review';
import { getLearningConfig } from '@/lib/services/core';
import { exportProgress, saveProgress, savedProgress, importProgress } from '@/lib/services/progress-backup';
import { clearStudentProgress } from '@/lib/services/progress';
import { analyzeImport, commitImport } from '@/lib/services/importer';
import { exportBankCsv, publishBank, archiveBank, cloneBank } from '@/lib/services/banks';

describe('independent student accounts', () => {
  beforeAll(async () => { await ensureActiveBank(); await initializeStudents(); });
  afterAll(async () => { await prisma.studentBankAssignment.deleteMany({ where: { studentId: { in: ['kenny', 'henry', 'xoai', 'moon'] } } }); });

  it('initializes four independent logins, preserving legacy Kenny and idempotent passwords/assignments', async () => {
    const before = await prisma.testAttempt.count({ where: { studentId: 'kenny' } });
    const banks = [];
    for (const username of ['kenny', 'henry', 'xoai', 'moon']) {
      const auth = await studentLogin(username, '123', `initial-${username}`);
      expect((await studentFromToken(auth.token))?.username).toBe(username);
      expect(await studentFromToken('invalid-token')).toBeNull();
      banks.push((await getActiveBank(username))?.id);
    }
    expect(new Set(banks).size).toBe(1);
    await setStudentPassword('henry', 'new-henry');
    const logged = await studentLogin('henry', 'new-henry', 'changed');
    await initializeStudents();
    expect((await studentFromToken(logged.token))?.id).toBe('henry');
    await prisma.student.update({ where: { id: 'henry' }, data: { username: 'henry-renamed' } });
    await initializeStudents();
    expect((await findUser('henry')).username).toBe('henry-renamed');
    await prisma.student.update({ where: { id: 'henry' }, data: { username: 'henry' } });
    expect(await prisma.testAttempt.count({ where: { studentId: 'kenny' } })).toBe(before);
    await expect(studentLogin('henry', '123', 'old')).rejects.toThrow('Incorrect');
    await setStudentPassword('henry', '123');
  });

  it('rejects anonymous, cross-site writes, expired/disabled sessions and repeated invalid passwords', async () => {
    await expect(requireStudent(new Request('http://localhost/api/attempts'))).rejects.toMatchObject({ status: 401 });
    const auth = await studentLogin('moon', '123', 'security');
    const headers = { cookie: `kmc_student=${auth.token}`, host: 'localhost' };
    await expect(requireStudent(new Request('http://localhost/api/attempts', { method: 'POST', headers: { ...headers, origin: 'https://evil.example' } }))).rejects.toMatchObject({ status: 403 });
    expect((await requireStudent(new Request('http://localhost/api/attempts', { headers }))).id).toBe('moon');
    await prisma.studentSession.updateMany({ where: { studentId: 'moon' }, data: { expiresAt: new Date(0) } });
    expect(await studentFromToken(auth.token)).toBeNull();
    for (let i = 0; i < 5; i++) await expect(studentLogin('moon', 'bad', 'rate')).rejects.toMatchObject({ status: 401 });
    await expect(studentLogin('moon', '123', 'rate')).rejects.toMatchObject({ status: 429 });
  });

  it('keeps profile/learning changes private and revokes sessions on password reset and disable', async () => {
    const kenny = await findUser('kenny');
    const token = (await studentLogin('henry', '123', 'profile')).token;
    const config = await getLearningConfig(prisma, 'henry');
    await updateUser('henry', { username: 'henry', name: 'Henry New', lang: 'vi', isActive: true, intervals: { ...config.intervals, afterCorrectOnce: 12 } });
    expect((await studentFromToken(token))?.name).toBe('Henry New');
    expect((await getLearningConfig(prisma, 'henry')).intervals.afterCorrectOnce).toBe(12);
    expect(await findUser('kenny')).toEqual(kenny);
    await setStudentPassword('henry', '456');
    expect(await studentFromToken(token)).toBeNull();
    await expect(setStudentPassword('henry', '789', 'wrong')).rejects.toThrow('current password');
    await updateUser('henry', { username: 'henry', name: 'Henry', lang: 'en', isActive: false, intervals: config.intervals });
    await expect(studentLogin('henry', '456', 'disabled')).rejects.toThrow('Incorrect');
    await updateUser('henry', { username: 'henry', name: 'Henry', lang: 'en', isActive: true, intervals: config.intervals });
    await setStudentPassword('henry', '123');
    await expect(createUser({ username: 'kenny', name: 'Duplicate', password: '123' })).rejects.toThrow('exists');
  });

  it('blocks cross-user tests, answers, results and practice, while progress remains independent', async () => {
    const a = await startAttempt(29, 'henry');
    const taking = await getAttemptForTaking(a.attemptId, 'henry');
    if (taking.finished) throw new Error('Expected open test');
    const questionId = taking.questions[0].id;
    await expect(getAttemptForTaking(a.attemptId, 'moon')).rejects.toMatchObject({ status: 404 });
    await expect(saveAnswer(a.attemptId, questionId, 'A', 'moon')).rejects.toMatchObject({ status: 404 });
    await expect(submitAttempt(a.attemptId, 'moon')).rejects.toMatchObject({ status: 404 });
    await saveAnswer(a.attemptId, questionId, 'A', 'henry');
    await submitAttempt(a.attemptId, 'henry');
    await expect(getAttemptResult(a.attemptId, 'moon')).rejects.toMatchObject({ status: 404 });
    expect((await getAttemptResult(a.attemptId, 'henry')).attempt.studentId).toBe('henry');
    const sid = await createSmartSession('henry');
    const review = await getReviewSession(sid, 'henry');
    await expect(getReviewSession(sid, 'moon')).rejects.toMatchObject({ status: 404 });
    await expect(answerReviewQuestion(review.questions[0].id, 'A', 'moon')).rejects.toMatchObject({ status: 404 });
    await answerReviewQuestion(review.questions[0].id, 'A', 'henry');
    expect((await exportProgress('moon')).attempts).toHaveLength(0);
    await saveProgress('henry');
    expect((await savedProgress('henry') as { student: { id: string } }).student.id).toBe('henry');
    expect(await savedProgress('moon')).toBeNull();
    const backup = JSON.parse(JSON.stringify(await exportProgress('henry')));
    await expect(importProgress(backup, 'RESTORE', 'moon')).rejects.toThrow('another user');
    await clearStudentProgress('CLEAR', 'henry');
    await importProgress(backup, 'RESTORE', 'henry');
    expect((await exportProgress('henry')).attempts).toHaveLength(backup.attempts.length);
  });

  it('imports a private bank with an immutable target, preserving other assignments and in-flight tests', async () => {
    const shared = await getActiveBank('moon');
    const originalAssignments = await prisma.studentBankAssignment.findMany({ orderBy: { studentId: 'asc' } });
    const open = await startAttempt(28, 'moon');
    const original = await prisma.testAttempt.findUniqueOrThrow({ where: { id: open.attemptId } });
    const csv = await exportBankCsv(shared!.id);
    const analyzed = await analyzeImport({ name: 'private.csv', bytes: Buffer.from(csv.csv) }, 'NEW_BANK', { targetStudentId: 'moon' });
    const imported = await commitImport(analyzed.jobId, { name: 'Moon private bank' });
    expect((await prisma.questionBank.findUniqueOrThrow({ where: { id: imported.bankId } })).ownerId).toBe('moon');
    await publishBank(imported.bankId, { acknowledgeReview: true });
    expect((await getActiveBank('moon'))?.id).toBe(imported.bankId);
    for (const a of originalAssignments.filter((a) => a.studentId !== 'moon')) expect((await getActiveBank(a.studentId))?.id).toBe(a.bankId);
    const unchanged = await prisma.testAttempt.findUniqueOrThrow({ where: { id: open.attemptId } });
    expect(unchanged.bankId).toBe(original.bankId); expect(unchanged.expiresAt).toEqual(original.expiresAt);
    await expect(assignBank('henry', imported.bankId)).rejects.toThrow('owned');
    const privateQuestion = await prisma.question.findFirstOrThrow({ where: { bankId: imported.bankId } });
    await expect(createSimilarSession(privateQuestion.id, undefined, 'henry')).rejects.toMatchObject({ status: 404 });
    await expect(analyzeImport({ name: 'cross-user.csv', bytes: Buffer.from(csv.csv) }, 'UPDATE_SELECTED', { targetStudentId: 'henry', baseBankId: imported.bankId })).rejects.toThrow('another user');
    expect((await cloneBank(imported.bankId)).ownerId).toBe('moon');
    await expect(archiveBank(imported.bankId)).rejects.toThrow('assigned');
    await assignBank('moon', shared!.id);
  });
});
