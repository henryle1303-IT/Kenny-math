import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { AppError } from './attempts';
import {
  AVATARS, BADGES, DEFAULT_XP_CONFIG, EMPTY_DAY, THEMES, addDays, advanceStreak, dailyQuests, dayKey, effectiveStreak, levelForXp, levelProgress,
  normalizeXpConfig, questProgress, questionXp, topicStars, weekStart, weeklyQuest,
  type BadgeStats, type DayActivity, type StreakState, type XpConfig,
} from '../xp/rules';

type Db = Prisma.TransactionClient;
const CONFIG_KEY = 'xpConfig';
const EARNED_SOURCES = ['TEST', 'REVIEW', 'QUEST', 'STREAK', 'BACKFILL', 'ADMIN'];

export async function getXpConfig(db: Pick<Db, 'setting'> = prisma): Promise<XpConfig> {
  const row = await db.setting.findUnique({ where: { key: CONFIG_KEY } });
  if (!row) return DEFAULT_XP_CONFIG;
  try { return normalizeXpConfig(JSON.parse(row.value)); } catch { return DEFAULT_XP_CONFIG; }
}

export async function saveXpConfig(value: unknown): Promise<XpConfig> {
  if (!value || typeof value !== 'object') throw new AppError('Invalid XP settings.');
  const cfg = normalizeXpConfig(value);
  await prisma.setting.upsert({ where: { key: CONFIG_KEY }, create: { key: CONFIG_KEY, value: JSON.stringify(cfg) }, update: { value: JSON.stringify(cfg) } });
  return cfg;
}

// ---------- Ledger ----------
export interface AwardEntry {
  amount: number;
  source: 'TEST' | 'REVIEW' | 'QUEST' | 'STREAK' | 'BACKFILL' | 'ADMIN';
  reason: string;
  refKey: string;
  fixed?: number; // counted in today's activity only when the entry is newly applied
  at?: Date;
}

/** Insert the entries that are not in the ledger yet; returns the ones that were applied. */
async function applyEntries(db: Db, studentId: string, entries: AwardEntry[], when: Date): Promise<AwardEntry[]> {
  const applied: AwardEntry[] = [];
  for (const e of entries) {
    if (e.amount === 0) continue;
    const exists = await db.xpLedger.findUnique({ where: { studentId_refKey: { studentId, refKey: e.refKey } }, select: { id: true } });
    if (exists) continue;
    const at = e.at ?? when;
    await db.xpLedger.create({ data: { studentId, amount: e.amount, source: e.source, reason: e.reason, refKey: e.refKey, day: dayKey(at), createdAt: at } });
    applied.push(e);
  }
  return applied;
}

export async function ledgerTotals(db: Db, studentId: string) {
  const [earned, spent] = await Promise.all([
    db.xpLedger.aggregate({ where: { studentId, source: { in: EARNED_SOURCES } }, _sum: { amount: true } }),
    db.xpLedger.aggregate({ where: { studentId, source: 'REDEEM' }, _sum: { amount: true } }),
  ]);
  return { totalXp: Math.max(0, earned._sum.amount ?? 0), spentXp: -(spent._sum.amount ?? 0) };
}

// ---------- Backfill (history -> XP) ----------
export interface BackfillPlan {
  totalXp: number;
  level: number;
  streak: number;
  bestStreak: number;
  lastStudyDay: string | null;
  attempts: number;
  reviewSessions: number;
  entries: AwardEntry[];
}

