import { describe, expect, it } from 'vitest';
import {
  DEFAULT_XP_CONFIG, addDays, advanceStreak, dailyQuests, dayKey, daysBetween, effectiveStreak, levelForXp, levelName, levelProgress, normalizeXpConfig,
  questProgress, questionXp, topicStars, weekStart, weeklyQuest, xpForLevel, EMPTY_DAY, type StreakState,
} from '@/lib/xp/rules';

const cfg = DEFAULT_XP_CONFIG;
const fresh: StreakState = { streak: 0, bestStreak: 0, freezes: 0, freezeMark: 0, lastStudyDay: null };

describe('days in Vietnam time', () => {
  it('rolls the day over at 17:00 UTC', () => {
    expect(dayKey(new Date('2026-10-17T16:59:00Z'))).toBe('2026-10-17');
    expect(dayKey(new Date('2026-10-17T17:00:00Z'))).toBe('2026-10-18');
  });
  it('does date arithmetic and finds the Monday of a week', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(daysBetween('2026-10-17', '2026-10-20')).toBe(3);
    expect(weekStart('2026-10-17')).toBe('2026-10-12'); // Saturday
    expect(weekStart('2026-10-12')).toBe('2026-10-12');
    expect(weekStart('2026-10-18')).toBe('2026-10-12'); // Sunday
  });
});

describe('levels', () => {
  it('grows each step by 50 XP', () => {
    expect([1, 2, 3, 4].map(xpForLevel)).toEqual([0, 100, 250, 450]);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(449)).toBe(3);
    expect(levelForXp(450)).toBe(4);
  });
  it('reports progress inside a level and names levels in both languages', () => {
    expect(levelProgress(175)).toMatchObject({ level: 2, into: 75, need: 150, pct: 50 });
    expect(levelName(1, 'vi')).toBe('Tập sự');
    expect(levelName(2, 'en')).toBe('Number Explorer');
    expect(levelName(12, 'en')).toBe('Math Legend 3');
  });
});

describe('streak', () => {
  it('starts, extends and ignores a second goal on the same day', () => {
    const a = advanceStreak(fresh, '2026-10-17');
    expect(a).toMatchObject({ streak: 1, bestStreak: 1, changed: true });
    const same = advanceStreak(a, '2026-10-17');
    expect(same.changed).toBe(false);
    expect(advanceStreak(a, '2026-10-18').streak).toBe(2);
  });
  it('flags the milestone days', () => {
    let s: StreakState = fresh;
    const hits: number[] = [];
    for (let i = 0; i < 8; i++) { const r = advanceStreak(s, addDays('2026-10-01', i)); s = r; if (r.milestone) hits.push(r.milestone); }
    expect(hits).toEqual([3, 7]);
  });
  it('grants a shield every 7 days (max 2) and uses it for a missed day', () => {
    let s: StreakState = fresh;
    for (let i = 0; i < 7; i++) s = advanceStreak(s, addDays('2026-10-01', i));
    expect(s.freezes).toBe(1);
    const saved = advanceStreak(s, '2026-10-09'); // 2026-10-07 was the last day; missed 10-08
    expect(saved).toMatchObject({ streak: 8, freezes: 0, freezesUsed: 1 });
    const broken = advanceStreak(saved, '2026-10-12'); // missed two days, no shield
    expect(broken.streak).toBe(1);
    let long: StreakState = fresh;
    for (let i = 0; i < 30; i++) long = advanceStreak(long, addDays('2026-10-01', i));
    expect(long.freezes).toBe(2);
  });
  it('shows today’s streak as alive only while shields can cover the gap', () => {
    const s: StreakState = { streak: 5, bestStreak: 5, freezes: 1, freezeMark: 0, lastStudyDay: '2026-10-10' };
    expect(effectiveStreak(s, '2026-10-10')).toEqual({ streak: 5, atRisk: false });
    expect(effectiveStreak(s, '2026-10-11')).toEqual({ streak: 5, atRisk: true });
    expect(effectiveStreak(s, '2026-10-12')).toEqual({ streak: 5, atRisk: true }); // one shield covers one missed day
    expect(effectiveStreak(s, '2026-10-13')).toEqual({ streak: 0, atRisk: false });
  });
});

describe('quests', () => {
  it('gives two small daily quests and skips the mistake quest when there are no mistakes', () => {
    const q = dailyQuests('2026-10-17', cfg, true);
    expect(q).toHaveLength(2);
    expect(q[0]).toMatchObject({ key: 'correct5', target: 5 });
    const keys = new Set([0, 1, 2, 3, 4, 5].map((i) => dailyQuests(addDays('2026-10-17', i), cfg, false)[1].key));
    expect(keys.has('fix2')).toBe(false);
    expect(new Set([0, 1, 2].map((i) => dailyQuests(addDays('2026-10-17', i), cfg, true)[1].key)).size).toBe(3);
  });
  it('measures progress from the day’s activity', () => {
    const day = { ...EMPTY_DAY, correct: 3, smartSessions: 1, fixed: 2, weakCorrect: 1 };
    expect(questProgress('correct5', day, [day])).toBe(3);
    expect(questProgress('smart', day, [day])).toBe(1);
    expect(questProgress('fix2', day, [day])).toBe(2);
    expect(questProgress('weak3', day, [day])).toBe(1);
    expect(questProgress('days3', day, [{ ...EMPTY_DAY, answered: 2 }, { ...EMPTY_DAY, answered: 0 }, { ...EMPTY_DAY, answered: 9 }])).toBe(2);
    expect(questProgress('test1', day, [{ ...EMPTY_DAY, tests: 1 }, { ...EMPTY_DAY, tests: 2 }])).toBe(3);
    expect(['days3', 'test1']).toContain(weeklyQuest('2026-10-12').key);
  });
});

describe('question XP', () => {
  it('pays full XP the first time and half for repeats, with a bonus for fixing a mistake', () => {
    const base = { correct: true, seenBefore: false, correctBefore: false, wrongBefore: false };
    expect(questionXp(base, cfg)).toEqual({ base: 10, firstTry: 5, fix: 0, repeat: false });
    expect(questionXp({ ...base, seenBefore: true, wrongBefore: true }, cfg)).toEqual({ base: 10, firstTry: 0, fix: 15, repeat: false });
    expect(questionXp({ ...base, seenBefore: true, correctBefore: true }, cfg)).toEqual({ base: 5, firstTry: 0, fix: 0, repeat: true });
    expect(questionXp({ ...base, correct: false }, cfg)).toEqual({ base: 0, firstTry: 0, fix: 0, repeat: false });
  });
});

describe('config and stars', () => {
  it('falls back to defaults for invalid values', () => {
    const c = normalizeXpConfig({ correct: -4, firstTry: 'x', repeatDivisor: 0, features: { shop: true, streak: 'no' }, streakMilestones: { '5': 20, bad: 3 } });
    expect(c.correct).toBe(10);
    expect(c.firstTry).toBe(5);
    expect(c.repeatDivisor).toBe(2);
    expect(c.features).toEqual({ streak: true, quests: true, badges: true, shop: true });
    expect(c.streakMilestones).toEqual({ '5': 20 });
    expect(normalizeXpConfig(null)).toEqual(DEFAULT_XP_CONFIG);
  });
  it('awards 0–3 stars by volume and accuracy', () => {
    expect(topicStars(0, 0)).toBe(0);
    expect(topicStars(10, 6)).toBe(1);
    expect(topicStars(20, 15)).toBe(2);
    expect(topicStars(30, 27)).toBe(3);
    expect(topicStars(30, 20)).toBe(1);
  });
});
