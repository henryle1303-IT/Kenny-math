import { T } from '../define';
import { Frac } from '../../math/fraction';
import { NAMES, commas, intWhere, m } from '../h';
import type { Tier } from '../types';

/** Split n into non-zero place-value parts, largest first (e.g. 3,704 -> 3000, 700, 4). */
function partsOf(n: number): number[] {
  const out: number[] = [];
  const s = String(n);
  for (let i = 0; i < s.length; i++) {
    const d = Number(s[i]);
    if (d) out.push(d * Math.pow(10, s.length - 1 - i));
  }
  return out;
}

const VERBS = ['Calculate', 'What is', 'Find the value of', 'Work out'];
const phrase = (verb: string, expr: string) => (verb === 'What is' ? `What is ${m(expr)}?` : `${verb} ${m(expr)}.`);
const padInt = (v: number) => (d: number) => commas(v + d);

const addsub = T('wn.addsub', 'wn.addsub', 'Adding and subtracting whole numbers', 'Whole Numbers', [1, 5], (r, tier) => {
  const digits = [3, 4, 4, 5, 6][tier - 1];
  const lo = Math.pow(10, digits - 1) + 11;
  const hi = Math.pow(10, digits) - 1;
  const add = r.chance(0.5);
  const verb = r.pick(VERBS);
  if (add) {
    const a = r.int(lo, hi - lo);
    const b = r.int(lo, Math.min(hi - a, hi));
    const v = a + b;
    const steps = [`Start with ${commas(a)}.`];
    let run = a;
    for (const p of partsOf(b)) {
      run += p;
      steps.push(`Add ${commas(p)}: ${commas(run - p)} + ${commas(p)} = ${commas(run)}.`);
    }
    return {
      text: phrase(verb, `${commas(a)} + ${commas(b)}`),
      correct: commas(v),
      wrong: [commas(v - 10), commas(v + 100), commas(v - 1000), commas(v + 10)],
      verify: `${a}+${b}`,
      pad: padInt(v),
      asks: 'Find the total of the two numbers.',
      concept: 'Addition: add the numbers one place value at a time.',
      steps,
      mistake: 'Forgetting to carry (regroup) when a column adds to 10 or more.',
      tip: 'Add the biggest parts first, then the smaller parts. Check by estimating: round both numbers and add.',
    };
  }
  const a = r.int(lo * 2 > hi ? lo : lo * 2, hi);
  const b = r.int(lo, a - 1);
  const v = a - b;
  const steps = [`Start with ${commas(a)}.`];
  let run = a;
  for (const p of partsOf(b)) {
    run -= p;
    steps.push(`Take away ${commas(p)}: ${commas(run + p)} − ${commas(p)} = ${commas(run)}.`);
  }
  return {
    text: phrase(verb, `${commas(a)} - ${commas(b)}`),
    correct: commas(v),
    wrong: [commas(v + 10), commas(v - 100), commas(v + 1000), commas(v - 10)],
    verify: `${a}-${b}`,
    pad: padInt(v),
    asks: 'Find the difference between the two numbers.',
    concept: 'Subtraction: take away one place value at a time.',
    steps,
    mistake: 'Forgetting to regroup (borrow) and subtracting the smaller digit from the larger one.',
    tip: 'Check subtraction with addition: the answer plus the smaller number should give the larger number.',
  };
});

const mul = T('wn.mul', 'wn.muldiv', 'Multiplying and dividing whole numbers', 'Whole Numbers', [1, 5], (r, tier) => {
  let a: number, b: number;
  if (tier === 1) [a, b] = [r.int(12, 49), r.int(3, 9)];
  else if (tier === 2) [a, b] = [r.int(101, 399), r.int(3, 9)];
  else if (tier === 3) [a, b] = [r.int(23, 79), r.int(12, 49)];
  else if (tier === 4) [a, b] = [r.int(112, 389), r.int(12, 39)];
  else [a, b] = [r.int(213, 899), r.int(23, 79)];
  const v = a * b;
  const bp = partsOf(b);
  const steps = bp.map((p) => `${commas(a)} × ${p} = ${commas(a * p)}.`);
  if (bp.length > 1) steps.push(`Add the parts: ${bp.map((p) => commas(a * p)).join(' + ')} = ${commas(v)}.`);
  const b10 = Math.floor(b / 10);
  const b1 = b % 10;
  const wrongs =
    bp.length > 1
      ? [commas(a * b10 + a * b1), commas(a * b10 * 10), commas(v - a), commas(v + a)]
      : [commas(v - a), commas(v + a), commas(v + 10), commas(v - 10)];
  return {
    text: phrase(r.pick(VERBS), `${commas(a)} \\times ${commas(b)}`),
    correct: commas(v),
    wrong: wrongs,
    verify: `${a}*${b}`,
    pad: padInt(v),
    asks: 'Find the product of the two numbers.',
    concept: 'Multiplication can be split into easier multiplications by place value (the distributive idea).',
    steps,
    mistake: 'Forgetting that the tens digit means tens, so its partial product must be 10 times bigger.',
    tip: 'Split the second number into tens and ones, multiply each part, then add.',
  };
});

