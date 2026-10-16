'use client';
import { useState } from 'react';
import { api } from './api';

export function Settings({ intervals, studentName }: { intervals: Record<string, number>; studentName: string }) {
  const [iv, setIv] = useState(intervals);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [name, setName] = useState(studentName);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  async function go(body: unknown, ok: string) {
    try {
      await api('/api/admin/settings', 'POST', body);
      setMsg({ ok: true, t: ok });
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message });
    }
  }
  const labels: [string, string][] = [['afterIncorrect', 'After an incorrect answer (days)'], ['afterCorrectOnce', 'Correct once (days)'], ['afterCorrectTwice', 'Correct twice in separate sessions (days)'], ['afterConsistent', 'Consistently correct (days)']];
  return (
    <div className="space-y-6">
      {msg && <p role="status" className={`rounded-lg p-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{msg.t}</p>}
      <section className="card space-y-3 p-5">
        <h2 className="font-bold">Student</h2>
        <div className="max-w-xs"><label className="label" htmlFor="sn">Name</label><input id="sn" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <button className="btn-secondary" onClick={() => go({ action: 'student', studentName: name }, 'Name saved.')}>Save name</button>
      </section>
      <section className="card space-y-3 p-5">
        <h2 className="font-bold">Spaced review intervals</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {labels.map(([k, l]) => (
            <div key={k}><label className="label" htmlFor={k}>{l}</label><input id={k} type="number" min={0} max={365} className="input" value={iv[k]} onChange={(e) => setIv({ ...iv, [k]: Number(e.target.value) })} /></div>
          ))}
        </div>
        <button className="btn-secondary" onClick={() => go({ action: 'intervals', intervals: iv }, 'Intervals saved. They apply the next time skills are updated.')}>Save intervals</button>
      </section>
      <section className="card space-y-3 p-5">
        <h2 className="font-bold">Change admin password</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="cp">Current password</label><input id="cp" type="password" autoComplete="current-password" className="input" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
          <div><label className="label" htmlFor="np">New password (10+ characters)</label><input id="np" type="password" autoComplete="new-password" className="input" value={next} onChange={(e) => setNext(e.target.value)} /></div>
        </div>
        <button className="btn-secondary" onClick={() => go({ action: 'password', current: cur, next }, 'Password changed.')}>Change password</button>
      </section>
    </div>
  );
}
