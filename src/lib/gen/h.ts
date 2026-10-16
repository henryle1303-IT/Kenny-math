import { Frac, gcd } from '../math/fraction';
import type { Rng } from './rng';

/** Wrap TeX as inline math. */
export const m = (tex: string | number) => `\\(${String(tex).replace(/(?<=\d),(?=\d{3}(?!\d))/g, '{,}')}\\)`;
export const tfrac = (n: number, d: number) => `\\frac{${n}}{${d}}`;
export const mfrac = (n: number, d: number) => m(tfrac(n, d));

/** Fraction (possibly improper) as TeX. */
export function fracTex(f: Frac): string {
  return f.isInt ? String(f.n) : `${f.n < 0 ? '-' : ''}\\frac{${Math.abs(f.n)}}{${f.d}}`;
}
/** Mixed number TeX (e.g. 2\frac{1}{4}); whole numbers and proper fractions fall back sensibly. */
export function mixedTex(f: Frac): string {
  if (f.isInt) return String(f.n);
  const w = Math.trunc(f.n / f.d);
  const rem = Math.abs(f.n) - Math.abs(w) * f.d;
  if (w === 0) return fracTex(f);
  return `${w}\\frac{${rem}}{${f.d}}`;
}
export const mm = (f: Frac) => m(mixedTex(f));
export const mf = (f: Frac) => m(fracTex(f));

/** Exact decimal string of a terminating fraction. `places` pads with zeros. */
export function decStr(f: Frac, places?: number): string {
  if (!f.terminating) throw new Error('Non-terminating decimal');
  const neg = f.n < 0;
  let p = 0;
  while (new Frac(f.n * Math.pow(10, p), f.d).isInt === false) p++;
  const digits = places !== undefined ? Math.max(places, p) : p;
  const scaled = Math.abs(f.n) * Math.pow(10, digits) / f.d;
  const s = String(Math.round(scaled)).padStart(digits + 1, '0');
  const out = digits === 0 ? s : `${s.slice(0, s.length - digits)}.${s.slice(s.length - digits)}`;
  return neg ? `-${out}` : out;
}
/** Build an exact decimal from an integer count of 10^-places units. */
export const D = (units: number, places: number) => new Frac(units, Math.pow(10, places));

export const commas = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
export const money = (f: Frac | number): string => {
  const fr = Frac.of(f);
  const s = decStr(fr, 2);
  const [w, c] = s.split('.');
  return `$${commas(Number(w))}.${c}`;
};
/** Whole-dollar or cents money, trimming ".00". */
export const moneyAuto = (f: Frac | number): string => {
  const fr = Frac.of(f);
  return fr.isInt ? `$${commas(fr.n)}` : money(fr);
};

export const NAMES = ['Kenny', 'Mai', 'Linh', 'Minh', 'Anna', 'Ben', 'Chloe', 'Dan', 'Ella', 'Finn', 'Grace', 'Hugo', 'Isla', 'Jack', 'Kira', 'Leo', 'Nina', 'Omar', 'Priya', 'Sam', 'Tom', 'Uma', 'Vy', 'Zoe', 'An', 'Bao', 'Khoa', 'Lan'];
export const twoNames = (r: Rng): [string, string] => {
  const [a, b] = r.sample(NAMES, 2);
  return [a, b];
};
export const ITEMS_SMALL = ['notebooks', 'pencil cases', 'storybooks', 'puzzle books', 'sticker packs', 'science kits', 'water bottles', 'lunch boxes'];
export const SHOPS = ['the school store', 'the corner shop', 'the book fair', 'the farmers market', 'the toy shop', 'the stationery shop'];
export const FRUITS = ['apples', 'oranges', 'mangoes', 'pears', 'bananas', 'plums', 'peaches'];
export const ANIMALS = ['goats', 'ducks', 'sheep', 'hens', 'ponies'];

/** Random integer that is not a multiple of 10 (avoids trivial arithmetic). */
export const awkward = (r: Rng, lo: number, hi: number): number => {
  for (let i = 0; i < 20; i++) {
    const v = r.int(lo, hi);
    if (v % 10 !== 0) return v;
  }
  return lo + 1;
};

/** Pick an integer from [lo, hi] that has a given property. */
export function intWhere(r: Rng, lo: number, hi: number, ok: (n: number) => boolean): number {
  for (let i = 0; i < 200; i++) {
    const v = r.int(lo, hi);
    if (ok(v)) return v;
  }
  for (let v = lo; v <= hi; v++) if (ok(v)) return v;
  throw new Error('intWhere: no value found');
}

export const coprime = (a: number, b: number) => gcd(a, b) === 1;

/** Tier-scaled pick: returns lo..hi lists by tier (1-5). */
export function byTier<T>(tier: number, list: readonly T[]): T {
  return list[Math.min(list.length - 1, Math.max(0, tier - 1))];
}

export const plural = (n: number, one: string, many = one + 's') => (n === 1 ? one : many);

/** Plain-text mixed number / fraction, e.g. "2 1/4" (for explanation steps). */
export function plainMixed(f: Frac): string {
  if (f.isInt) return String(f.n);
  const w = Math.trunc(f.n / f.d);
  const rem = Math.abs(f.n) - Math.abs(w) * f.d;
  return w === 0 ? `${f.n}/${f.d}` : `${w} ${rem}/${f.d}`;
}
