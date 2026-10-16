import { adminHandle, readJson } from '@/lib/http';
import { createBank, listBanks } from '@/lib/services/banks';
import { DEFAULT_BANK_SEED } from '@/lib/gen/bank';

export async function GET(req: Request) {
  return adminHandle(req, 'read.banks', async () => ({ banks: await listBanks() }));
}

/** Create an empty draft bank (the generator then fills it in batches). */
export async function POST(req: Request) {
  const body = await readJson<{ name?: string; seed?: string }>(req);
  return adminHandle(req, 'bank.create', async () => {
    const seed = body.seed?.trim() || `${DEFAULT_BANK_SEED}-${Date.now().toString(36)}`;
    const bank = await createBank({ name: String(body.name ?? 'New question bank'), source: 'GENERATED', seed });
    return { bank };
  }, () => ({ name: body.name }));
}
