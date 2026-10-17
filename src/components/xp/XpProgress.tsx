import { BADGES } from '@/lib/xp/rules';
import { xt, type Lang } from '@/lib/i18n';
import type { XpSummary } from '@/lib/services/xp';

const STAR = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

/** Progress against yourself only: weekly XP, badges and stars by topic. */
export function XpProgress({ xp, lang }: { xp: XpSummary; lang: Lang }) {
  const max = Math.max(1, ...xp.weeks.map((w) => w.xp));
  const diff = xp.thisWeek - xp.lastWeek;
  const earned = new Map(xp.badges.map((b) => [b.key, b]));
  return (
    <div className="space-y-4" data-testid="xp-progress">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          [xt(lang, 'thisWeek'), xp.thisWeek], [xt(lang, 'lastWeek'), xp.lastWeek], [xt(lang, 'bestWeek'), xp.bestWeek], [xt(lang, 'bestDay'), xp.bestDay],
        ] as [string, number][]).map(([l, v]) => (
          <div key={l} className="card p-4 text-center"><div className="text-2xl font-extrabold text-amber-600">{v}<span className="text-sm"> XP</span></div><div className="text-sm text-slate-500">{l}</div></div>
        ))}
      </div>
      <section className="card p-4">
        <h2 className="mb-1 text-lg font-bold">{xt(lang, 'weeklyXp')}</h2>
        <p className="mb-3 text-sm text-slate-600" data-testid="xp-vs-last">{diff > 0 ? xt(lang, 'vsLast', { n: diff }) : diff < 0 ? xt(lang, 'vsLastLess', { n: -diff + 1 }) : xt(lang, 'vsLastSame')}</p>
        <div className="flex h-32 items-end gap-2" role="img" aria-label={xt(lang, 'weeklyXp')}>
          {xp.weeks.map((w, i) => (
            <div key={w.start} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs text-slate-500">{w.xp}</span>
              <div className={`w-full rounded-t-md ${i === xp.weeks.length - 1 ? 'bg-amber-500' : 'bg-amber-300'}`} style={{ height: `${Math.max(4, Math.round((w.xp / max) * 80))}px` }} />
              <span className="text-[10px] text-slate-400">{w.start.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>
      {xp.features.badges && (
        <section className="card p-4">
          <h2 className="mb-2 text-lg font-bold">{xt(lang, 'badges')}</h2>
          <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {BADGES.map((b) => {
              const got = earned.has(b.key);
              return (
                <li key={b.key} data-testid={`badge-${b.key}`} data-earned={got} className={`flex items-center gap-3 rounded-xl p-3 ring-1 ${got ? 'bg-emerald-50 ring-emerald-200' : 'bg-slate-50 opacity-60 ring-slate-200'}`}>
                  <span className="text-3xl" aria-hidden>{got ? b.icon : '🔒'}</span>
                  <div><div className="font-bold">{b.name[lang]}</div><div className="text-xs text-slate-600">{got ? b.desc[lang] : `${xt(lang, 'locked')} · ${b.desc[lang]}`}</div></div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section className="card p-4">
        <h2 className="mb-2 text-lg font-bold">{xt(lang, 'topicStars')}</h2>
        {xp.topics.length === 0 ? <p className="text-slate-500">{xt(lang, 'noTopics')}</p> : (
          <ul className="divide-y">
            {xp.topics.map((t) => <li key={t.topic} className="flex items-center justify-between py-1.5"><span>{t.topic}</span><span className="text-amber-500" aria-label={`${t.stars}/3`}>{STAR(t.stars)}</span></li>)}
          </ul>
        )}
      </section>
    </div>
  );
}
