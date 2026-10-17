import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { gradeAnswers, isExpired, timeUsedSeconds } from '../grading';
import { recordSkillEvents } from './skills';
import { STUDENT_ID } from './core';
import { awardForTest } from './xp';
import { isResponseCorrect, normalizeResponse, studentView, type StudentView } from '../question-types';

export class AppError extends Error {
  constructor(message: string, public status = 400, public code = 'BAD_REQUEST') {
    super(message);
  }
}

export async function getActiveBank(studentId?: string) {
  if (studentId) {
    const assigned = await prisma.studentBankAssignment.findUnique({ where: { studentId }, include: { bank: true } });
    if (assigned) return assigned.bank.status === 'PUBLISHED' && (!assigned.bank.ownerId || assigned.bank.ownerId === studentId) ? assigned.bank : null;
  }
  return prisma.questionBank.findFirst({ where: { isActive: true, status: 'PUBLISHED', ownerId: null } });
}

/** Start a test, or resume the unfinished attempt for it. */
export async function startAttempt(testNumber: number, studentId = STUDENT_ID) {
  if (!Number.isInteger(testNumber) || testNumber < 1 || testNumber > 30) throw new AppError('Please choose a test from 1 to 30.');
  const open = await prisma.testAttempt.findFirst({ where: { studentId, testNumber, status: 'IN_PROGRESS' } });
  if (open) {
    if (!isExpired(open.expiresAt)) return { attemptId: open.id, resumed: true };
    await finalizeAttempt(open.id);
  }
  const bank = await getActiveBank(studentId);
  if (!bank) throw new AppError('No question bank is active yet. Please ask a grown-up to publish one.', 409, 'NO_ACTIVE_BANK');
  const [test, questions] = await Promise.all([
    prisma.test.findUnique({ where: { bankId_testNumber: { bankId: bank.id, testNumber } } }),
    prisma.question.findMany({ where: { bankId: bank.id, testNumber }, orderBy: { position: 'asc' }, select: { id: true } }),
  ]);
  if (!test || questions.length === 0) throw new AppError('This test is not available.', 404, 'NO_TEST');
  const now = new Date();
  try {
    const a = await prisma.testAttempt.create({
      data: {
        studentId,
        bankId: bank.id,
        testNumber,
        questionOrder: JSON.stringify(questions.map((q) => q.id)),
        startedAt: now,
        expiresAt: new Date(now.getTime() + test.timeLimitSec * 1000),
        inProgressKey: `${studentId}:${testNumber}`,
      },
    });
    return { attemptId: a.id, resumed: false };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const again = await prisma.testAttempt.findFirst({ where: { studentId, testNumber, status: 'IN_PROGRESS' } });
      if (again) return { attemptId: again.id, resumed: true };
    }
    throw e;
  }
}

/** Data the test page needs. Never includes answers or explanations while the test is open. */
export async function getAttemptForTaking(attemptId: string, studentId = STUDENT_ID) {
  let attempt = await prisma.testAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.studentId !== studentId) throw new AppError('Test not found.', 404, 'NOT_FOUND');
  if (attempt.status === 'IN_PROGRESS' && isExpired(attempt.expiresAt)) {
    await finalizeAttempt(attemptId);
    attempt = (await prisma.testAttempt.findUnique({ where: { id: attemptId } }))!;
  }
  if (attempt.status !== 'IN_PROGRESS') return { finished: true as const, attemptId };
  const order: string[] = JSON.parse(attempt.questionOrder);
  const [qs, answers, test] = await Promise.all([
    prisma.question.findMany({ where: { id: { in: order } }, select: { id: true, position: true, questionText: true, optionA: true, optionB: true, optionC: true, optionD: true, topic: true, questionType: true, answerData: true, correctAnswer: true } }),
    prisma.studentAnswer.findMany({ where: { attemptId } }),
    prisma.test.findUnique({ where: { bankId_testNumber: { bankId: attempt.bankId, testNumber: attempt.testNumber } } }),
  ]);
  const byId = new Map(qs.map((q) => [q.id, q]));
  return {
    finished: false as const,
    attemptId,
    testNumber: attempt.testNumber,
    title: test?.title ?? `Math Test ${attempt.testNumber}`,
    level: test?.level ?? '',
    startedAt: attempt.startedAt.toISOString(),
    expiresAt: attempt.expiresAt.toISOString(),
    serverNow: new Date().toISOString(),
    questions: order.map((id, i) => {
      const q = byId.get(id)!;
      const view = studentView(q, `${attemptId}:${id}`) ?? ({ type: 'MCQ', options: [q.optionA, q.optionB, q.optionC, q.optionD] } as StudentView);
      return { id, number: i + 1, text: q.questionText, view };
    }),
    answers: Object.fromEntries(answers.filter((a) => a.selectedAnswer).map((a) => [a.questionId, a.selectedAnswer as string])),
  };
}

