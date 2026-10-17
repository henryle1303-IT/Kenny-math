'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AVATARS, THEMES } from '@/lib/xp/rules';
import { xt, type Lang } from '@/lib/i18n';

export function Cosmetics({ lang, level, avatar, theme }: { lang: Lang; level: number; avatar: string; theme: string }) {
  const router = useRouter();
  const [a, setA] = useState(avatar); const [t, setT] = useState(theme);
  const [msg, setMsg] = useState('');
  async function save(body: { avatar?: string; theme?: string }) {
    setMsg('');
    const res = await fetch('/api/student/cosmetics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(d.error ?? ''); return; }
    if (body.avatar) setA(body.avatar);
    if (body.theme) setT(body.theme);
    setMsg(xt(lang, 'saved')); router.refresh();
  }
  return (
    <section className="card max-w-md space-y-4 p-5" aria-label={xt(lang, 'customise')}>
      <h2 className="font-bold">{xt(lang, 'customise')}</h2>
      <div>
        <div className="label">{xt(lang, 'avatar')}</div>
        <div className="flex flex-wrap gap-2">
          {AVATARS.map((x) => {
            const locked = x.level > level;
            return <button key={x.key} type="button" disabled={locked} onClick={() => save({ avatar: x.key })} aria-pressed={a === x.key} title={locked ? xt(lang, 'unlockAt', { n: x.level }) : x.key}
              data-testid={`avatar-${x.key}`} className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ring-2 ${a === x.key ? 'ring-brand-500' : 'ring-slate-200'} ${locked ? 'opacity-40' : ''}`}>{locked ? '🔒' : x.icon}</button>;
          })}
        </div>
      </div>
      <div>
        <div className="label">{xt(lang, 'colour')}</div>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((x) => {
            const locked = x.level > level;
            return <button key={x.key} type="button" disabled={locked} onClick={() => save({ theme: x.key })} aria-pressed={t === x.key} title={locked ? xt(lang, 'unlockAt', { n: x.level }) : ''}
              data-testid={`theme-${x.key}`} className={`rounded-xl bg-gradient-to-br ${x.from} ${x.to} px-3 py-2 text-sm font-semibold text-white ring-2 ${t === x.key ? 'ring-slate-800' : 'ring-transparent'} ${locked ? 'opacity-40' : ''}`}>{xt(lang, `theme.${x.key}`)}{locked ? ` 🔒${x.level}` : ''}</button>;
          })}
        </div>
      </div>
      {msg && <p role="status" className="text-sm text-slate-600">{msg}</p>}
    </section>
  );
}
