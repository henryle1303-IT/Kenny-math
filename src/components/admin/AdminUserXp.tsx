'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

interface View {
  summary: { totalXp: number; available: number; level: number; streak: number; bestStreak: number; freezes: number; badges: { key: string }[] };
  ledger: { id: string; amount: number; source: string; reason: string; at: string }[];
  historyWorth: { totalXp: number; level: number; bestStreak: number };
}

export function AdminUserXp({ studentId, studentName }: { studentId: string; studentName: string }) {
  const url = `/api/admin/users/${encodeURIComponent(studentId)}/xp`;
  const [view, setView] = useState<View | null>(null);
  const [amount, setAmount] = useState(''); const [note, setNote] = useState(''); const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const load = useCallback(async () => { try { setView(await api<View>(url, 'GET')); } catch (e) { setMsg({ ok: false, t: (e as Error).message }); } }, [url]);
  useEffect(() => { void load(); }, [load]);

  async function run(body: Record<string, unknown>, ok: string) {
    if (busy) return;
    setBusy(true); setMsg(null);
    try { setView(await api<View>(url, 'POST', body)); setMsg({ ok: true, t: ok }); setAmount(''); setNote(''); setConfirm(''); }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    finally { setBusy(false); }
  }

  return (
    <section className="card space-y-4 p-5" aria-label={`XP for ${studentName}`} data-testid="admin-xp">
      <h2 className="text-xl font-bold">XP and rewards – {studentName}</h2>
      {msg && <p role="status" className={`rounded-lg p-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{msg.t}</p>}
      {view && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {([['Level', view.summary.level], ['Lifetime XP', view.summary.totalXp], ['XP to spend', view.summary.available], ['Streak (best)', `${view.summary.streak} (${view.summary.bestStreak})`], ['Badges', view.summary.badges.length]] as [string, string | number][]).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-slate-50 p-3"><div className="text-xl font-bold" data-testid={`axp-${k}`}>{v}</div><div className="text-xs text-slate-500">{k}</div></div>
            ))}
          </div>
          <form className="grid gap-3 sm:grid-cols-[8rem_1fr_auto]" onSubmit={(e) => { e.preventDefault(); void run({ action: 'grant', amount: Number(amount), note }, 'XP adjusted.'); }}>
            <div><label className="label" htmlFor="grant-amount">XP (+ or −)</label><input id="grant-amount" className="input" type="number" step={1} min={-10000} max={10000} required value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><label className="label" htmlFor="grant-note">Reason</label><input id="grant-note" className="input" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Helped with homework" /></div>
            <button className="btn-secondary self-end" disabled={busy || !amount}>Give / take XP</button>
          </form>
          <details className="rounded-xl bg-slate-50 p-3">
            <summary className="cursor-pointer font-semibold">Rebuild or reset XP</summary>
            <p className="my-2 text-sm text-slate-600">Rebuild recalculates XP, streak and badges from {studentName}&apos;s test and Smart Review history (history is worth about {view.historyWorth.totalXp} XP, level {view.historyWorth.level}). Manual adjustments and shop spending are kept. Reset starts again from zero and ignores earlier history.</p>
            <label className="label" htmlFor="xp-confirm">Type REBUILD or RESET to confirm</label>
            <input id="xp-confirm" className="input max-w-xs" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
            <div className="mt-2 flex gap-2">
              <button className="btn-secondary" disabled={busy || confirm !== 'REBUILD'} onClick={() => run({ action: 'rebuild', confirm }, 'XP rebuilt from history.')}>Rebuild from history</button>
              <button className="btn-danger" disabled={busy || confirm !== 'RESET'} onClick={() => run({ action: 'reset', confirm }, 'XP reset to zero.')}>Reset to zero</button>
            </div>
          </details>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-1">When</th><th>XP</th><th>Source</th><th>Reason</th></tr></thead>
              <tbody>{view.ledger.map((l) => <tr key={l.id} className="border-b"><td className="py-1">{new Date(l.at).toLocaleString()}</td><td className={l.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}>{l.amount > 0 ? `+${l.amount}` : l.amount}</td><td>{l.source}</td><td>{l.reason}</td></tr>)}</tbody></table>
          </div>
        </>
      )}
    </section>
  );
}
