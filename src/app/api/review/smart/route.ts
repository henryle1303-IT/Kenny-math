import { requireStudent } from '@/lib/services/student-auth';
import { handle } from '@/lib/http';
import { createSmartSession } from '@/lib/services/review';

export async function POST(req: Request) {
  return handle(async () => ({ sessionId: await createSmartSession((await requireStudent(req)).id) }));
}
