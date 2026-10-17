import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { ensureActiveBank, answerAttempt } from './helpers';
import { startAttempt, submitAttempt } from '@/lib/services/attempts';
import { answerReviewQuestion, createSimilarSession, createSmartSession } from '@/lib/services/review';
import { clearStudentProgress } from '@/lib/services/progress';
import { exportProgress, importProgress } from '@/lib/services/progress-backup';
import {
  applyActivity, attemptXp, backfillXp, getXpChip, getXpSummary, grantXp, previewBackfill, rebuildXp, resetXp, saveXpConfig, setCosmetics, wipeXp,
} from '@/lib/services/xp';
import { createReward, decideRedemption, deleteReward, listRewardsForStudent, redeemReward } from '@/lib/services/rewards';
import { dayKey } from '@/lib/xp/rules';

const A = 'xp-a';
const B = 'xp-b';

async function mkStudent(id: string) {
  await prisma.student.upsert({ where: { id }, update: {}, create: { id, name: id.toUpperCase() } });
}
const ledgerSum = async (studentId: string) => (await prisma.xpLedger.aggregate({ where: { studentId, source: { not: 'REDEEM' } }, _sum: { amount: true } }))._sum.amount ?? 0;

beforeAll(async () => {
  await ensureActiveBank();
  await mkStudent(A);
  await mkStudent(B);
});

describe('XP for tests', () => {
  it('awards correct, first-time and finishing XP once, and shows the breakdown', async () => {
    const { attemptId } = await startAttempt(5, A);
    await answerAttempt(attemptId, 20, 30);
    await submitAttempt(attemptId, A);
    await submitAttempt(attemptId, A); // submitting again must not pay twice
    const r = await attemptXp(A, attemptId);
    expect(r?.lines).toEqual([
      { kind: 'correct', amount: 200 }, { kind: 'first', amount: 100 }, { kind: 'done', amount: 20 },
    ]);
    expect(r?.total).toBe(320);
    const xp = await prisma.studentXp.findUniqueOrThrow({ where: { studentId: A } });
    expect(xp).toMatchObject({ totalXp: 320, level: 3, streak: 1, spentXp: 0 });
    expect(await ledgerSum(A)).toBe(320);
    expect(await prisma.dailyActivity.findFirst({ where: { studentId: A } })).toMatchObject({ answered: 30, correct: 20, tests: 1 });
  });

  it('pays half for repeated right answers and a bonus for fixing old mistakes', async () => {
    const { attemptId } = await startAttempt(5, A);
    await answerAttempt(attemptId, 30, 30); // everything right now: 20 repeats, 10 fixed mistakes
    await submitAttempt(attemptId, A);
    const r = await attemptXp(A, attemptId);
    expect(Object.fromEntries(r!.lines.map((l) => [l.kind, l.amount]))).toEqual({ correct: 20 * 5 + 10 * 10, fix: 10 * 15, done: 20, perfect: 50 });
    // a third perfect run: the fixed questions are not “mistakes” any more
    const third = await startAttempt(5, A);
    await answerAttempt(third.attemptId, 30, 30);
    await submitAttempt(third.attemptId, A);
    const t = await attemptXp(A, third.attemptId);
    expect(Object.fromEntries(t!.lines.map((l) => [l.kind, l.amount]))).toEqual({ correct: 30 * 5, done: 20, perfect: 50 });
  });

  it('does not award XP for an empty submission', async () => {
    const { attemptId } = await startAttempt(6, B);
    await submitAttempt(attemptId, B);
    expect(await attemptXp(B, attemptId)).toBeNull();
    expect((await prisma.studentXp.findUniqueOrThrow({ where: { studentId: B } })).totalXp).toBe(0);
  });

  it('badges: first answer, perfect score and new record', async () => {
    const badges = (await prisma.studentBadge.findMany({ where: { studentId: A } })).map((b) => b.badgeKey);
    expect(badges).toEqual(expect.arrayContaining(['first_correct', 'perfect_test', 'new_record']));
  });
});

