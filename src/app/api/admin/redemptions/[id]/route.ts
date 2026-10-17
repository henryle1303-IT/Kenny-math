import { adminHandle, readJson } from '@/lib/http';
import { decideRedemption } from '@/lib/services/rewards';

type Context = { params: Promise<{ id: string }> };
export async function POST(req: Request, ctx: Context) {
  const { id } = await ctx.params;
  return adminHandle(req, 'reward.decide', async () => decideRedemption(id, (await readJson<{ decision?: unknown }>(req)).decision), () => ({ redemptionId: id }));
}
