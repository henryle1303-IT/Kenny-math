// Pure XP rules: no database access, so every rule can be unit-tested.
import type { Lang } from '../i18n';

export interface XpConfig {
  correct: number; // each correct answer
  firstTry: number; // correct the first time the question is seen
  testDone: number; // finishing a test
  testPerfect: number; // 30/30
  reviewDone: number; // finishing a Smart Review session
  fix: number; // correctly answering a question that was wrong before
  repeatDivisor: number; // XP for a question already answered correctly = correct / divisor
  reviewFullPerDay: number; // correct Smart Review answers per day that pay full XP
  reviewReducedXp: number; // XP per correct review answer after that
  streakMinCorrect: number; // correct answers needed to keep the daily streak
  dailyBonus: number; // finishing both daily quests
  weeklyBonus: number; // finishing the weekly challenge
  streakMilestones: Record<string, number>; // streak length -> bonus XP
  features: { streak: boolean; quests: boolean; badges: boolean; shop: boolean };
}

export const DEFAULT_XP_CONFIG: XpConfig = {
  correct: 10,
  firstTry: 5,
  testDone: 20,
  testPerfect: 50,
  reviewDone: 15,
  fix: 15,
  repeatDivisor: 2,
  reviewFullPerDay: 50,
  reviewReducedXp: 2,
  streakMinCorrect: 5,
  dailyBonus: 15,
  weeklyBonus: 30,
  streakMilestones: { '3': 10, '7': 25, '14': 50, '30': 100 },
  features: { streak: true, quests: true, badges: true, shop: false },
};

const int = (v: unknown, fallback: number, min = 0, max = 10000) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : fallback);

/** Merge untrusted stored/submitted JSON over the defaults; invalid values fall back to the defaults. */
export function normalizeXpConfig(raw: unknown): XpConfig {
  const d = DEFAULT_XP_CONFIG;
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const f = (r.features && typeof r.features === 'object' ? r.features : {}) as Record<string, unknown>;
  const milestones: Record<string, number> = {};
  const m = (r.streakMilestones && typeof r.streakMilestones === 'object' ? r.streakMilestones : d.streakMilestones) as Record<string, unknown>;
  for (const [k, v] of Object.entries(m)) if (/^\d{1,3}$/.test(k) && Number(k) >= 2) milestones[k] = int(v, 0, 0, 1000);
  return {
    correct: int(r.correct, d.correct, 0, 1000),
    firstTry: int(r.firstTry, d.firstTry, 0, 1000),
    testDone: int(r.testDone, d.testDone, 0, 1000),
    testPerfect: int(r.testPerfect, d.testPerfect, 0, 1000),
    reviewDone: int(r.reviewDone, d.reviewDone, 0, 1000),
    fix: int(r.fix, d.fix, 0, 1000),
    repeatDivisor: int(r.repeatDivisor, d.repeatDivisor, 1, 100),
    reviewFullPerDay: int(r.reviewFullPerDay, d.reviewFullPerDay, 0, 1000),
    reviewReducedXp: int(r.reviewReducedXp, d.reviewReducedXp, 0, 1000),
    streakMinCorrect: int(r.streakMinCorrect, d.streakMinCorrect, 1, 100),
    dailyBonus: int(r.dailyBonus, d.dailyBonus, 0, 1000),
    weeklyBonus: int(r.weeklyBonus, d.weeklyBonus, 0, 1000),
    streakMilestones: Object.keys(milestones).length ? milestones : d.streakMilestones,
    features: {
      streak: typeof f.streak === 'boolean' ? f.streak : d.features.streak,
      quests: typeof f.quests === 'boolean' ? f.quests : d.features.quests,
      badges: typeof f.badges === 'boolean' ? f.badges : d.features.badges,
      shop: typeof f.shop === 'boolean' ? f.shop : d.features.shop,
    },
  };
}

// ---------- Days (Asia/Ho_Chi_Minh has no daylight saving: UTC+7) ----------
const DAY_MS = 86_400_000;
export const VN_OFFSET_MS = 7 * 3_600_000;

export function dayKey(date: Date): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}
const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
export function addDays(day: string, n: number): string {
  return new Date((dayNumber(day) + n) * DAY_MS).toISOString().slice(0, 10);
}
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}
/** Monday of the week containing `day`. */
export function weekStart(day: string): string {
  const dow = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(day, -dow);
}
/** Start of a VN calendar day as a UTC instant. */
export function dayStart(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) - VN_OFFSET_MS);
}

