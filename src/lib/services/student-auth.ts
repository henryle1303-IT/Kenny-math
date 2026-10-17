import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../db';
import { AppError } from './attempts';
import { cookieFromHeader, hashPassword } from './admin-auth';

export const STUDENT_COOKIE = 'kmc_student';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const failures = new Map<string, { count: number; first: number }>();
const safeStudent = { id: true, name: true, username: true, preferences: true, isActive: true } as const;

export function checkOrigin(req: Request) {
  if (['GET', 'HEAD'].includes(req.method)) return;
  const origin = req.headers.get('origin');
  if (!origin) return;
  let host = '';
  try { host = new URL(origin).host; } catch { /* reject below */ }
  if (!host || host !== (req.headers.get('x-forwarded-host') ?? req.headers.get('host'))) throw new AppError('Request blocked (cross-site).', 403, 'CSRF');
}

export async function studentLogin(username: string, password: string, ip: string) {
  username = username.trim().toLowerCase();
  if (username.length > 40 || password.length > 128) throw new AppError('Incorrect username or password.', 401);
  const key = `${ip}|${username}`;
  const now = Date.now();
  const f = failures.get(key);
  if (f && now - f.first < 900_000 && f.count >= 5) throw new AppError('Too many failed attempts. Please wait 15 minutes.', 429);
  const student = await prisma.student.findUnique({ where: { username } });
  const ok = await bcrypt.compare(password, student?.passwordHash ?? '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5Y3xYb7q0G5B1N3E8x1Yq3lq0uU0b2i');
  if (!student?.isActive || !student.passwordHash || !ok) {
    if (failures.size > 10000) for (const [k, v] of failures) if (now - v.first >= 900_000) failures.delete(k);
    failures.set(key, { count: f && now - f.first < 900_000 ? f.count + 1 : 1, first: f && now - f.first < 900_000 ? f.first : now });
    throw new AppError('Incorrect username or password.', 401, 'BAD_LOGIN');
  }
  failures.delete(key);
  const token = randomBytes(32).toString('base64url');
  const maxAge = 12 * 3600;
  await prisma.studentSession.create({ data: { studentId: student.id, tokenHash: sha(token), expiresAt: new Date(now + maxAge * 1000) } });
  await prisma.studentSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return { token, maxAge };
}

export async function studentFromToken(token?: string | null) {
  if (!token) return null;
  const session = await prisma.studentSession.findUnique({ where: { tokenHash: sha(token) }, include: { student: { select: safeStudent } } });
  return session && session.expiresAt.getTime() > Date.now() && session.student.isActive ? session.student : null;
}

export async function currentStudent() {
  const { cookies } = await import('next/headers');
  return studentFromToken((await cookies()).get(STUDENT_COOKIE)?.value);
}

export async function requireStudent(req: Request) {
  checkOrigin(req);
  const student = await studentFromToken(cookieFromHeader(req.headers.get('cookie'), STUDENT_COOKIE));
  if (!student) throw new AppError('Please sign in.', 401, 'UNAUTHORIZED');
  return student;
}

export async function studentLogout(token?: string) {
  if (token) await prisma.studentSession.deleteMany({ where: { tokenHash: sha(token) } });
}

export function validateStudentPassword(password: string) {
  if (password.length < 3 || password.length > 128 || Buffer.byteLength(password) > 72) throw new AppError('Use a password of 3–72 bytes.');
}

export async function setStudentPassword(studentId: string, password: string, current?: string) {
  validateStudentPassword(password);
  const hash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({ where: { id: studentId } });
    if (!student) throw new AppError('User not found.', 404);
    if (current !== undefined && (!student.passwordHash || !await bcrypt.compare(current, student.passwordHash))) throw new AppError('Your current password is not correct.');
    await tx.student.update({ where: { id: studentId }, data: { passwordHash: hash } });
    await tx.studentSession.deleteMany({ where: { studentId } });
  });
}