async function planBackfill(db: Db, studentId: string, cfg: XpConfig, exclude: Set<string>) {
  const [attempts, sessions, live] = await Promise.all([
    db.testAttempt.findMany({ where: { studentId, status: { not: 'IN_PROGRESS' } }, orderBy: { startedAt: 'asc' } }),
    db.reviewSession.findMany({ where: { studentId }, include: { questions: { select: { isCorrect: true, answeredAt: true } } }, orderBy: { startedAt: 'asc' } }),
    db.xpLedger.findMany({ where: { studentId, OR: [{ refKey: { startsWith: 'test:' } }, { refKey: { startsWith: 'rq:' } }, { refKey: { startsWith: 'rs:' } }] }, select: { refKey: true } }),
  ]);
  const liveAttempts = new Set(live.filter((l) => l.refKey.startsWith('test:')).map((l) => l.refKey.split(':')[1]));
  const entries: AwardEntry[] = [];
  const days = new Map<string, DayActivity & { xp: number }>();
  const day = (d: string) => days.get(d) ?? days.set(d, { ...EMPTY_DAY, xp: 0 }).get(d)!;
  let attemptCount = 0;
  let sessionCount = 0;

  for (const a of attempts) {
    if (exclude.has(a.id) || liveAttempts.has(a.id)) continue;
    const correct = a.correctCount ?? 0;
    const answered = correct + (a.incorrectCount ?? 0);
    if (answered === 0) continue;
    const at = a.submittedAt ?? a.startedAt;
    const amount = correct * cfg.correct + cfg.testDone + (correct === 30 ? cfg.testPerfect : 0);
    entries.push({ amount, source: 'BACKFILL', reason: 'Earlier test', refKey: `bf:test:${a.id}`, at });
    const d = day(dayKey(at));
    d.answered += answered; d.correct += correct; d.tests += 1; d.xp += amount;
    attemptCount++;
  }
  for (const s of sessions) {
    if (exclude.has(s.id) || live.some((l) => l.refKey === `rs:${s.id}`)) continue;
    const answeredQs = s.questions.filter((q) => q.isCorrect !== null);
    if (answeredQs.length === 0) continue;
    const correct = answeredQs.filter((q) => q.isCorrect).length;
    const finished = s.kind === 'SMART' && !!s.completedAt;
    const last = answeredQs.reduce((m, q) => Math.max(m, q.answeredAt?.getTime() ?? 0), 0);
    const at = s.completedAt ?? (last ? new Date(last) : s.startedAt);
    const amount = correct * cfg.correct + (finished ? cfg.reviewDone : 0);
    if (amount > 0) entries.push({ amount, source: 'BACKFILL', reason: 'Earlier Smart Review', refKey: `bf:review:${s.id}`, at });
    for (const q of answeredQs) {
      const d = day(dayKey(q.answeredAt ?? at));
      d.answered += 1; if (q.isCorrect) d.correct += 1;
    }
    if (finished) day(dayKey(at)).smartSessions += 1;
    day(dayKey(at)).xp += amount;
    sessionCount++;
  }

  // Streaks from the days that reached the daily goal.
  const goalDays = [...days.entries()].filter(([, v]) => v.correct >= cfg.streakMinCorrect).map(([k]) => k).sort();
  let best = 0; let run = 0; let prev: string | null = null;
  for (const d of goalDays) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run); prev = d;
  }
  return { entries, days, attemptCount, sessionCount, streak: prev ? run : 0, bestStreak: best, lastStudyDay: prev };
}

/** Dry run: what the history is worth, without writing anything. */
export async function previewBackfill(studentId: string): Promise<BackfillPlan> {
  const cfg = await getXpConfig();
  const plan = await planBackfill(prisma, studentId, cfg, new Set());
  const existing = await ledgerTotals(prisma, studentId);
  const totalXp = existing.totalXp + plan.entries.reduce((s, e) => s + e.amount, 0);
  return { totalXp, level: levelForXp(totalXp), streak: plan.streak, bestStreak: plan.bestStreak, lastStudyDay: plan.lastStudyDay, attempts: plan.attemptCount, reviewSessions: plan.sessionCount, entries: plan.entries };
}

/** Build the XP profile from history. Safe to repeat: ledger keys are unique. */
export async function backfillXp(db: Db, studentId: string, exclude: Set<string> = new Set()) {
  const cfg = await getXpConfig(db);
  const plan = await planBackfill(db, studentId, cfg, exclude);
  await applyEntries(db, studentId, plan.entries, new Date());
  for (const [d, v] of plan.days) {
    await db.dailyActivity.upsert({
      where: { studentId_day: { studentId, day: d } },
      create: { studentId, day: d, answered: v.answered, correct: v.correct, fixed: 0, weakCorrect: 0, smartSessions: v.smartSessions, tests: v.tests, xp: v.xp },
      update: { answered: v.answered, correct: v.correct, smartSessions: v.smartSessions, tests: v.tests, xp: v.xp },
    });
  }
  const totals = await ledgerTotals(db, studentId);
  const streakState = { streak: plan.streak, bestStreak: plan.bestStreak, freezes: 0, freezeMark: Math.floor(plan.streak / 7) * 7, lastStudyDay: plan.lastStudyDay };
  const row = await db.studentXp.upsert({
    where: { studentId },
    create: { studentId, ...totals, level: levelForXp(totals.totalXp), ...streakState },
    update: { ...totals, level: levelForXp(totals.totalXp), ...streakState },
  });
  if (cfg.features.badges) await grantBadges(db, studentId, row.level, row.bestStreak, null, false, true);
  return row;
}

