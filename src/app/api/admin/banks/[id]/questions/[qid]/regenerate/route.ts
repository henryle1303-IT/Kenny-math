import { adminHandle } from '@/lib/http';
import { regenerateQuestion } from '@/lib/services/banks';

type P = { params: Promise<{ id: string; qid: string }> };
export async function POST(req: Request, { params }: P) {
  const { id, qid } = await params;
  return adminHandle(req, 'question.regenerate', async () => {
    await regenerateQuestion(id, qid);
    return { ok: true };
  }, () => ({ id, qid }));
}
