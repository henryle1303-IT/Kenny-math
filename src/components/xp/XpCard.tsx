import Link from 'next/link';
import { AVATARS, THEMES, levelName, questLabel } from '@/lib/xp/rules';
import { xt, type Lang } from '@/lib/i18n';
import type { XpSummary } from '@/lib/services/xp';

export function XpCard({ xp, lang, name }: { xp: XpSummary; lang: Lang; name: string }) {
  const theme = THEMES.find((t) => t.key === xp.theme) ?? THEMES[0];
  const avatar = AVATARS.find((a) => a.key === xp.avatar) ?? AVATARS[0];
  const left = Math.max(0, xp.goalToday.target - xp.goalToday.correct);
  const daily = xp.quests.filter((q) => q.kind === 'DAILY');
  const weekly = xp.quests.find((q) => q.kind === 'WEEKLY');
  return (
    <section className="card overflow-hidden" data-testid="xp-card" aria-label={xt(lang, 'xpTitle')}>
      <div className={`bg-gradient-to-br ${theme.from} ${theme.to} p-5 text-white`}>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20 text-4xl" aria-hidden>{avatar.icon}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm opacity-90">{name}</div>
            <div className="text-2xl font-black" data-testid="xp-level">{xt(lang, 'level', { n: xp.level })} · {levelName(xp.level, lang)}</div>
            <div className="text-sm opacity-90"><b data-testid="xp-total">{xp.totalXp}</b> {xt(lang, 'xp')} · {xt(lang, 'toNext', { n: xp.need - xp.into, l: xp.level + 1 })}</div>
          </div>
          <div className="text-center" data-testid="xp-streak">
            <div className="text-3xl" aria-hidden>🔥</div>
            <div className="text-xl font-black">{xp.streak}</div>
          </div>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuenow={xp.pct} aria-valuemin={0} aria-valuemax={100} aria-label={xt(lang, 'level', { n: xp.level })}>
          <div className="h-full rounded-full bg-white transition-all" style={{ width: `${xp.pct}%` }} />
        </div>
        <p className="mt-2 text-sm font-semibold">
          {xp.streak > 0 ? xt(lang, 'streakDays', { n: xp.streak }) : xt(lang, 'streakNone')}
          {' · '}
          {left > 0 ? xt(lang, 'streakGoal', { n: left }) : xt(lang, 'streakSafe')}
          {xp.freezes > 0 && <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">🛡️ {xt(lang, 'shields', { n: xp.freezes })}</span>}
        </p>
      </div>
      {xp.features.quests && daily.length > 0 && (
        <div className="grid gap-4 p-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 font-bold">{xt(lang, 'quests')}</h3>
            <ul className="space-y-2">
              {daily.map((q) => <QuestRow key={q.key} q={q} lang={lang} />)}
            </ul>
            <p className="mt-2 text-xs text-slate-500">{xt(lang, 'questBonus', { n: xp.dailyBonus })}</p>
          </div>
          {weekly && (
            <div>
              <h3 className="mb-2 font-bold">{xt(lang, 'weekly')}</h3>
              <ul><QuestRow q={weekly} lang={lang} /></ul>
              <p className="mt-2 text-xs text-slate-500">{xt(lang, 'weeklyReward', { n: weekly.rewardXp })}</p>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-sm">
        <span className="text-slate-600">{xt(lang, 'available', { n: xp.available })}</span>
        <span className="flex gap-3">
          {xp.shopEnabled && <Link href="/rewards" className="font-semibold text-brand-700 underline">{xt(lang, 'rewards')}</Link>}
          <Link href="/progress" className="font-semibold text-brand-700 underline">{xt(lang, 'seeAll')}</Link>
        </span>
      </div>
    </section>
  );
}

function QuestRow({ q, lang }: { q: XpSummary['quests'][number]; lang: Lang }) {
  return (
    <li className="flex items-center gap-3" data-testid={`quest-${q.key}`}>
      <span aria-hidden className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${q.done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{q.done ? '✓' : ''}</span>
      <div className="min-w-0 flex-1">
        <div className={q.done ? 'text-slate-500 line-through' : ''}>{questLabel(q.key, q.target, lang)}</div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round((q.progress / q.target) * 100)}%` }} /></div>
      </div>
      <span className="text-sm tabular-nums text-slate-500">{q.done ? xt(lang, 'done') : `${q.progress}/${q.target}`}</span>
    </li>
  );
}
