import { T } from '../define';
import type { Template } from '../types';
import { Frac, gcd, lcm } from '../../math/fraction';
import { NAMES, coprime, fracTex, intWhere, m, mixedTex, plainMixed, tfrac } from '../h';
import type { Rng } from '../rng';

const F = (n: number, d = 1) => new Frac(n, d);
const ans = (f: Frac) => m(mixedTex(f));
const imp = (f: Frac) => m(fracTex(f));
const ft = (n: number, d: number) => tfrac(n, d);
/** Pad generator: shift by 1/den steps. */
const padF = (v: Frac, den: number) => (d: number) => {
  const x = v.add(F(d, den));
  return x.n > 0 ? ans(x) : ans(v.add(F(Math.abs(d) + 1, den)));
};

const DENS = [2, 3, 4, 5, 6, 8, 10, 12];

function properFrac(r: Rng, den: number): Frac {
  return F(r.int(1, den - 1), den);
}

type Raw = [number, number];
const rf = (x: Raw) => F(x[0], x[1]);

const add: Template = T('fr.add', 'fr.add', 'Adding fractions', 'Fractions', [1, 5], (r, tier) => {
  let a: Raw, b: Raw;
  if (tier === 1) {
    const d = r.pick([5, 6, 7, 8, 9, 10, 12]);
    const n1 = r.int(1, Math.floor(d / 2));
    a = [n1, d];
    b = [r.int(1, Math.max(1, d - n1 - 1)), d];
  } else if (tier === 2) {
    const d = r.pick([4, 6, 8, 10, 12]);
    a = [r.int(1, d - 1), d];
    b = [r.int(1, 2), d / 2];
  } else if (tier === 3) {
    const [d1, d2] = r.pick([[3, 4], [2, 5], [3, 5], [4, 5], [2, 3], [3, 7], [5, 6]] as Raw[]);
    a = [r.int(1, d1 - 1), d1];
    b = [r.int(1, d2 - 1), d2];
  } else {
    const [d1, d2] = r.pick([[6, 8], [4, 6], [10, 15], [6, 9], [8, 12], [12, 18], [9, 12]] as Raw[]);
    a = [r.int(1, d1 - 1), d1];
    b = [r.int(1, d2 - 1), d2];
  }
  let c: Raw | null = null;
  if (tier === 5) {
    const d3 = r.pick([2, 3, 4, 6]);
    c = [r.int(1, d3 - 1), d3];
  }
  const parts: Raw[] = c ? [a, b, c] : [a, b];
  if (new Set(parts.map((p) => rf(p).toString())).size < parts.length) return add.build(r, tier);
  const sum = parts.map(rf).reduce((x, y) => x.add(y));
  const dens = parts.map((p) => p[1]);
  const L = dens.reduce((x, y) => lcm(x, y));
  const conv = (p: Raw) => `${p[0] * (L / p[1])}/${L}`;
  const numSum = parts.reduce((s, p) => s + p[0] * (L / p[1]), 0);
  const naive = F(parts.reduce((s, p) => s + p[0], 0), dens.reduce((s, x) => s + x, 0));
  const sameDen = dens.every((x) => x === dens[0]);
  return {
    text: `Calculate ${m(parts.map((p) => ft(p[0], p[1])).join(' + '))}. Give your answer in simplest form${sum.cmp(1) > 0 ? ' (use a mixed number if needed)' : ''}.`,
    correct: ans(sum),
    wrong: [ans(naive), ans(F(parts.reduce((s, p) => s + p[0], 0), Math.max(...dens))), ans(sum.add(F(1, L))), ans(sum.sub(F(1, L)).n > 0 ? sum.sub(F(1, L)) : sum.add(F(2, L)))],
    verify: parts.map((p) => `${p[0]}/${p[1]}`).join('+'),
    pad: padF(sum, L),
    asks: 'Add the fractions and write the total as simply as possible.',
    concept: 'Fractions can be added only when the pieces are the same size, so use a common denominator.',
    steps: [
      sameDen ? `The denominators are the same (${dens[0]}), so add the numerators.` : `Common denominator: the smallest number that ${[...new Set(dens)].join(', ')} all go into is ${L}.`,
      `Rewrite: ${parts.map(conv).join(' + ')}.`,
      `Add the numerators: ${parts.map((p) => p[0] * (L / p[1])).join(' + ')} = ${numSum}, so the sum is ${numSum}/${L}.`,
      `Simplify${sum.cmp(1) > 0 ? ' and write as a mixed number' : ''}: ${plainMixed(sum)}.`,
    ],
    mistake: 'Adding the numerators AND the denominators (for example 1/2 + 1/3 = 2/5).',
    tip: 'Never add denominators. Make them the same, then add only the numerators.',
  };
});

