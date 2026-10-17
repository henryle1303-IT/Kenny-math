import { findUser } from '@/lib/services/users';
import { NextResponse } from 'next/server';
import { adminHandle, errorResponse } from '@/lib/http';
import { requireAdmin, audit } from '@/lib/services/admin-auth';
import { exportProgress, saveProgress, savedProgress, importProgress, MAX_PROGRESS_BYTES } from '@/lib/services/progress-backup';
import { AppError } from '@/lib/services/attempts';

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin(req);
    const studentId = new URL(req.url).searchParams.get('studentId') ?? '';
    const student = await findUser(studentId);
    const saved = new URL(req.url).searchParams.get('saved') === '1';
    const backup = saved ? await savedProgress(studentId) : await exportProgress(studentId);
    if (!backup) throw new AppError('No saved backup yet.', 404);
    await audit(admin.id, 'student.progress.export', { saved, studentId });
    return new NextResponse(JSON.stringify(backup), { headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${student.username ?? student.id}-progress-${saved ? 'saved' : new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    } });
  } catch (e) { return errorResponse(e); }
}

export async function POST(req: Request) {
  const studentId = new URL(req.url).searchParams.get('studentId') ?? '';
  let action = '';
  return adminHandle(req, 'student.progress.backup', async () => {
    await findUser(studentId);
    // Read the stream with a hard bound, including requests without Content-Length.
    const reader = req.body?.getReader();
    if (!reader) throw new AppError('Choose a progress backup.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PROGRESS_BYTES) { await reader.cancel(); throw new AppError('Backup must be smaller than 4 MB.', 413); }
      chunks.push(value);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AppError('Invalid JSON backup.'); }
    action = String(body?.action ?? '');
    if (body?.action === 'save') return { ok: true, summary: await saveProgress(studentId) };
    if (body?.action === 'import') return { ok: true, summary: await importProgress(body.backup, body.confirmation, studentId) };
    throw new AppError('Unknown progress action.');
  }, () => ({ studentId, action }));
}
