import { prisma } from '../db';
import { skillInfo } from '../gen/registry';
import { computeSkillState } from '../learning/mastery';
import { getLearningConfig, STUDENT_ID } from './core';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0] | typeof prisma;

export interface SkillEventInput {
  skillId: string;
  topic: string;
  isCorrect: boolean;
  source: 'TEST' | 'REVIEW';
  sessionKey: string;
  tier: number;
}

export async function recordSkillEvents(events: SkillEventInput[], db: Tx = prisma, studentId = STUDENT_ID) {
  if (!events.length) return;
  await db.skillEvent.createMany({ data: events.map((e) => ({ ...e, studentId })) });
  await recomputeSkills(
    [...new Set(events.map((e) => e.skillId))],
    db,
    studentId,
    new Map(events.map((e) => [e.skillId, e.tier])),
    new Map(events.map((e) => [e.skillId, e.topic])),
    events[0].source === 'REVIEW',
  );
}

export async function recomputeSkills(skillIds: string[], db: Tx = prisma, studentId = STUDENT_ID, tiers = new Map<string, number>(), topics = new Map<string, string>(), reviewTier = false) {
  const cfg = await getLearningConfig(db, studentId);
  for (const skillId of skillIds) {
    const evs = await db.skillEvent.findMany({ where: { studentId, skillId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    const st = computeSkillState(evs, cfg);
    const prev = await db.skillProgress.findUnique({ where: { studentId_skillId: { studentId, skillId } } });
    const topic = topics.get(skillId) ?? prev?.topic ?? skillInfo(skillId)?.topic ?? 'Other';
    const data = {
      topic,
      totalAttempts: st.totalAttempts,
      totalCorrect: st.totalCorrect,
      recentAccuracy: st.recentAccuracy,
      recentCount: st.recentCount,
      sessionCount: st.sessionCount,
      masteryStatus: st.mastery,
      streakSessions: st.streakSessions,
      lastEventAt: st.lastEventAt,
      nextReviewDate: st.nextReviewDate,
      previousAccuracy: prev && prev.recentAccuracy !== st.recentAccuracy ? prev.recentAccuracy : prev?.previousAccuracy ?? null,
      ...(reviewTier && tiers.get(skillId) ? { lastTier: tiers.get(skillId)! } : {}),
    };
    await db.skillProgress.upsert({
      where: { studentId_skillId: { studentId, skillId } },
      update: data,
      create: { studentId, skillId, ...data },
    });
  }
}

export async function listSkillProgress(studentId = STUDENT_ID) {
  return prisma.skillProgress.findMany({ where: { studentId }, orderBy: { skillId: 'asc' } });
}