const sub: Template = T('fr.sub', 'fr.sub', 'Subtracting fractions', 'Fractions', [1, 5], (r, tier) => {
  let a: Raw, b: Raw;
  const order = (x: Raw, y: Raw): [Raw, Raw] => (rf(x).cmp(rf(y)) >= 0 ? [x, y] : [y, x]);
  if (tier === 1) {
    const d = r.pick([6, 7, 8, 9, 10, 12]);
    const n1 = r.int(3, d - 1);
    a = [n1, d];
    b = [r.int(1, n1 - 1), d];
  } else if (tier === 2) {
    const d = r.pick([4, 6, 8, 10, 12]);
    a = [r.int(d / 2 + 1, d - 1), d];
    b = [1, d / 2];
  } else if (tier === 3) {
    const [d1, d2] = r.pick([[3, 4], [2, 5], [3, 5], [4, 5], [2, 3], [3, 7]] as Raw[]);
    [a, b] = order([r.int(1, d1 - 1), d1], [r.int(1, d2 - 1), d2]);
  } else {
    const [d1, d2] = r.pick([[6, 8], [4, 6], [10, 15], [6, 9], [8, 12], [12, 18]] as Raw[]);
    [a, b] = order([r.int(1, d1 - 1), d1], [r.int(1, d2 - 1), d2]);
  }
  if (rf(a).eq(rf(b))) return sub.build(r, tier);
  let left: Raw = a;
  let lTex = ft(a[0], a[1]);
  if (tier === 5) {
    const w = r.int(2, 6);
    left = [w, 1];
    lTex = String(w);
  }
  const diff = rf(left).sub(rf(b));
  const L = lcm(left[1], b[1]);
  const naive = F(Math.abs(left[0] - b[0]), Math.abs(left[1] - b[1]) || 1);
  const ln = left[0] * (L / left[1]);
  const bn = b[0] * (L / b[1]);
  return {
    text: `Calculate ${m(`${lTex} - ${ft(b[0], b[1])}`)}. Give your answer in simplest form.`,
    correct: ans(diff),
    wrong: [ans(naive.n > 0 && !naive.eq(diff) ? naive : diff.add(F(1, L))), ans(diff.add(F(1, L))), ans(diff.cmp(F(1, L)) > 0 ? diff.sub(F(1, L)) : diff.add(F(2, L))), ans(rf(left).add(rf(b)))],
    verify: `${left[0]}/${left[1]}-${b[0]}/${b[1]}`,
    pad: padF(diff, L),
    asks: 'Take the smaller amount away from the larger amount.',
    concept: 'Subtract fractions after giving them the same denominator.',
    steps:
      tier === 5
        ? [`Write the whole number as a fraction with denominator ${b[1]}: ${left[0]} = ${ln}/${L}.`, `Subtract numerators: ${ln} − ${bn} = ${ln - bn}, so ${ln - bn}/${L}.`, `Simplify: ${plainMixed(diff)}.`]
        : [`Common denominator: ${L}.`, `Rewrite: ${ln}/${L} − ${bn}/${L}.`, `Subtract numerators: ${ln} − ${bn} = ${ln - bn}, so ${ln - bn}/${L}.`, `Simplify: ${plainMixed(diff)}.`],
    mistake: 'Subtracting the denominators as well, or subtracting without matching the denominators.',
    tip: 'The denominator tells the size of the pieces – it stays the same once the pieces match.',
  };
});

