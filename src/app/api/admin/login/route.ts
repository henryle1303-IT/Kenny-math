import { NextResponse } from 'next/server';
import { errorResponse, readJson } from '@/lib/http';
import { ADMIN_COOKIE, login } from '@/lib/services/admin-auth';

export async function POST(req: Request) {
  try {
    const { email, password } = await readJson<{ email?: string; password?: string }>(req);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const { token, maxAge } = await login(String(email ?? ''), String(password ?? ''), ip);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== 'true',
      path: '/',
      maxAge,
    });
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
