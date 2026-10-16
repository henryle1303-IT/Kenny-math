import { chooseTier } from './adaptive';
import type { Tier } from '../gen/types';

export interface SkillSnapshot {
  skillId: string;
  topic: string;
  recentAccuracy: number | null;
  recentWrong: number;
  totalAttempts: number;
  due: boolean;
  lastTier: number | null;
}

export interface PlannedItem {
  skillId: string;
  tier: Tier;
}

export const SESSION_SIZE = 10;
const MAX_PER_SKILL = 3;

export function priority(s: SkillSnapshot): number {
  const acc = s.recentAccuracy ?? 0.5;
  return (1 - acc) * 3 + s.recentWrong * 0.5 + (s.due ? 1 : 0);
}

/**
 * Pick the 10 review items: weak skills first (repeated mistakes weigh more), at most 3 per skill,
 * ordered from approachable to harder questions.
 * `catalog` supplies filler skills for brand-new students (skill id -> topic).
 */
export function planSession(snaps: SkillSnapshot[], catalog: { skillId: string; topic: string }[], rnd: () => number = Math.random, size = SESSION_SIZE): PlannedItem[] {
  const usable = snaps.filter((s) => s.totalAttempts > 0).sort((a, b) => priority(b) - priority(a));
  // Only skills that still need work get weight; mastered & due-free skills drop to the end.
  const needing = usable.filter((s) => s.recentAccuracy === null || s.recentAccuracy < 0.85 || s.due);
  const chosen = (needing.length ? needing : usable).slice(0, Math.max(4, Math.ceil(size / MAX_PER_SKILL)));
  const counts = new Map<string, number>();
  const items: { s: SkillSnapshot | null; skillId: string; tier: Tier }[] = [];

  const add = (skillId: string, s: SkillSnapshot | null) => {
    counts.set(skillId, (counts.get(skillId) ?? 0) + 1);
    const base = s ? chooseTier(s.recentAccuracy, s.lastTier) : 2;
    const n = counts.get(skillId) ?? 1;
    // Within the same skill, later questions are a notch harder (gradual increase), capped at +1.
    const tier = Math.min(5, base + (n >= 3 ? 1 : 0)) as Tier;
    items.push({ s, skillId, tier });
  };

  // First pass: one question for each chosen skill (highest priority first).
  for (const s of chosen) if (items.length < size) add(s.skillId, s);
  // Second pass: extra questions for the highest-priority skills.
  let guard = 0;
  while (items.length < size && chosen.length && guard++ < 100) {
    for (const s of chosen) {
      if (items.length >= size) break;
      if ((counts.get(s.skillId) ?? 0) < MAX_PER_SKILL) add(s.skillId, s);
    }
    if (chosen.every((s) => (counts.get(s.skillId) ?? 0) >= MAX_PER_SKILL)) break;
  }
  // Filler for new students / small histories: spread across the catalog at easy tiers.
  if (items.length < size) {
    const used = new Set(items.map((i) => i.skillId));
    const pool = catalog.filter((c) => !used.has(c.skillId)).map((c) => ({ c, k: rnd() })).sort((a, b) => a.k - b.k);
    for (const { c } of pool) {
      if (items.length >= size) break;
      add(c.skillId, null);
    }
  }
  return items.sort((a, b) => a.tier - b.tier).map((i) => ({ skillId: i.skillId, tier: i.tier }));
}