const mult = T('fr.mult', 'fr.mult', 'Multiplying fractions', 'Fractions', [1, 5], (r, tier) => {
  let a: Frac, b: Frac;
  if (tier === 1) {
    const d = r.pick([3, 4, 5, 6, 8]);
    const w = d * r.int(2, 6);
    a = F(r.int(1, d - 1), d);
    b = F(w);
  } else if (tier === 2) {
    a = F(r.int(1, 4), r.pick([5, 6, 7]));
    b = F(r.int(1, 4), r.pick([3, 4, 5]));
  } else if (tier === 3) {
    a = F(r.int(1, 5), r.pick([6, 8, 9]));
    b = F(r.int(2, 8), r.pick([5, 7, 9, 10]));
  } else if (tier === 4) {
    a = F(r.int(1, 3) * 4 + r.int(1, 3), 4); // mixed
    b = F(r.int(1, 4), r.pick([3, 5, 6]));
  } else {
    a = F(r.int(1, 3) * 3 + r.int(1, 2), 3);
    b = F(r.int(1, 3) * 4 + r.int(1, 3), 4);
  }
  const mixedFmt = (f: Frac) => (f.isInt ? String(f.n) : f.n > f.d ? mixedTex(f) : ft(f.n, f.d));
  const aTex = mixedFmt(a);
  const bTex = mixedFmt(b);
  const aExpr = `${a.n}/${a.d}`;
  const bExpr = `${b.n}/${b.d}`;
  const p = a.mul(b);
  if (a.n === b.n && a.d === b.d) return mult.build(r, tier);
  const imps = tier >= 4;
  return {
    text: `Calculate ${m(`${aTex} \\times ${bTex}`)}. Give your answer in simplest form.`,
    correct: ans(p),
    wrong: [ans(F(a.n * b.n, a.d + b.d)), ans(a.add(b).d === 0 ? p : a.mul(b.d === 1 ? b : F(b.n, 1))), ans(p.add(F(1, p.d))), ans(F(a.n * b.d, a.d * b.n || 1))],
    verify: `${aExpr}*${bExpr}`,
    pad: padF(p, p.d),
    asks: 'Multiply the two numbers and simplify.',
    concept: 'To multiply fractions, multiply the numerators together and the denominators together. Change mixed numbers to improper fractions first.',
    steps: [
      ...(imps ? [`Write mixed numbers as improper fractions: ${aExpr} × ${bExpr}.`] : []),
      `Multiply numerators: ${a.n} × ${b.n} = ${a.n * b.n}. Multiply denominators: ${a.d} × ${b.d} = ${a.d * b.d}.`,
      `The product is ${a.n * b.n}/${a.d * b.d}, which simplifies to ${p.toString()}.`,
    ],
    mistake: 'Finding a common denominator (needed for adding, not multiplying) or multiplying only the numerators.',
    tip: 'Multiply straight across, then simplify. You can cancel common factors before you multiply.',
  };
});

