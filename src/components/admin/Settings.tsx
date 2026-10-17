'use client';
import { useState } from 'react';
import { api } from './api';

export function Settings({ intervals }: { intervals: Record<string, number> }) {
  const [iv, setIv] = useState<Record<string, number | ''>>(intervals);
  const [busy, setBusy] = useState(false);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function go(body: unknown, ok: string) {
    if (busy) return;
    setBusy(true);
    try {
      await api('/api/admin/settings', 'POST', body);
      setMsg({ ok: true, t: ok });
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message });
    } finally { setBusy(false); }
  }
  const labels: [string, string][] = [['afterIncorrect', 'After an incorrect answer (days)'], ['afterCorrectOnce', 'Correct once (days)'], ['afterCorrectTwice', 'Correct twice in separate sessions (days)'], ['afterConsistent', 'Consistently correct (days)']];
  return (
    <div className="space-y-6">
      {msg && <p role="status" className={`rounded-lg p-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{msg.t}</p>}
      <form className="card space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); void go({ action: 'intervals', intervals: iv }, 'Defaults saved. Existing user configurations are unchanged.'); }}>
        <h2 className="font-bold">Default spaced review intervals for new users</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {labels.map(([k, l]) => (
            <div key={k}><label className="label" htmlFor={k}>{l}</label><input id={k} type="number" min={0} max={365} step={1} required className="input" value={iv[k]} onChange={(e) => setIv({ ...iv, [k]: e.target.value === '' ? '' : Number(e.target.value) })} /></div>
          ))}
        </div>
        <button className="btn-secondary" disabled={busy}>Save intervals</button>
      </form>
      <section className="card space-y-3 p-5">
        <h2 className="font-bold">Change admin password</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="cp">Current password</label><input id="cp" type="password" autoComplete="current-password" className="input" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
          <div><label className="label" htmlFor="np">New password (10+ characters, up to 72 bytes)</label><input id="np" type="password" autoComplete="new-password" className="input" value={next} onChange={(e) => setNext(e.target.value)} /></div>
        </div>
        <button className="btn-secondary" disabled={busy} onClick={() => go({ action: 'password', current: cur, next }, 'Password changed. Other admin sessions have been signed out.')}>Change password</button>
      </section>
    </div>
  );
}
