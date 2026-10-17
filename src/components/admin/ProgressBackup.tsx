'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

type Preview = { exportedAt: string; student: { name: string }; attempts: unknown[]; answers: unknown[]; sessions: unknown[]; skills: unknown[] };

export function ProgressBackup({ savedAt, studentId, studentName }: { savedAt: string | null; studentId: string; studentName: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const selection = useRef(0);
  const [lastSaved, setLastSaved] = useState(savedAt);
  const [backup, setBackup] = useState<Preview | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function choose(file?: File) {
    const current = ++selection.current;
    setBackup(null); setConfirmation(''); setError(''); setMessage('');
    if (!file) return;
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error('Backup must be smaller than 4 MB.');
      const b = JSON.parse(await file.text());
      if (current !== selection.current) return;
      if (b?.format !== 'kenny-math-progress' || b.version !== 1 || typeof b.student?.name !== 'string' || !Number.isFinite(Date.parse(b.exportedAt)) || ![b.attempts, b.answers, b.sessions, b.skills].every(Array.isArray)) throw new Error('Choose a JSON progress backup exported by Kenny Math.');
      setBackup(b);
    } catch (e) { if (current === selection.current) setError(e instanceof SyntaxError ? 'The file is not valid JSON.' : (e as Error).message); }
  }

  async function run(action: 'save' | 'import') {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await api<{ summary: { exportedAt: string } }>(`/api/admin/progress/backup?studentId=${encodeURIComponent(studentId)}`, 'POST', action === 'save' ? { action } : { action, backup, confirmation });
      if (action === 'save') { setLastSaved(result.summary.exportedAt); setMessage('Progress backup saved to the database.'); }
      else {
        setLastSaved(new Date().toISOString());
        setBackup(null); setConfirmation('');
        if (fileInput.current) fileInput.current.value = '';
        setMessage('Progress restored. The previous progress was saved as the database backup.');
        router.refresh();
      }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function download(saved = false) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/progress/backup?studentId=${encodeURIComponent(studentId)}${saved ? '&saved=1' : ''}`, { cache: 'no-store' });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'Could not export progress.'); }
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement('a'); a.href = url; a.download = `student-${studentId}-progress-${saved ? 'saved' : new Date().toISOString().slice(0, 10)}.json`;
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Progress backup downloaded.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return <section className="card space-y-4 p-4" aria-labelledby="progress-backup-title">
    <h2 id="progress-backup-title" className="font-bold">Save, export &amp; import progress — {studentName}</h2>
    <p className="text-sm text-slate-600">Answers are saved automatically. Save progress creates one database backup, replacing the previous saved backup. Export downloads all test attempts, answers, Smart Review sessions, skill mastery and review schedules as JSON.</p>
    <div className="flex flex-wrap gap-2">
      <button className="btn-primary" disabled={busy} onClick={() => run('save')}>Save progress</button>
      <button className="btn-secondary" disabled={busy} onClick={() => download()}>Export progress</button>
      <button className="btn-secondary" disabled={busy || !lastSaved} onClick={() => download(true)}>Download saved backup</button>
    </div>
    <p className="text-sm text-slate-500">{lastSaved ? `Last database backup: ${new Date(lastSaved).toLocaleString()}` : 'No database backup saved yet.'}</p>
    <div className="space-y-2 border-t pt-4">
      <label className="label" htmlFor="progress-file">Import progress backup (.json, up to 4 MB)</label>
      <input ref={fileInput} id="progress-file" type="file" accept=".json,application/json" disabled={busy} onChange={(e) => void choose(e.target.files?.[0])} className="block w-full text-sm" />
      <p className="text-sm text-slate-600">Import replaces current progress and first saves a rollback backup. The original question banks must still exist unchanged. Student settings and question banks are kept. Timers retain their original expiry times.</p>
      {backup && <div className="space-y-3 rounded-lg bg-amber-50 p-3">
        <p className="text-sm">Backup for {backup.student.name} from {new Date(backup.exportedAt).toLocaleString()}: {backup.attempts.length} attempts, {backup.answers.length} answers, {backup.sessions.length} review sessions, {backup.skills.length} skills.</p>
        <label className="label" htmlFor="restore-progress-confirmation">Type RESTORE to replace current progress</label>
        <input id="restore-progress-confirmation" className="input" autoComplete="off" value={confirmation} disabled={busy} onChange={(e) => setConfirmation(e.target.value)} />
        <button className="btn-danger" disabled={busy || confirmation !== 'RESTORE'} onClick={() => run('import')}>Import &amp; replace progress</button>
      </div>}
    </div>
    {busy && <p role="status" className="text-sm">Processing progress backup…</p>}
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </section>;
}
