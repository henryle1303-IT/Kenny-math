import bcrypt from 'bcryptjs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { prisma } from '../db';
import { AppError } from './attempts';

export const ADMIN_COOKIE = 'kmc_admin';
const SESSION_HOURS = 12;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

const fails = new Map<string, { count: number; first: number }>();

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export function validatePasswordStrength(pw: string) {
  if (pw.length < 10) throw new AppError('Use a password with at least 10 characters.');
}

export async function login(email: string, password: string, ip: string) {
  const key = `${ip}|${email.toLowerCase()}`;
  const f = fails.get(key);
  if (f && Date.now() - f.first < LOCK_MS && f.count >= MAX_FAILS) {
    throw new AppError('Too many failed attempts. Please wait 15 minutes and try again.', 429, 'RATE_LIMITED');
  }
  const admin = await prisma.adminUser.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Always run a hash comparison so timing does not reveal whether the account exists.
  const hash = admin?.passwordHash ?? '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5Y3xYb7q0G5B1N3E8x1Yq3lq0uU0b2i';
  const ok = await bcrypt.compare(password, hash);
  if (!admin || !ok) {
    const now = Date.now();
    const cur = !f || now - f.first > LOCK_MS ? { count: 0, first: now } : f;
    cur.count++;
    fails.set(key, cur);
    await audit(admin?.id ?? null, 'login.failed', { email: email.slice(0, 120) });
    throw new AppError('Incorrect email or password.', 401, 'BAD_LOGIN');
  }
  fails.delete(key);
  const token = randomBytes(32).toString('base64url');
  await prisma.adminSession.create({ data: { adminId: admin.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + SESSION_HOURS * 3600_000) } });
  await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await audit(admin.id, 'login', {});
  return { token, admin, maxAge: SESSION_HOURS * 3600 };
}

export async function logout(token: string | undefined, adminId?: string) {
  if (!token) return;
  await prisma.adminSession.deleteMany({ where: { tokenHash: sha(token) } });
  if (adminId) await audit(adminId, 'logout', {});
}

export async function adminFromToken(token: string | undefined | null) {
  if (!token) return null;
  const s = await prisma.adminSession.findUnique({ where: { tokenHash: sha(token) }, include: { admin: true } });
  if (!s || s.expiresAt.getTime() < Date.now()) return null;
  return s.admin;
}

export function cookieFromHeader(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/** Server-side authorisation for admin API routes. Also rejects cross-site writes. */
export async function requireAdmin(req: Request) {
  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    const origin = req.headers.get('origin');
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
    if (origin) {
      let oh = '';
      try {
        oh = new URL(origin).host;
      } catch {
        /* invalid origin */
      }
      if (!host || oh !== host) throw new AppError('Request blocked (cross-site).', 403, 'CSRF');
    }
  }
  const admin = await adminFromToken(cookieFromHeader(req.headers.get('cookie'), ADMIN_COOKIE));
  if (!admin) throw new AppError('Please sign in as an administrator.', 401, 'UNAUTHORIZED');
  return admin;
}

export async function audit(adminId: string | null, operation: string, details: unknown) {
  try {
    await prisma.adminAuditLog.create({ data: { adminId, operation, details: JSON.stringify(details ?? {}).slice(0, 4000) } });
  } catch {
    /* auditing must never break the request */
  }
}

export async function changePassword(adminId: string, current: string, next: string) {
  const a = await prisma.adminUser.findUnique({ where: { id: adminId } });
  if (!a || !(await bcrypt.compare(current, a.passwordHash))) throw new AppError('Your current password is not correct.', 400);
  validatePasswordStrength(next);
  await prisma.adminUser.update({ where: { id: adminId }, data: { passwordHash: await hashPassword(next) } });
  await audit(adminId, 'password.changed', {});
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
