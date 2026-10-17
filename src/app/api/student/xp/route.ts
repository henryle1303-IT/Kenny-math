import { requireStudent } from '@/lib/services/student-auth';
import { handle } from '@/lib/http';
import { getXpSummary } from '@/lib/services/xp';

export async function GET(req: Request) {
  return handle(async () => getXpSummary((await requireStudent(req)).id));
}
