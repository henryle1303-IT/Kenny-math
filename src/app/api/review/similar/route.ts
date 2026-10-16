import { handle, readJson } from '@/lib/http';
import { createSimilarSession } from '@/lib/services/review';

export async function POST(req: Request) {
  return handle(async () => {
    const { questionId, tier } = await readJson<{ questionId?: string; tier?: number }>(req);
    return { sessionId: await createSimilarSession(String(questionId ?? ''), tier ? Number(tier) : undefined) };
  });
}