const div = T('fr.div', 'fr.div', 'Dividing with fractions', 'Fractions', [1, 5], (r, tier) => {
  if (tier === 1) {
    const d = r.pick([2, 3, 4, 5, 6]);
    const w = r.int(2, 8);
    const v = F(w * d);
    return {
      text: `Calculate ${m(`${w} \\div ${ft(1, d)}`)}.`,
      correct: String(v.n),
      wrong: [String(w * 1), String(w + d), String(Math.round((w / d) * 100) / 100 === w / d ? v.n + d : v.n - d), String(w * d + 1)],
      verify: `${w}/(1/${d})`,
      pad: (x) => String(v.n + x),
      asks: `Find how many pieces of size 1/${d} fit into ${w}.`,
      concept: `Dividing by 1/${d} asks “how many ${d === 2 ? 'halves' : 'pieces of that size'} fit?”. Each whole holds ${d} of them.`,
      steps: [`Each whole has ${d} pieces of size 1/${d}.`, `${w} wholes × ${d} pieces = ${w * d}.`],
      mistake: `Dividing ${w} by ${d} instead of multiplying (dividing by a fraction makes the answer bigger).`,
      tip: 'Dividing by a unit fraction is the same as multiplying by its denominator.',
    };
  }
  if (tier === 2) {
    const d = r.pick([2, 3, 4, 5]);
    const w = r.int(2, 6);
    const v = F(1, d * w);
    return {
      text: `Calculate ${m(`${ft(1, d)} \\div ${w}`)}.`,
      correct: imp(v),
      wrong: [imp(F(w, d)), imp(F(1, d + w)), imp(F(w, 1).div(F(d))), imp(F(1, d * w + 1))],
      verify: `(1/${d})/${w}`,
      pad: (x) => imp(F(1, d * w + x)),
      asks: `Share 1/${d} equally into ${w} parts and find the size of each part.`,
      concept: 'Dividing a fraction by a whole number makes each part smaller: multiply the denominator by the whole number.',
      steps: [`${ft(1, d)} ÷ ${w} = ${ft(1, d)} × ${ft(1, w)}.`, `Multiply: 1×1 over ${d}×${w} = 1/${d * w}.`],
      mistake: `Multiplying by ${w} instead of dividing.`,
      tip: 'Splitting a piece into more parts makes the pieces smaller.',
    };
  }
  if (tier === 3) {
    const a = F(r.int(1, 5), r.pick([4, 5, 6, 7]));
    const b = F(r.int(1, 4), r.pick([3, 5, 8]));
    const v = a.div(b);
    return {
      text: `Calculate ${m(`${ft(a.n, a.d)} \\div ${ft(b.n, b.d)}`)}. Give your answer in simplest form.`,
      correct: ans(v),
      wrong: [ans(a.mul(b)), ans(b.div(a)), ans(F(a.n * b.n, a.d * b.d + 1)), ans(v.add(F(1, v.d)))],
      verify: `(${a.n}/${a.d})/(${b.n}/${b.d})`,
      pad: padF(v, v.d),
      asks: 'Divide one fraction by another.',
      concept: 'To divide by a fraction, multiply by its reciprocal (flip it upside down).',
      steps: [`The reciprocal of ${b.n}/${b.d} is ${b.d}/${b.n}.`, `${a.n}/${a.d} × ${b.d}/${b.n} = ${a.n * b.d}/${a.d * b.n}.`, `Simplify: ${v.toString()}.`],
      mistake: 'Flipping the wrong fraction (or both), or forgetting to flip at all.',
      tip: 'Keep – Change – Flip: keep the first fraction, change ÷ to ×, flip the second.',
    };
  }
  if (tier === 4) {
    const bn = r.pick([2, 3, 4, 5]);
    const bd = r.pick([5, 6, 7, 8, 9].filter((x) => x > bn));
    const w = r.int(2, 9);
    const b = F(bn, bd);
    const v = F(w).div(b);
    const cups = r.chance(0.5);
    return {
      text: cups
        ? `A jug holds ${w} litres of juice. Each glass holds ${m(ft(bn, bd))} of a litre. How many glasses can be filled? Give your answer in simplest form.`
        : `Calculate ${m(`${w} \\div ${ft(bn, bd)}`)}. Give your answer in simplest form.`,
      correct: ans(v),
      wrong: [ans(F(w * bn, bd)), ans(F(w).div(F(bd, bn)).add(F(1, bn))), ans(v.add(F(1, bn))), ans(F(w * bd, bn + 1))],
      verify: `${w}/(${bn}/${bd})`,
      pad: padF(v, bn),
      asks: cups ? 'Find how many equal servings can be made.' : 'Divide a whole number by a fraction.',
      concept: 'Dividing by a fraction means multiplying by its reciprocal.',
      steps: [`${w} ÷ ${bn}/${bd} = ${w} × ${bd}/${bn}.`, `${w} × ${bd} = ${w * bd}, so we get ${w * bd}/${bn}.`, `Simplify: ${v.toString()}.`],
      mistake: 'Multiplying by the fraction instead of by its reciprocal.',
      tip: 'Dividing by a number less than 1 gives a bigger answer than the number you started with.',
    };
  }
  const wnum = r.int(1, 3);
  const a = F(wnum * 3 + r.int(1, 2), 3);
  const b = F(r.int(1, 3), r.pick([2, 4, 5]));
  const v = a.div(b);
  return {
    text: `Calculate ${m(`${mixedTex(a)} \\div ${ft(b.n, b.d)}`)}. Give your answer in simplest form.`,
    correct: ans(v),
    wrong: [ans(a.mul(b)), ans(F(a.n * b.n, a.d * b.d + 1)), ans(v.add(F(1, v.d))), ans(b.div(a))],
    verify: `(${a.n}/${a.d})/(${b.n}/${b.d})`,
    pad: padF(v, v.d),
    asks: 'Divide a mixed number by a fraction.',
    concept: 'Change the mixed number to an improper fraction, then multiply by the reciprocal.',
    steps: [`${plainMixed(a)} = ${a.n}/${a.d}.`, `Multiply by the reciprocal: ${a.n}/${a.d} × ${b.d}/${b.n} = ${a.n * b.d}/${a.d * b.n}.`, `Simplify: ${v.toString()}.`],
    mistake: 'Dividing the whole-number part and the fraction part separately.',
    tip: 'Always turn mixed numbers into improper fractions before multiplying or dividing.',
  };
});

