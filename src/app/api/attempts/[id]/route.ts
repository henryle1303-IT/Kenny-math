import { requireStudent } from '@/lib/services/student-auth';
import { handle } from '@/lib/http';
import { getAttemptForTaking } from '@/lib/services/attempts';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => getAttemptForTaking((await params).id, (await requireStudent(req)).id));
}
