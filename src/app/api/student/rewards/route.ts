import { requireStudent } from '@/lib/services/student-auth';
import { handle, readJson } from '@/lib/http';
import { listRewardsForStudent, redeemReward } from '@/lib/services/rewards';

export async function GET(req: Request) {
  return handle(async () => listRewardsForStudent((await requireStudent(req)).id));
}
export async function POST(req: Request) {
  return handle(async () => {
    const student = await requireStudent(req);
    const { rewardId } = await readJson<{ rewardId?: unknown }>(req);
    return redeemReward(student.id, rewardId);
  });
}