const div = T('wn.div', 'wn.muldiv', 'Multiplying and dividing whole numbers', 'Whole Numbers', [1, 5], (r, tier) => {
  let b: number, q: number;
  if (tier === 1) [b, q] = [r.int(3, 9), r.int(11, 29)];
  else if (tier === 2) [b, q] = [r.int(4, 9), r.int(41, 149)];
  else if (tier === 3) [b, q] = [r.int(11, 19), r.int(21, 89)];
  else if (tier === 4) [b, q] = [r.int(12, 29), r.int(121, 389)];
  else [b, q] = [r.int(21, 49), r.int(205, 499)];
  const a = b * q;
  const steps: string[] = [`Think: how many groups of ${b} fit into ${commas(a)}?`];
  let rest = a;
  const qp = partsOf(q);
  for (const p of qp) {
    steps.push(`${b} × ${commas(p)} = ${commas(b * p)}, so take it away: ${commas(rest)} − ${commas(b * p)} = ${commas(rest - b * p)}.`);
    rest -= b * p;
  }
  steps.push(`The parts add up: ${qp.map(commas).join(' + ')} = ${commas(q)}.`);
  return {
    text: phrase(r.pick(VERBS), `${commas(a)} \\div ${b}`),
    correct: commas(q),
    wrong: [commas(q + 10), commas(q - 10), commas(q + 1), commas(q - 1)],
    verify: `${a}/${b}`,
    pad: padInt(q),
    asks: 'Share the number equally and find the size of each share.',
    concept: 'Division is the opposite of multiplication. Break the number into friendly chunks.',
    steps,
    mistake: 'Losing a zero or skipping a place in the answer.',
    tip: `Check your answer: ${commas(q)} × ${b} should give back ${commas(a)}.`,
  };
});

const remainder = T('wn.remainder', 'wn.muldiv', 'Multiplying and dividing whole numbers', 'Whole Numbers', [2, 5], (r, tier) => {
  const b = tier <= 2 ? r.int(4, 9) : tier <= 4 ? r.int(11, 19) : r.int(21, 39);
  const q = tier <= 2 ? r.int(8, 30) : tier <= 4 ? r.int(15, 60) : r.int(30, 90);
  const rem = r.int(1, b - 1);
  const a = b * q + rem;
  const name = r.pick(NAMES);
  const story = r.chance(0.5);
  return {
    text: story
      ? `${name} has ${commas(a)} beads and puts them into bags of ${b}. How many beads are left over after filling as many bags as possible?`
      : `What is the remainder when ${commas(a)} is divided by ${b}?`,
    correct: String(rem),
    wrong: [String(q % b === rem ? rem + 1 : q % b), String(b - rem), String(rem + 1), String(Math.max(0, rem - 1))],
    verify: `mod(${a},${b})`,
    pad: (d) => String(rem + d),
    asks: story ? 'Find how many beads do not fit into a full bag.' : 'Find what is left after dividing as many whole groups as possible.',
    concept: 'The remainder is what is left over after making as many full groups as you can.',
    steps: [
      `${b} × ${q} = ${commas(b * q)}, which is the biggest multiple of ${b} that is not more than ${commas(a)}.`,
      `${commas(a)} − ${commas(b * q)} = ${rem}.`,
      `The remainder is ${rem}, and it is smaller than ${b}, as a remainder must be.`,
    ],
    mistake: `Giving the quotient (${q}) instead of the remainder, or a remainder bigger than the divisor.`,
    tip: 'A remainder is always smaller than the number you divide by.',
  };
});