export async function ensureXpRow(db: Db, studentId: string, exclude: Set<string> = new Set()) {
  return (await db.studentXp.findUnique({ where: { studentId } })) ?? backfillXp(db, studentId, exclude);
}

/** Admin: discard computed XP and rebuild it from history. Admin grants and shop spending are kept. */
export async function rebuildXp(studentId: string) {
  await assertStudent(studentId);
  return prisma.$transaction(async (tx) => {
    await tx.xpLedger.deleteMany({ where: { studentId, source: { in: ['TEST', 'REVIEW', 'QUEST', 'STREAK', 'BACKFILL'] } } });
    await tx.dailyActivity.deleteMany({ where: { studentId } });
    await tx.quest.deleteMany({ where: { studentId } });
    await tx.studentBadge.deleteMany({ where: { studentId } });
    await tx.studentXp.deleteMany({ where: { studentId } });
    return backfillXp(tx, studentId);
  }, { timeout: 60000, maxWait: 10000 });
}

/** Admin: start again from zero, ignoring earlier history. */
export async function resetXp(studentId: string) {
  await assertStudent(studentId);
  return prisma.$transaction(async (tx) => {
    await wipeXp(tx, studentId);
    await tx.studentXp.create({ data: { studentId } });
  });
}

/** Remove every XP record of a student (used when progress is cleared or restored). */
export async function wipeXp(db: Db, studentId: string) {
  await db.rewardRedemption.deleteMany({ where: { studentId } });
  await db.xpLedger.deleteMany({ where: { studentId } });
  await db.dailyActivity.deleteMany({ where: { studentId } });
  await db.quest.deleteMany({ where: { studentId } });
  await db.studentBadge.deleteMany({ where: { studentId } });
  await db.studentXp.deleteMany({ where: { studentId } });
}

async function assertStudent(studentId: string) {
  if (!(await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } }))) throw new AppError('User not found.', 404);
}

export async function grantXp(studentId: string, amount: unknown, note: unknown) {
  await assertStudent(studentId);
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 10000) throw new AppError('Enter a whole number of XP between -10000 and 10000 (not 0).');
  const reason = String(note ?? '').trim().slice(0, 120) || 'Admin adjustment';
  return prisma.$transaction(async (tx) => {
    await ensureXpRow(tx, studentId);
    const now = new Date();
    await tx.xpLedger.create({ data: { studentId, amount, source: 'ADMIN', reason, refKey: `admin:${randomUUID()}`, day: dayKey(now) } });
    const totals = await ledgerTotals(tx, studentId);
    return tx.studentXp.update({ where: { studentId }, data: { ...totals, level: levelForXp(totals.totalXp) } });
  });
}

// ---------- Quests ----------
async function ensureQuests(db: Db, studentId: string, day: string, cfg: XpConfig) {
  if (!cfg.features.quests) return [];
  const week = weekStart(day);
  const hasMistakes = (await db.skillEvent.count({ where: { studentId, isCorrect: false }, take: 1 })) > 0;
  const defs = [...dailyQuests(day, cfg, hasMistakes), weeklyQuest(week)];
  for (const d of defs) {
    const period = d.kind === 'DAILY' ? day : week;
    // Keep the quest set chosen when the day started, even if the student has fixed their mistakes since.
    if (d.kind === 'DAILY' && d.key !== 'correct5') {
      const other = await db.quest.findFirst({ where: { studentId, kind: 'DAILY', period, NOT: { key: 'correct5' } } });
      if (other) continue;
    }
    await db.quest.upsert({
      where: { studentId_kind_period_key: { studentId, kind: d.kind, period, key: d.key } },
      create: { studentId, kind: d.kind, period, key: d.key, target: d.target, rewardXp: d.kind === 'WEEKLY' ? cfg.weeklyBonus : 0 },
      update: {},
    });
  }
  return db.quest.findMany({ where: { studentId, OR: [{ kind: 'DAILY', period: day }, { kind: 'WEEKLY', period: week }] }, orderBy: [{ kind: 'asc' }, { key: 'asc' }] });
}

