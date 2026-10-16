import { adminHandle } from '@/lib/http';
import { markReviewed } from '@/lib/services/banks';

type P = { params: Promise<{ id: string; qid: string }> };
export async function POST(req: Request, { params }: P) {
  const { id, qid } = await params;
  return adminHandle(req, 'question.reviewed', async () => {
    await markReviewed(id, qid);
    return { ok: true };
  }, () => ({ id, qid }));
}
