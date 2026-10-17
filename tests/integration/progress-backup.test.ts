import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { exportProgress, saveProgress, savedProgress, importProgress, parseProgress } from '@/lib/services/progress-backup';
import { clearStudentProgress, getProgress } from '@/lib/services/progress';
import { startAttempt, saveAnswer, submitAttempt } from '@/lib/services/attempts';
import { createSimilarSession, answerReviewQuestion } from '@/lib/services/review';
import { GET, POST } from '@/app/api/admin/progress/backup/route';
import { login, ADMIN_COOKIE } from '@/lib/services/admin-auth';
import { ensureActiveBank, ensureAdmin } from './helpers';

let token = '';
const json = (v: unknown) => JSON.parse(JSON.stringify(v));
const request = (body: unknown, extra: Record<string, string> = {}) => new Request('http://localhost:3000/api/admin/progress/backup?studentId=kenny', {
  method: 'POST', headers: { host: 'localhost:3000', 'content-type': 'application/json', ...extra }, body: JSON.stringify(body),
});

beforeAll(async () => {
  await ensureActiveBank();
  await clearStudentProgress('CLEAR');
  const admin = await ensureAdmin('backup-admin@test.local');
  token = (await login(admin.email, admin.password, 'backup-tests')).token;
  const completed = await startAttempt(1);
  const q = await prisma.question.findFirstOrThrow({ where: { testNumber: 1, bank: { isActive: true } } });
  await saveAnswer(completed.attemptId, q.id, q.correctAnswer);
  await submitAttempt(completed.attemptId);
  const open = await startAttempt(2);
  const q2 = await prisma.question.findFirstOrThrow({ where: { testNumber: 2, bank: { isActive: true } } });
  await saveAnswer(open.attemptId, q2.id, 'B');
  const review = await createSimilarSession(q.id);
  const rq = await prisma.reviewQuestion.findFirstOrThrow({ where: { sessionId: review } });
  await answerReviewQuestion(rq.id, rq.correctAnswer);
});

describe('progress backups', () => {
  it('protects downloads and writes with admin authentication and origin checks', async () => {
    expect((await GET(new Request('http://localhost:3000/api/admin/progress/backup?studentId=kenny'))).status).toBe(401);
    expect((await POST(request({ action: 'save' }))).status).toBe(401);
    expect((await POST(request({ action: 'save' }, { cookie: `${ADMIN_COOKIE}=${token}`, origin: 'https://evil.example' }))).status).toBe(403);
    const response = await GET(new Request('http://localhost:3000/api/admin/progress/backup?studentId=kenny', { headers: { cookie: `${ADMIN_COOKIE}=${token}` } }));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).format).toBe('kenny-math-progress');
  });

  it('saves a durable snapshot and restores all history, keeping timers and remapping relations', async () => {
    const before = await getProgress();
    const original = json(await exportProgress());
    const bankCount = await prisma.questionBank.count();
    await saveProgress();
    expect((await savedProgress()) as object).toMatchObject({ format: 'kenny-math-progress', attempts: original.attempts });
    await clearStudentProgress('CLEAR');
    expect((await getProgress()).attemptsCount).toBe(0);
    await importProgress(original, 'RESTORE');
    expect(await getProgress()).toEqual(before);
    const restored = json(await exportProgress());
    expect(restored.answers.length).toBe(original.answers.length);
    expect(restored.reviewQuestions.length).toBe(original.reviewQuestions.length);
    expect(restored.events.length).toBe(original.events.length);
    expect(restored.attempts.map((a: { expiresAt: string }) => a.expiresAt).sort()).toEqual(original.attempts.map((a: { expiresAt: string }) => a.expiresAt).sort());
    expect(restored.attempts[0].id).not.toBe(original.attempts[0].id);
    expect(await prisma.questionBank.count()).toBe(bankCount);
    expect((await savedProgress()) as object).toMatchObject({ attempts: [] });
    // The same file can be restored repeatedly without duplicate records.
    await importProgress(original, 'RESTORE');
    expect((await exportProgress()).attempts.length).toBe(original.attempts.length);
  });

  it('rejects malformed, mismatched and unconfirmed restores without changing progress or backup', async () => {
    const original = json(await exportProgress());
    const saved = await savedProgress();
    await expect(importProgress(original, '')).rejects.toThrow(/RESTORE/);
    const invalid = json(original); invalid.answers[0].attemptId = 'missing';
    expect(() => parseProgress(invalid)).toThrow(/inconsistent/);
    const wrongDate = json(original); wrongDate.attempts[0].startedAt = 'not-a-date';
    expect(() => parseProgress(wrongDate)).toThrow(/Invalid/);
    const wrongBank = json(original); wrongBank.banks[0].signature = '0'.repeat(64);
    await expect(importProgress(wrongBank, 'RESTORE')).rejects.toThrow(/bank/);
    const after = json(await exportProgress());
    expect(after.attempts).toEqual(original.attempts);
    expect(after.answers).toEqual(original.answers);
    expect(await savedProgress()).toEqual(saved);
  });
});