const place = T('wn.place', 'wn.place', 'Place value', 'Whole Numbers', [1, 5], (r, tier) => {
  const len = [4, 5, 6, 7, 8][tier - 1];
  const digits = r.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, len);
  if (digits[0] === 0) [digits[0], digits[len - 1]] = [digits[len - 1], digits[0]];
  const nz = digits.map((d, i) => ({ d, i })).filter((x) => x.d !== 0 && x.i > 0);
  const pick = r.pick(nz);
  const pos = len - 1 - pick.i;
  const n = Number(digits.join(''));
  const v = pick.d * Math.pow(10, pos);
  const names = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands', 'millions', 'ten millions'];
  return {
    text: `In the number ${commas(n)}, what is the value of the digit ${pick.d}?`,
    correct: commas(v),
    wrong: [String(pick.d), commas(pick.d * Math.pow(10, pos + 1)), commas(pick.d * Math.pow(10, Math.max(0, pos - 1))), commas(pick.d * Math.pow(10, pos + 2))],
    verify: `${pick.d}*10^${pos}`,
    pad: padInt(v),
    asks: `Find what the digit ${pick.d} is worth because of the place it sits in.`,
    concept: 'A digit’s value depends on its place: ones, tens, hundreds, thousands…',
    steps: [`In ${commas(n)}, the digit ${pick.d} is in the ${names[pos]} place.`, `${pick.d} × ${commas(Math.pow(10, pos))} = ${commas(v)}.`],
    mistake: 'Saying the digit’s face value instead of its place value.',
    tip: 'Write the place names under the digits to see where each digit sits.',
  };
});

const expanded = T('wn.expanded', 'wn.place', 'Place value', 'Whole Numbers', [2, 4], (r, tier) => {
  const len = tier === 2 ? 4 : tier === 3 ? 5 : 6;
  const parts: number[] = [];
  const used = new Set<number>();
  while (parts.length < 3) {
    const pos = r.int(0, len - 1);
    if (used.has(pos)) continue;
    used.add(pos);
    parts.push(r.int(1, 9) * Math.pow(10, pos));
  }
  if (!used.has(len - 1)) {
    parts[0] = r.int(1, 9) * Math.pow(10, len - 1);
  }
  parts.sort((x, y) => y - x);
  const uniquePos = new Set(parts.map((p) => String(p).length));
  if (uniquePos.size < 3) return expanded.build(r, tier as Tier);
  const n = parts.reduce((s, x) => s + x, 0);
  const exp = parts.map((p) => `${p / Math.pow(10, String(p).length - 1)} \\times ${commas(Math.pow(10, String(p).length - 1))}`).join(' + ');
  const sw = Number(String(n).split('').reverse().join(''));
  return {
    text: `Which number is the same as ${m(exp)}?`,
    correct: commas(n),
    wrong: [commas(Number(String(n).replace(/0/g, '')) || n + 1), commas(sw === n ? n + 11 : sw), commas(n + Math.pow(10, len - 2)), commas(Math.abs(n - Math.pow(10, len - 2)))],
    verify: parts.join('+'),
    pad: padInt(n),
    asks: 'Turn the expanded form into an ordinary number.',
    concept: 'Expanded form shows each digit multiplied by its place value.',
    steps: [`Work out each part: ${parts.map(commas).join(', ')}.`, `Add them: ${parts.map(commas).join(' + ')} = ${commas(n)}.`, 'Places with no part are zeros.'],
    mistake: 'Leaving out the zero placeholders and writing a number that is too short.',
    tip: 'Write a 0 in every place value that is missing from the expanded form.',
  };
});

const round = T('wn.round', 'wn.round', 'Rounding whole numbers', 'Whole Numbers', [1, 5], (r, tier) => {
  const k = [1, 2, 3, 4, 3][tier - 1];
  const unit = Math.pow(10, k);
  const names: Record<number, string> = { 1: 'ten', 2: 'hundred', 3: 'thousand', 4: 'ten thousand' };
  const len = [3, 4, 5, 6, 6][tier - 1];
  const n = intWhere(r, Math.pow(10, len - 1), Math.pow(10, len) - 1, (x) => x % unit !== 0 && (x % unit) !== unit / 2);
  const v = Math.round(n / unit) * unit;
  const down = Math.floor(n / unit) * unit;
  const up = down + unit;
  const wrongOther = Math.round(n / (unit * 10)) * unit * 10;
  const lower = v === down ? up : down;
  return {
    text: `Round ${commas(n)} to the nearest ${names[k]}.`,
    correct: commas(v),
    wrong: [commas(lower), commas(wrongOther === v ? v + unit * 10 : wrongOther), commas(Math.round(n / (unit / 10 || 1)) * (unit / 10 || 1)), commas(v + unit)],
    verify: `round(${n}/${unit})*${unit}`,
    pad: (d) => commas(v + d * unit),
    asks: `Find the ${names[k]} that ${commas(n)} is closest to.`,
    concept: 'Rounding: look at the digit just to the right of the place you are rounding to. 5 or more rounds up; 4 or less rounds down.',
    steps: [`${commas(n)} is between ${commas(down)} and ${commas(up)}.`, `It is ${commas(n - down)} above ${commas(down)} and ${commas(up - n)} below ${commas(up)}.`, `It is closer to ${commas(v)}.`],
    mistake: 'Looking at the wrong digit, or changing digits that should be turned into zeros.',
    tip: 'Underline the place you round to, circle the next digit on the right, and decide up or down.',
  };
});

