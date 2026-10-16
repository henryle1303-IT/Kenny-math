import { adminHandle, readJson } from '@/lib/http';
import { changePassword } from '@/lib/services/admin-auth';
import { getLearningConfig, getStudent, setSetting } from '@/lib/services/core';
import { prisma } from '@/lib/db';
import { AppError } from '@/lib/services/attempts';

export async function GET(req: Request) {
  return adminHandle(req, 'read.settings', async () => ({ learning: await getLearningConfig(), student: await getStudent() }));
}

export async function POST(req: Request) {
  const body = await readJson<{ action?: string; current?: string; next?: string; intervals?: Record<string, number>; studentName?: string }>(req);
  return adminHandle(req, `settings.${body.action ?? 'unknown'}`, async (admin) => {
    if (body.action === 'password') {
      await changePassword(admin.id, String(body.current ?? ''), String(body.next ?? ''));
      return { ok: true };
    }
    if (body.action === 'intervals') {
      const cur = await getLearningConfig();
      const iv = body.intervals ?? {};
      const num = (k: string, d: number) => {
        const v = Number(iv[k]);
        if (!Number.isFinite(v) || v < 0 || v > 365) throw new AppError(`Invalid number of days for ${k}.`);
        return v ?? d;
      };
      await setSetting('learningConfig', JSON.stringify({ ...cur, intervals: { afterIncorrect: num('afterIncorrect', 0), afterCorrectOnce: num('afterCorrectOnce', 1), afterCorrectTwice: num('afterCorrectTwice', 3), afterConsistent: num('afterConsistent', 7) } }));
      return { ok: true };
    }
    if (body.action === 'student') {
      const name = String(body.studentName ?? '').trim().slice(0, 40);
      if (!name) throw new AppError('Please enter a name.');
      await prisma.student.update({ where: { id: (await getStudent()).id }, data: { name } });
      return { ok: true };
    }
    throw new AppError('Unknown settings action.');
  }, () => ({}));
}
