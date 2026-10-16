import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, computeSkillState, intervalDays, masteryFor, type SkillEventLite } from '@/lib/learning/mastery';
import { chooseTier, targetTier } from '@/lib/learning/adaptive';
import { planSession, type SkillSnapshot } from '@/lib/learning/planner';

const day = 86_400_000;
const t0 = new Date('2026-03-01T09:00:00Z').getTime();
const ev = (ok: boolean, session: string, dayOffset = 0): SkillEventLite => ({ isCorrect: ok, sessionKey: session, createdAt: new Date(t0 + dayOffset * day) });

describe('mastery', () => {
  it('uses the specified thresholds', () => {
    expect(masteryFor(0.4, 5, 2)).toBe('NEEDS_PRACTICE');
    expect(masteryFor(0.5, 5, 2)).toBe('DEVELOPING');
    expect(masteryFor(0.69, 5, 2)).toBe('DEVELOPING');
    expect(masteryFor(0.7, 5, 2)).toBe('IMPROVING');
    expect(masteryFor(0.84, 5, 2)).toBe('IMPROVING');
    expect(masteryFor(0.85, 5, 2)).toBe('MASTERED');
  });
  it('needs enough data and evidence for Mastered', () => {
    expect(masteryFor(1, 2, 1)).toBe('NOT_ENOUGH_DATA');
    expect(masteryFor(null, 0, 0)).toBe('NOT_ENOUGH_DATA');
    expect(masteryFor(1, 4, 2)).toBe('IMPROVING'); // fewer than 5 attempts
    expect(masteryFor(1, 6, 1)).toBe('IMPROVING'); // only one session
    expect(masteryFor(1, 5, 2)).toBe('MASTERED');
  });
  it('only looks at the latest 10 attempts', () => {
    const events = [...Array.from({ length: 10 }, (_, i) => ev(false, `old${i % 2}`, i)), ...Array.from({ length: 10 }, (_, i) => ev(true, `new${i % 2}`, 20 + i))];
    const s = computeSkillState(events);
    expect(s.recentCount).toBe(10);
    expect(s.recentAccuracy).toBe(1);
    expect(s.totalAttempts).toBe(20);
    expect(s.mastery).toBe('MASTERED');
  });
  it('counts separate sessions', () => {
    const one = computeSkillState([1, 2, 3, 4, 5].map((i) => ev(true, 'a', i)));
    expect(one.sessionCount).toBe(1);
    expect(one.mastery).toBe('IMPROVING');
    const two = computeSkillState([...[1, 2, 3].map((i) => ev(true, 'a', i)), ...[4, 5].map((i) => ev(true, 'b', i))]);
    expect(two.mastery).toBe('MASTERED');
  });
});

describe('spaced review', () => {
  it('uses 0 / 1 / 3 / 7 day intervals by default', () => {
    expect([0, 1, 2, 3, 5].map((n) => intervalDays(n))).toEqual([0, 1, 3, 7, 7]);
  });
  it('schedules the next review from the last attempt', () => {
    const wrong = computeSkillState([ev(false, 'a')]);
    expect(wrong.nextReviewDate!.getTime()).toBe(t0);
    const once = computeSkillState([ev(true, 'a')]);
    expect(once.nextReviewDate!.getTime()).toBe(t0 + day);
    const twice = computeSkillState([ev(true, 'a'), ev(true, 'b', 1)]);
    expect(twice.streakSessions).toBe(2);
    expect(twice.nextReviewDate!.getTime()).toBe(t0 + day + 3 * day);
    const many = computeSkillState([ev(true, 'a'), ev(true, 'b', 1), ev(true, 'c', 5)]);
    expect(many.nextReviewDate!.getTime()).toBe(t0 + 5 * day + 7 * day);
  });
  it('a mistake resets the streak', () => {
    const s = computeSkillState([ev(true, 'a'), ev(true, 'b', 1), ev(false, 'c', 2)]);
    expect(s.streakSessions).toBe(0);
    expect(s.nextReviewDate!.getTime()).toBe(t0 + 2 * day);
  });
  it('intervals are configurable', () => {
    const cfg = { ...DEFAULT_CONFIG, intervals: { afterIncorrect: 0, afterCorrectOnce: 2, afterCorrectTwice: 4, afterConsistent: 10 } };
    expect(intervalDays(1, cfg)).toBe(2);
    expect(intervalDays(3, cfg)).toBe(10);
  });
});

describe('adaptive difficulty', () => {
  it('maps accuracy bands to tiers', () => {
    expect([0.2, 0.49, 0.5, 0.69, 0.7, 0.84, 0.85, 1].map(targetTier)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect(targetTier(null)).toBe(2);
  });
  it('changes difficulty gradually', () => {
    expect(chooseTier(0.95, 2)).toBe(3);
    expect(chooseTier(0.95, 3)).toBe(4);
    expect(chooseTier(0.2, 4)).toBe(3);
    expect(chooseTier(0.2, 1)).toBe(1);
  });
  it('first practice on a skill starts at a moderate level', () => {
    expect(chooseTier(0.95, null)).toBe(3);
    expect(chooseTier(0.3, null)).toBe(1);
  });
});

describe('session planner', () => {
  const snap = (id: string, acc: number, wrong: number, over: Partial<SkillSnapshot> = {}): SkillSnapshot => ({ skillId: id, topic: 'T', recentAccuracy: acc, recentWrong: wrong, totalAttempts: 6, due: false, lastTier: null, ...over });
  const catalog = Array.from({ length: 30 }, (_, i) => ({ skillId: `c${i}`, topic: 'T' }));
  it('creates 10 questions and prioritises weak skills with repeated mistakes', () => {
    const plan = planSession([snap('fr', 0.3, 5), snap('geo', 0.5, 3), snap('dec', 0.8, 1), snap('wn', 0.95, 0)], catalog, () => 0.5);
    expect(plan).toHaveLength(10);
    const counts = new Map<string, number>();
    for (const p of plan) counts.set(p.skillId, (counts.get(p.skillId) ?? 0) + 1);
    expect(counts.get('fr')!).toBeGreaterThanOrEqual(counts.get('dec') ?? 0);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(3);
    expect(counts.get('wn') ?? 0).toBeLessThanOrEqual(1);
  });
  it('starts with approachable questions and ramps up', () => {
    const plan = planSession([snap('a', 0.3, 5), snap('b', 0.6, 3), snap('c', 0.75, 2), snap('d', 0.9, 0, { due: true })], catalog, () => 0.5);
    const tiers = plan.map((p) => p.tier);
    expect(tiers).toEqual([...tiers].sort((x, y) => x - y));
  });
  it('fills a session for a brand-new student', () => {
    const plan = planSession([], catalog, () => 0.3);
    expect(plan).toHaveLength(10);
    expect(new Set(plan.map((p) => p.skillId)).size).toBe(10);
    expect(Math.max(...plan.map((p) => p.tier))).toBeLessThanOrEqual(2);
  });
});
