import { adminHandle, readJson } from '@/lib/http';
import { cloneBank } from '@/lib/services/banks';

type P = { params: Promise<{ id: string }> };
export async function POST(req: Request, { params }: P) {
  const { id } = await params;
  const body = await readJson<{ name?: string }>(req).catch(() => ({}) as { name?: string });
  return adminHandle(req, 'bank.clone', async () => ({ bank: await cloneBank(id, body.name) }), () => ({ id }));
}
