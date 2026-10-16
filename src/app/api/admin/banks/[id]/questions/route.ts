import { adminHandle, readJson } from '@/lib/http';
import { createQuestion, listQuestions } from '@/lib/services/banks';
import type { QuestionData } from '@/lib/validate/question';

type P = { params: Promise<{ id: string }> };
export async function GET(req: Request, { params }: P) {
  const { id } = await params;
  const u = new URL(req.url).searchParams;
  return adminHandle(req, 'read.questions', async () =>
    listQuestions(id, {
      q: u.get('q') ?? undefined,
      test: u.get('test') ? Number(u.get('test')) : undefined,
      topic: u.get('topic') ?? undefined,
      difficulty: u.get('difficulty') ? Number(u.get('difficulty')) : undefined,
      status: u.get('status') ?? undefined,
      page: u.get('page') ? Number(u.get('page')) : 1,
    }),
  );
}
export async function POST(req: Request, { params }: P) {
  const { id } = await params;
  const body = await readJson<QuestionData>(req);
  return adminHandle(req, 'question.create', async () => ({ question: await createQuestion(id, body) }), () => ({ id, questionId: body.questionId }));
}
