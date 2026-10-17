import { prisma } from '../db';
import { Rng } from '../gen/rng';
import { SKILLS, skillInfo, templatesForSkill } from '../gen/registry';
import { buildFromTemplate } from '../gen/engine';
import type { GeneratedQuestion, Tier } from '../gen/types';
import { planSession, SESSION_SIZE, type SkillSnapshot } from '../learning/planner';
import { getLearningConfig, STUDENT_ID } from './core';
import { recordSkillEvents } from './skills';
import { AppError } from './attempts';
import { awardForReviewAnswer, weakSkillIds, type XpAward } from './xp';

const RECENT_FINGERPRINTS = 200;

async function recentFingerprints(studentId: string): Promise<Set<string>> {
  const rows = await prisma.reviewQuestion.findMany({
    where: { session: { studentId } },
    orderBy: { session: { startedAt: 'desc' } },
    take: RECENT_FINGERPRINTS,
    select: { fingerprint: true },
  });
  return new Set(rows.map((r) => r.fingerprint));
}

export function generateForSkill(skillId: string, tier: Tier, avoid: Set<string>, seed: string): GeneratedQuestion {
  const templates = templatesForSkill(skillId);
  if (!templates.length) throw new AppError('There is no practice generator for this skill yet.', 404, 'NO_GENERATOR');
  const fits = templates.filter((t) => t.tiers[0] <= tier && tier <= t.tiers[1]);
  const pool = fits.length ? fits : templates;
  let last: unknown;
  for (let i = 0; i < 40; i++) {
    const rng = new Rng(`${seed}|${skillId}|${i}`);
    const t = pool[rng.int(0, pool.length - 1)];
    try {
      const q = buildFromTemplate(t, rng, tier);
      if (avoid.has(q.fingerprint)) continue;
      return q;
    } catch (e) {
      last = e;
    }
  }
  if (last) throw last;
  // Everything recently used: allow a repeat rather than failing.
  const rng = new Rng(`${seed}|${skillId}|fallback`);
  return buildFromTemplate(pool[0], rng, tier);
}

function payload(q: GeneratedQuestion) {
  return JSON.stringify({
    text: q.text,
    options: q.options,
    correct: q.correct,
    explanation: q.explanation,
    commonMistake: q.commonMistake,
    learningTip: q.learningTip,
    topic: q.topic,
    templateId: q.templateId,
    verifyExpr: q.verifyExpr,
  });
}

async function snapshots(studentId: string): Promise<SkillSnapshot[]> {
  const rows = await prisma.skillProgress.findMany({ where: { studentId } });
  const now = Date.now();
  return rows
    .filter((r) => skillInfo(r.skillId))
    .map((r) => ({
      skillId: r.skillId,
      topic: r.topic,
      recentAccuracy: r.recentAccuracy,
      recentWrong: Math.round((r.recentCount ?? 0) * (1 - (r.recentAccuracy ?? 1))),
      totalAttempts: r.totalAttempts,
      due: !!r.nextReviewDate && r.nextReviewDate.getTime() <= now,
      lastTier: r.lastTier,
    }));
}