// ---------- Levels ----------
/** Total XP needed to reach `level` (level 1 starts at 0, level 2 at 100, then each step costs 50 more). */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level)) - 1;
  return 100 * n + 25 * n * (n - 1);
}
export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}
export function levelProgress(xp: number) {
  const level = levelForXp(xp);
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return { level, into: xp - from, need: to - from, pct: Math.min(100, Math.round(((xp - from) / (to - from)) * 100)), nextAt: to };
}

const LEVEL_NAMES: { en: string; vi: string }[] = [
  { en: 'Beginner', vi: 'Tập sự' },
  { en: 'Number Explorer', vi: 'Thám hiểm số' },
  { en: 'Puzzle Solver', vi: 'Giải đố' },
  { en: 'Fraction Fighter', vi: 'Chiến binh phân số' },
  { en: 'Decimal Detective', vi: 'Thám tử số thập phân' },
  { en: 'Geometry Guardian', vi: 'Hiệp sĩ hình học' },
  { en: 'Math Wizard', vi: 'Pháp sư toán học' },
  { en: 'Fraction Wizard', vi: 'Pháp sư phân số' },
  { en: 'Math Champion', vi: 'Nhà vô địch toán' },
  { en: 'Math Legend', vi: 'Huyền thoại toán học' },
];
export function levelName(level: number, lang: Lang): string {
  const n = LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length) - 1];
  return level > LEVEL_NAMES.length ? `${n[lang]} ${level - LEVEL_NAMES.length + 1}` : n[lang];
}

// ---------- Streak ----------
export interface StreakState {
  streak: number;
  bestStreak: number;
  freezes: number;
  freezeMark: number;
  lastStudyDay: string | null;
}
export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;

export interface StreakResult extends StreakState {
  changed: boolean;
  freezesUsed: number;
  freezeGained: boolean;
  milestone: number | null; // streak length reached, if it is a milestone
}

/** The student reached the daily goal on `today`: extend, protect or restart the streak. */
export function advanceStreak(s: StreakState, today: string, milestones: Record<string, number> = DEFAULT_XP_CONFIG.streakMilestones): StreakResult {
  if (s.lastStudyDay === today) return { ...s, changed: false, freezesUsed: 0, freezeGained: false, milestone: null };
  let streak: number;
  let freezes = s.freezes;
  let freezeMark = s.freezeMark;
  let freezesUsed = 0;
  if (!s.lastStudyDay) {
    streak = 1;
  } else {
    const missed = Math.max(0, daysBetween(s.lastStudyDay, today) - 1);
    if (missed === 0) streak = s.streak + 1;
    else if (missed <= freezes) { freezes -= missed; freezesUsed = missed; streak = s.streak + 1; }
    else { streak = 1; freezeMark = 0; }
  }
  let freezeGained = false;
  if (streak - freezeMark >= FREEZE_EVERY) {
    freezeMark = streak;
    if (freezes < MAX_FREEZES) { freezes++; freezeGained = true; }
  }
  return {
    streak, bestStreak: Math.max(s.bestStreak, streak), freezes, freezeMark, lastStudyDay: today,
    changed: true, freezesUsed, freezeGained, milestone: milestones[String(streak)] !== undefined ? streak : null,
  };
}

/** Streak to display today: still alive when the missed days can be covered by freezes. */
export function effectiveStreak(s: StreakState, today: string): { streak: number; atRisk: boolean } {
  if (!s.lastStudyDay || s.streak === 0) return { streak: 0, atRisk: false };
  const gap = daysBetween(s.lastStudyDay, today);
  if (gap <= 0) return { streak: s.streak, atRisk: false };
  const missed = gap - 1;
  if (missed <= s.freezes) return { streak: s.streak, atRisk: true };
  return { streak: 0, atRisk: false };
}

// ---------- Quests ----------
export interface DayActivity {
  answered: number;
  correct: number;
  fixed: number;
  weakCorrect: number;
  smartSessions: number;
  tests: number;
}
export const EMPTY_DAY: DayActivity = { answered: 0, correct: 0, fixed: 0, weakCorrect: 0, smartSessions: 0, tests: 0 };

export type DailyQuestKey = 'correct5' | 'smart' | 'fix2' | 'weak3';
export type WeeklyQuestKey = 'days3' | 'test1';
export interface QuestDef { kind: 'DAILY' | 'WEEKLY'; key: string; target: number; text: { en: string; vi: string } }

