import { z } from 'zod';
import { prisma } from '../db';
import { AppError } from './attempts';
import { hashPassword } from './admin-auth';
import { validateStudentPassword } from './student-auth';
import { getLearningConfig } from './core';

export const publicProfile = { id: true, username: true, name: true, preferences: true, isActive: true, createdAt: true, learningConfig: true } as const;
const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{0,39}$/);
const intervalsSchema = z.object({ afterIncorrect: z.number().int().min(0).max(365), afterCorrectOnce: z.number().int().min(0).max(365), afterCorrectTwice: z.number().int().min(0).max(365), afterConsistent: z.number().int().min(0).max(365) }).strict();
const profileSchema = z.object({ username: usernameSchema, name: z.string().trim().min(1).max(40), lang: z.enum(['en', 'vi']), isActive: z.boolean(), intervals: intervalsSchema }).strict();

export async function findUser(id: string) {
  const student = await prisma.student.findUnique({ where: { id }, select: publicProfile });
  if (!student) throw new AppError('User not found.', 404);
  return student;
}

export async function createUser(value: unknown) {
  const parsed = z.object({ username: usernameSchema, name: z.string().trim().min(1).max(40), password: z.string(), lang: z.enum(['en', 'vi']).default('en') }).strict().safeParse(value);
  if (!parsed.success) throw new AppError('Enter a valid username, display name, language and password.');
  const { username, name, password, lang } = parsed.data;
  validateStudentPassword(password);
  if (await prisma.student.findUnique({ where: { username } })) throw new AppError('Username already exists.', 409);
  const config = await getLearningConfig();
  const bank = await prisma.questionBank.findFirst({ where: { isActive: true, status: 'PUBLISHED', ownerId: null } });
  return prisma.student.create({ data: { username, name, passwordHash: await hashPassword(password), preferences: JSON.stringify({ lang }), learningConfig: JSON.stringify(config), ...(bank ? { bankAssignment: { create: { bankId: bank.id } } } : {}) }, select: publicProfile });
}

export async function updateUser(id: string, value: unknown) {
  const parsed = profileSchema.safeParse(value);
  if (!parsed.success) throw new AppError('Invalid profile. Review the name, username, language and intervals (0–365 whole days).');
  const data = parsed.data;
  const student = await findUser(id);
  const taken = await prisma.student.findUnique({ where: { username: data.username } });
  if (taken && taken.id !== id) throw new AppError('Username already exists.', 409);
  const cfg = await getLearningConfig(prisma, id);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.student.update({ where: { id }, data: { username: data.username, name: data.name, isActive: data.isActive, preferences: JSON.stringify({ ...JSON.parse(student.preferences), lang: data.lang }), learningConfig: JSON.stringify({ ...cfg, intervals: data.intervals }) }, select: publicProfile });
    if (!data.isActive || data.username !== student.username) await tx.studentSession.deleteMany({ where: { studentId: id } });
    return updated;
  });
}

export async function assignBank(studentId: string, bankId: string) {
  await findUser(studentId);
  return prisma.$transaction(async (tx) => {
    const bank = await tx.questionBank.findUnique({ where: { id: bankId } });
    if (!bank || bank.status !== 'PUBLISHED' || (bank.ownerId && bank.ownerId !== studentId)) throw new AppError('Select a published shared bank or a bank owned by this user.', 409);
    return tx.studentBankAssignment.upsert({ where: { studentId }, create: { studentId, bankId }, update: { bankId } });
  });
}

/** Idempotent upgrade: never overwrites existing passwords, names, preferences or assignments. */
export async function initializeStudents() {
  const config = JSON.stringify(await getLearningConfig());
  const bank = await prisma.questionBank.findFirst({ where: { isActive: true, status: 'PUBLISHED', ownerId: null } });
  if (!bank) throw new AppError('Publish or select an existing shared bank before initializing users.', 409);
  for (const username of ['kenny', 'henry', 'xoai', 'moon']) {
    const byName = await prisma.student.findUnique({ where: { username } });
    const legacy = await prisma.student.findUnique({ where: { id: username } });
    if (byName && legacy && byName.id !== legacy.id) throw new AppError(`Username conflict for ${username}. Resolve the existing profiles before initialization.`, 409);
    const existing = byName ?? legacy;
    const hash = existing?.passwordHash ? undefined : await hashPassword('123');
    await prisma.$transaction(async (tx) => {
      const s = existing
        ? await tx.student.update({ where: { id: existing.id }, data: { ...(existing.username ? {} : { username }), ...(hash ? { passwordHash: hash } : {}), ...(existing.learningConfig ? {} : { learningConfig: config }) } })
        : await tx.student.create({ data: { id: username, username, name: username[0].toUpperCase() + username.slice(1), passwordHash: hash, learningConfig: config } });
      await tx.studentBankAssignment.upsert({ where: { studentId: s.id }, create: { studentId: s.id, bankId: bank.id }, update: {} });
    });
  }
}
