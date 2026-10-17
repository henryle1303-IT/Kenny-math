import { requireStudent } from '@/lib/services/student-auth';
import { handle, readJson } from '@/lib/http';
import { startAttempt } from '@/lib/services/attempts';

export async function POST(req: Request) {
  return handle(async () => {
    const student = await requireStudent(req);
    const { testNumber } = await readJson<{ testNumber?: number }>(req);
    return startAttempt(Number(testNumber), student.id);
  });
}
