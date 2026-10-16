import { adminHandle } from '@/lib/http';
import { validateBankById } from '@/lib/services/banks';

type P = { params: Promise<{ id: string }> };
export async function POST(req: Request, { params }: P) {
  const { id } = await params;
  return adminHandle(req, 'bank.validate', async () => {
    const { perQuestion: _p, ...report } = await validateBankById(id);
    return { ...report, issues: report.issues.slice(0, 300) };
  }, () => ({ id }));
}
