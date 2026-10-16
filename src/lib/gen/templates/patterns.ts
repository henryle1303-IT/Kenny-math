import { T } from '../define';
import { Frac } from '../../math/fraction';
import { NAMES, commas, decStr, m } from '../h';
import type { Template } from '../types';

const F = (n: number, d = 1) => new Frac(n, d);
const ds = (f: Frac) => decStr(f);

const arith = T('pa.arith', 'pa.arith', 'Arithmetic sequences', 'Patterns', [1, 5], (r, tier) => {
  const useDec = tier >= 4 && r.chance(0.5);
  const first = useDec ? F(r.int(5, 40), 10) : F(r.int(1, tier * 12));
  const step = useDec ? F(r.pick([3, 5, 7, 9, 12, 15]), 10) : F(r.int(2, 4 + tier * 3));
  const desc = tier >= 3 && r.chance(0.4);
  const st = desc ? step.neg() : step;
  const start = desc ? first.add(step.mul(F(7))) : first;
  const mode = tier <= 2 ? 0 : r.int(0, 2);
  const term = (k: number) => start.add(st.mul(F(k - 1)));
  const shown = [1, 2, 3, 4].map((k) => ds(term(k)));
  if (mode === 0) {
    const v = term(5);
    return {
      text: `What is the next number in this pattern? ${shown.join(', ')}, …`,
      correct: ds(v),
      wrong: [ds(v.add(st)), ds(v.sub(st)), ds(term(4).add(st.mul(F(2)))), ds(v.add(F(1, useDec ? 10 : 1)))],
      verify: `${ds(start)}+(${ds(st)})*4`,
      pad: (d) => ds(v.add(F(d, useDec ? 10 : 1))),
      asks: 'Find the rule, then continue the pattern.',
      concept: 'In an arithmetic sequence the same amount is added (or subtracted) each time.',
      steps: [`Differences: ${ds(term(2))} − ${ds(term(1))} = ${ds(term(2).sub(term(1)))}, and the next ones are the same.`, `Next term: ${ds(term(4))} ${desc ? '−' : '+'} ${ds(step)} = ${ds(v)}.`],
      mistake: 'Spotting a pattern in only the first two numbers without checking the others.',
      tip: 'Check that the rule works for every pair of neighbouring numbers.',
    };
  }
  if (mode === 1) {
    const k = r.int(8, 12 + tier * 3);
    const v = term(k);
    return {
      text: `A sequence starts ${shown.join(', ')}, … and continues in the same way. What is the ${k}th number in the sequence?`,
      correct: ds(v),
      wrong: [ds(term(k - 1)), ds(term(k + 1)), ds(start.add(st.mul(F(k)))), ds(v.add(st.mul(F(2))))],
      verify: `${ds(start)}+(${ds(st)})*${k - 1}`,
      pad: (d) => ds(v.add(st.mul(F(d)))),
      asks: `Find the ${k}th term without writing out the whole list.`,
      concept: `nth term = first term + (n − 1) × difference.`,
      steps: [`The difference is ${ds(st)}.`, `To reach term ${k}, add the difference ${k - 1} times: ${ds(start)} + ${k - 1} × ${ds(st)}.`, `= ${ds(v)}.`],
      mistake: `Adding the difference ${k} times instead of ${k - 1} times (term 1 is already there).`,
      tip: 'The first term needs no steps: term 2 needs 1 step, term 3 needs 2 steps…',
    };
  }
  const idx = r.int(2, 4);
  const v = term(idx);
  const shownGap = [1, 2, 3, 4, 5].map((k) => (k === idx ? '□' : ds(term(k))));
  return {
    text: `Find the missing number in this pattern: ${shownGap.join(', ')}`,
    correct: ds(v),
    wrong: [ds(v.add(st)), ds(v.sub(st)), ds(v.add(st.mul(F(2)))), ds(v.add(F(1, useDec ? 10 : 1)))],
    verify: `${ds(start)}+(${ds(st)})*${idx - 1}`,
    pad: (d) => ds(v.add(F(d, useDec ? 10 : 1))),
    asks: 'Use the numbers around the gap to find the rule.',
    concept: 'Work out the rule from two neighbouring numbers that are both known.',
    steps: [`From the known numbers the difference per step is ${ds(st)}.`, `The missing number is ${ds(v)}.`],
    mistake: 'Using the wrong step size when the gap is in the middle.',
    tip: 'Check your answer fits in both directions: before and after the gap.',
  };
});

