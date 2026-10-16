import { adminHandle, readJson } from '@/lib/http';
import { STUDENT_ID } from '@/lib/services/core';
import { clearStudentProgress } from '@/lib/services/progress';

export async function POST(req: Request) {
  let deleted: Awaited<ReturnType<typeof clearStudentProgress>> | undefined;
  return adminHandle(req, 'student.progress.clear', async () => {
    const body = await readJson<{ confirmation?: unknown } | null>(req);
    deleted = await clearStudentProgress(body?.confirmation);
    return { ok: true, deleted };
  }, () => ({ studentId: STUDENT_ID, deleted }));
}
