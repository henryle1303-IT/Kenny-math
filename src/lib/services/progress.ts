import { prisma } from '../db';
import { skillLabel } from '../gen/registry';
import { MASTERY_LABELS, type Mastery } from '../learning/mastery';
import { STUDENT_ID } from './core';

export interface SkillRow {
  skillId: string;
  label: string;
  topic: string;
  accuracy: number | null;
  previousAccuracy: number | null;
  attempts: number;
  mastery: Mastery;
  masteryLabel: string;
  due: boolean;
  nextReviewDate: string | null;
}

export async function getSkillRows(studentId = STUDENT_ID): Promise<SkillRow[]> {
  const rows = await prisma.skillProgress.findMany({ where: { studentId } });
  const now = Date.now();
  return rows.map((r) => ({
    skillId: r.skillId,
    label: skillLabel(r.skillId),
    topic: r.topic,
    accuracy: r.recentAccuracy,
    previousAccuracy: r.previousAccuracy,
    attempts: r.totalAttempts,
    mastery: r.masteryStatus as Mastery,
    masteryLabel: MASTERY_LABELS[r.masteryStatus as Mastery] ?? r.masteryStatus,
    due: !!r.nextReviewDate && r.nextReviewDate.getTime() <= now && r.totalAttempts > 0,
    nextReviewDate: r.nextReviewDate?.toISOString() ?? null,
  }));
}

export async function getProgress(studentId = STUDENT_ID) {
  const [attempts, reviews, events, skills] = await Promise.all([
    prisma.testAttempt.findMany({ where: { studentId, status: { not: 'IN_PROGRESS' } }, orderBy: { startedAt: 'asc' } }),
    prisma.reviewSession.findMany({ where: { studentId }, orderBy: { startedAt: 'asc' }, include: { questions: { select: { isCorrect: true, answeredAt: true } } } }),
    prisma.skillEvent.findMany({ where: { studentId }, select: { topic: true, isCorrect: true, source: true } }),
    getSkillRows(studentId),
  ]);
  const smart = reviews.filter((r) => r.kind === 'SMART');
  const reviewQs = reviews.flatMap((r) => r.questions).filter((q) => q.isCorrect !== null);
  const scores = attempts.map((a) => a.score ?? 0);
  const testSeconds = attempts.reduce((s, a) => s + (a.timeUsedSec ?? 0), 0);
  const reviewSeconds = reviews.reduce((s, r) => {
    const times = r.questions.map((q) => q.answeredAt?.getTime()).filter((x): x is number => !!x);
    return s + (times.length ? Math.min(30 * 60, (Math.max(...times) - r.startedAt.getTime()) / 1000) : 0);
  }, 0);

  const topicMap = new Map<string, { total: number; correct: number }>();
  for (const e of events) {
    const t = topicMap.get(e.topic) ?? { total: 0, correct: 0 };
    t.total++;
    if (e.isCorrect) t.correct++;
    topicMap.set(e.topic, t);
  }
  const topics = [...topicMap.entries()].map(([topic, v]) => ({ topic, total: v.total, accuracy: Math.round((v.correct / v.total) * 100) })).sort((a, b) => a.accuracy - b.accuracy);

  const withData = skills.filter((s) => s.accuracy !== null && s.attempts >= 3);
  const strongest = withData.slice().sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0)).slice(0, 3);
  const weakest = withData.slice().sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0)).filter((s) => (s.accuracy ?? 1) < 0.85).slice(0, 3);
  const improved = skills.filter((s) => s.accuracy !== null && s.previousAccuracy !== null && s.accuracy - s.previousAccuracy >= 0.1).sort((a, b) => (b.accuracy! - b.previousAccuracy!) - (a.accuracy! - a.previousAccuracy!)).slice(0, 3);
  const masteryCounts: Record<string, number> = {};
  for (const s of skills) masteryCounts[s.mastery] = (masteryCounts[s.mastery] ?? 0) + 1;

  return {
    testsCompleted: new Set(attempts.map((a) => a.testNumber)).size,
    attemptsCount: attempts.length,
    smartSessions: smart.length,
    questionsAttempted: attempts.reduce((s, a) => s + (a.correctCount ?? 0) + (a.incorrectCount ?? 0), 0) + reviewQs.length,
    averageScore: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
    bestScore: scores.length ? Math.max(...scores) : null,
    latestScore: scores.length ? scores[scores.length - 1] : null,
    recent: attempts.slice(-12).map((a, i) => ({ label: `T${a.testNumber}`, n: i + 1, score: a.score ?? 0, date: a.startedAt.toISOString() })),
    practiceMinutes: Math.round((testSeconds + reviewSeconds) / 60),
    topics,
    skills,
    strongest,
    weakest,
    improved,
    masteryCounts,
    reviewQuestionsDone: reviewQs.length,
    reviewAccuracy: reviewQs.length ? Math.round((reviewQs.filter((q) => q.isCorrect).length / reviewQs.length) * 100) : null,
    reviewTrend: smart.filter((r) => r.completedAt).map((r, i) => ({ n: i + 1, accuracy: Math.round(((r.score ?? 0) / Math.max(1, r.total)) * 100), date: r.startedAt.toISOString() })),
    readyForReview: skills.filter((s) => s.due).sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0)).slice(0, 6),
  };
}

export type Progress = Awaited<ReturnType<typeof getProgress>>;
