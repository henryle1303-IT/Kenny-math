import { z } from 'zod';
import { adminHandle, readJson } from '@/lib/http';
import { changePassword, cookieFromHeader, ADMIN_COOKIE } from '@/lib/services/admin-auth';
import { getLearningConfig, setSetting } from '@/lib/services/core';
import { AppError } from '@/lib/services/attempts';

const days = z.number().int().min(0).max(365);
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('password'), current: z.string(), next: z.string() }).strict(),
  z.object({ action: z.literal('intervals'), intervals: z.object({ afterIncorrect: days, afterCorrectOnce: days, afterCorrectTwice: days, afterConsistent: days }).strict() }).strict(),
]);

export async function GET(req: Request) {
  return adminHandle(req, 'read.settings', async () => ({ learning: await getLearningConfig() }));
}

export async function POST(req: Request) {
  let action = '';
  return adminHandle(req, 'settings.update', async (admin) => {
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) throw new AppError('Invalid settings. Review the password fields or enter whole days from 0 to 365 for every interval.');
    const body = parsed.data;
    action = body.action;
    if (body.action === 'password') {
      await changePassword(admin.id, body.current, body.next, cookieFromHeader(req.headers.get('cookie'), ADMIN_COOKIE));
    } else {
      const current = await getLearningConfig();
      await setSetting('learningConfig', JSON.stringify({ ...current, intervals: body.intervals }));
    }
    return { ok: true };
  }, () => ({ action }));
}