const factors = T('wn.factors', 'wn.factors', 'Factors, multiples and primes', 'Whole Numbers', [2, 5], (r, tier) => {
  const pool = [
    [12, 16, 18, 20, 28],
    [24, 30, 36, 40, 42, 45],
    [48, 60, 54, 56, 72, 64],
    [80, 84, 90, 96, 100, 120],
    [144, 126, 150, 180, 168, 140],
  ][tier - 1];
  const n = r.pick(pool);
  const fs: number[] = [];
  for (let i = 1; i <= n; i++) if (n % i === 0) fs.push(i);
  const c = fs.length;
  return {
    text: `How many different factors does ${n} have?`,
    correct: String(c),
    wrong: [String(c - 1), String(c + 1), String(c - 2), String(c + 2)],
    verify: `nfactors(${n})`,
    pad: (d) => String(c + d),
    asks: `Count every whole number that divides ${n} exactly.`,
    concept: 'Factors come in pairs that multiply to give the number.',
    steps: [`Find the pairs: ${fs.filter((f) => f * f <= n).map((f) => `${f} × ${n / f}`).join(', ')}.`, `List all the factors: ${fs.join(', ')}.`, `There are ${c} factors.`],
    mistake: 'Forgetting 1 and the number itself, or listing a factor twice (as in a square number).',
    tip: 'Test 1, 2, 3, … in order and write down each pair; stop when the pairs meet.',
  };
});

const gcfT = T('wn.gcf', 'wn.factors', 'Factors, multiples and primes', 'Whole Numbers', [2, 5], (r, tier) => {
  const g = [r.int(2, 6), r.int(3, 8), r.int(4, 9), r.int(6, 12), r.int(7, 15)][tier - 1];
  const x = intWhere(r, 2, tier <= 2 ? 6 : 9, (v) => v > 1);
  const y = intWhere(r, 2, tier <= 2 ? 7 : 11, (v) => v !== x && Math.abs(x - v) > 0 && gcd2(x, v) === 1);
  const a = g * x;
  const b = g * y;
  return {
    text: `What is the greatest common factor (GCF) of ${a} and ${b}?`,
    correct: String(g),
    wrong: [String(g * 2 === Math.min(a, b) ? g + 1 : g * 2), String((a * b) / g), String(Math.min(a, b)), String(Math.max(1, Math.floor(g / 2) || 1))],
    verify: `gcd(${a},${b})`,
    pad: (d) => String(g + d),
    asks: 'Find the biggest number that divides both numbers exactly.',
    concept: 'The GCF is the largest factor the two numbers share.',
    steps: [`Factors of ${a}: ${factorsOf(a).join(', ')}.`, `Factors of ${b}: ${factorsOf(b).join(', ')}.`, `The biggest number in both lists is ${g}.`],
    mistake: 'Mixing up GCF (a factor, small) with LCM (a multiple, large).',
    tip: 'List the factors of both numbers and circle the largest one that appears in both lists.',
  };
});