const geo = T('pa.geometric', 'pa.geometric', 'Growing and shrinking patterns', 'Patterns', [2, 5], (r, tier) => {
  const mult = r.pick(tier <= 2 ? [2, 3] : tier <= 4 ? [2, 3, 4, 5] : [2, 3, 5]);
  const start = r.int(1, tier <= 3 ? 5 : 8);
  const shrink = tier >= 3 && r.chance(0.4);
  if (shrink) {
    const v = start;
    const seq = [4, 3, 2, 1, 0].map((k) => v * Math.pow(mult, k));
    return {
      text: `Each number is divided by ${mult} to get the next one: ${commas(seq[0])}, ${commas(seq[1])}, ${commas(seq[2])}, ${commas(seq[3])}, … What is the next number?`,
      correct: commas(seq[4]),
      wrong: [commas(seq[3] - mult), commas(seq[3] - seq[2]), commas(seq[4] + mult), commas(Math.max(0, seq[4] - 1))],
      verify: `${seq[3]}/${mult}`,
      pad: (d) => commas(seq[4] + d),
      asks: 'Find the multiplier or divider that links each term.',
      concept: 'In this pattern each term is the previous one divided by the same number.',
      steps: [`${seq[0]} ÷ ${mult} = ${seq[1]}, and the same rule continues.`, `${seq[3]} ÷ ${mult} = ${seq[4]}.`],
      mistake: 'Subtracting a fixed number instead of dividing.',
      tip: 'If the gaps keep getting smaller (or larger), try multiplying or dividing.',
    };
  }
  const seq = [0, 1, 2, 3, 4].map((k) => start * Math.pow(mult, k));
  const kth = tier >= 4 ? 6 : 5;
  const v = start * Math.pow(mult, kth - 1);
  const ask5 = tier < 4;
  return {
    text: ask5 ? `What is the next number in the pattern ${seq.slice(0, 4).map(commas).join(', ')}, …?` : `Each number in the pattern ${seq.slice(0, 4).map(commas).join(', ')}, … is ${mult} times the one before. What is the ${kth}th number?`,
    correct: commas(ask5 ? seq[4] : v),
    wrong: [commas(seq[3] + (seq[3] - seq[2])), commas(seq[3] + mult), commas((ask5 ? seq[4] : v) + start), commas(Math.max(1, (ask5 ? seq[4] : v) - start))],
    verify: ask5 ? `${seq[3]}*${mult}` : `${start}*${mult}^${kth - 1}`,
    pad: (d) => commas((ask5 ? seq[4] : v) + d * start),
    asks: 'Find the multiplying rule and apply it.',
    concept: 'In this pattern each term is the previous one multiplied by the same number.',
    steps: [`${seq[1]} ÷ ${seq[0]} = ${mult}, so the rule is “× ${mult}”.`, ask5 ? `${seq[3]} × ${mult} = ${seq[4]}.` : `Keep multiplying: … → ${commas(seq[4])} → ${commas(v)}.`],
    mistake: 'Assuming the pattern adds the same amount every time.',
    tip: 'If the differences are not constant, test whether the ratios are constant.',
  };
});

const diffs = T('pa.growing', 'pa.growing', 'Patterns with growing steps', 'Patterns', [3, 5], (r, tier) => {
  const start = r.int(1, 6);
  const inc0 = r.int(1, 4);
  const inc1 = r.int(1, 3);
  const seq = [start];
  let inc = inc0;
  for (let i = 0; i < 5; i++) {
    seq.push(seq[i] + inc);
    inc += inc1;
  }
  const sec = inc1;
  return {
    text: `Look at this pattern: ${seq.slice(0, 5).join(', ')}, … The numbers go up by a bigger amount each time. What is the next number?`,
    correct: String(seq[5]),
    wrong: [String(seq[4] + (seq[4] - seq[3])), String(seq[5] + 1), String(seq[5] - 1), String(seq[4] + (seq[4] - seq[3]) + 2 * sec)],
    verify: `${seq[4]}+${inc0 + 4 * inc1}`,
    pad: (d) => String(seq[5] + d),
    asks: 'Look at how the gaps themselves change.',
    concept: 'When the differences are not constant, check whether the differences form their own pattern.',
    steps: [`Gaps: ${seq.slice(1, 5).map((v, i) => v - seq[i]).join(', ')} – they grow by ${sec} each time.`, `Next gap: ${inc0 + 4 * inc1}.`, `${seq[4]} + ${inc0 + 4 * inc1} = ${seq[5]}.`],
    mistake: 'Repeating the last gap instead of increasing it.',
    tip: 'Write the gaps between numbers underneath the sequence and look for a pattern in those too.',
  };
});

