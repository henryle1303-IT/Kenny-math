'use client';
import { useState } from 'react';
import { api } from './api';

type Cfg = {
  correct: number; firstTry: number; testDone: number; testPerfect: number; reviewDone: number; fix: number; repeatDivisor: number; reviewFullPerDay: number; reviewReducedXp: number;
  streakMinCorrect: number; dailyBonus: number; weeklyBonus: number; streakMilestones: Record<string, number>; features: { streak: boolean; quests: boolean; badges: boolean; shop: boolean };
};
type Reward = { id: string; name: string; nameVi: string; description: string; costXp: number; studentId: string | null; studentName: string | null; maxPerWeek: number | null; isActive: boolean };
type Redemption = { id: string; reward: string; student: string; costXp: number; status: string; createdAt: string };
type Shop = { students: { id: string; name: string }[]; rewards: Reward[]; redemptions: Redemption[] };

const FIELDS: [keyof Omit<Cfg, 'streakMilestones' | 'features'>, string][] = [
  ['correct', 'XP per correct answer'], ['firstTry', 'Extra XP: right the first time'], ['testDone', 'XP for finishing a test'], ['testPerfect', 'Extra XP for a perfect test'],
  ['reviewDone', 'XP for finishing a Smart Review'], ['fix', 'XP for fixing an old mistake'], ['repeatDivisor', 'Repeat answers earn XP ÷ this'], ['reviewFullPerDay', 'Smart Review answers per day at full XP'],
  ['reviewReducedXp', 'XP per Smart Review answer after that'], ['streakMinCorrect', 'Correct answers to keep the daily streak'], ['dailyBonus', 'Bonus for both daily quests'], ['weeklyBonus', 'Bonus for the weekly challenge'],
];
const FEATURES: [keyof Cfg['features'], string][] = [['streak', 'Daily streak and shields'], ['quests', 'Daily and weekly quests'], ['badges', 'Badges'], ['shop', 'Reward shop (visible to students)']];

