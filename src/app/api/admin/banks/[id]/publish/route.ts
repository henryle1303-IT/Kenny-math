import { adminHandle, readJson } from '@/lib/http';
import { publishBank } from '@/lib/services/banks';
import { AppError } from '@/lib/services/attempts';

type P = { params: Promise<{ id: string }> };
export async function POST(req: Request, { params }: P) {
  const { id } = await params;
  const body = await readJson<{ confirm?: boolean; acknowledgeReview?: boolean }>(req);
  return adminHandle(req, 'bank.publish', async () => {
    if (!body.confirm) throw new AppError('Please confirm that you want to publish and activate this bank.', 400, 'CONFIRM_REQUIRED');
    return publishBank(id, { acknowledgeReview: !!body.acknowledgeReview });
  }, () => ({ id }));
}
