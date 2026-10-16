import { Frac } from './fraction';
import { evalExpr } from './expr';

/** Strip inline-math delimiters and common LaTeX so option text can be read as plain math. */
export function texToPlain(input: string): string {
  let s = input.replace(/\{,\}/g, ',');
  s = s.replace(/\\\(|\\\)/g, ' ');
  s = s.replace(/\\\$/g, '$');
  s = s.replace(/\\[td]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, ' $1/$2 ');
  s = s.replace(/\\(?:text|mathrm|textbf)\s*\{([^{}]*)\}/g, ' $1 ');
  s = s.replace(/\\%/g, '%');
  s = s.replace(/\\(?:times|cdot)/g, '*').replace(/\\div/g, '/');
  s = s.replace(/\\(?:,|;|!|:|quad|qquad|left|right)/g, ' ');
  s = s.replace(/\^\{?\s*\\?circ\s*\}?/g, '°');
  s = s.replace(/\^\{([^{}]*)\}/g, '^$1');
  s = s.replace(/[{}]/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Interpret an answer option as an exact number when possible.
 * Conventions: "h:mm" -> minutes since midnight, "X hours Y minutes" -> total minutes,
 * "a:b" ratio -> a/b, weekday names -> 0 (Sunday) .. 6, percentages keep their written value.
 */
export function parseOptionValue(text: string): Frac | null {
  try {
    const s = texToPlain(text).replace(/\s+/g, ' ').trim();
    if (!s) return null;
    const lower = s.toLowerCase();

    const dayIdx = DAYS.indexOf(lower);
    if (dayIdx >= 0) return new Frac(dayIdx);

    const clock = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(s);
    if (clock) {
      let h = Number(clock[1]);
      const m = Number(clock[2]);
      const ap = clock[3]?.toLowerCase();
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      return new Frac(h * 60 + m);
    }

    const hm = /^(\d+)\s*(?:hours?|hrs?|h)\s*(?:and\s*)?(\d+)\s*(?:minutes?|mins?|min|m)$/i.exec(s);
    if (hm) return new Frac(Number(hm[1]) * 60 + Number(hm[2]));

    const ratio = /^(\d+)\s*:\s*(\d+)(?!\d)/.exec(s);
    if (ratio) return new Frac(Number(ratio[1]), Number(ratio[2]));

    const cleaned = s.replace(/(?<=\d),(?=\d{3}(?!\d))/g, '').replace(/^[^\d-.]*\$\s*/, '');
    const mixed = /(-?\d+)\s+(\d+)\/(\d+)/.exec(cleaned);
    if (mixed) {
      const w = Number(mixed[1]);
      const part = new Frac(Number(mixed[2]), Number(mixed[3]));
      return w < 0 || mixed[1].startsWith('-') ? new Frac(w).sub(part) : new Frac(w).add(part);
    }
    const fr = /(-?\d+)\/(\d+)/.exec(cleaned);
    if (fr) return new Frac(Number(fr[1]), Number(fr[2]));
    const num = /-?\d+(?:\.\d+)?|-?\.\d+/.exec(cleaned);
    if (num) return Frac.parse(num[0].startsWith('.') ? '0' + num[0] : num[0].replace(/^-\./, '-0.'));
    return null;
  } catch {
    return null;
  }
}

/** Convert a TeX arithmetic fragment to the evaluator's syntax. Returns null if it is not plain arithmetic. */
export function texToExpr(tex: string): string | null {
  let s = tex.replace(/\{,\}/g, ',');
  s = s.replace(/(\d)\s*\\[td]?frac\s*\{(\d+)\}\s*\{(\d+)\}/g, '($1+$2/$3)'); // mixed number
  s = s.replace(/\\[td]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '(($1)/($2))');
  s = s.replace(/\\(?:times|cdot)/g, '*').replace(/\\div/g, '/');
  s = s.replace(/\\(?:left|right)/g, '').replace(/\\[,;! ]/g, ' ');
  s = s.replace(/\^\{([^{}]*)\}/g, '^($1)').replace(/\^(\d)/g, '^$1');
  s = s.replace(/(?<=\d),(?=\d{3}(?!\d))/g, '');
  s = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  s = s.replace(/\[/g, '(').replace(/\]/g, ')');
  if (/[\\{}]/.test(s)) return null;
  if (!/^[0-9+\-*/^().\s]+$/.test(s)) return null;
  return s;
}

/**
 * Independently verify a question that is pure arithmetic ("Calculate \(24 \times 3 + 6\)").
 * Returns the computed value, or null if the text is not a recognised arithmetic question.
 */
export function evaluateArithmeticQuestion(questionText: string): Frac | null {
  const segs = [...questionText.matchAll(/\\\((.+?)\\\)/g)];
  if (segs.length !== 1) return null;
  if (!/^(calculate|evaluate|work out|compute|find the value of|what is|simplify)\b/i.test(questionText.trim())) return null;
  const outside = questionText.replace(/\\\(.+?\\\)/g, '').toLowerCase();
  if (/\b(of|percent|%|remainder|round|nearest|digit)\b/.test(outside)) return null;
  const expr = texToExpr(segs[0][1].replace(/=\s*\??\s*$/, ''));
  if (!expr || !/[+\-*/^]/.test(expr.replace(/^-/, ''))) return null;
  try {
    return evalExpr(expr);
  } catch {
    return null;
  }
}