export function XpAdmin({ config, shop }: { config: Cfg; shop: Shop }) {
  const [cfg, setCfg] = useState(config);
  const [milestones, setMilestones] = useState(Object.entries(config.streakMilestones).map(([k, v]) => `${k}:${v}`).join(', '));
  const [data, setData] = useState(shop);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const blank = { id: '', name: '', nameVi: '', description: '', costXp: 50, studentId: '', maxPerWeek: '' };
  const [form, setForm] = useState<typeof blank>(blank);

  async function guard(fn: () => Promise<unknown>, ok: string) {
    if (busy) return;
    setBusy(true); setMsg(null);
    try { await fn(); setMsg({ ok: true, t: ok }); } catch (e) { setMsg({ ok: false, t: (e as Error).message }); } finally { setBusy(false); }
  }
  const reload = async () => setData(await api<Shop>('/api/admin/rewards', 'GET'));

  function parseMilestones(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const part of milestones.split(',').map((p) => p.trim()).filter(Boolean)) {
      const [k, v] = part.split(':').map((x) => x.trim());
      if (!/^\d+$/.test(k ?? '') || !/^\d+$/.test(v ?? '')) throw new Error('Streak bonuses look like 3:10, 7:25 (days:XP).');
      out[k] = Number(v);
    }
    return out;
  }
  const payload = () => ({ name: form.name, nameVi: form.nameVi, description: form.description, costXp: Number(form.costXp), studentId: form.studentId || null, maxPerWeek: form.maxPerWeek === '' ? null : Number(form.maxPerWeek), isActive: true });

  return (
    <div className="space-y-6">
      {msg && <p role="status" className={`rounded-lg p-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{msg.t}</p>}
      <form className="card space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); void guard(async () => setCfg(await api<Cfg>('/api/admin/xp', 'PUT', { ...cfg, streakMilestones: parseMilestones() })), 'XP settings saved.'); }}>
        <h2 className="text-lg font-bold">XP settings</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FIELDS.map(([k, label]) => <div key={k}><label className="label" htmlFor={`xp-${k}`}>{label}</label><input id={`xp-${k}`} className="input" type="number" min={0} step={1} required value={cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: Number(e.target.value) })} /></div>)}
          <div><label className="label" htmlFor="xp-milestones">Streak bonuses (days:XP)</label><input id="xp-milestones" className="input" value={milestones} onChange={(e) => setMilestones(e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap gap-4">{FEATURES.map(([k, label]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={cfg.features[k]} onChange={(e) => setCfg({ ...cfg, features: { ...cfg.features, [k]: e.target.checked } })} />{label}</label>)}</div>
        <button className="btn-primary" disabled={busy}>Save XP settings</button>
      </form>

      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-bold">Rewards set by parents</h2>
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(e) => { e.preventDefault(); void guard(async () => { await api(form.id ? `/api/admin/rewards/${form.id}` : '/api/admin/rewards', form.id ? 'PUT' : 'POST', payload()); setForm(blank); await reload(); }, form.id ? 'Reward updated.' : 'Reward added.'); }}>
          <div><label className="label" htmlFor="rw-name">Name</label><input id="rw-name" className="input" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label" htmlFor="rw-name-vi">Name (Tiếng Việt, optional)</label><input id="rw-name-vi" className="input" maxLength={80} value={form.nameVi} onChange={(e) => setForm({ ...form, nameVi: e.target.value })} /></div>
          <div><label className="label" htmlFor="rw-cost">Cost (XP)</label><input id="rw-cost" className="input" type="number" min={1} max={100000} required value={form.costXp} onChange={(e) => setForm({ ...form, costXp: Number(e.target.value) })} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="rw-desc">Description</label><input id="rw-desc" className="input" maxLength={300} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className="label" htmlFor="rw-user">For</label><select id="rw-user" className="input" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}><option value="">Everyone</option>{data.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label className="label" htmlFor="rw-max">Limit per week (blank = none)</label><input id="rw-max" className="input" type="number" min={1} max={100} value={form.maxPerWeek} onChange={(e) => setForm({ ...form, maxPerWeek: e.target.value })} /></div>
          <div className="flex items-end gap-2"><button className="btn-primary" disabled={busy}>{form.id ? 'Save reward' : 'Add reward'}</button>{form.id && <button type="button" className="btn-ghost" onClick={() => setForm(blank)}>Cancel</button>}</div>
        </form>
        <ul className="divide-y text-sm">
          {data.rewards.length === 0 && <li className="py-2 text-slate-500">No rewards yet.</li>}
          {data.rewards.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid="admin-reward">
              <span><b>{r.name}</b> · {r.costXp} XP · {r.studentName ?? 'Everyone'}{r.maxPerWeek ? ` · max ${r.maxPerWeek}/week` : ''}{!r.isActive && ' · hidden'}</span>
              <span className="flex gap-2">
                <button className="btn-secondary !min-h-9" onClick={() => setForm({ id: r.id, name: r.name, nameVi: r.nameVi, description: r.description, costXp: r.costXp, studentId: r.studentId ?? '', maxPerWeek: r.maxPerWeek === null ? '' : String(r.maxPerWeek) })}>Edit</button>
                <button className="btn-secondary !min-h-9" disabled={busy} onClick={() => guard(async () => { await api(`/api/admin/rewards/${r.id}`, 'PUT', { name: r.name, nameVi: r.nameVi, description: r.description, costXp: r.costXp, studentId: r.studentId, maxPerWeek: r.maxPerWeek, isActive: !r.isActive }); await reload(); }, r.isActive ? 'Reward hidden.' : 'Reward shown.')}>{r.isActive ? 'Hide' : 'Show'}</button>
                <button className="btn-danger !min-h-9" disabled={busy} onClick={() => guard(async () => { await api(`/api/admin/rewards/${r.id}`, 'DELETE'); await reload(); }, 'Reward removed.')}>Delete</button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold">Reward requests</h2>
        <ul className="divide-y text-sm">
          {data.redemptions.length === 0 && <li className="py-2 text-slate-500">No requests yet.</li>}
          {data.redemptions.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid="admin-redemption">
              <span><b>{x.student}</b> asked for <b>{x.reward}</b> ({x.costXp} XP) · {new Date(x.createdAt).toLocaleString()} · {x.status.toLowerCase()}</span>
              {x.status === 'PENDING' && (
                <span className="flex gap-2">
                  <button className="btn-primary !min-h-9" disabled={busy} onClick={() => guard(async () => { await api(`/api/admin/redemptions/${x.id}`, 'POST', { decision: 'APPROVE' }); await reload(); }, 'Approved.')}>Approve</button>
                  <button className="btn-secondary !min-h-9" disabled={busy} onClick={() => guard(async () => { await api(`/api/admin/redemptions/${x.id}`, 'POST', { decision: 'REJECT' }); await reload(); }, 'Declined and XP returned.')}>Decline</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