async function activityFor(db: Db, studentId: string, day: string): Promise<{ today: DayActivity; week: DayActivity[] }> {
  const rows = await db.dailyActivity.findMany({ where: { studentId, day: { gte: weekStart(day), lte: day } } });
  return { today: rows.find((r) => r.day === day) ?? EMPTY_DAY, week: rows };
}

// ---------- Badges ----------
async function badgeStats(db: Db, studentId: string, level: number, bestStreak: number, newRecord: boolean): Promise<BadgeStats> {
  const [totalXpRow, correctTotal, perfectTests, testsDone, fixedTotal, weeklyDone, topicRows] = await Promise.all([
    db.studentXp.findUnique({ where: { studentId }, select: { totalXp: true } }),
    db.skillEvent.count({ where: { studentId, isCorrect: true } }),
    db.testAttempt.count({ where: { studentId, status: { not: 'IN_PROGRESS' }, score: 30 } }),
    db.testAttempt.count({ where: { studentId, status: { not: 'IN_PROGRESS' } } }),
    db.xpLedger.count({ where: { studentId, refKey: { startsWith: 'fix:' } } }),
    db.quest.count({ where: { studentId, kind: 'WEEKLY', completedAt: { not: null } } }),
    db.skillEvent.groupBy({ by: ['topic', 'isCorrect'], where: { studentId }, _count: { _all: true } }),
  ]);
  const topics = new Map<string, { total: number; correct: number }>();
  for (const r of topicRows) {
    const t = topics.get(r.topic) ?? { total: 0, correct: 0 };
    t.total += r._count._all; if (r.isCorrect) t.correct += r._count._all;
    topics.set(r.topic, t);
  }
  const masteredTopics = [...topics.values()].filter((t) => t.total >= 20 && t.correct / t.total >= 0.9).length;
  return { totalXp: totalXpRow?.totalXp ?? 0, level, bestStreak, correctTotal, perfectTests, testsDone, fixedTotal, masteredTopics, newRecord, weeklyDone };
}

async function grantBadges(db: Db, studentId: string, level: number, bestStreak: number, refKey: string | null, newRecord: boolean, quiet: boolean): Promise<string[]> {
  const [stats, have] = await Promise.all([badgeStats(db, studentId, level, bestStreak, newRecord), db.studentBadge.findMany({ where: { studentId }, select: { badgeKey: true } })]);
  const owned = new Set(have.map((h) => h.badgeKey));
  const fresh = BADGES.filter((b) => !owned.has(b.key) && b.earned(stats));
  for (const b of fresh) await db.studentBadge.create({ data: { studentId, badgeKey: b.key, refKey, quiet } });
  return fresh.map((b) => b.key);
}

// ---------- Applying an activity ----------
export interface ActivityInput {
  entries: AwardEntry[];
  answered: number;
  correct: number;
  weakCorrect: number;
  smartSessions: number;
  tests: number;
  refKey: string; // attempt id or review session id
  excludeIds?: string[];
  newRecord?: boolean;
  when?: Date;
}
export interface XpAward {
  gained: number;
  totalXp: number;
  level: number;
  leveledUp: boolean;
  streak: number;
  streakExtended: boolean;
  freezeUsed: boolean;
  freezeGained: boolean;
  newBadges: string[];
  questsDone: string[];
  bonuses: { reason: string; amount: number }[];
}

