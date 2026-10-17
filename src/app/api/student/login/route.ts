import { NextResponse } from 'next/server';
import { errorResponse, readJson } from '@/lib/http';
import { checkOrigin, studentLogin, STUDENT_COOKIE } from '@/lib/services/student-auth';

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const body = await readJson<{ username?: string; password?: string }>(req);
    const { token, maxAge } = await studentLogin(String(body.username ?? ''), String(body.password ?? ''), req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local');
    const res = NextResponse.json({ ok: true });
    res.cookies.set(STUDENT_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== 'true', path: '/', maxAge });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (e) { return errorResponse(e); }
}