/** Two small daily quests: a fixed one and one that rotates by day. */
export function dailyQuests(day: string, cfg: XpConfig, hasMistakes: boolean): QuestDef[] {
  const rotating: DailyQuestKey[] = hasMistakes ? ['smart', 'fix2', 'weak3'] : ['smart', 'weak3'];
  const pick = rotating[((dayNumber(day) % rotating.length) + rotating.length) % rotating.length];
  const n = cfg.streakMinCorrect;
  return [{ kind: 'DAILY', key: 'correct5', target: n, text: questText('correct5', n) }, { kind: 'DAILY', key: pick, target: ROTATING_TARGET[pick], text: questText(pick, ROTATING_TARGET[pick]) }];
}

const ROTATING_TARGET: Record<string, number> = { smart: 1, fix2: 2, weak3: 3 };
function questText(key: string, n: number): { en: string; vi: string } {
  switch (key) {
    case 'correct5': return { en: `Answer ${n} questions correctly`, vi: `Trả lời đúng ${n} câu` };
    case 'smart': return { en: 'Finish 1 Smart Review', vi: 'Hoàn thành 1 phiên Ôn tập thông minh' };
    case 'fix2': return { en: 'Fix 2 questions you got wrong before', vi: 'Sửa đúng 2 câu từng làm sai' };
    case 'weak3': return { en: 'Get 3 right on a skill you find tricky', vi: 'Làm đúng 3 câu ở kỹ năng còn yếu' };
    case 'days3': return { en: 'Practise on 3 different days this week', vi: 'Học 3 ngày khác nhau trong tuần' };
    case 'test1': return { en: 'Finish 1 test this week', vi: 'Làm xong 1 bài kiểm tra trong tuần' };
    default: return { en: key, vi: key };
  }
}
/** Localised text of a quest, for display. */
export function questLabel(key: string, target: number, lang: Lang): string {
  return questText(key, target)[lang];
}

export function weeklyQuest(week: string): QuestDef {
  const rotating: WeeklyQuestKey[] = ['days3', 'test1'];
  const pick = rotating[Math.floor(dayNumber(week) / 7) % rotating.length];
  return { kind: 'WEEKLY', key: pick, target: pick === 'days3' ? 3 : 1, text: questText(pick, 0) };
}

export function questProgress(key: string, today: DayActivity, week: DayActivity[]): number {
  switch (key) {
    case 'correct5': return today.correct;
    case 'smart': return today.smartSessions;
    case 'fix2': return today.fixed;
    case 'weak3': return today.weakCorrect;
    case 'days3': return week.filter((d) => d.answered > 0).length;
    case 'test1': return week.reduce((s, d) => s + d.tests, 0);
    default: return 0;
  }
}

// ---------- Badges ----------
export interface BadgeStats {
  totalXp: number;
  level: number;
  bestStreak: number;
  correctTotal: number;
  perfectTests: number;
  testsDone: number;
  fixedTotal: number;
  masteredTopics: number;
  newRecord: boolean; // set only when the triggering test beat the previous best
  weeklyDone: number;
}
export interface BadgeDef { key: string; icon: string; name: { en: string; vi: string }; desc: { en: string; vi: string }; earned: (s: BadgeStats) => boolean }

