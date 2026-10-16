import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { ensureActiveBank, answerAttempt } from './helpers';
import { finalizeAttempt, getAttemptForTaking, getAttemptResult, listTestSummaries, saveAnswer, startAttempt, submitAttempt } from '@/lib/services/attempts';

let bankId = '';
beforeAll(async () => {
  bankId = (await ensureActiveBank()).id;
});

describe('official bank', () => {
  it('has 30 tests of 30 questions each (900 total) and is active', async () => {
    expect(await prisma.question.count({ where: { bankId } })).toBe(900);
    for (const t of [1, 15, 30]) expect(await prisma.question.count({ where: { bankId, testNumber: t } })).toBe(30);
    expect(await prisma.test.count({ where: { bankId } })).toBe(30);
    const tests = await listTestSummaries();
    expect(tests).toHaveLength(30);
    expect(tests[0].level).toBe('Beginner');
    expect(tests[29].level).toBe('Advanced');
    expect(tests.every((t) => t.timeLimitSec === 1800)).toBe(true);
  });
});

describe('taking a test', () => {
  it('starts, resumes after refresh, saves answers and never leaks the key', async () => {
    const start = await startAttempt(1);
    expect(start.resumed).toBe(false);
    const again = await startAttempt(1);
    expect(again).toEqual({ attemptId: start.attemptId, resumed: true });
    expect(await prisma.testAttempt.count({ where: { testNumber: 1, status: 'IN_PROGRESS' } })).toBe(1);

    const view = await getAttemptForTaking(start.attemptId);
    if (view.finished) throw new Error('should be open');
    expect(view.questions).toHaveLength(30);
    expect(JSON.stringify(view)).not.toMatch(/correctAnswer|explanation/);
    const expiry = new Date(view.expiresAt).getTime() - new Date(view.startedAt).getTime();
    expect(expiry).toBe(30 * 60 * 1000);

    await saveAnswer(start.attemptId, view.questions[0].id, 'C');
    await saveAnswer(start.attemptId, view.questions[0].id, 'D'); // change of mind
    await saveAnswer(start.attemptId, view.questions[1].id, 'A');
    const reloaded = await getAttemptForTaking(start.attemptId);
    if (reloaded.finished) throw new Error('should be open');
    expect(reloaded.answers[view.questions[0].id]).toBe('D');
    expect(reloaded.expiresAt).toBe(view.expiresAt); // timer cannot reset
    await expect(saveAnswer(start.attemptId, 'not-a-question', 'A')).rejects.toThrow();
    await expect(saveAnswer(start.attemptId, view.questions[0].id, 'Z')).rejects.toThrow();
    await submitAttempt(start.attemptId);
  });

  it('grades correctly, is idempotent and blocks late answers', async () => {
    const { attemptId } = await startAttempt(2);
    await answerAttempt(attemptId, 17, 25); // 17 right, 8 wrong, 5 blank
    const [r1, r2] = await Promise.all([submitAttempt(attemptId), submitAttempt(attemptId)]); // two tabs at once
    expect(r1.score).toBe(17);
    expect(r2.score).toBe(17);
    const result = await getAttemptResult(attemptId);
    expect(result.grade).toMatchObject({ correct: 17, incorrect: 8, unanswered: 5, percentage: 56.7 });
    expect(result.attempt.status).toBe('SUBMITTED');
    expect(result.attempt.score).toBe(17);
    expect(result.items.filter((i) => i.status === 'unanswered')).toHaveLength(5);
    expect(await prisma.studentAnswer.count({ where: { attemptId } })).toBe(30);
    await expect(saveAnswer(attemptId, result.items[0].q.id, 'A')).rejects.toThrow(/already been submitted/);
    const again = await submitAttempt(attemptId);
    expect(again.score).toBe(17);
    expect(await prisma.skillEvent.count({ where: { sessionKey: attemptId } })).toBe(30); // events recorded exactly once
  });

  it('auto-submits when the persisted expiry has passed', async () => {
    const { attemptId } = await startAttempt(3);
    await answerAttempt(attemptId, 10, 10);
    await prisma.testAttempt.update({ where: { id: attemptId }, data: { expiresAt: new Date(Date.now() - 60_000), startedAt: new Date(Date.now() - 31 * 60_000) } });
    const view = await getAttemptForTaking(attemptId);
    expect(view.finished).toBe(true);
    const a = await prisma.testAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    expect(a.status).toBe('TIMED_OUT');
    expect(a.score).toBe(10);
    expect(a.timeUsedSec).toBeLessThanOrEqual(1800);
    expect(a.inProgressKey).toBeNull();
    await expect(saveAnswer(attemptId, JSON.parse(a.questionOrder)[0], 'A')).rejects.toThrow();
  });

  it('keeps every attempt and reports improvement and personal best', async () => {
    const a1 = await startAttempt(4);
    await answerAttempt(a1.attemptId, 12);
    await submitAttempt(a1.attemptId);
    const a2 = await startAttempt(4);
    expect(a2.attemptId).not.toBe(a1.attemptId);
    await answerAttempt(a2.attemptId, 20);
    await submitAttempt(a2.attemptId);
    const r = await getAttemptResult(a2.attemptId);
    expect(r.history.map((h) => h.score)).toEqual([12, 20]);
    expect(r.improvement).toBe(8);
    expect(r.isPersonalBest).toBe(true);
    const first = await getAttemptResult(a1.attemptId);
    expect(first.attempt.score).toBe(12); // old result untouched
    const summary = (await listTestSummaries()).find((t) => t.testNumber === 4)!;
    expect(summary).toMatchObject({ attempts: 2, latestScore: 20, bestScore: 20 });
  });

  it('finalizing twice does not double count', async () => {
    const { attemptId } = await startAttempt(5);
    await answerAttempt(attemptId, 5, 5);
    await Promise.all([finalizeAttempt(attemptId), finalizeAttempt(attemptId), finalizeAttempt(attemptId)]);
    expect(await prisma.skillEvent.count({ where: { sessionKey: attemptId } })).toBe(30);
  });
});
