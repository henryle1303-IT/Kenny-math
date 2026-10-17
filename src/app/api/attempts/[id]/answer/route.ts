import { requireStudent } from '@/lib/services/student-auth';
import { handle, readJson } from '@/lib/http';
import { saveAnswer } from '@/lib/services/attempts';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const student = await requireStudent(req);
    const { questionId, selected } = await readJson<{ questionId?: string; selected?: string | null }>(req);
    return saveAnswer((await params).id, String(questionId ?? ''), selected ?? null, student.id);
  });
}