const mixedConv = T('fr.mixed', 'fr.mixed', 'Mixed numbers and improper fractions', 'Fractions', [1, 4], (r, tier) => {
  const d = tier === 1 ? r.pick([3, 4, 5]) : tier === 2 ? r.pick([4, 5, 6, 8]) : r.pick([7, 8, 9, 10, 12]);
  const w = tier === 1 ? r.int(1, 3) : r.int(2, tier === 4 ? 12 : 8);
  const n = r.int(1, d - 1);
  const improper = F(w * d + n, d);
  if (r.chance(0.5) || tier === 1) {
    return {
      text: `Write ${m(tfrac(w * d + n, d))} as a mixed number.`,
      correct: m(`${w}\\frac{${n}}{${d}}`),
      wrong: [m(`${w}\\frac{${d - n}}{${d}}`), m(`${w + 1}\\frac{${n}}{${d}}`), m(`${n}\\frac{${w}}{${d}}`), m(`${w}\\frac{${n}}{${d + 1}}`)],
      verify: `${w}+${n}/${d}`,
      pad: (x) => m(`${w}\\frac{${Math.min(d - 1, Math.max(1, n + x))}}{${d}}`),
      asks: 'Find how many whole ones are in the fraction and what is left over.',
      concept: 'An improper fraction has a numerator bigger than its denominator. Divide to find wholes and remainder.',
      steps: [`${w * d + n} ÷ ${d} = ${w} remainder ${n}.`, `So there are ${w} wholes and ${n}/${d} left.`, `The mixed number is ${w} ${n}/${d}.`],
      mistake: 'Writing the remainder as the whole number or changing the denominator.',
      tip: 'Whole number = quotient, new numerator = remainder, denominator stays the same.',
    };
  }
  return {
    text: `Write ${m(`${w}\\frac{${n}}{${d}}`)} as an improper fraction.`,
    correct: imp(improper),
    wrong: [m(tfrac(w + n, d)), m(tfrac(w * n + d, d)), m(tfrac(w * d + n, w + d)), m(tfrac(w * d - n, d))],
    verify: `(${w}*${d}+${n})/${d}`,
    pad: (x) => m(tfrac(w * d + n + x, d)),
    asks: 'Turn the mixed number into one fraction.',
    concept: 'Each whole is made of d parts. Multiply the whole number by the denominator and add the numerator.',
    steps: [`${w} wholes = ${w} × ${d} = ${w * d} parts of size 1/${d}.`, `Add the ${n} extra parts: ${w * d} + ${n} = ${w * d + n}.`, `The improper fraction is ${w * d + n}/${d}.`],
    mistake: 'Adding the whole number to the numerator (w + n) instead of multiplying w by the denominator first.',
    tip: 'Multiply the whole number by the denominator, then add the numerator.',
  };
});

