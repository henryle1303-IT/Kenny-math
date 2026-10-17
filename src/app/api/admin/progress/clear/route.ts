import { adminHandle, readJson } from '@/lib/http';
import { findUser } from '@/lib/services/users';
import { clearStudentProgress } from '@/lib/services/progress';

export async function POST(req: Request) {
  const studentId = new URL(req.url).searchParams.get('studentId') ?? '';
  let deleted: Awaited<ReturnType<typeof clearStudentProgress>> | undefined;
  return adminHandle(req, 'student.progress.clear', async () => {
    await findUser(studentId);
    const body = await readJson<{ confirmation?: unknown } | null>(req);
    deleted = await clearStudentProgress(body?.confirmation, studentId);
    return { ok: true, deleted };
  }, () => ({ studentId, deleted }));
}
