import { adminHandle, readJson } from '@/lib/http';
import { archiveBank, deleteBank } from '@/lib/services/banks';

type P = { params: Promise<{ id: string }> };
export async function POST(req: Request, { params }: P) {
  const { id } = await params;
  return adminHandle(req, 'bank.archive', async () => {
    await archiveBank(id);
    return { ok: true };
  }, () => ({ id }));
}
export async function DELETE(req: Request, { params }: P) {
  const { id } = await params;
  const body = await readJson<{ confirmName?: string }>(req);
  return adminHandle(req, 'bank.delete', async () => {
    await deleteBank(id, String(body.confirmName ?? ''));
    return { ok: true };
  }, () => ({ id }));
}
