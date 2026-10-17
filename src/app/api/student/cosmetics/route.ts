import { requireStudent } from '@/lib/services/student-auth';
import { handle, readJson } from '@/lib/http';
import { setCosmetics } from '@/lib/services/xp';

export async function POST(req: Request) {
  return handle(async () => {
    const student = await requireStudent(req);
    return setCosmetics(student.id, await readJson<{ avatar?: unknown; theme?: unknown }>(req));
  });
}