describe('XP for Smart Review', () => {
  it('pays per correct answer and for finishing, without paying twice', async () => {
    const before = (await prisma.studentXp.findUniqueOrThrow({ where: { studentId: A } })).totalXp;
    const sid = await createSmartSession(A);
    const qs = await prisma.reviewQuestion.findMany({ where: { sessionId: sid }, orderBy: { position: 'asc' } });
    let gained = 0; let last = null;
    for (const q of qs) {
      const res = await answerReviewQuestion(q.id, q.correctAnswer, A);
      gained += res.xp?.gained ?? 0; last = res;
      const again = await answerReviewQuestion(q.id, q.correctAnswer, A);
      expect(again.alreadyAnswered).toBe(true);
      expect(again.xp).toBeNull();
    }
    expect(last?.sessionCompleted).toBe(true);
    // 10 correct x (10 + 5) + 15 for finishing, plus any quest or streak bonus granted along the way
    const base = 10 * 15 + 15;
    const bonuses = (await prisma.xpLedger.aggregate({ where: { studentId: A, source: { in: ['QUEST', 'STREAK'] }, createdAt: { gte: new Date(Date.now() - 600_000) } }, _sum: { amount: true } }))._sum.amount ?? 0;
    expect(gained).toBeGreaterThanOrEqual(base);
    const after = (await prisma.studentXp.findUniqueOrThrow({ where: { studentId: A } })).totalXp;
    expect(after - before).toBe(gained);
    expect(gained - base).toBeLessThanOrEqual(bonuses);
  });

  it('pays the fixing bonus once for a similar question on a missed one', async () => {
    const missed = await prisma.question.findFirstOrThrow({ where: { id: { in: (await prisma.studentAnswer.findMany({ where: { attempt: { studentId: A } }, select: { questionId: true } })).map((a) => a.questionId) } } });
    const run = async () => {
      const sid = await createSimilarSession(missed.id, undefined, A);
      const q = await prisma.reviewQuestion.findFirstOrThrow({ where: { sessionId: sid } });
      return answerReviewQuestion(q.id, q.correctAnswer, A);
    };
    const first = await run();
    const second = await run();
    expect(first.xp!.gained).toBeGreaterThanOrEqual(30); // 15 correct + 15 fix
    expect(second.xp!.gained).toBeLessThan(first.xp!.gained);
    expect(await prisma.xpLedger.count({ where: { studentId: A, refKey: `fix:sim:${A}:${missed.id}` } })).toBe(1);
  });
});

describe('streak and quests', () => {
  it('completes the daily quests once and pays the bonus once', async () => {
    const today = dayKey(new Date());
    await getXpSummary(B); // creates today's quests
    const quests = await prisma.quest.findMany({ where: { studentId: B, kind: 'DAILY', period: today } });
    expect(quests).toHaveLength(2);
    const need = { correct: 0, smartSessions: 0, fixed: 0, weakCorrect: 0 };
    for (const q of quests) {
      if (q.key === 'correct5') need.correct = q.target;
      if (q.key === 'smart') need.smartSessions = 1;
      if (q.key === 'weak3') need.weakCorrect = 3;
      if (q.key === 'fix2') need.fixed = 2;
    }
    const award = await prisma.$transaction((tx) => applyActivity(tx, B, {
      entries: [{ amount: 10, source: 'REVIEW', reason: 'test', refKey: 'test-quest-1', fixed: need.fixed }],
      answered: Math.max(need.correct, need.weakCorrect, 5), correct: Math.max(need.correct, 5), weakCorrect: need.weakCorrect, smartSessions: need.smartSessions, tests: 0, refKey: 'test-quest-1',
    }));
    expect(award.questsDone.sort()).toEqual(quests.map((q) => q.key).sort());
    expect(award.bonuses.some((b) => b.reason.startsWith('Daily'))).toBe(true);
    expect(award.streak).toBe(1);
    const again = await prisma.$transaction((tx) => applyActivity(tx, B, { entries: [], answered: 1, correct: 1, weakCorrect: 0, smartSessions: 0, tests: 0, refKey: 'test-quest-2' }));
    expect(again.bonuses).toEqual([]);
    expect(await prisma.xpLedger.count({ where: { studentId: B, refKey: `daily:${today}` } })).toBe(1);
  });

  it('keeps the streak after a missed day with a shield, and breaks it without one', async () => {
    await mkStudent('xp-streak');
    const d = (n: number) => new Date(Date.now() - n * 86_400_000);
    const act = (n: number, id: string) => prisma.$transaction((tx) => applyActivity(tx, 'xp-streak', { entries: [], answered: 5, correct: 5, weakCorrect: 0, smartSessions: 0, tests: 0, refKey: id, when: d(n) }));
    for (let n = 8; n >= 2; n--) await act(n, `s${n}`); // 7 days in a row: earns a shield
    expect((await prisma.studentXp.findUniqueOrThrow({ where: { studentId: 'xp-streak' } })).freezes).toBe(1);
    const saved = await act(0, 's0'); // skipped yesterday
    expect(saved).toMatchObject({ streak: 8, freezeUsed: true });
    expect((await prisma.studentXp.findUniqueOrThrow({ where: { studentId: 'xp-streak' } })).bestStreak).toBe(8);
    expect(await prisma.xpLedger.count({ where: { studentId: 'xp-streak', source: 'STREAK' } })).toBe(2); // 3 and 7 day bonuses
  });
});