const compare = T('fr.compare', 'fr.compare', 'Comparing and ordering fractions', 'Fractions', [1, 5], (r, tier) => {
  const isMax = r.chance(0.6);
  let vals: Frac[];
  if (tier === 1) {
    const d = r.pick([5, 6, 7, 8, 9, 10]);
    vals = r.sample([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => x < d), 4).map((n) => F(n, d));
    // keep un-simplified display so same denominator is visible
    const disp = vals.map((v) => ({ n: v.n * 1, d: v.d }));
    return buildCompare(r, vals.map((v, i) => ({ f: v, n: disp[i].n, d: disp[i].d })), isMax, tier);
  }
  if (tier === 2) {
    const n = r.int(1, 4);
    const ds = r.sample([n + 1, n + 2, n + 3, n + 4, n + 6, n + 8], 4);
    const items = ds.map((d) => ({ f: F(n, d), n, d }));
    return buildCompare(r, items, isMax, tier);
  }
  const pool: { f: Frac; n: number; d: number }[] = [];
  const dens = tier === 3 ? [3, 4, 5, 6, 8] : tier === 4 ? [6, 7, 8, 9, 10, 12] : [9, 11, 12, 13, 15, 16];
  while (pool.length < 4) {
    const d = r.pick(dens);
    const n = r.int(1, d - 1);
    const f = F(n, d);
    if (gcd(n, d) !== 1) continue;
    if (pool.some((p) => p.f.eq(f))) continue;
    pool.push({ f, n, d });
  }
  vals = pool.map((p) => p.f);
  return buildCompare(r, pool, isMax, tier);
});

function buildCompare(r: Rng, items: { f: Frac; n: number; d: number }[], isMax: boolean, tier: number) {
  const sorted = items.slice().sort((x, y) => x.f.cmp(y.f));
  const target = isMax ? sorted[sorted.length - 1] : sorted[0];
  const others = items.filter((i) => i !== target);
  const show = (i: { n: number; d: number }) => m(tfrac(i.n, i.d));
  const expr = `${isMax ? 'max' : 'min'}(${items.map((i) => `${i.n}/${i.d}`).join(',')})`;
  const common = items.map((i) => i.d).reduce((a, b) => lcm(a, b));
  return {
    text: `Which of these fractions is the ${isMax ? 'greatest' : 'smallest'}?`,
    correct: show(target),
    wrong: others.map(show),
    verify: expr,
    asks: `Pick the fraction with the ${isMax ? 'largest' : 'smallest'} value.`,
    concept: 'To compare fractions, give them the same denominator (or the same numerator) so the pieces are comparable.',
    steps: [
      tier === 1 ? 'The denominators are all the same, so the fraction with the bigger numerator is bigger.' : tier === 2 ? 'The numerators are the same, so the fraction with the smaller denominator has bigger pieces.' : `Change every fraction to a denominator of ${common}.`,
      `In order from smallest to largest: ${sorted.map((i) => `${i.n}/${i.d}`).join(' < ')}.`,
      `The ${isMax ? 'greatest' : 'smallest'} is ${target.n}/${target.d}.`,
    ],
    mistake: 'Thinking the fraction with the bigger denominator is bigger (1/8 is smaller than 1/4).',
    tip: 'A bigger denominator means the whole is cut into more, smaller pieces.',
  };
}

const simplify = T('fr.simplify', 'fr.simplify', 'Simplifying fractions', 'Fractions', [1, 4], (r, tier) => {
  const g = [r.int(2, 4), r.int(3, 6), r.int(4, 9), r.int(6, 12)][tier - 1];
  const sd = intWhere(r, 3, tier <= 2 ? 9 : 13, (x) => x > 2);
  const sn = intWhere(r, 1, sd - 1, (x) => coprime(x, sd));
  const n = sn * g;
  const d = sd * g;
  return {
    text: `Write ${m(tfrac(n, d))} in its simplest form.`,
    correct: m(tfrac(sn, sd)),
    wrong: [m(tfrac(sn, d)), m(tfrac(n, sd)), m(tfrac(sn + 1, sd)), m(tfrac(sn, sd + 1))],
    verify: `${n}/${d}`,
    pad: (x) => m(tfrac(Math.max(1, sn + x), sd)),
    asks: 'Write the fraction using the smallest possible numerator and denominator.',
    concept: 'Divide the numerator and denominator by their greatest common factor.',
    steps: [`The greatest common factor of ${n} and ${d} is ${g}.`, `${n} ÷ ${g} = ${sn} and ${d} ÷ ${g} = ${sd}.`, `The simplest form is ${sn}/${sd}.`],
    mistake: 'Dividing the top and bottom by different numbers, or stopping before the fraction is fully simplified.',
    tip: 'Whatever you do to the top you must do to the bottom.',
  };
});

