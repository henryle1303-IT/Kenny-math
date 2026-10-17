import { adminHandle, readJson } from '@/lib/http';
import { findUser, updateUser, assignBank } from '@/lib/services/users';
import { setStudentPassword } from '@/lib/services/student-auth';
import { AppError } from '@/lib/services/attempts';

type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, ctx: Context) {
  return adminHandle(req, 'read.user', async () => findUser((await ctx.params).id));
}
export async function POST(req: Request, ctx: Context) {
  const { id } = await ctx.params;
  let action = '';
  return adminHandle(req, 'user.update', async () => {
    const body = await readJson<{ action?: string; profile?: unknown; password?: string; bankId?: string }>(req);
    action = String(body.action ?? '');
    if (action === 'profile') return updateUser(id, body.profile);
    if (action === 'password') { await setStudentPassword(id, String(body.password ?? '')); return { ok: true }; }
    if (action === 'bank') return assignBank(id, String(body.bankId ?? ''));
    throw new AppError('Unknown user action.');
  }, () => ({ studentId: id, action }));
}
