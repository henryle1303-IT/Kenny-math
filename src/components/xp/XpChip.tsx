import Link from 'next/link';
import { xt, type Lang } from '@/lib/i18n';

export function XpChip({ level, totalXp, streak, lang }: { level: number; totalXp: number; streak: number; lang: Lang }) {
  return (
    <Link href="/progress" className="btn-ghost !px-2 text-sm font-bold text-amber-700" data-testid="xp-chip" aria-label={`${xt(lang, 'level', { n: level })}, ${totalXp} XP, ${xt(lang, 'streakDays', { n: streak })}`}>
      <span aria-hidden>⭐</span> {level}<span className="hidden sm:inline"> · {totalXp} XP</span>
      {streak > 0 && <span className="ml-1"><span aria-hidden>🔥</span>{streak}</span>}
    </Link>
  );
}
