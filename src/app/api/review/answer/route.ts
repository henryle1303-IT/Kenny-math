import { handle, readJson } from '@/lib/http';
import { answerReviewQuestion } from '@/lib/services/review';

export async function POST(req: Request) {
  return handle(async () => {
    const { reviewQuestionId, selected } = await readJson<{ reviewQuestionId?: string; selected?: string }>(req);
    return answerReviewQuestion(String(reviewQuestionId ?? ''), String(selected ?? ''));
  });
}
