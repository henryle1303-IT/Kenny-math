import { requireStudent } from '@/lib/services/student-auth';
import { handle } from '@/lib/http';
import { submitAttempt } from '@/lib/services/attempts';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => submitAttempt((await params).id, (await requireStudent(req)).id));
}
