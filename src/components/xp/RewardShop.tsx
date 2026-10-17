'use client';
import { useState } from 'react';
import { xt, type Lang } from '@/lib/i18n';

interface Reward { id: string; name: string; nameVi: string; description: string; costXp: number; maxPerWeek: number | null; usedThisWeek: number; canRedeem: boolean }
interface History { id: string; name: string; nameVi: string; costXp: number; status: string; createdAt: string }
interface Data { available: number; rewards: Reward[]; history: History[] }

export function RewardShop({ lang, initial }: { lang: Lang; initial: Data }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const label = (r: { name: string; nameVi: string }) => (lang === 'vi' && r.nameVi ? r.nameVi : r.name);

  async function redeem(id: string) {
    if (busy) return;
    setBusy(id); setMsg(null);
    try {
      const res = await fetch('/api/student/rewards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rewardId: id }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      const fresh = await fetch('/api/student/rewards').then((r) => r.json());
      setData(fresh);
      setMsg({ ok: true, t: xt(lang, 'redeemed') });
    } catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    finally { setBusy(''); }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 text-lg font-bold text-amber-700" data-testid="shop-available">⭐ {xt(lang, 'available', { n: data.available })}</div>
      {msg && <p role="status" className={`rounded-lg p-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{msg.t}</p>}
      {data.rewards.length === 0 ? <p className="card p-4">{xt(lang, 'shopEmpty')}</p> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.rewards.map((r) => {
            const limited = r.maxPerWeek !== null && r.usedThisWeek >= r.maxPerWeek;
            return (
              <li key={r.id} className="card flex flex-col gap-2 p-4" data-testid="reward-item">
                <div className="text-lg font-bold">{label(r)}</div>
                {r.description && <div className="text-sm text-slate-600">{r.description}</div>}
                <div className="font-semibold text-amber-700">{r.costXp} XP</div>
                {r.maxPerWeek !== null && <div className="text-xs text-slate-500">{xt(lang, 'usedWeek', { a: r.usedThisWeek, b: r.maxPerWeek })}</div>}
                <button className="btn-primary mt-auto" disabled={!r.canRedeem || !!busy} onClick={() => redeem(r.id)} data-testid="redeem">
                  {limited ? xt(lang, 'limitReached') : r.canRedeem ? xt(lang, 'redeem') : xt(lang, 'needXp', { n: r.costXp - data.available })}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {data.history.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 font-bold">{xt(lang, 'history')}</h2>
          <ul className="divide-y text-sm">
            {data.history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-2 py-1.5" data-testid="redemption">
                <span>{label(h)} · {h.costXp} XP</span>
                <span className="badge bg-slate-100 text-slate-700">{xt(lang, `status.${h.status}`)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