export async function applyActivity(db: Db, studentId: string, a: ActivityInput): Promise<XpAward> {
  const cfg = await getXpConfig(db);
  const when = a.when ?? new Date();
  const today = dayKey(when);
  const before = await ensureXpRow(db, studentId, new Set(a.excludeIds ?? []));

  const applied = await applyEntries(db, studentId, a.entries, when);
  let gained = applied.reduce((s, e) => s + e.amount, 0);
  const fixed = applied.reduce((s, e) => s + (e.fixed ?? 0), 0);
  const bonuses: { reason: string; amount: number }[] = [];

  const act = await db.dailyActivity.upsert({
    where: { studentId_day: { studentId, day: today } },
    create: { studentId, day: today, answered: a.answered, correct: a.correct, fixed, weakCorrect: a.weakCorrect, smartSessions: a.smartSessions, tests: a.tests, xp: gained },
    update: { answered: { increment: a.answered }, correct: { increment: a.correct }, fixed: { increment: fixed }, weakCorrect: { increment: a.weakCorrect }, smartSessions: { increment: a.smartSessions }, tests: { increment: a.tests }, xp: { increment: gained } },
  });

  // Streak: the daily goal keeps it alive.
  let state: StreakState = { streak: before.streak, bestStreak: before.bestStreak, freezes: before.freezes, freezeMark: before.freezeMark, lastStudyDay: before.lastStudyDay };
  let streakExtended = false; let freezeUsed = false; let freezeGained = false;
  if (cfg.features.streak && act.correct >= cfg.streakMinCorrect) {
    const r = advanceStreak(state, today, cfg.streakMilestones);
    if (r.changed) {
      streakExtended = true; freezeUsed = r.freezesUsed > 0; freezeGained = r.freezeGained;
      state = { streak: r.streak, bestStreak: r.bestStreak, freezes: r.freezes, freezeMark: r.freezeMark, lastStudyDay: r.lastStudyDay };
      if (r.milestone !== null) {
        const bonus = cfg.streakMilestones[String(r.milestone)] ?? 0;
        const got = await applyEntries(db, studentId, [{ amount: bonus, source: 'STREAK', reason: `${r.milestone}-day streak`, refKey: `streak:${r.milestone}:${addDays(today, -(r.streak - 1))}` }], when);
        for (const e of got) { gained += e.amount; bonuses.push({ reason: e.reason, amount: e.amount }); }
      }
    }
  }

  // Quests.
  const questsDone: string[] = [];
  if (cfg.features.quests) {
    const quests = await ensureQuests(db, studentId, today, cfg);
    const { today: t, week } = await activityFor(db, studentId, today);
    for (const q of quests) {
      if (q.completedAt) continue;
      if (questProgress(q.key, t, week) >= q.target) {
        await db.quest.update({ where: { id: q.id }, data: { completedAt: when } });
        q.completedAt = when;
        questsDone.push(q.key);
      }
    }
    const daily = quests.filter((q) => q.kind === 'DAILY');
    if (daily.length && daily.every((q) => q.completedAt) && questsDone.some((k) => daily.some((q) => q.key === k))) {
      for (const e of await applyEntries(db, studentId, [{ amount: cfg.dailyBonus, source: 'QUEST', reason: 'Daily quests done', refKey: `daily:${today}` }], when)) { gained += e.amount; bonuses.push({ reason: e.reason, amount: e.amount }); }
    }
    const weekly = quests.find((q) => q.kind === 'WEEKLY');
    if (weekly && questsDone.includes(weekly.key) && weekly.rewardXp > 0) {
      for (const e of await applyEntries(db, studentId, [{ amount: weekly.rewardXp, source: 'QUEST', reason: 'Weekly challenge done', refKey: `weekly:${weekStart(today)}` }], when)) { gained += e.amount; bonuses.push({ reason: e.reason, amount: e.amount }); }
    }
  }
  if (gained !== applied.reduce((s, e) => s + e.amount, 0)) {
    await db.dailyActivity.update({ where: { studentId_day: { studentId, day: today } }, data: { xp: { increment: gained - applied.reduce((s, e) => s + e.amount, 0) } } });
  }

  const totals = await ledgerTotals(db, studentId);
  const level = levelForXp(totals.totalXp);
  await db.studentXp.update({ where: { studentId }, data: { ...totals, level, ...state } });
  const newBadges = cfg.features.badges ? await grantBadges(db, studentId, level, state.bestStreak, a.refKey, !!a.newRecord, false) : [];
  return {
    gained, totalXp: totals.totalXp, level, leveledUp: level > before.level, streak: effectiveStreak(state, today).streak,
    streakExtended, freezeUsed, freezeGained, newBadges, questsDone, bonuses,
  };
}

/** Skills the student currently finds tricky (used for the “practise a weak skill” quest). */
export async function weakSkillIds(db: Db, studentId: string): Promise<Set<string>> {
  const rows = await db.skillProgress.findMany({ where: { studentId, totalAttempts: { gte: 3 } }, select: { skillId: true, recentAccuracy: true } });
  return new Set(rows.filter((r) => (r.recentAccuracy ?? 1) < 0.85).map((r) => r.skillId));
}

