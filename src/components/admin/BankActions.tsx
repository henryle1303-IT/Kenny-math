'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

interface Props {
  id: string;
  name: string;
  status: string;
  isActive: boolean;
  everPublished: boolean;
  hasAttempts: boolean;
}

export function BankActions({ id, name, status, isActive, everPublished, hasAttempts }: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ack, setAck] = useState(false);
  const editable = status === 'DRAFT' || status === 'READY_FOR_REVIEW';

  async function run(label: string, fn: () => Promise<unknown>, okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: okText });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: `${label}: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <a className="btn-secondary !min-h-9 text-sm" href={`/admin/questions?bank=${id}`}>Questions</a>
        <button disabled={busy} className="btn-secondary !min-h-9 text-sm" onClick={() => run('Validate', async () => {
          const r = await api('/api/admin/banks/' + id + '/validate', 'POST');
          setMsg({ ok: r.ok, text: `${r.validRows}/${r.totalRows} valid, ${r.verifiedRows} verified, ${r.reviewRows + r.warningRows} need review${r.bankErrors.length ? '. ' + r.bankErrors.slice(0, 3).join(' ') : ''}` });
        }, 'Validated.')}>Validate</button>
        <a className="btn-secondary !min-h-9 text-sm" href={`/api/admin/banks/${id}/export`}>Export CSV</a>
        <button disabled={busy} className="btn-secondary !min-h-9 text-sm" onClick={() => run('Copy', () => api('/api/admin/banks/' + id + '/clone', 'POST', {}), 'Draft copy created.')}>Create draft copy</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {editable && (
          <>
            <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> accept questions flagged for review</label>
            <button disabled={busy} className="btn-primary !min-h-9 text-sm" data-testid={`publish-${id}`} onClick={() => {
              if (!confirm(`Publish and activate “${name}”? Kenny will use it for NEW tests. Tests already in progress keep their original questions.`)) return;
              void run('Publish', () => api('/api/admin/banks/' + id + '/publish', 'POST', { confirm: true, acknowledgeReview: ack }), 'Published and activated.');
            }}>Publish / Activate</button>
          </>
        )}
        {!editable && everPublished && !isActive && (
          <button disabled={busy} className="btn-primary !min-h-9 text-sm" onClick={() => {
            if (!confirm(`Make “${name}” the active bank? New tests will use it. Existing results are not changed.`)) return;
            void run('Activate', () => api('/api/admin/banks/' + id + '/activate', 'POST', { confirm: true }), 'Activated.');
          }}>Restore / Activate</button>
        )}
        {!isActive && !editable && status !== 'ARCHIVED' && (
          <button disabled={busy} className="btn-ghost !min-h-9 text-sm" onClick={() => run('Archive', () => api('/api/admin/banks/' + id + '/archive', 'POST'), 'Archived.')}>Archive</button>
        )}
        {editable && !hasAttempts && (
          <button disabled={busy} className="btn-ghost !min-h-9 text-sm text-rose-700" onClick={() => {
            const typed = prompt(`Delete this draft? Type its exact name to confirm:\n${name}`);
            if (typed === null) return;
            void run('Delete', () => api('/api/admin/banks/' + id + '/archive', 'DELETE', { confirmName: typed }), 'Deleted.');
          }}>Delete draft</button>
        )}
      </div>
      {msg && <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}
    </div>
  );
}
