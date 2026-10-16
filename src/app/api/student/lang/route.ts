import { prisma } from '@/lib/db';
import { handle, readJson } from '@/lib/http';
import { getStudent } from '@/lib/services/core';

export async function POST(req: Request) {
  return handle(async () => {
    const { lang } = await readJson<{ lang?: string }>(req);
    const s = await getStudent();
    await prisma.student.update({ where: { id: s.id }, data: { preferences: JSON.stringify({ ...JSON.parse(s.preferences || '{}'), lang: lang === 'vi' ? 'vi' : 'en' }) } });
    return { ok: true };
  });
}
