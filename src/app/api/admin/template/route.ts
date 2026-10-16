import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/http';
import { requireAdmin } from '@/lib/services/admin-auth';
import { buildTemplateCsv } from '@/lib/csv/export';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    return new NextResponse(buildTemplateCsv(), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="kenny-math-question-template.csv"' } });
  } catch (e) {
    return errorResponse(e);
  }
}
