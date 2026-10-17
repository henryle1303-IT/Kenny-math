import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { POST } from '@/app/api/admin/progress/clear/route';
import { ADMIN_COOKIE, login } from '@/lib/services/admin-auth';
import { startAttempt, saveAnswer, submitAttempt } from '@/lib/services/attempts';
import { clearStudentProgress, getProgress } from '@/lib/services/progress';
import { answerReviewQuestion, createSimilarSession, createSmartSession } from '@/lib/services/review';
import { ensureActiveBank, ensureAdmin } from './helpers';

const target = 'reset-progress-target';
const other = 'reset-progress-other';
let token = '';
let submittedId = '';
let openId = '';
let reviewIds: string[] = [];

async function history(studentId: string) {
  return {
    student: await prisma.student.findUnique({ where: { id: studentId } }),
    attempts: await prisma.testAttempt.findMany({ where: { studentId }, include: { answers: true } }),
    reviews: await prisma.reviewSession.findMany({ where: { studentId }, include: { questions: true } }),
    events: await prisma.skillEvent.findMany({ where: { studentId } }),
    skills: await prisma.skillProgress.findMany({ where: { studentId } }),
  };
}

beforeAll(async () => {
  await ensureActiveBank();
  await prisma.student.createMany({ data: [
    { id: target, name: 'Reset me', preferences: '{"lang":"vi"}' },
    { id: other, name: 'Keep me' },
  ] });
  const admin = await ensureAdmin('progress-admin@test.local');
  token = (await login(admin.email, admin.password, 'progress-reset-test')).token;

  submittedId = (await startAttempt(28, target)).attemptId;
  const first = await prisma.question.findFirstOrThrow({ where: { testNumber: 28, bank: { isActive: true } } });
  await saveAnswer(submittedId, first.id, first.correctAnswer, target);
  await submitAttempt(submittedId, target);
  openId = (await startAttempt(29, target)).attemptId;
  const second = await prisma.question.findFirstOrThrow({ where: { testNumber: 29, bank: { isActive: true } } });
  await saveAnswer(openId, second.id, 'A', target);
  const smart = await createSmartSession(target);
  const rq = await prisma.reviewQuestion.findFirstOrThrow({ where: { sessionId: smart } });
  await answerReviewQuestion(rq.id, rq.correctAnswer, target);
  const similar = await createSimilarSession(first.id, undefined, target);
  reviewIds = [smart, similar];

  const keep = await startAttempt(27, other);
  const keepQuestion = await prisma.question.findFirstOrThrow({ where: { testNumber: 27, bank: { isActive: true } } });
  await saveAnswer(keep.attemptId, keepQuestion.id, 'B', other);
  const keepReview = await createSmartSession(other);
  const keepRq = await prisma.reviewQuestion.findFirstOrThrow({ where: { sessionId: keepReview } });
  await answerReviewQuestion(keepRq.id, keepRq.correctAnswer, other);
});

afterAll(async () => {
  for (const studentId of [target, other]) {
    await clearStudentProgress('CLEAR', studentId);
    await prisma.student.deleteMany({ where: { id: studentId } });
  }
});

describe('clearing student progress', () => {
  it('requires admin authentication, same-origin requests and explicit confirmation', async () => {
    const before = await history('kenny');
    const request = (body: string, headers: Record<string, string> = {}) => new Request('http://localhost:3000/api/admin/progress/clear?studentId=kenny', {
      method: 'POST', headers: { 'content-type': 'application/json', host: 'localhost:3000', ...headers }, body,
    });
    expect((await POST(request('{"confirmation":"CLEAR"}'))).status).toBe(401);
    expect((await POST(request('{"confirmation":"CLEAR"}', { cookie: `${ADMIN_COOKIE}=${token}`, origin: 'http://evil.example' }))).status).toBe(403);
    for (const body of ['{}', 'null', '{"confirmation":"clear"}', '{"confirmation":true}', 'invalid json']) {
      expect((await POST(request(body, { cookie: `${ADMIN_COOKIE}=${token}` }))).status).toBe(400);
    }
    expect(await history('kenny')).toEqual(before);
    await expect(clearStudentProgress('wrong', target)).rejects.toThrow(/CLEAR/);
    expect(await prisma.testAttempt.count({ where: { studentId: target } })).toBe(2);
  });

  it('clears completed and unfinished history, cascades answers, and preserves banks, settings and other students', async () => {
    const keep = await history(other);
    const student = await prisma.student.findUniqueOrThrow({ where: { id: target } });
    const banks = await prisma.questionBank.findMany();
    const questionCount = await prisma.question.count();
    const testCount = await prisma.test.count();
    const admins = await prisma.adminUser.findMany();
    const settings = await prisma.setting.findMany();

    const deleted = await clearStudentProgress('CLEAR', target);
    expect(deleted).toMatchObject({ attempts: 2, reviewSessions: 2, skillEvents: 31 });
    expect(deleted.skills).toBeGreaterThan(0);
    expect(await history(target)).toEqual({ student, attempts: [], reviews: [], events: [], skills: [] });
    expect(await prisma.studentAnswer.count({ where: { attemptId: { in: [submittedId, openId] } } })).toBe(0);
    expect(await prisma.reviewQuestion.count({ where: { sessionId: { in: reviewIds } } })).toBe(0);
    expect(await history(other)).toEqual(keep);
    expect(await prisma.questionBank.findMany()).toEqual(banks);
    expect(await prisma.question.count()).toBe(questionCount);
    expect(await prisma.test.count()).toBe(testCount);
    expect(await prisma.adminUser.findMany()).toEqual(admins);
    expect(await prisma.setting.findMany()).toEqual(settings);
    expect(await getProgress(target)).toMatchObject({ testsCompleted: 0, attemptsCount: 0, smartSessions: 0, averageScore: null, skills: [], readyForReview: [], topics: [] });
  });

  it('can clear empty progress and start a fresh attempt afterwards', async () => {
    expect(await clearStudentProgress('CLEAR', target)).toEqual({ attempts: 0, reviewSessions: 0, skillEvents: 0, skills: 0 });
    const fresh = await startAttempt(28, target);
    expect(fresh.resumed).toBe(false);
    expect(fresh.attemptId).not.toBe(submittedId);
    expect(await prisma.studentAnswer.count({ where: { attemptId: fresh.attemptId } })).toBe(0);
  });
});
