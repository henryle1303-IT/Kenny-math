import { adminHandle, readJson } from '@/lib/http';
import { getXpConfig, saveXpConfig } from '@/lib/services/xp';

export async function GET(req: Request) {
  return adminHandle(req, 'read.xpConfig', async () => getXpConfig());
}
export async function PUT(req: Request) {
  return adminHandle(req, 'xp.config', async () => saveXpConfig(await readJson(req)));
}
