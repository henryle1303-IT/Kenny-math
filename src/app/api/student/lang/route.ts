import { requireStudent } from '@/lib/services/student-auth';
import { prisma } from '@/lib/db';
import { handle, readJson } from '@/lib/http';

export async function POST(req: Request) {
  return handle(async () => {
    const student = await requireStudent(req);
    const { lang } = await readJson<{ lang?: string }>(req);
    const s = student;
    await prisma.student.update({ where: { id: s.id }, data: { preferences: JSON.stringify({ ...JSON.parse(s.preferences || '{}'), lang: lang === 'vi' ? 'vi' : 'en' }) } });
    return { ok: true };
  });
}