const equiv = T('fr.equiv', 'fr.equiv', 'Equivalent fractions', 'Fractions', [1, 4], (r, tier) => {
  const d = r.pick([3, 4, 5, 6, 7]);
  const n = intWhere(r, 1, d - 1, (x) => true);
  const k = [r.int(2, 4), r.int(3, 6), r.int(4, 9), r.int(6, 12)][tier - 1];
  const down = tier === 4 && r.chance(0.5);
  const v = n * k;
  return {
    text: down
      ? `Find the missing number: ${m(`${tfrac(n * k, d * k)} = ${tfrac(n, '\\square' as unknown as number)}`)}`
      : `Find the missing number: ${m(`${tfrac(n, d)} = \\frac{\\square}{${d * k}}`)}`,
    correct: String(down ? d : v),
    wrong: down ? [String(d * k), String(d + k), String(n), String(d + 1)] : [String(n + d * k - d), String(v + k), String(n + k), String(v - 1)],
    verify: down ? `${d}` : `${n}*${d * k}/${d}`,
    pad: (x) => String((down ? d : v) + x),
    asks: 'Find the number that keeps the fraction the same size.',
    concept: 'Equivalent fractions are made by multiplying (or dividing) the numerator and denominator by the same number.',
    steps: down
      ? [`${n * k} ÷ ${k} = ${n}, so the numerator was divided by ${k}.`, `Do the same to the denominator: ${d * k} ÷ ${k} = ${d}.`]
      : [`${d} × ${k} = ${d * k}, so the denominator was multiplied by ${k}.`, `Do the same to the numerator: ${n} × ${k} = ${v}.`],
    mistake: 'Adding the same number to the top and bottom instead of multiplying.',
    tip: 'Find the number that links the two known parts, then use it on the unknown part.',
  };
});

const of = T('fr.of', 'fr.of', 'Fraction of an amount', 'Fractions', [1, 5], (r, tier) => {
  const name = r.pick(NAMES);
  const d = tier === 1 ? r.pick([2, 3, 4, 5]) : tier === 2 ? r.pick([3, 4, 5, 6, 8]) : r.pick([5, 6, 7, 8, 9, 10, 12]);
  const n = r.int(1, d - 1);
  const unit = tier <= 2 ? r.int(2, 9) : r.int(4, 15);
  const total = d * unit;
  const item = r.pick(['stickers', 'marbles', 'cards', 'pages', 'coins', 'beads']);
  const part = n * unit;
  if (tier <= 3 || r.chance(0.4)) {
    const remaining = r.chance(0.5) && tier >= 2;
    const v = remaining ? total - part : part;
    return {
      text: `${name} has ${total} ${item}. ${name} gives away ${m(tfrac(n, d))} of them. ${remaining ? `How many ${item} does ${name} have left?` : `How many ${item} does ${name} give away?`}`,
      correct: String(v),
      wrong: remaining ? [String(part), String(total - n), String(v + unit), String(v - unit)] : [String(total - part), String(n * d), String(part + unit), String(Math.max(1, part - unit))],
      verify: remaining ? `${total}-${total}*${n}/${d}` : `${total}*${n}/${d}`,
      pad: (x) => String(v + x),
      asks: remaining ? `Find the amount that is NOT given away.` : 'Find the fraction of the total.',
      concept: 'To find a fraction of an amount, divide by the denominator, then multiply by the numerator.',
      steps: [`Divide ${total} into ${d} equal parts: ${total} ÷ ${d} = ${unit}.`, `Take ${n} parts: ${n} × ${unit} = ${part}.`, ...(remaining ? [`Left over: ${total} − ${part} = ${total - part}.`] : [])],
      mistake: remaining ? 'Stopping at the number given away and forgetting to subtract.' : 'Multiplying the amount by the denominator instead of dividing.',
      tip: `“${n}/${d} of” means divide by ${d}, then multiply by ${n}.`,
    };
  }
  // find the whole from a part
  return {
    text: `${name} says that ${m(tfrac(n, d))} of the ${item} in a box is ${part}. How many ${item} are in the box altogether?`,
    correct: String(total),
    wrong: [String(part * n), String(part + d), String(Math.round(part / n) * (d + 1)), String(part * d)],
    verify: `${part}/(${n}/${d})`,
    pad: (x) => String(total + x * d),
    asks: 'Use the part to find the whole.',
    concept: `If ${n} parts equal ${part}, one part is ${part} ÷ ${n}, and the whole is ${d} parts.`,
    steps: [`${n} parts = ${part}, so 1 part = ${part} ÷ ${n} = ${unit}.`, `The whole is ${d} parts: ${d} × ${unit} = ${total}.`],
    mistake: 'Multiplying the part by the fraction instead of finding one part first.',
    tip: 'Find the value of ONE part first, then multiply by the total number of parts.',
  };
});

