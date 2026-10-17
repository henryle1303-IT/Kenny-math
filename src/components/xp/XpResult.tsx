import { BADGES, levelName } from '@/lib/xp/rules';
import { xt, type Lang } from '@/lib/i18n';

type Result = { total: number; lines: { kind: string; amount: number }[]; levelBefore: number; levelAfter: number; badges: string[] };

export function XpResult({ r, lang }: { r: Result | null; lang: Lang }) {
  if (!r) return null;
  return (
    <section className="card p-4" data-testid="xp-result" aria-label={xt(lang, 'earned')}>
      <h2 className="mb-2 flex items-center justify-between text-lg font-bold">
        <span>⭐ {xt(lang, 'earned')}</span>
        <span className="text-amber-600" data-testid="xp-result-total">+{r.total} XP</span>
      </h2>
      <ul className="divide-y text-sm">
        {r.lines.map((l) => <li key={l.kind} className="flex justify-between py-1.5"><span>{xt(lang, `line.${l.kind}`)}</span><b>+{l.amount}</b></li>)}
      </ul>
      {r.levelAfter > r.levelBefore && <p className="mt-2 font-bold text-brand-700">🎉 {xt(lang, 'levelUp', { n: r.levelAfter, name: levelName(r.levelAfter, lang) })}</p>}
      {r.badges.map((k) => {
        const b = BADGES.find((x) => x.key === k);
        return b ? <p key={k} className="mt-1 font-semibold">{b.icon} {xt(lang, 'newBadge', { name: b.name[lang] })}</p> : null;
      })}
    </section>
  );
}