const rule = T('pa.rule', 'pa.rule', 'Number rules and function machines', 'Patterns', [2, 5], (r, tier) => {
  const a = r.int(2, tier <= 3 ? 6 : 9);
  const b = r.int(1, tier <= 3 ? 9 : 15);
  const sub = tier >= 4 && r.chance(0.5);
  const f = (x: number) => a * x + (sub ? -b : b);
  const ins = [2, 3, 5].map((x) => x + (sub ? Math.ceil(b / a) : 0));
  const ask = r.int(8, 15) + (sub ? Math.ceil(b / a) : 0);
  const v = f(ask);
  const rev = tier === 5 && r.chance(0.5);
  if (rev) {
    return {
      text: `A function machine multiplies the input by ${a} and then ${sub ? 'subtracts' : 'adds'} ${b}. The output is ${v}. What was the input?`,
      correct: String(ask),
      wrong: [String(v - a * 1), String(Math.round(v / a)), String(ask + 1), String(Math.max(1, ask - 1))].map((x, i) => (x === String(ask) ? String(ask + 2 + i) : x)),
      verify: sub ? `(${v}+${b})/${a}` : `(${v}-${b})/${a}`,
      pad: (d) => String(ask + d),
      asks: 'Work backwards through the machine.',
      concept: 'Undo the steps in reverse order using the opposite operations.',
      steps: [sub ? `Undo “− ${b}”: ${v} + ${b} = ${v + b}.` : `Undo “+ ${b}”: ${v} − ${b} = ${v - b}.`, `Undo “× ${a}”: ${sub ? v + b : v - b} ÷ ${a} = ${ask}.`],
      mistake: 'Undoing the steps in the same order instead of the reverse order.',
      tip: 'Last step done = first step undone.',
    };
  }
  return {
    text: `A rule changes each input number to an output number. Input ${ins[0]} gives ${f(ins[0])}, input ${ins[1]} gives ${f(ins[1])}, and input ${ins[2]} gives ${f(ins[2])}. What output does input ${ask} give?`,
    correct: String(v),
    wrong: [String(v + a), String(ask + b), String(a * ask), String(v - b)].map((x, i) => (x === String(v) ? String(v + 3 + i) : x)),
    verify: `${a}*${ask}${sub ? '-' : '+'}${b}`,
    pad: (d) => String(v + d),
    asks: 'Find the rule from the examples, then use it.',
    concept: 'Rules usually combine multiplying and adding: look at how the output changes when the input goes up by 1.',
    steps: [`When the input goes up by 1, the output goes up by ${a}, so the rule includes × ${a}.`, `${ins[0]} × ${a} = ${a * ins[0]}, and the output is ${f(ins[0])}, so we ${sub ? 'subtract' : 'add'} ${b}.`, `For ${ask}: ${a} × ${ask} ${sub ? '−' : '+'} ${b} = ${v}.`],
    mistake: 'Finding only the “+ b” part or only the “× a” part of the rule.',
    tip: 'Test your rule on every example before using it.',
  };
});

const matchsticks = T('pa.shapes', 'pa.shapes', 'Shape patterns', 'Patterns', [3, 5], (r, tier) => {
  const k = r.pick([3, 4, 5, 6]);
  const c = 1;
  const n = r.int(10, 12 + tier * 4);
  const v = k * n + c;
  const shape = k === 3 ? 'triangles' : k === 4 ? 'squares' : k === 5 ? 'pentagons' : 'hexagons';
  return {
    text: `Matchsticks are used to build a row of joined ${shape}. Shape 1 uses ${k + c} matchsticks, Shape 2 uses ${2 * k + c}, and Shape 3 uses ${3 * k + c}. How many matchsticks are needed for Shape ${n}?`,
    correct: String(v),
    wrong: [String(k * n), String((k + c) * n), String(v + k), String(v - 1)],
    verify: `${k}*${n}+${c}`,
    pad: (d) => String(v + d),
    asks: 'Find the rule for the nth shape.',
    concept: `Each new shape adds ${k} matchsticks, and there is ${c} extra stick at the start: nth shape = ${k} × n + ${c}.`,
    steps: [`The number of sticks goes up by ${k} each time.`, `Rule: ${k} × n + ${c}.`, `For Shape ${n}: ${k} × ${n} + ${c} = ${v}.`],
    mistake: `Multiplying the first shape’s number of sticks by ${n}.`,
    tip: 'Test the rule on the shapes you know before using it on a big one.',
  };
});

