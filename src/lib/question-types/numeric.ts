import { Frac, gcd } from '../math/fraction';
import { texToPlain } from '../math/parse';
import { normalizeText } from './text';

export type NumericFormat = 'number' | 'fraction' | 'ratio' | 'mixed';

export interface NumericOptions {
  unit?: string | null;
  /** How the student is asked to write the answer. 'ratio' reads a:b; everything else reads numbers, fractions and decimals. */
  format?: NumericFormat;
  tolerance?: number;
  requireSimplified?: boolean;
}

export interface ParsedNumber {
  value: Frac;
  /** Written as a fraction (a/b or a b/c). */
  isFraction: boolean;
  /** The fraction is already in lowest terms (true for non-fractions). */
  reduced: boolean;
}

/** Strip a trailing unit (case-insensitive, optional) from a numeric answer. */
function stripUnit(s: string, unit?: string | null): string {
  if (!unit) return s;
  const u = normalizeText(unit);
  const lower = normalizeText(s);
  if (lower.endsWith(u)) return s.normalize('NFC').trim().slice(0, s.normalize('NFC').trim().length - u.length).trim();
  return s;
}

/**
 * Read a whole student answer as a number. Accepts 12, 0.5, .5, 0,5, 1,000, 3/4, 1 1/2, -2.
 * Returns null for anything else, so "abc" or "3 apples" are simply wrong.
 */
export function parseNumberInput(raw: string, unit?: string | null, format?: NumericFormat): ParsedNumber | null {
  try {
    if (format === 'ratio') {
      const r = /^(\d+) ?: ?(\d+)$/.exec(raw.normalize('NFC').replace(/\s+/g, ' ').trim());
      if (!r || Number(r[2]) === 0) return null;
      return { value: new Frac(Number(r[1]), Number(r[2])), isFraction: true, reduced: gcd(Number(r[1]), Number(r[2])) === 1 };
    }
    let s = texToPlain(stripUnit(raw, unit)).normalize('NFC').replace(/\s+/g, ' ').replace(/−/g, '-').replace(/^(-?)\$\s*/, '$1').trim();
    if (!s) return null;
    if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else if (/^-?\d*,\d+$/.test(s)) s = s.replace(',', '.');
    const mixed = /^(-?)(\d+) (\d+)\/(\d+)$/.exec(s);
    if (mixed) {
      const part = new Frac(Number(mixed[3]), Number(mixed[4]));
      const whole = new Frac(Number(mixed[2]));
      const total = whole.add(part);
      return { value: mixed[1] ? total.neg() : total, isFraction: true, reduced: gcd(Number(mixed[3]), Number(mixed[4])) === 1 && Number(mixed[3]) < Number(mixed[4]) };
    }
    const fr = /^(-?\d+)\/(\d+)$/.exec(s);
    if (fr) return { value: new Frac(Number(fr[1]), Number(fr[2])), isFraction: true, reduced: gcd(Number(fr[1]), Number(fr[2])) === 1 };
    const dec = /^-?(\d+(\.\d*)?|\.\d+)$/.exec(s);
    if (dec) {
      let lit = s.replace(/\.$/, '');
      lit = lit.replace(/^(-?)\./, '$10.');
      return { value: Frac.parse(lit), isFraction: false, reduced: true };
    }
    return null;
  } catch {
    return null;
  }
}

export function numericMatches(input: string, accepted: string[], opts: NumericOptions = {}): boolean {
  const got = parseNumberInput(input, opts.unit, opts.format);
  if (!got) return false;
  if (opts.requireSimplified && got.isFraction && !got.reduced) return false;
  const tol = opts.tolerance ?? 0;
  return accepted.some((a) => {
    const want = parseNumberInput(a, opts.unit, opts.format);
    if (!want) return false;
    return tol > 0 ? Math.abs(got.value.value - want.value.value) <= tol + 1e-12 : got.value.eq(want.value);
  });
}