export const BADGES: BadgeDef[] = [
  { key: 'first_correct', icon: '🌱', name: { en: 'First Step', vi: 'Bước đầu tiên' }, desc: { en: 'Get your first answer right', vi: 'Trả lời đúng câu đầu tiên' }, earned: (s) => s.correctTotal >= 1 },
  { key: 'perfect_test', icon: '💯', name: { en: 'Perfect Score', vi: 'Điểm tuyệt đối' }, desc: { en: 'Score 30/30 on a test', vi: 'Đạt 30/30 trong một bài kiểm tra' }, earned: (s) => s.perfectTests >= 1 },
  { key: 'streak_7', icon: '🔥', name: { en: '7-Day Streak', vi: 'Chuỗi 7 ngày' }, desc: { en: 'Practise 7 days in a row', vi: 'Học liên tiếp 7 ngày' }, earned: (s) => s.bestStreak >= 7 },
  { key: 'streak_30', icon: '🏔️', name: { en: '30-Day Streak', vi: 'Chuỗi 30 ngày' }, desc: { en: 'Practise 30 days in a row', vi: 'Học liên tiếp 30 ngày' }, earned: (s) => s.bestStreak >= 30 },
  { key: 'mistake_hunter', icon: '🎯', name: { en: 'Mistake Hunter', vi: 'Thợ săn lỗi sai' }, desc: { en: 'Fix 20 questions you got wrong before', vi: 'Sửa đúng 20 câu từng làm sai' }, earned: (s) => s.fixedTotal >= 20 },
  { key: 'topic_master', icon: '🎓', name: { en: 'Topic Master', vi: 'Bậc thầy chủ đề' }, desc: { en: '90% or more in a topic (20+ questions)', vi: 'Đạt từ 90% trong một chủ đề (từ 20 câu)' }, earned: (s) => s.masteredTopics >= 1 },
  { key: 'new_record', icon: '🏆', name: { en: 'New Record', vi: 'Kỷ lục mới' }, desc: { en: 'Beat your best score on a test', vi: 'Phá kỷ lục điểm của chính mình' }, earned: (s) => s.newRecord },
  { key: 'tests_5', icon: '📚', name: { en: 'Test Taker', vi: 'Người làm bài' }, desc: { en: 'Finish 5 tests', vi: 'Hoàn thành 5 bài kiểm tra' }, earned: (s) => s.testsDone >= 5 },
  { key: 'level_5', icon: '⭐', name: { en: 'Level 5', vi: 'Cấp 5' }, desc: { en: 'Reach level 5', vi: 'Đạt cấp 5' }, earned: (s) => s.level >= 5 },
  { key: 'level_10', icon: '🌟', name: { en: 'Level 10', vi: 'Cấp 10' }, desc: { en: 'Reach level 10', vi: 'Đạt cấp 10' }, earned: (s) => s.level >= 10 },
  { key: 'weekly_hero', icon: '🗓️', name: { en: 'Weekly Hero', vi: 'Anh hùng của tuần' }, desc: { en: 'Finish a weekly challenge', vi: 'Hoàn thành một thử thách tuần' }, earned: (s) => s.weeklyDone >= 1 },
];

/** 0–3 stars for a topic, from the number of questions answered and the accuracy. */
export function topicStars(total: number, correct: number): 0 | 1 | 2 | 3 {
  if (total <= 0) return 0;
  const acc = correct / total;
  if (total >= 30 && acc >= 0.9) return 3;
  if (total >= 20 && acc >= 0.75) return 2;
  if (total >= 10 && acc >= 0.6) return 1;
  return 0;
}

// ---------- Unlockables ----------
export const AVATARS: { key: string; icon: string; level: number }[] = [
  { key: 'owl', icon: '🦉', level: 1 }, { key: 'cat', icon: '🐱', level: 1 }, { key: 'fox', icon: '🦊', level: 2 },
  { key: 'panda', icon: '🐼', level: 3 }, { key: 'lion', icon: '🦁', level: 4 }, { key: 'rocket', icon: '🚀', level: 5 },
  { key: 'dragon', icon: '🐲', level: 7 }, { key: 'unicorn', icon: '🦄', level: 10 },
];
export const THEMES: { key: string; level: number; from: string; to: string }[] = [
  { key: 'ocean', level: 1, from: 'from-brand-600', to: 'to-brand-800' },
  { key: 'forest', level: 3, from: 'from-emerald-500', to: 'to-teal-700' },
  { key: 'sunset', level: 6, from: 'from-orange-500', to: 'to-rose-600' },
  { key: 'galaxy', level: 9, from: 'from-violet-600', to: 'to-fuchsia-700' },
];

// ---------- Per-question XP ----------
export interface QuestionXpInput {
  correct: boolean;
  seenBefore: boolean; // answered in an earlier test attempt
  correctBefore: boolean; // answered correctly in an earlier attempt
  wrongBefore: boolean; // answered wrongly in an earlier attempt and never correctly
}
export interface QuestionXp { base: number; firstTry: number; fix: number; repeat: boolean }

export function questionXp(q: QuestionXpInput, cfg: XpConfig): QuestionXp {
  if (!q.correct) return { base: 0, firstTry: 0, fix: 0, repeat: false };
  if (q.correctBefore) return { base: Math.floor(cfg.correct / cfg.repeatDivisor), firstTry: 0, fix: 0, repeat: true };
  return { base: cfg.correct, firstTry: q.seenBefore ? 0 : cfg.firstTry, fix: q.wrongBefore ? cfg.fix : 0, repeat: false };
}
