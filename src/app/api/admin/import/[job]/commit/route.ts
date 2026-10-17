import { adminHandle, readJson } from '@/lib/http';
import { commitImport, getImportJob } from '@/lib/services/importer';

type P = { params: Promise<{ job: string }> };
export async function POST(req: Request, { params }: P) {
  const { job } = await params;
  let targetStudentId: string | null = null;
  const body = await readJson<{ name?: string; activate?: boolean; confirmText?: string; acknowledgeReview?: boolean }>(req);
  return adminHandle(req, 'import.commit', async () => {
    targetStudentId = (await getImportJob(job)).job.targetStudentId;
    const r = await commitImport(job, body);
    return { bankId: r.bankId, activated: r.activated, ok: r.report.ok };
  }, () => ({ job, targetStudentId, activate: body.activate }));
}
