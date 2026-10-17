import { AppError } from '@/lib/services/attempts';
import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/http';
import { audit, requireAdmin } from '@/lib/services/admin-auth';
import { exportBankCsv } from '@/lib/services/banks';
import { parseTests } from '@/lib/csv/export';

type P = { params: Promise<{ id: string }> };
export async function GET(req: Request, { params }: P) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await params;
    let tests: number[] | undefined;
    try { tests = parseTests(new URL(req.url).searchParams.get('tests')); } catch (e) { throw new AppError((e as Error).message); }
    const { csv, bank, count } = await exportBankCsv(id, tests);
    await audit(admin.id, 'bank.export', { id, tests, count });
    const name = `kenny-math-bank-v${bank.version}${tests?.length ? `-tests-${tests[0]}-${tests[tests.length - 1]}` : ''}.csv`;
    return new NextResponse(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
