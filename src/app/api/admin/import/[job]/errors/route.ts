import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/http';
import { requireAdmin } from '@/lib/services/admin-auth';
import { errorReportCsv } from '@/lib/services/importer';

type P = { params: Promise<{ job: string }> };
export async function GET(req: Request, { params }: P) {
  try {
    await requireAdmin(req);
    const { job } = await params;
    return new NextResponse(await errorReportCsv(job), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="import-error-report.csv"' } });
  } catch (e) {
    return errorResponse(e);
  }
}
