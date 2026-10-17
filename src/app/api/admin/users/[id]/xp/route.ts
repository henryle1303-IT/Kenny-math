import { adminHandle, readJson } from '@/lib/http';
import { adminXpView, grantXp, rebuildXp, resetXp } from '@/lib/services/xp';
import { AppError } from '@/lib/services/attempts';

type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, ctx: Context) {
  return adminHandle(req, 'read.userXp', async () => adminXpView((await ctx.params).id));
}
export async function POST(req: Request, ctx: Context) {
  const { id } = await ctx.params;
  let action = '';
  return adminHandle(req, 'user.xp', async () => {
    const body = await readJson<{ action?: string; amount?: unknown; note?: unknown; confirm?: unknown }>(req);
    action = String(body.action ?? '');
    if (action === 'grant') { await grantXp(id, body.amount, body.note); return adminXpView(id); }
    if (action === 'rebuild') {
      if (body.confirm !== 'REBUILD') throw new AppError('Type REBUILD to confirm.');
      await rebuildXp(id); return adminXpView(id);
    }
    if (action === 'reset') {
      if (body.confirm !== 'RESET') throw new AppError('Type RESET to confirm.');
      await resetXp(id); return adminXpView(id);
    }
    throw new AppError('Unknown XP action.');
  }, () => ({ studentId: id, action }));
}