describe('history backfill', () => {
  it('rebuilds the same totals from history, and previews them without writing', async () => {
    const before = await prisma.studentXp.findUniqueOrThrow({ where: { studentId: A } });
    await wipeXp(prisma, A);
    const preview = await previewBackfill(A);
    expect(await prisma.xpLedger.count({ where: { studentId: A } })).toBe(0);
    expect(preview.totalXp).toBeGreaterThan(0);
    const summary = await getXpSummary(A); // lazy backfill
    expect(summary.totalXp).toBe(preview.totalXp);
    expect(summary.level).toBe(preview.level);
    // simplified rates: 10 per correct answer, 20 per finished test, 50 per perfect test, 15 per finished Smart Review
    expect(summary.totalXp).toBeGreaterThan(0);
    expect(summary.totalXp).toBeLessThanOrEqual(before.totalXp + 1000);
    const total = summary.totalXp;
    await prisma.$transaction((tx) => backfillXp(tx, A)); // running again changes nothing
    expect((await prisma.studentXp.findUniqueOrThrow({ where: { studentId: A } })).totalXp).toBe(total);
    expect(await prisma.xpLedger.count({ where: { studentId: A, source: 'BACKFILL' } })).toBeGreaterThan(0);
  });

  it('does not double count an attempt that is already in the ledger', async () => {
    await mkStudent('xp-late');
    const { attemptId } = await startAttempt(7, 'xp-late');
    await answerAttempt(attemptId, 10, 30);
    await submitAttempt(attemptId, 'xp-late');
    const total = (await prisma.studentXp.findUniqueOrThrow({ where: { studentId: 'xp-late' } })).totalXp;
    await prisma.$transaction((tx) => backfillXp(tx, 'xp-late'));
    expect((await prisma.studentXp.findUniqueOrThrow({ where: { studentId: 'xp-late' } })).totalXp).toBe(total);
    expect(await prisma.xpLedger.count({ where: { studentId: 'xp-late', refKey: { startsWith: 'bf:' } } })).toBe(0);
  });

  it('credits history that existed before XP was introduced', async () => {
    await mkStudent('xp-old');
    // submit the test, then remove the XP the live award gave to mimic data from before the feature existed
    const { attemptId } = await startAttempt(8, 'xp-old');
    await answerAttempt(attemptId, 12, 30);
    await submitAttempt(attemptId, 'xp-old');
    await wipeXp(prisma, 'xp-old');
    const chip = await getXpChip('xp-old');
    expect(chip.totalXp).toBe(12 * 10 + 20);
    expect(chip.level).toBe(2);
  });
});

