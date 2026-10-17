import { z } from 'zod';
import { prisma } from '../db';
import { AppError } from './attempts';
import { dayKey, dayStart, levelForXp, weekStart } from '../xp/rules';
import { ensureXpRow, getXpConfig, ledgerTotals } from './xp';

const rewardSchema = z.object({
  name: z.string().trim().min(1).max(80),
  nameVi: z.string().trim().max(80).default(''),
  description: z.string().trim().max(300).default(''),
  costXp: z.number().int().min(1).max(100000),
  studentId: z.string().min(1).max(64).nullable().default(null),
  maxPerWeek: z.number().int().min(1).max(100).nullable().default(null),
  isActive: z.boolean().default(true),
}).strict();

const weekStartInstant = () => dayStart(weekStart(dayKey(new Date())));

// ---------- Student ----------
export async function listRewardsForStudent(studentId: string) {
  const cfg = await getXpConfig();
  const row = await prisma.$transaction((tx) => ensureXpRow(tx, studentId), { timeout: 60000, maxWait: 10000 });
  const available = row.totalXp - row.spentXp;
  if (!cfg.features.shop) return { enabled: false as const, available, rewards: [], history: [] };
  const [rewards, used, history] = await Promise.all([
    prisma.reward.findMany({ where: { isActive: true, OR: [{ studentId: null }, { studentId }] }, orderBy: { costXp: 'asc' } }),
    prisma.rewardRedemption.groupBy({ by: ['rewardId'], where: { studentId, status: { not: 'REJECTED' }, createdAt: { gte: weekStartInstant() } }, _count: { _all: true } }),
    prisma.rewardRedemption.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, take: 20, include: { reward: { select: { name: true, nameVi: true } } } }),
  ]);
  const usedBy = new Map(used.map((u) => [u.rewardId, u._count._all]));
  return {
    enabled: true as const,
    available,
    rewards: rewards.map((r) => ({
      id: r.id, name: r.name, nameVi: r.nameVi, description: r.description, costXp: r.costXp, maxPerWeek: r.maxPerWeek,
      usedThisWeek: usedBy.get(r.id) ?? 0,
      canRedeem: available >= r.costXp && (r.maxPerWeek === null || (usedBy.get(r.id) ?? 0) < r.maxPerWeek),
    })),
    history: history.map((h) => ({ id: h.id, name: h.reward.name, nameVi: h.reward.nameVi, costXp: h.costXp, status: h.status, createdAt: h.createdAt.toISOString() })),
  };
}

export async function redeemReward(studentId: string, rewardId: unknown) {
  const cfg = await getXpConfig();
  if (!cfg.features.shop) throw new AppError('The reward shop is closed right now.', 409, 'SHOP_CLOSED');
  if (typeof rewardId !== 'string') throw new AppError('Choose a reward.');
  return prisma.$transaction(async (tx) => {
    const reward = await tx.reward.findUnique({ where: { id: rewardId } });
    if (!reward || !reward.isActive || (reward.studentId && reward.studentId !== studentId)) throw new AppError('That reward is not available.', 404, 'NOT_FOUND');
    const row = await ensureXpRow(tx, studentId);
    if (reward.maxPerWeek !== null) {
      const used = await tx.rewardRedemption.count({ where: { studentId, rewardId, status: { not: 'REJECTED' }, createdAt: { gte: weekStartInstant() } } });
      if (used >= reward.maxPerWeek) throw new AppError('You have already used this reward the maximum number of times this week.', 409, 'LIMIT');
    }
    if (row.totalXp - row.spentXp < reward.costXp) throw new AppError('You need more XP for this reward.', 409, 'NOT_ENOUGH_XP');
    // Optimistic guard: two simultaneous redemptions cannot spend the same XP twice.
    const claim = await tx.studentXp.updateMany({ where: { studentId, spentXp: row.spentXp }, data: { spentXp: row.spentXp + reward.costXp } });
    if (claim.count === 0) throw new AppError('Please try again.', 409, 'RETRY');
    const redemption = await tx.rewardRedemption.create({ data: { rewardId, studentId, costXp: reward.costXp } });
    await tx.xpLedger.create({ data: { studentId, amount: -reward.costXp, source: 'REDEEM', reason: `Reward: ${reward.name}`, refKey: `redeem:${redemption.id}`, day: dayKey(new Date()) } });
    return { id: redemption.id, status: redemption.status, available: row.totalXp - row.spentXp - reward.costXp };
  }, { timeout: 20000, maxWait: 10000 });
}

