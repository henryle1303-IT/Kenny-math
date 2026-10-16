import { adminHandle } from '@/lib/http';
import { duplicateQuestion } from '@/lib/services/banks';

type P = { params: Promise<{ id: string; qid: string }> };
export async function POST(req: Request, { params }: P) {
  const { id, qid } = await params;
  return adminHandle(req, 'question.duplicate', async () => ({ question: await duplicateQuestion(id, qid) }), () => ({ id, qid }));
}
