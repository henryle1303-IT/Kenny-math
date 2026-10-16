import { handle } from '@/lib/http';
import { submitAttempt } from '@/lib/services/attempts';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => submitAttempt((await params).id));
}
