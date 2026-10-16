import { adminHandle } from '@/lib/http';
import { analyzeImport, type ImportMode } from '@/lib/services/importer';
import { AppError } from '@/lib/services/attempts';
import { MAX_UPLOAD_BYTES } from '@/lib/csv/import';

export async function POST(req: Request) {
  return adminHandle(req, 'import.upload', async () => {
    const len = Number(req.headers.get('content-length') ?? 0);
    if (len > MAX_UPLOAD_BYTES + 100_000) throw new AppError('The file is too large (limit 5 MB).', 413);
    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!form || !(file instanceof File)) throw new AppError('Please choose a CSV file to upload.');
    const mode = String(form.get('mode') ?? 'NEW_BANK') as ImportMode;
    if (!['NEW_BANK', 'REPLACE_ACTIVE', 'UPDATE_SELECTED'].includes(mode)) throw new AppError('Unknown import mode.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { jobId, report } = await analyzeImport({ name: file.name, bytes }, mode, { baseBankId: String(form.get('baseBankId') ?? '') || null, includeExamples: form.get('includeExamples') === 'true' });
    return { jobId, report: { ...report, issues: report.issues.slice(0, 300) } };
  });
}
