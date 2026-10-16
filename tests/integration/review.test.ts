import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { ensureActiveBank, answerAttempt } from './helpers';
import { startAttempt, submitAttempt } from '@/lib/services/attempts';
import { answerReviewQuestion, createSimilarSession, createSmartSession, getReviewSession } from '@/lib/services/review';
import { getProgress } from '@/lib/services/progress';

beforeAll(async () => {
  await ensureActiveBank();
});

describe('Smart Review', () => {
  it('records mistakes by skill after a test', async () => {
    const { attemptId } = await startAttempt(10);
    await answerAttempt(attemptId, 8, 30);
    await submitAttempt(attemptId);
    const events = await prisma.skillEvent.findMany({ where: { sessionKey: attemptId } });
    expect(events).toHaveLength(30);
    expect(events.filter((e) => !e.isCorrect)).toHaveLength(22);
    const prog = await prisma.skillProgress.findMany();
    expect(prog.length).toBeGreaterThan(10);
    expect(prog.every((p) => p.masteryStatus === 'NOT_ENOUGH_DATA' || p.totalAttempts >= 3)).toBe(true);
  });

  it('builds a 10-question session, hides answers until answered, and updates mastery data', async () => {
    const sid = await createSmartSession();
    const s = await getReviewSession(sid);
    expect(s.questions).toHaveLength(10);
    expect(s.questions.every((q) => q.correct === null && q.explanation === null)).toBe(true);
    const tiers = s.questions.map((q) => q.tier);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
    expect(Math.max(...s.questions.map((q) => q.options.length))).toBe(4);
    const skillsBefore = await prisma.skillEvent.count();
    const rq = await prisma.reviewQuestion.findMany({ where: { sessionId: sid }, orderBy: { position: 'asc' } });
    let right = 0;
    for (const [i, q] of rq.entries()) {
      const pick = i % 2 === 0 ? q.correctAnswer : q.correctAnswer === 'A' ? 'B' : 'A';
      const res = await answerReviewQuestion(q.id, pick);
      if (res.isCorrect) right++;
      expect(res.explanation).toBeTruthy();
      const again = await answerReviewQuestion(q.id, 'D'); // answering twice never changes the result
      expect(again.alreadyAnswered).toBe(true);
      expect(again.selected).toBe(pick);
    }
    expect(right).toBe(5);
    expect(await prisma.skillEvent.count()).toBe(skillsBefore + 10);
    const done = await getReviewSession(sid);
    expect(done.completed).toBe(true);
    expect(done.score).toBe(5);
    const p = await getProgress();
    expect(p.smartSessions).toBe(1);
    expect(p.reviewQuestionsDone).toBeGreaterThanOrEqual(10);
  });

  it('avoids repeating recent review questions', async () => {
    const a = await createSmartSession();
    const b = await createSmartSession();
    const fa = (await prisma.reviewQuestion.findMany({ where: { sessionId: a } })).map((q) => q.fingerprint);
    const fb = (await prisma.reviewQuestion.findMany({ where: { sessionId: b } })).map((q) => q.fingerprint);
    expect(new Set(fa).size).toBe(fa.length);
    expect(fb.filter((f) => fa.includes(f))).toEqual([]);
  });

  it('does not modify the official questions', async () => {
    const before = await prisma.question.count();
    await createSmartSession();
    expect(await prisma.question.count()).toBe(before);
  });

  it('offers a similar question on the same skill', async () => {
    const wrong = await prisma.studentAnswer.findFirst({ where: { isCorrect: false }, include: { question: true } });
    expect(wrong).toBeTruthy();
    const sid = await createSimilarSession(wrong!.questionId);
    const s = await getReviewSession(sid);
    expect(s.kind).toBe('SIMILAR');
    expect(s.questions).toHaveLength(1);
    expect(s.questions[0].skillId).toBe(wrong!.question.skill);
    expect(s.questions[0].text).not.toBe(wrong!.question.questionText);
  });

  it('lists skills due for review after mistakes', async () => {
    const p = await getProgress();
    expect(p.readyForReview.length).toBeGreaterThan(0);
  });
});