const lcmT = T('wn.lcm', 'wn.factors', 'Factors, multiples and primes', 'Whole Numbers', [2, 5], (r, tier) => {
  const pairs: [number, number][] = [
    [[3, 4], [4, 6], [6, 8], [5, 6], [2, 5]],
    [[6, 9], [8, 12], [10, 15], [4, 10], [6, 10]],
    [[12, 18], [9, 12], [14, 21], [15, 20], [16, 24]],
    [[18, 24], [20, 30], [24, 36], [14, 35], [28, 42]],
    [[30, 45], [36, 48], [40, 60], [42, 63], [45, 75]],
  ][tier - 1] as [number, number][];
  const [a, b] = r.pick(pairs);
  const l = (a * b) / gcd2(a, b);
  const ctx = r.int(0, 2);
  const text =
    ctx === 0
      ? `What is the least common multiple (LCM) of ${a} and ${b}?`
      : ctx === 1
        ? `A red light flashes every ${a} seconds and a blue light flashes every ${b} seconds. They flash together now. After how many seconds will they next flash together?`
        : `Bus A leaves the station every ${a} minutes and Bus B every ${b} minutes. They leave together at 8:00. After how many minutes will they next leave together?`;
  const mults = (x: number) => Array.from({ length: Math.min(6, Math.ceil(l / x) + 1) }, (_, i) => x * (i + 1)).join(', ');
  return {
    text,
    correct: String(l),
    wrong: [String(a * b === l ? l * 2 : a * b), String(gcd2(a, b)), String(Math.max(a, b)), String(l + Math.min(a, b))],
    verify: `lcm(${a},${b})`,
    pad: (d) => String(l + d * Math.min(a, b)),
    asks: ctx === 0 ? 'Find the smallest number that both numbers divide into.' : 'Find the first time both events happen together.',
    concept: 'The LCM is the smallest number that is a multiple of both numbers.',
    steps: [`Multiples of ${a}: ${mults(a)}…`, `Multiples of ${b}: ${mults(b)}…`, `The first number in both lists is ${l}.`],
    mistake: 'Multiplying the two numbers together, which is a common multiple but not always the least one.',
    tip: 'Write multiples of the bigger number first; it is the quickest way to find a match.',
  };
});

const primes = T('wn.primes', 'wn.factors', 'Factors, multiples and primes', 'Whole Numbers', [3, 5], (r, tier) => {
  const lo = [10, 20, 30, 40, 50][tier - 3] ?? 20;
  const hi = lo + [20, 30, 40][tier - 3];
  let c = 0;
  const list: number[] = [];
  for (let n = lo; n <= hi; n++) {
    let p = n > 1;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) p = false;
    if (p) {
      c++;
      list.push(n);
    }
  }
  const odd = Math.ceil((hi - lo + 1) / 2);
  return {
    text: `How many prime numbers are there from ${lo} to ${hi}, including both ${lo} and ${hi} if they are prime?`,
    correct: String(c),
    wrong: [String(c + 1), String(c - 1), String(odd), String(c + 2)],
    verify: `nprimes(${lo},${hi})`,
    pad: (d) => String(c + d),
    asks: 'Count the numbers in the range that have exactly two factors: 1 and themselves.',
    concept: 'A prime number has exactly two factors. Every even number except 2 is not prime.',
    steps: ['Cross out all even numbers (except 2) and multiples of 3, 5 and 7.', `The primes left are ${list.join(', ')}.`, `That is ${c} prime numbers.`],
    mistake: 'Counting odd numbers like 9, 15 or 21 as prime when they have other factors.',
    tip: 'Test each odd number by trying 3, 5 and 7 as divisors.',
  };
});

const powers = T('wn.powers', 'wn.powers', 'Squares, cubes and powers', 'Whole Numbers', [1, 5], (r, tier) => {
  let base: number, exp: number;
  if (tier === 1) [base, exp] = [r.int(3, 12), 2];
  else if (tier === 2) [base, exp] = [10, r.int(3, 5)];
  else if (tier === 3) [base, exp] = [r.pick([2, 2, 3]), r.int(4, 8)];
  else if (tier === 4) [base, exp] = [r.int(3, 6), 3];
  else [base, exp] = [r.int(13, 25), 2];
  const v = Math.pow(base, exp);
  return {
    text: `What is the value of ${m(`${base}^{${exp}}`)}?`,
    correct: commas(v),
    wrong: [commas(base * exp), commas(Math.pow(base, exp - 1)), commas(Math.pow(base, exp + 1)), commas(v + base)],
    verify: `${base}^${exp}`,
    pad: padInt(v),
    asks: `Multiply ${base} by itself ${exp} times.`,
    concept: 'A power shows repeated multiplication: the small number says how many times the base is used.',
    steps: [`${base}^${exp} means ${Array(exp).fill(base).join(' × ')}.`, `${Array(exp).fill(base).join(' × ')} = ${commas(v)}.`],
    mistake: `Multiplying ${base} × ${exp} instead of using ${base} ${exp} times.`,
    tip: 'The small raised number is NOT what you multiply by – it counts how many times to use the base.',
  };
});

function gcd2(a: number, b: number): number {
  return b === 0 ? a : gcd2(b, a % b);
}
function factorsOf(n: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i);
  return out;
}

export const wholeTemplates = [addsub, mul, div, remainder, place, expanded, round, factors, gcfT, lcmT, primes, powers];
export { Frac };
