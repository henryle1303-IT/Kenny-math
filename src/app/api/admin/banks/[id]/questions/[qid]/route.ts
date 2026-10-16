import { adminHandle, readJson } from '@/lib/http';
import { deleteQuestion, updateQuestion, type QuestionEdit } from '@/lib/services/banks';

type P = { params: Promise<{ id: string; qid: string }> };
export async function PUT(req: Request, { params }: P) {
  const { id, qid } = await params;
  const body = await readJson<QuestionEdit>(req);
  return adminHandle(req, 'question.update', async () => ({ validation: await updateQuestion(id, qid, body) }), () => ({ id, qid }));
}
export async function DELETE(req: Request, { params }: P) {
  const { id, qid } = await params;
  return adminHandle(req, 'question.delete', async () => {
    await deleteQuestion(id, qid);
    return { ok: true };
  }, () => ({ id, qid }));
}