const mixedOps = T('fr.mixedops', 'fr.mixedops', 'Adding and subtracting mixed numbers', 'Fractions', [3, 5], (r, tier) => {
  const [d1, d2] = tier === 3 ? ([r.pick([4, 5, 6, 8]), 0] as [number, number]) : r.pick([[3, 4], [4, 6], [5, 10], [3, 6], [6, 8], [2, 5]] as [number, number][]);
  const dd2 = d2 || d1;
  const a = F(r.int(2, 6) * d1 + r.int(1, d1 - 1), d1);
  const b = F(r.int(1, 4) * dd2 + r.int(1, dd2 - 1), dd2);
  const addOp = tier === 3 ? true : r.chance(0.5);
  const [x, y] = a.cmp(b) >= 0 ? [a, b] : [b, a];
  const v = addOp ? a.add(b) : x.sub(y);
  const [p, q] = addOp ? [a, b] : [x, y];
  const L = lcm(p.d, q.d);
  return {
    text: `Calculate ${m(`${mixedTex(p)} ${addOp ? '+' : '-'} ${mixedTex(q)}`)}. Give your answer as a mixed number in simplest form.`,
    correct: ans(v),
    wrong: [
      ans(addOp ? F(Math.trunc(p.n / p.d) + Math.trunc(q.n / q.d), 1).add(F((p.n % p.d) + (q.n % q.d), p.d + q.d)) : F(Math.trunc(p.n / p.d) - Math.trunc(q.n / q.d), 1).add(F(Math.abs((p.n % p.d) - (q.n % q.d)), Math.max(p.d, q.d)))),
      ans(v.add(F(1, L))),
      ans(v.n > L ? v.sub(F(1, L)) : v.add(F(2, L))),
      ans(v.add(1)),
    ],
    verify: `${p.n}/${p.d}${addOp ? '+' : '-'}${q.n}/${q.d}`,
    pad: padF(v, L),
    asks: `${addOp ? 'Add' : 'Subtract'} the mixed numbers.`,
    concept: 'Convert to improper fractions with a common denominator, calculate, then convert back to a mixed number.',
    steps: [
      `Write as improper fractions over ${L}: ${p.n * (L / p.d)}/${L} ${addOp ? '+' : '−'} ${q.n * (L / q.d)}/${L}.`,
      `${addOp ? 'Add' : 'Subtract'} numerators: ${addOp ? p.n * (L / p.d) + q.n * (L / q.d) : p.n * (L / p.d) - q.n * (L / q.d)}/${L}.`,
      `Simplify and change to a mixed number: ${v.toString()}.`,
    ],
    mistake: addOp ? 'Adding the whole numbers and the fractions separately but forgetting to carry when the fractions make more than 1.' : 'Subtracting the smaller fraction from the larger one in each column instead of regrouping.',
    tip: 'When in doubt, change both mixed numbers to improper fractions first.',
  };
});

export const fractionTemplates = [add, sub, mult, div, mixedConv, compare, simplify, equiv, of, mixedOps];