const GRACE_MS = 3000;

export async function saveAnswer(attemptId: string, questionId: string, selected: string | null, studentId = STUDENT_ID) {
  const attempt = await prisma.testAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.studentId !== studentId) throw new AppError('Test not found.', 404, 'NOT_FOUND');
  if (attempt.status !== 'IN_PROGRESS') throw new AppError('This test has already been submitted.', 409, 'SUBMITTED');
  if (Date.now() > attempt.expiresAt.getTime() + GRACE_MS) {
    await finalizeAttempt(attemptId);
    throw new AppError('Time is up. The test has been submitted.', 409, 'EXPIRED');
  }
  const order: string[] = JSON.parse(attempt.questionOrder);
  if (!order.includes(questionId)) throw new AppError('That question is not part of this test.', 400, 'BAD_QUESTION');
  const question = await prisma.question.findUnique({ where: { id: questionId }, select: { questionType: true, answerData: true, correctAnswer: true } });
  if (!question) throw new AppError('That question is not part of this test.', 400, 'BAD_QUESTION');
  const norm = normalizeResponse(question, selected);
  if (!norm.ok) throw new AppError(norm.message);
  selected = norm.value;
  // Re-check the status inside the write so a concurrent submit in another tab wins cleanly.
  await prisma.$transaction(async (tx) => {
    const fresh = await tx.testAttempt.findUnique({ where: { id: attemptId }, select: { status: true } });
    if (fresh?.status !== 'IN_PROGRESS') throw new AppError('This test has already been submitted.', 409, 'SUBMITTED');
    await tx.studentAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      update: { selectedAnswer: selected, answeredAt: new Date() },
      create: { attemptId, questionId, selectedAnswer: selected },
    });
  });
  return { saved: true };
}

/** Grade and close an attempt. Idempotent: only the first caller does the work. */
export async function finalizeAttempt(attemptId: string, now: Date = new Date()) {
  const { attempt, fresh } = await gradeAttempt(attemptId, now);
  // XP is best effort and runs after grading, so a problem here can never lose a submitted test.
  if (fresh) await awardForTest(attemptId).catch((e) => console.error('[xp] test award failed', e));
  return attempt;
}

async function gradeAttempt(attemptId: string, now: Date) {
  return prisma.$transaction(async (tx) => {
    const attempt = await tx.testAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new AppError('Test not found.', 404, 'NOT_FOUND');
    if (attempt.status !== 'IN_PROGRESS') return { attempt, fresh: false };
    const expired = now.getTime() >= attempt.expiresAt.getTime();
    const claim = await tx.testAttempt.updateMany({
      where: { id: attemptId, status: 'IN_PROGRESS' },
      data: { status: expired ? 'TIMED_OUT' : 'SUBMITTED', submittedAt: now, inProgressKey: null },
    });
    if (claim.count === 0) return { attempt: (await tx.testAttempt.findUnique({ where: { id: attemptId } }))!, fresh: false };

    const order: string[] = JSON.parse(attempt.questionOrder);
    const [questions, answers] = await Promise.all([
      tx.question.findMany({ where: { id: { in: order } } }),
      tx.studentAnswer.findMany({ where: { attemptId } }),
    ]);
    const qById = new Map(questions.map((q) => [q.id, q]));
    const aById = new Map(answers.map((a) => [a.questionId, a.selectedAnswer]));
    const result = gradeAnswers(
      order.map((id) => {
        const q = qById.get(id)!;
        return { questionId: id, correctAnswer: q.correctAnswer, questionType: q.questionType, answerData: q.answerData, topic: q.topic, difficulty: q.difficulty, selected: aById.get(id) ?? null };
      }),
    );
    for (const pq of result.perQuestion) {
      await tx.studentAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId: pq.questionId } },
        update: { isCorrect: pq.isCorrect },
        create: { attemptId, questionId: pq.questionId, selectedAnswer: null, isCorrect: null },
      });
    }
    const updated = await tx.testAttempt.update({
      where: { id: attemptId },
      data: {
        score: result.score,
        correctCount: result.correct,
        incorrectCount: result.incorrect,
        unansweredCount: result.unanswered,
        timeUsedSec: timeUsedSeconds(attempt.startedAt, now, attempt.expiresAt),
      },
    });
    await recordSkillEvents(
      order.map((id) => {
        const q = qById.get(id)!;
        const pq = result.perQuestion.find((x) => x.questionId === id)!;
        return { skillId: q.skill, topic: q.topic, isCorrect: pq.isCorrect === true, source: 'TEST' as const, sessionKey: attemptId, tier: q.difficulty };
      }),
      tx,
      attempt.studentId,
    );
    return { attempt: updated, fresh: true };
  }, { timeout: 30000, maxWait: 10000 });
}