describe('admin tools', () => {
  it('grants XP, rebuilds from history keeping grants, and resets to zero', async () => {
    await mkStudent('xp-admin');
    const { attemptId } = await startAttempt(9, 'xp-admin');
    await answerAttempt(attemptId, 10, 30);
    await submitAttempt(attemptId, 'xp-admin');
    const base = (await prisma.studentXp.findUniqueOrThrow({ where: { studentId: 'xp-admin' } })).totalXp;
    await expect(grantXp('xp-admin', 0, '')).rejects.toThrow();
    await expect(grantXp('xp-admin', 1.5, '')).rejects.toThrow();
    await grantXp('xp-admin', 100, 'Great week');
    expect((await prisma.studentXp.findUniqueOrThrow({ where: { studentId: 'xp-admin' } })).totalXp).toBe(base + 100);
    const rebuilt = await rebuildXp('xp-admin');
    expect(rebuilt.totalXp).toBe(10 * 10 + 20 + 100); // simplified history rates + the manual grant
    await resetXp('xp-admin');
    expect(await prisma.studentXp.findUniqueOrThrow({ where: { studentId: 'xp-admin' } })).toMatchObject({ totalXp: 0, level: 1 });
    expect((await getXpSummary('xp-admin')).totalXp).toBe(0); // history is ignored after a reset
  });

  it('clearing progress removes XP, and restoring a backup rebuilds it from the restored history', async () => {
    await mkStudent('xp-clear');
    const { attemptId } = await startAttempt(10, 'xp-clear');
    await answerAttempt(attemptId, 15, 30);
    await submitAttempt(attemptId, 'xp-clear');
    const backup = JSON.parse(JSON.stringify(await exportProgress('xp-clear')));
    await clearStudentProgress('CLEAR', 'xp-clear');
    expect(await prisma.studentXp.count({ where: { studentId: 'xp-clear' } })).toBe(0);
    expect((await getXpSummary('xp-clear')).totalXp).toBe(0);
    await importProgress(backup, 'RESTORE', 'xp-clear');
    expect(await prisma.studentXp.count({ where: { studentId: 'xp-clear' } })).toBe(0);
    expect((await getXpSummary('xp-clear')).totalXp).toBe(15 * 10 + 20);
  });

  it('only unlocks avatars and colours the level allows', async () => {
    await mkStudent('xp-cos');
    await expect(setCosmetics('xp-cos', { avatar: 'unicorn' })).rejects.toThrow('locked');
    await setCosmetics('xp-cos', { avatar: 'cat', theme: 'ocean' });
    expect((await getXpSummary('xp-cos')).avatar).toBe('cat');
  });
});

describe('reward shop', () => {
  it('is closed until a parent opens it', async () => {
    await expect(redeemReward(A, 'x')).rejects.toThrow('closed');
    expect((await listRewardsForStudent(A)).enabled).toBe(false);
  });

  it('spends XP without lowering the level, limits use per week, and refunds declined requests', async () => {
    await saveXpConfig({ features: { shop: true } });
    const r = await createReward({ name: 'Ice cream', costXp: 100, maxPerWeek: 1 });
    const mine = await createReward({ name: 'Only for B', costXp: 10, studentId: B });
    const total = (await getXpSummary(A)).totalXp;
    const level = (await getXpSummary(A)).level;
    expect((await listRewardsForStudent(A)).rewards.map((x) => x.name)).toEqual(['Ice cream']);
    await expect(redeemReward(A, mine.id)).rejects.toThrow('not available');
    const done = await redeemReward(A, r.id);
    expect(done.status).toBe('PENDING');
    let s = await getXpSummary(A);
    expect(s).toMatchObject({ totalXp: total, level, available: total - 100 });
    await expect(redeemReward(A, r.id)).rejects.toThrow('maximum');
    await decideRedemption(done.id, 'REJECT');
    await expect(decideRedemption(done.id, 'APPROVE')).rejects.toThrow('already decided');
    s = await getXpSummary(A);
    expect(s.available).toBe(total);
    const again = await redeemReward(A, r.id); // a declined request does not use up the weekly limit
    await decideRedemption(again.id, 'APPROVE');
    expect((await getXpSummary(A)).available).toBe(total - 100);
    // a poor student cannot buy it
    await expect(redeemReward(B, (await createReward({ name: 'Big', costXp: 99999 })).id)).rejects.toThrow('more XP');
    // rewards with history are hidden, not deleted
    expect(await deleteReward(r.id)).toEqual({ deleted: false, hidden: true });
    expect(await deleteReward(mine.id)).toEqual({ deleted: true, hidden: false });
  });

  it('cannot spend the same XP twice at the same time', async () => {
    await mkStudent('xp-race');
    await grantXp('xp-race', 100, 'start');
    const r = await createReward({ name: 'Race prize', costXp: 100 });
    const results = await Promise.allSettled([redeemReward('xp-race', r.id), redeemReward('xp-race', r.id)]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect((await getXpSummary('xp-race')).available).toBe(0);
  });
});
