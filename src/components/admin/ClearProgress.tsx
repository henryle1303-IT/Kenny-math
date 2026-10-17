'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

export function ClearProgress({ studentName, studentId }: { studentName: string; studentId: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function clear() {
    if (busy || confirmation !== 'CLEAR') return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/progress/clear?studentId=${encodeURIComponent(studentId)}`, 'POST', { confirmation });
      dialog.current?.close();
      setDone(true);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-3 border border-rose-200 p-4">
      <h2 className="font-bold">Clear student progress</h2>
      <p className="text-sm text-slate-600">Reset {studentName}&apos;s test history, saved answers, Smart Review, skill mastery and review schedule, including unfinished sessions. Question banks, student settings and admin accounts are kept.</p>
      {done && <p role="status" className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">Progress cleared. {studentName} can start again.</p>}
      <button type="button" className="btn-danger" onClick={() => {
        setConfirmation('');
        setError('');
        setDone(false);
        dialog.current?.showModal();
      }}>Clear progress</button>
      <dialog ref={dialog} aria-labelledby="clear-progress-title" aria-describedby="clear-progress-description" className="w-[calc(100%_-_2rem)] max-w-md rounded-2xl bg-white p-5 shadow-xl backdrop:bg-slate-900/50" onCancel={(e) => { if (busy) e.preventDefault(); }}>
        <h2 id="clear-progress-title" className="text-xl font-bold">Clear {studentName}&apos;s progress?</h2>
        <p id="clear-progress-description" className="mt-2 text-sm text-slate-600">All test attempts, answers and practice progress will be permanently deleted. This cannot be undone.</p>
        <label className="label mt-4" htmlFor="clear-progress-confirmation">Type CLEAR to confirm</label>
        <input id="clear-progress-confirmation" className="input" autoComplete="off" spellCheck={false} value={confirmation} disabled={busy} onChange={(e) => setConfirmation(e.target.value)} />
        {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button>
          <button type="button" className="btn-danger" disabled={busy || confirmation !== 'CLEAR'} onClick={clear}>{busy ? 'Clearing…' : 'Clear all progress'}</button>
        </div>
      </dialog>
    </section>
  );
}