export async function submitAttempt(attemptId: string, studentId = STUDENT_ID) {
  const owned = await prisma.testAttempt.findFirst({ where: { id: attemptId, studentId } });
  if (!owned) throw new AppError('Test not found.', 404);
  const a = await finalizeAttempt(attemptId);
  return { attemptId: a.id, status: a.status, score: a.score };
}

export async function getAttemptResult(attemptId: string, studentId = STUDENT_ID) {
  const attempt = await prisma.testAttempt.findUnique({ where: { id: attemptId }, include: { bank: { select: { name: true, version: true } } } });
  if (!attempt || attempt.studentId !== studentId) throw new AppError('Result not found.', 404, 'NOT_FOUND');
  if (attempt.status === 'IN_PROGRESS') throw new AppError('This test is still in progress.', 409, 'IN_PROGRESS');
  const order: string[] = JSON.parse(attempt.questionOrder);
  const [questions, answers, previous] = await Promise.all([
    prisma.question.findMany({ where: { id: { in: order } } }),
    prisma.studentAnswer.findMany({ where: { attemptId } }),
    prisma.testAttempt.findMany({ where: { studentId: attempt.studentId, testNumber: attempt.testNumber, status: { not: 'IN_PROGRESS' } }, orderBy: { startedAt: 'asc' } }),
  ]);
  const qById = new Map(questions.map((q) => [q.id, q]));
  const aById = new Map(answers.map((a) => [a.questionId, a.selectedAnswer]));
  const items = order.map((id, i) => {
    const q = qById.get(id)!;
    const sel = aById.get(id) ?? null;
    return { number: i + 1, q, selected: sel, status: sel === null ? ('unanswered' as const) : isResponseCorrect(q, sel) ? ('correct' as const) : ('incorrect' as const) };
  });
  const grade = gradeAnswers(items.map((it) => ({ questionId: it.q.id, correctAnswer: it.q.correctAnswer, questionType: it.q.questionType, answerData: it.q.answerData, topic: it.q.topic, difficulty: it.q.difficulty, selected: it.selected })));
  const idx = previous.findIndex((p) => p.id === attemptId);
  const earlier = previous.slice(0, idx);
  const prev = idx > 0 ? previous[idx - 1] : null;
  const priorBest = earlier.reduce((m, p) => Math.max(m, p.score ?? 0), -1);
  return {
    attempt,
    items,
    grade,
    history: previous.map((p, i) => ({ id: p.id, n: i + 1, score: p.score ?? 0, date: p.startedAt.toISOString(), timeUsedSec: p.timeUsedSec ?? 0 })),
    previousScore: prev?.score ?? null,
    improvement: prev ? (attempt.score ?? 0) - (prev.score ?? 0) : null,
    isPersonalBest: earlier.length > 0 && (attempt.score ?? 0) > priorBest,
    firstAttempt: earlier.length === 0,
  };
}

export async function listTestSummaries(studentId = STUDENT_ID) {
  const bank = await getActiveBank(studentId);
  const attempts = await prisma.testAttempt.findMany({ where: { studentId }, orderBy: { startedAt: 'asc' } });
  const tests = bank ? await prisma.test.findMany({ where: { bankId: bank.id }, orderBy: { testNumber: 'asc' } }) : [];
  return tests.map((t) => {
    const mine = attempts.filter((a) => a.testNumber === t.testNumber);
    const done = mine.filter((a) => a.status !== 'IN_PROGRESS');
    const open = mine.find((a) => a.status === 'IN_PROGRESS' && !isExpired(a.expiresAt));
    const latest = done[done.length - 1];
    return {
      testNumber: t.testNumber,
      level: t.level,
      title: t.title,
      timeLimitSec: t.timeLimitSec,
      attempts: done.length,
      latestScore: latest?.score ?? null,
      latestAttemptId: latest?.id ?? null,
      bestScore: done.length ? Math.max(...done.map((a) => a.score ?? 0)) : null,
      inProgressId: open?.id ?? null,
    };
  });
}
