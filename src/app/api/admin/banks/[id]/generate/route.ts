import { adminHandle, readJson } from '@/lib/http';
import { generateTests } from '@/lib/services/banks';

type P = { params: Promise<{ id: string }> };
export async function POST(req: Request, { params }: P) {
  const { id } = await params;
  const body = await readJson<{ tests?: number[]; onlyTopic?: string }>(req);
  return adminHandle(req, 'bank.generate', () => generateTests(id, { tests: (body.tests ?? []).map(Number), onlyTopic: body.onlyTopic || undefined }), () => ({ id, tests: body.tests, topic: body.onlyTopic }));
}
