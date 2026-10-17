import { handle, readJson } from '@/lib/http';
import { requireStudent, setStudentPassword } from '@/lib/services/student-auth';

export async function POST(req: Request) {
  return handle(async () => {
    const student = await requireStudent(req);
    const body = await readJson<{ current?: string; next?: string }>(req);
    await setStudentPassword(student.id, String(body.next ?? ''), String(body.current ?? ''));
    return { ok: true };
  });
}
