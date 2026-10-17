import { adminHandle, readJson } from '@/lib/http';
import { adminListRewards, createReward } from '@/lib/services/rewards';

export async function GET(req: Request) {
  return adminHandle(req, 'read.rewards', async () => adminListRewards());
}
export async function POST(req: Request) {
  return adminHandle(req, 'reward.create', async () => createReward(await readJson(req)));
}