/** “Practice My Mistakes”: build a 10-question personalised session. */
export async function createSmartSession(studentId = STUDENT_ID) {
  const snaps = await snapshots(studentId);
  const plan = planSession(snaps, SKILLS.map((s) => ({ skillId: s.id, topic: s.topic })), Math.random, SESSION_SIZE);
  const avoid = await recentFingerprints(studentId);
  const seed = `smart-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const qs: { item: (typeof plan)[number]; q: GeneratedQuestion }[] = [];
  for (const item of plan) {
    const q = generateForSkill(item.skillId, item.tier, avoid, `${seed}|${qs.length}`);
    avoid.add(q.fingerprint);
    qs.push({ item, q });
  }
  const session = await prisma.reviewSession.create({
    data: {
      studentId,
      kind: 'SMART',
      total: qs.length,
      questions: {
        create: qs.map(({ item, q }, i) => ({
          position: i + 1,
          skillId: item.skillId,
          tier: item.tier,
          generatedQuestionData: payload(q),
          fingerprint: q.fingerprint,
          correctAnswer: q.correct,
          explanation: q.explanation,
        })),
      },
    },
  });
  return session.id;
}

/** “Try a Similar Question”: one fresh question on the same skill as a missed official question. */
export async function createSimilarSession(sourceQuestionId: string, tierOverride?: number, studentId = STUDENT_ID) {
  const src = await prisma.question.findUnique({ where: { id: sourceQuestionId } });
  const allowed = src && await prisma.questionBank.findFirst({ where: { id: src.bankId, OR: [{ ownerId: null, status: 'PUBLISHED' }, { ownerId: studentId, status: 'PUBLISHED' }, { attempts: { some: { studentId, status: { not: 'IN_PROGRESS' } } } }] } });
  if (!src || !allowed) throw new AppError('Question not found.', 404, 'NOT_FOUND');
  if (!skillInfo(src.skill)) throw new AppError('There is no practice generator for this skill yet.', 404, 'NO_GENERATOR');
  const tier = Math.min(5, Math.max(1, tierOverride ?? src.difficulty)) as Tier;
  const avoid = await recentFingerprints(studentId);
  avoid.add(`${src.questionText.replace(/\s+/g, ' ').trim().toLowerCase()}|`);
  const q = generateForSkill(src.skill, tier, avoid, `similar-${Date.now()}-${Math.floor(Math.random() * 1e9)}`);
  const session = await prisma.reviewSession.create({
    data: {
      studentId,
      kind: 'SIMILAR',
      total: 1,
      sourceQuestionId,
      questions: { create: [{ position: 1, skillId: src.skill, tier, generatedQuestionData: payload(q), fingerprint: q.fingerprint, correctAnswer: q.correct, explanation: q.explanation }] },
    },
  });
  return session.id;
}

export async function getReviewSession(sessionId: string, studentId = STUDENT_ID) {
  const s = await prisma.reviewSession.findUnique({ where: { id: sessionId }, include: { questions: { orderBy: { position: 'asc' } } } });
  if (!s || s.studentId !== studentId) throw new AppError('Practice session not found.', 404, 'NOT_FOUND');
  return {
    id: s.id,
    kind: s.kind,
    total: s.total,
    completed: !!s.completedAt,
    score: s.score,
    sourceQuestionId: s.sourceQuestionId,
    questions: s.questions.map((q) => {
      const d = JSON.parse(q.generatedQuestionData) as { text: string; options: string[]; commonMistake: string; learningTip: string; topic: string };
      const answered = q.selectedAnswer !== null;
      return {
        id: q.id,
        position: q.position,
        skillId: q.skillId,
        skillLabel: skillInfo(q.skillId)?.label ?? q.skillId,
        topic: d.topic,
        tier: q.tier,
        text: d.text,
        options: d.options,
        selected: q.selectedAnswer,
        // answers are only revealed once the child has answered
        correct: answered ? q.correctAnswer : null,
        isCorrect: q.isCorrect,
        explanation: answered ? q.explanation : null,
        commonMistake: answered ? d.commonMistake : null,
        learningTip: answered ? d.learningTip : null,
      };
    }),
  };
}

export async function answerReviewQuestion(reviewQuestionId: string, selected: string, studentId = STUDENT_ID) {
  if (!['A', 'B', 'C', 'D'].includes(selected)) throw new AppError('Please choose A, B, C or D.');
  const weak = await weakSkillIds(prisma, studentId);
  const result = await prisma.$transaction(async (tx) => {
    const q = await tx.reviewQuestion.findUnique({ where: { id: reviewQuestionId }, include: { session: true } });
    if (!q || q.session.studentId !== studentId) throw new AppError('Question not found.', 404, 'NOT_FOUND');
    const d = JSON.parse(q.generatedQuestionData) as { commonMistake: string; learningTip: string; topic: string };
    const reveal = (sel: string, ok: boolean) => ({ selected: sel, isCorrect: ok, correct: q.correctAnswer, explanation: q.explanation, commonMistake: d.commonMistake, learningTip: d.learningTip });
    if (q.selectedAnswer !== null) return { alreadyAnswered: true, ...reveal(q.selectedAnswer, q.isCorrect === true), sessionCompleted: !!q.session.completedAt, award: null as null | { correct: boolean; kind: string; sourceQuestionId: string | null; sessionId: string; skillId: string } };
    const ok = selected === q.correctAnswer;
    const claim = await tx.reviewQuestion.updateMany({ where: { id: q.id, selectedAnswer: null }, data: { selectedAnswer: selected, isCorrect: ok, answeredAt: new Date() } });
    if (claim.count === 0) {
      const again = (await tx.reviewQuestion.findUnique({ where: { id: q.id } }))!;
      return { alreadyAnswered: true, ...reveal(again.selectedAnswer ?? selected, again.isCorrect === true), sessionCompleted: false, award: null };
    }
    await recordSkillEvents([{ skillId: q.skillId, topic: d.topic, isCorrect: ok, source: 'REVIEW', sessionKey: q.sessionId, tier: q.tier }], tx, q.session.studentId);
    const all = await tx.reviewQuestion.findMany({ where: { sessionId: q.sessionId } });
    const finished = all.every((x) => x.selectedAnswer !== null);
    if (finished) {
      await tx.reviewSession.update({ where: { id: q.sessionId }, data: { completedAt: new Date(), score: all.filter((x) => x.isCorrect).length } });
    }
    return { alreadyAnswered: false, ...reveal(selected, ok), sessionCompleted: finished, award: { correct: ok, kind: q.session.kind, sourceQuestionId: q.session.sourceQuestionId, sessionId: q.sessionId, skillId: q.skillId } };
  }, { timeout: 20000, maxWait: 10000 });
  const { award, ...rest } = result;
  // XP is best effort and runs after the answer is saved.
  let xp: XpAward | null = null;
  if (award) {
    xp = await awardForReviewAnswer({ studentId, reviewQuestionId, sessionId: award.sessionId, skillId: award.skillId, kind: award.kind, sourceQuestionId: award.sourceQuestionId, correct: award.correct, sessionCompleted: rest.sessionCompleted, weak: weak.has(award.skillId) })
      .catch((e) => { console.error('[xp] review award failed', e); return null; });
  }
  return { ...rest, xp };
}

export { getLearningConfig };
