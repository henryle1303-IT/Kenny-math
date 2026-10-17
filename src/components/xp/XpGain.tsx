'use client';
import { BADGES, levelName } from '@/lib/xp/rules';
import { xt, type Lang } from '@/lib/i18n';

export interface XpGainData {
  gained: number;
  level: number;
  leveledUp: boolean;
  streak: number;
  streakExtended: boolean;
  freezeUsed: boolean;
  freezeGained: boolean;
  newBadges: string[];
  questsDone: string[];
  bonuses: { reason: string; amount: number }[];
}

/** Friendly feedback after earning XP: amount, level-ups, badges and streak news. */
export function XpGain({ xp, lang }: { xp: XpGainData | null | undefined; lang: Lang }) {
  if (!xp || (xp.gained <= 0 && !xp.newBadges.length)) return null;
  const bonusLabel = (reason: string) => (reason.startsWith('Daily') ? xt(lang, 'bonus.d') : reason.startsWith('Weekly') ? xt(lang, 'bonus.w') : xt(lang, 'bonus.s'));
  return (
    <div className="xp-pop mt-3 space-y-1 rounded-xl bg-amber-50 p-3 text-amber-900 ring-1 ring-amber-200" role="status" data-testid="xp-gain">
      {xp.gained > 0 && <div className="text-lg font-black" data-testid="xp-gained">+{xp.gained} XP ✨</div>}
      {xp.bonuses.map((b) => <div key={b.reason} className="text-sm">🎁 {bonusLabel(b.reason)}: +{b.amount} XP</div>)}
      {xp.leveledUp && <div className="font-bold" data-testid="xp-levelup">🎉 {xt(lang, 'levelUp', { n: xp.level, name: levelName(xp.level, lang) })}</div>}
      {xp.newBadges.map((k) => {
        const b = BADGES.find((x) => x.key === k);
        return b ? <div key={k} className="font-semibold" data-testid="xp-badge">{b.icon} {xt(lang, 'newBadge', { name: b.name[lang] })}</div> : null;
      })}
      {xp.streakExtended && xp.streak > 1 && <div className="text-sm font-semibold">🔥 {xt(lang, 'streakNow', { n: xp.streak })}</div>}
      {xp.freezeUsed && <div className="text-sm">🛡️ {xt(lang, 'shieldUsed')}</div>}
      {xp.freezeGained && <div className="text-sm">🛡️ {xt(lang, 'shieldGained')}</div>}
      {xp.questsDone.length > 0 && <div className="text-sm font-semibold">✅ {xt(lang, 'questDone')}</div>}
    </div>
  );
}
