import { Star } from 'lucide-react';

export function ProgressBar({ value, max = 100, color = 'bg-brand-500', label }: { value: number; max?: number; color?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Stars({ count, size = 18 }: { count: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${count} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Star key={i} size={size} className={i < count ? 'fill-amber-400 text-amber-500' : 'text-slate-300'} />
      ))}
    </span>
  );
}

const MASTERY_STYLE: Record<string, string> = {
  NOT_ENOUGH_DATA: 'bg-slate-100 text-slate-600',
  NEEDS_PRACTICE: 'bg-rose-100 text-rose-700',
  DEVELOPING: 'bg-amber-100 text-amber-700',
  IMPROVING: 'bg-sky-100 text-sky-700',
  MASTERED: 'bg-emerald-100 text-emerald-700',
};
export function MasteryBadge({ status, label }: { status: string; label: string }) {
  return <span className={`badge ${MASTERY_STYLE[status] ?? MASTERY_STYLE.NOT_ENOUGH_DATA}`}>{status === 'MASTERED' ? '★ ' : ''}{label}</span>;
}

export const LEVEL_STYLE: Record<string, string> = {
  Beginner: 'bg-emerald-100 text-emerald-700',
  Intermediate: 'bg-amber-100 text-amber-700',
  Advanced: 'bg-rose-100 text-rose-700',
};

export function pct(n: number | null | undefined) {
  return n === null || n === undefined ? '–' : `${Math.round(n * 100)}%`;
}