// ---------- Flow: test submitted ----------
export async function awardForTest(attemptId: string): Promise<XpAward | null> {
  const attempt = await prisma.testAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.status === 'IN_PROGRESS') return null;
  const studentId = attempt.studentId;
  const cfg = await getXpConfig();
  const order: string[] = JSON.parse(attempt.questionOrder);
  const [answers, prior, previous] = await Promise.all([
    prisma.studentAnswer.findMany({ where: { attemptId } }),
    prisma.studentAnswer.findMany({ where: { questionId: { in: order }, attempt: { studentId, id: { not: attemptId }, status: { not: 'IN_PROGRESS' } } }, select: { questionId: true, selectedAnswer: true, isCorrect: true } }),
    prisma.testAttempt.findMany({ where: { studentId, testNumber: attempt.testNumber, status: { not: 'IN_PROGRESS' }, id: { not: attemptId } }, select: { score: true } }),
  ]);
  const when = attempt.submittedAt ?? new Date();
  let base = 0; let first = 0; let correct = 0; let answered = 0;
  const entries: AwardEntry[] = [];
  for (const a of answers) {
    if (a.selectedAnswer === null) continue;
    answered++;
    if (!a.isCorrect) continue;
    correct++;
    const mine = prior.filter((p) => p.questionId === a.questionId);
    const correctBefore = mine.some((p) => p.isCorrect === true);
    const x = questionXp({ correct: true, seenBefore: mine.some((p) => p.selectedAnswer !== null), correctBefore, wrongBefore: !correctBefore && mine.some((p) => p.isCorrect === false) }, cfg);
    base += x.base; first += x.firstTry;
    if (x.fix > 0) entries.push({ amount: x.fix, source: 'TEST', reason: 'Fixed a mistake', refKey: `fix:test:${attemptId}:${a.questionId}`, fixed: 1 });
  }
  const id = attemptId;
  entries.unshift(
    { amount: base, source: 'TEST', reason: 'Correct answers', refKey: `test:${id}:correct` },
    { amount: first, source: 'TEST', reason: 'Right the first time', refKey: `test:${id}:first` },
  );
  if (answered > 0) entries.push({ amount: cfg.testDone, source: 'TEST', reason: 'Finished a test', refKey: `test:${id}:done` });
  if (answered > 0 && correct === order.length) entries.push({ amount: cfg.testPerfect, source: 'TEST', reason: 'Perfect score', refKey: `test:${id}:perfect` });
  const best = previous.reduce((m, p) => Math.max(m, p.score ?? 0), -1);
  const weak = await weakSkillIds(prisma, studentId);
  const questions = answered > 0 ? await prisma.question.findMany({ where: { id: { in: answers.filter((a) => a.isCorrect).map((a) => a.questionId) } }, select: { skill: true } }) : [];
  return prisma.$transaction((tx) => applyActivity(tx, studentId, {
    entries, answered, correct, weakCorrect: questions.filter((q) => weak.has(q.skill)).length, smartSessions: 0, tests: answered > 0 ? 1 : 0,
    refKey: attemptId, excludeIds: [attemptId], newRecord: previous.length > 0 && (attempt.score ?? 0) > best, when,
  }), { timeout: 30000, maxWait: 10000 });
}

/** XP breakdown shown on the results page. */
export async function attemptXp(studentId: string, attemptId: string) {
  const rows = await prisma.xpLedger.findMany({ where: { studentId, OR: [{ refKey: { startsWith: `test:${attemptId}:` } }, { refKey: { startsWith: `fix:test:${attemptId}:` } }, { refKey: `bf:test:${attemptId}` }] }, orderBy: { createdAt: 'asc' } });
  if (!rows.length) return null;
  const sum = (f: (k: string) => boolean) => rows.filter((r) => f(r.refKey)).reduce((s, r) => s + r.amount, 0);
  const lines = [
    { kind: 'correct', amount: sum((k) => k.endsWith(':correct')) },
    { kind: 'first', amount: sum((k) => k.endsWith(':first')) },
    { kind: 'fix', amount: sum((k) => k.startsWith('fix:')) },
    { kind: 'done', amount: sum((k) => k.endsWith(':done')) },
    { kind: 'perfect', amount: sum((k) => k.endsWith(':perfect')) },
    { kind: 'earlier', amount: sum((k) => k.startsWith('bf:')) },
  ].filter((l) => l.amount > 0);
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const first = rows[0].createdAt;
  const [pre, badges] = await Promise.all([
    prisma.xpLedger.aggregate({ where: { studentId, source: { in: EARNED_SOURCES }, createdAt: { lt: first } }, _sum: { amount: true } }),
    prisma.studentBadge.findMany({ where: { studentId, refKey: attemptId, quiet: false }, select: { badgeKey: true } }),
  ]);
  const levelBefore = levelForXp(Math.max(0, pre._sum.amount ?? 0));
  const levelAfter = levelForXp(Math.max(0, (pre._sum.amount ?? 0) + total));
  return { total, lines, levelBefore, levelAfter, badges: badges.map((b) => b.badgeKey) };
}

