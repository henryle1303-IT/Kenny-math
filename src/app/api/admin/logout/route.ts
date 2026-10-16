import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminFromToken, cookieFromHeader, logout } from '@/lib/services/admin-auth';

export async function POST(req: Request) {
  const token = cookieFromHeader(req.headers.get('cookie'), ADMIN_COOKIE);
  const admin = await adminFromToken(token);
  await logout(token, admin?.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