const fib = T('pa.fibonacci', 'pa.fibonacci', 'Patterns using earlier terms', 'Patterns', [3, 5], (r, tier) => {
  const a = r.int(1, 5);
  const b = r.int(2, 7);
  const s = [a, b];
  for (let i = 2; i < 8; i++) s.push(s[i - 1] + s[i - 2]);
  const idx = tier === 3 ? 5 : tier === 4 ? 6 : 7;
  return {
    text: `In the pattern ${s.slice(0, idx).join(', ')}, … each number is the sum of the two numbers before it. What is the next number?`,
    correct: String(s[idx]),
    wrong: [String(s[idx - 1] + 1), String(s[idx - 1] * 2), String(s[idx] + 2), String(s[idx] - 1)],
    verify: `${s[idx - 1]}+${s[idx - 2]}`,
    pad: (d) => String(s[idx] + d),
    asks: 'Use the rule “add the two previous numbers”.',
    concept: 'Some patterns use earlier terms instead of a fixed step.',
    steps: [`The last two numbers are ${s[idx - 2]} and ${s[idx - 1]}.`, `${s[idx - 2]} + ${s[idx - 1]} = ${s[idx]}.`],
    mistake: 'Adding only the last number and the difference, ignoring the “two previous” rule.',
    tip: 'Check the rule on the earlier terms first.',
  };
});

const alternating = T('pa.alternating', 'pa.alternating', 'Alternating patterns', 'Patterns', [3, 5], (r, tier) => {
  const up = r.int(3, 9);
  const down = r.int(1, up - 1);
  const start = r.int(2, 20);
  const s = [start];
  for (let i = 1; i < 9; i++) s.push(s[i - 1] + (i % 2 === 1 ? up : -down));
  const idx = tier === 3 ? 6 : tier === 4 ? 7 : 8;
  return {
    text: `A pattern goes ${s.slice(0, 5).join(', ')}, … The rule alternates between two steps. What is term number ${idx + 1}?`,
    correct: String(s[idx]),
    wrong: [String(s[idx - 1]), String(s[idx] + up - down), String(s[idx] + down), String(s[idx] - 1)],
    verify: `${start}+${Math.ceil(idx / 2)}*${up}-${Math.floor(idx / 2)}*${down}`,
    pad: (d) => String(s[idx] + d),
    asks: 'Find the two alternating steps and keep going.',
    concept: `Steps of +${up} and −${down} repeat in turn, so every 2 steps the pattern moves by ${up - down}.`,
    steps: [`Steps: +${up}, −${down}, +${up}, −${down}, …`, `Continue: ${s.slice(4, idx + 1).join(', ')}.`, `Term ${idx + 1} is ${s[idx]}.`],
    mistake: 'Using only one of the two steps.',
    tip: 'Write out the pattern term by term when the rule alternates.',
  };
});

const squares = T('pa.special', 'pa.special', 'Square and triangular numbers', 'Patterns', [2, 5], (r, tier) => {
  const sq = r.chance(0.5);
  if (sq) {
    const n = r.int(8, 10 + tier * 3);
    return {
      text: `The first four square numbers are 1, 4, 9 and 16. What is the ${n}th square number?`,
      correct: commas(n * n),
      wrong: [commas(n * 2), commas((n - 1) ** 2), commas((n + 1) ** 2), commas(n * n + n)],
      verify: `${n}^2`,
      pad: (d) => commas(n * n + d),
      asks: 'Use the rule for square numbers.',
      concept: 'The nth square number is n × n.',
      steps: [`1 = 1×1, 4 = 2×2, 9 = 3×3, so the nth square number is n × n.`, `${n} × ${n} = ${commas(n * n)}.`],
      mistake: 'Doubling the number instead of multiplying it by itself.',
      tip: 'Square numbers make square arrays of dots.',
    };
  }
  const n = r.int(8, 9 + tier * 3);
  const v = (n * (n + 1)) / 2;
  return {
    text: `The first four triangular numbers are 1, 3, 6 and 10 (each is 1 + 2 + 3 + … up to n). What is the ${n}th triangular number?`,
    correct: commas(v),
    wrong: [commas(n * n), commas(v + n), commas(v - n), commas(n * (n - 1))],
    verify: `${n}*(${n}+1)/2`,
    pad: (d) => commas(v + d),
    asks: `Add 1 + 2 + 3 + … + ${n}.`,
    concept: 'The nth triangular number is the sum of the whole numbers from 1 to n: n × (n + 1) ÷ 2.',
    steps: [`Pair up the numbers: 1 + ${n}, 2 + ${n - 1}, … each pair makes ${n + 1}.`, `There are ${n} numbers, so ${n}/2 pairs: ${n} × ${n + 1} ÷ 2 = ${commas(v)}.`],
    mistake: 'Squaring the number instead of using the sum.',
    tip: 'Pair the first and last numbers; each pair has the same sum.',
  };
});

export const patternTemplates: Template[] = [arith, geo, diffs, rule, matchsticks, fib, alternating, squares];
export { m, NAMES };