// ---------- Flow: Smart Review answer ----------
export interface ReviewAnswerInfo {
  studentId: string;
  reviewQuestionId: string;
  sessionId: string;
  skillId: string;
  kind: string;
  sourceQuestionId: string | null;
  correct: boolean;
  sessionCompleted: boolean;
  weak: boolean;
}

export async function awardForReviewAnswer(i: ReviewAnswerInfo): Promise<XpAward> {
  const cfg = await getXpConfig();
  const when = new Date();
  const today = dayKey(when);
  const entries: AwardEntry[] = [];
  if (i.correct) {
    const paid = await prisma.xpLedger.count({ where: { studentId: i.studentId, day: today, refKey: { startsWith: 'rq:' } } });
    const amount = paid < cfg.reviewFullPerDay ? cfg.correct + cfg.firstTry : cfg.reviewReducedXp;
    entries.push({ amount, source: 'REVIEW', reason: 'Correct answer in practice', refKey: `rq:${i.reviewQuestionId}` });
    if (i.kind === 'SIMILAR' && i.sourceQuestionId) {
      entries.push({ amount: cfg.fix, source: 'REVIEW', reason: 'Fixed a mistake', refKey: `fix:sim:${i.studentId}:${i.sourceQuestionId}`, fixed: 1 });
    }
  }
  const finishedSmart = i.sessionCompleted && i.kind === 'SMART';
  if (finishedSmart) entries.push({ amount: cfg.reviewDone, source: 'REVIEW', reason: 'Finished Smart Review', refKey: `rs:${i.sessionId}` });
  return prisma.$transaction((tx) => applyActivity(tx, i.studentId, {
    entries, answered: 1, correct: i.correct ? 1 : 0, weakCorrect: i.correct && i.weak ? 1 : 0, smartSessions: finishedSmart ? 1 : 0, tests: 0,
    refKey: i.sessionId, excludeIds: [i.sessionId], when,
  }), { timeout: 30000, maxWait: 10000 });
}

// ---------- Reading ----------
export async function getXpChip(studentId: string) {
  const [row, cfg] = await Promise.all([ensureXpRowSafe(studentId), getXpConfig()]);
  const today = dayKey(new Date());
  return { level: row.level, totalXp: row.totalXp, available: row.totalXp - row.spentXp, streak: effectiveStreak(row, today).streak, shop: cfg.features.shop };
}

async function ensureXpRowSafe(studentId: string) {
  const row = await prisma.studentXp.findUnique({ where: { studentId } });
  if (row) return row;
  return prisma.$transaction((tx) => ensureXpRow(tx, studentId), { timeout: 60000, maxWait: 10000 }).catch(async (e) => {
    // A concurrent request may have created the row first.
    const again = await prisma.studentXp.findUnique({ where: { studentId } });
    if (again) return again;
    throw e;
  });
}

