import { adminHandle, readJson } from '@/lib/http';
import { deleteReward, updateReward } from '@/lib/services/rewards';

type Context = { params: Promise<{ id: string }> };
export async function PUT(req: Request, ctx: Context) {
  const { id } = await ctx.params;
  return adminHandle(req, 'reward.update', async () => updateReward(id, await readJson(req)), () => ({ rewardId: id }));
}
export async function DELETE(req: Request, ctx: Context) {
  const { id } = await ctx.params;
  return adminHandle(req, 'reward.delete', async () => deleteReward(id), () => ({ rewardId: id }));
}
