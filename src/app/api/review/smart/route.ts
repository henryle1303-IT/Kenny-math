import { handle } from '@/lib/http';
import { createSmartSession } from '@/lib/services/review';

export async function POST() {
  return handle(async () => ({ sessionId: await createSmartSession() }));
}