// ---------- Admin ----------
export async function adminListRewards() {
  const [rewards, redemptions, students] = await Promise.all([
    prisma.reward.findMany({ orderBy: [{ isActive: 'desc' }, { costXp: 'asc' }], include: { student: { select: { name: true } } } }),
    prisma.rewardRedemption.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { reward: { select: { name: true } }, student: { select: { name: true } } } }),
    prisma.student.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  return {
    students,
    rewards: rewards.map((r) => ({ id: r.id, name: r.name, nameVi: r.nameVi, description: r.description, costXp: r.costXp, studentId: r.studentId, studentName: r.student?.name ?? null, maxPerWeek: r.maxPerWeek, isActive: r.isActive })),
    redemptions: redemptions
      .map((x) => ({ id: x.id, reward: x.reward.name, student: x.student.name, costXp: x.costXp, status: x.status, createdAt: x.createdAt.toISOString(), decidedAt: x.decidedAt?.toISOString() ?? null }))
      .sort((a, b) => Number(b.status === 'PENDING') - Number(a.status === 'PENDING')),
  };
}

export async function createReward(value: unknown) {
  const parsed = rewardSchema.safeParse(value);
  if (!parsed.success) throw new AppError('Enter a name and a cost between 1 and 100000 XP.');
  if (parsed.data.studentId && !(await prisma.student.findUnique({ where: { id: parsed.data.studentId }, select: { id: true } }))) throw new AppError('User not found.', 404);
  return prisma.reward.create({ data: parsed.data });
}

export async function updateReward(id: string, value: unknown) {
  const parsed = rewardSchema.safeParse(value);
  if (!parsed.success) throw new AppError('Enter a name and a cost between 1 and 100000 XP.');
  if (!(await prisma.reward.findUnique({ where: { id }, select: { id: true } }))) throw new AppError('Reward not found.', 404);
  return prisma.reward.update({ where: { id }, data: parsed.data });
}

export async function deleteReward(id: string) {
  const reward = await prisma.reward.findUnique({ where: { id }, include: { _count: { select: { redemptions: true } } } });
  if (!reward) throw new AppError('Reward not found.', 404);
  // Keep the history of anything already redeemed: hide it instead.
  if (reward._count.redemptions > 0) { await prisma.reward.update({ where: { id }, data: { isActive: false } }); return { deleted: false, hidden: true }; }
  await prisma.reward.delete({ where: { id } });
  return { deleted: true, hidden: false };
}

export async function decideRedemption(id: string, decision: unknown) {
  if (decision !== 'APPROVE' && decision !== 'REJECT') throw new AppError('Choose approve or reject.');
  return prisma.$transaction(async (tx) => {
    const r = await tx.rewardRedemption.findUnique({ where: { id } });
    if (!r) throw new AppError('Request not found.', 404);
    const claim = await tx.rewardRedemption.updateMany({ where: { id, status: 'PENDING' }, data: { status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED', decidedAt: new Date() } });
    if (claim.count === 0) throw new AppError('This request was already decided.', 409);
    if (decision === 'REJECT') {
      // Give the XP back; the level never dropped because spending does not reduce lifetime XP.
      await tx.xpLedger.create({ data: { studentId: r.studentId, amount: r.costXp, source: 'REDEEM', reason: 'Reward request declined – XP returned', refKey: `refund:${id}`, day: dayKey(new Date()) } });
      const totals = await ledgerTotals(tx, r.studentId);
      await tx.studentXp.update({ where: { studentId: r.studentId }, data: { ...totals, level: levelForXp(totals.totalXp) } });
    }
    return { id, status: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED' };
  });
}