export async function getXpSummary(studentId: string) {
  const cfg = await getXpConfig();
  const row = await ensureXpRowSafe(studentId);
  const today = dayKey(new Date());
  const week = weekStart(today);
  const [quests, badges, topicRows, activity, recent, student] = await Promise.all([
    prisma.$transaction((tx) => ensureQuests(tx, studentId, today, cfg)),
    prisma.studentBadge.findMany({ where: { studentId }, orderBy: { earnedAt: 'asc' } }),
    prisma.skillEvent.groupBy({ by: ['topic', 'isCorrect'], where: { studentId }, _count: { _all: true } }),
    prisma.dailyActivity.findMany({ where: { studentId, day: { gte: addDays(week, -7 * 7) } }, orderBy: { day: 'asc' } }),
    prisma.xpLedger.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take: 15 }),
    prisma.student.findUnique({ where: { id: studentId }, select: { preferences: true } }),
  ]);
  const t = activity.find((r) => r.day === today) ?? EMPTY_DAY;
  const weekRows = activity.filter((r) => r.day >= week && r.day <= today);
  const streak = effectiveStreak(row, today);
  const topics = new Map<string, { total: number; correct: number }>();
  for (const r of topicRows) {
    const x = topics.get(r.topic) ?? { total: 0, correct: 0 };
    x.total += r._count._all; if (r.isCorrect) x.correct += r._count._all;
    topics.set(r.topic, x);
  }
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(week, -7 * (7 - i));
    const end = addDays(start, 6);
    return { start, xp: activity.filter((r) => r.day >= start && r.day <= end).reduce((s, r) => s + r.xp, 0) };
  });
  const allDays = await prisma.dailyActivity.aggregate({ where: { studentId }, _max: { xp: true } });
  let prefs: { avatar?: string; theme?: string } = {};
  try { prefs = JSON.parse(student?.preferences ?? '{}'); } catch { /* defaults */ }
  const lp = levelProgress(row.totalXp);
  return {
    totalXp: row.totalXp, available: row.totalXp - row.spentXp, ...lp,
    streak: streak.streak, streakAtRisk: streak.atRisk, bestStreak: row.bestStreak, freezes: row.freezes, goalToday: { correct: t.correct, target: cfg.streakMinCorrect },
    quests: quests.map((q) => ({ kind: q.kind, key: q.key, target: q.target, rewardXp: q.rewardXp, done: !!q.completedAt, progress: Math.min(q.target, questProgress(q.key, t, weekRows)) })),
    dailyBonus: cfg.dailyBonus,
    badges: badges.map((b) => ({ key: b.badgeKey, earnedAt: b.earnedAt.toISOString() })),
    topics: [...topics.entries()].map(([topic, v]) => ({ topic, total: v.total, accuracy: Math.round((v.correct / v.total) * 100), stars: topicStars(v.total, v.correct) })).sort((a, b) => a.topic.localeCompare(b.topic)),
    weeks,
    thisWeek: weeks[7].xp, lastWeek: weeks[6].xp, bestWeek: Math.max(...weeks.map((w) => w.xp)), bestDay: allDays._max.xp ?? 0,
    recent: recent.map((r) => ({ amount: r.amount, source: r.source, reason: r.reason, at: r.createdAt.toISOString() })),
    avatar: AVATARS.find((a) => a.key === prefs.avatar && a.level <= row.level)?.key ?? AVATARS[0].key,
    theme: THEMES.find((x) => x.key === prefs.theme && x.level <= row.level)?.key ?? THEMES[0].key,
    shopEnabled: cfg.features.shop,
    features: cfg.features,
  };
}
export type XpSummary = Awaited<ReturnType<typeof getXpSummary>>;

export async function setCosmetics(studentId: string, value: { avatar?: unknown; theme?: unknown }) {
  const row = await ensureXpRowSafe(studentId);
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { preferences: true } });
  const prefs = JSON.parse(student.preferences || '{}') as Record<string, unknown>;
  if (value.avatar !== undefined) {
    const a = AVATARS.find((x) => x.key === value.avatar);
    if (!a || a.level > row.level) throw new AppError('That avatar is still locked.', 409);
    prefs.avatar = a.key;
  }
  if (value.theme !== undefined) {
    const t = THEMES.find((x) => x.key === value.theme);
    if (!t || t.level > row.level) throw new AppError('That colour is still locked.', 409);
    prefs.theme = t.key;
  }
  await prisma.student.update({ where: { id: studentId }, data: { preferences: JSON.stringify(prefs) } });
  return { ok: true };
}

/** Admin view of one student's XP, with the latest ledger rows. */
export async function adminXpView(studentId: string) {
  await assertStudent(studentId);
  const [summary, ledger, preview] = await Promise.all([
    getXpSummary(studentId),
    prisma.xpLedger.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    previewBackfill(studentId),
  ]);
  return { summary, ledger: ledger.map((l) => ({ id: l.id, amount: l.amount, source: l.source, reason: l.reason, at: l.createdAt.toISOString() })), historyWorth: { totalXp: preview.totalXp, level: preview.level, bestStreak: preview.bestStreak } };
}

