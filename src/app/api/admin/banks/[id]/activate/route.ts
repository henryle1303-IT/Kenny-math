import { adminHandle, readJson } from '@/lib/http';
import { activateBank } from '@/lib/services/banks';
import { AppError } from '@/lib/services/attempts';

type P = { params: Promise<{ id: string }> };
export async function POST(req: Request, { params }: P) {
  const { id } = await params;
  const body = await readJson<{ confirm?: boolean }>(req);
  return adminHandle(req, 'bank.activate', async () => {
    if (!body.confirm) throw new AppError('Please confirm the activation.', 400, 'CONFIRM_REQUIRED');
    return activateBank(id);
  }, () => ({ id }));
}
