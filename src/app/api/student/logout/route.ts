import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/http';
import { cookieFromHeader } from '@/lib/services/admin-auth';
import { checkOrigin, studentLogout, STUDENT_COOKIE } from '@/lib/services/student-auth';

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    await studentLogout(cookieFromHeader(req.headers.get('cookie'), STUDENT_COOKIE));
    const res = NextResponse.json({ ok: true });
    res.cookies.set(STUDENT_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' && process.env.INSECURE_COOKIES !== 'true', path: '/', maxAge: 0 });
    return res;
  } catch (e) { return errorResponse(e); }
}
