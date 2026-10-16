import { T } from '../define';
import { Frac } from '../../math/fraction';
import { NAMES, commas, m } from '../h';
import type { Template } from '../types';

const F = (n: number, d = 1) => new Frac(n, d);
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const handshake = T('lr.handshake', 'lr.handshake', 'Counting pairs and handshakes', 'Logical Reasoning', [3, 5], (r, tier) => {
  const n = r.int(4, tier === 3 ? 8 : tier === 4 ? 12 : 20);
  const v = (n * (n - 1)) / 2;
  const ctx = r.int(0, 1);
  return {
    text:
      ctx === 0
        ? `At a party, ${n} friends each shake hands with every other friend exactly once. How many handshakes are there altogether?`
        : `${n} teams play in a tournament. Every team plays every other team exactly once. How many games are played?`,
    correct: String(v),
    wrong: [String(n * (n - 1)), String(n * n), String(n + (n - 1)), String(v + n)],
    verify: `${n}*(${n}-1)/2`,
    pad: (d) => String(v + d),
    asks: 'Count each pair once.',
    concept: `Each of the ${n} people meets ${n - 1} others, but each meeting is counted twice, so divide by 2.`,
    steps: [`Each of the ${n} people shakes hands with ${n - 1} others: ${n} × ${n - 1} = ${n * (n - 1)}.`, `Each handshake was counted twice, so divide by 2: ${n * (n - 1)} ÷ 2 = ${v}.`],
    mistake: 'Counting every handshake twice.',
    tip: 'Try small cases first: 3 people → 3 handshakes, 4 people → 6.',
  };
});

const combos = T('lr.combos', 'lr.combos', 'Counting combinations', 'Logical Reasoning', [2, 5], (r, tier) => {
  const a = r.int(2, 5);
  const b = r.int(2, 6);
  const c = tier >= 4 ? r.int(2, 4) : 1;
  const v = a * b * c;
  const name = r.pick(NAMES);
  return {
    text: c === 1
      ? `${name} has ${a} different T-shirts and ${b} different pairs of shorts. How many different outfits can ${name} make using one T-shirt and one pair of shorts?`
      : `An ice-cream stall has ${a} cone types, ${b} flavours and ${c} toppings. How many different ice creams can be made using one cone, one flavour and one topping?`,
    correct: String(v),
    wrong: [String(a + b + (c === 1 ? 0 : c)), String(v + a), String(Math.max(2, v - b)), String(a * b + (c === 1 ? 1 : c))],
    verify: `${a}*${b}*${c}`,
    pad: (d) => String(v + d),
    asks: 'Count every possible way to combine the choices.',
    concept: 'Multiply the number of choices for each part (the counting principle).',
    steps: [`For each of the ${a} ${c === 1 ? 'T-shirts' : 'cones'}, there are ${b} ${c === 1 ? 'shorts' : 'flavours'}.`, c === 1 ? `${a} × ${b} = ${v}.` : `${a} × ${b} × ${c} = ${v}.`],
    mistake: 'Adding the choices instead of multiplying.',
    tip: 'Make a tree diagram or a table for small numbers to see why we multiply.',
  };
});

const venn = T('lr.venn', 'lr.venn', 'Overlapping groups', 'Logical Reasoning', [3, 5], (r, tier) => {
  const total = r.int(24, 40);
  const neither = r.int(1, 5);
  const both = r.int(3, 9);
  const onlyA = r.int(4, 12);
  const onlyB = r.int(3, 12);
  const t = onlyA + onlyB + both + neither;
  const A = onlyA + both;
  const B = onlyB + both;
  const [x, y] = r.pick([['football', 'swimming'], ['art', 'music'], ['chess', 'coding'], ['reading', 'drawing']]);
  return {
    text: `In a class of ${t} students, ${A} like ${x}, ${B} like ${y}, and ${neither} like neither. How many students like both ${x} and ${y}?`,
    correct: String(both),
    wrong: [String(A + B), String(onlyA), String(both + 2), String(Math.max(1, both - 2))],
    verify: `${A}+${B}-(${t}-${neither})`,
    pad: (d) => String(both + d),
    asks: 'Use the overlap to find how many are counted twice.',
    concept: 'Students who like at least one = total − neither. Adding the two groups counts the “both” students twice.',
    steps: [`Like at least one: ${t} − ${neither} = ${t - neither}.`, `Adding the two groups: ${A} + ${B} = ${A + B}, which is ${A + B - (t - neither)} too many.`, `Those are the students counted twice: ${both}.`],
    mistake: 'Forgetting to take the “neither” group out first.',
    tip: 'Draw two overlapping circles and fill in the numbers.',
  };
});

const queue = T('lr.queue', 'lr.queue', 'Positions and counting', 'Logical Reasoning', [2, 5], (r, tier) => {
  const n = r.int(12, 30);
  const front = r.int(3, n - 3);
  const back = n - front + 1;
  const name = r.pick(NAMES);
  const mode = r.int(0, 1);
  if (mode === 0) {
    return {
      text: `${name} is ${front}th from the front of a queue and ${back}th from the back. How many people are in the queue?`,
      correct: String(n),
      wrong: [String(front + back), String(n + 2), String(n - 2), String(Math.max(2, front + back - 2))],
      verify: `${front}+${back}-1`,
      pad: (d) => String(n + d),
      asks: `Count everyone once, including ${name}.`,
      concept: `${name} is counted in both positions, so subtract 1 from the sum.`,
      steps: [`In front of ${name}: ${front - 1} people. Behind ${name}: ${back - 1} people.`, `Total: ${front - 1} + ${back - 1} + 1 (${name}) = ${n}.`],
      mistake: `Adding ${front} + ${back} and counting ${name} twice.`,
      tip: 'Draw a line of dots and mark the person.',
    };
  }
  const gap = r.int(2, 6);
  const sections = r.int(5, 15);
  const posts = sections + 1;
  const len = gap * sections;
  return {
    text: `A straight fence is ${len} m long. A post is placed at both ends and then every ${gap} m along the fence. How many posts are needed?`,
    correct: String(posts),
    wrong: [String(sections), String(sections + 2), String(len), String(posts + 2)],
    verify: `${len}/${gap}+1`,
    pad: (d) => String(posts + d),
    asks: 'Count the posts, including the one at each end.',
    concept: 'A straight fence with n sections needs n + 1 posts.',
    steps: [`Number of gaps: ${len} ÷ ${gap} = ${sections}.`, `There is one more post than gaps: ${sections} + 1 = ${posts}.`],
    mistake: 'Forgetting the extra post at the end.',
    tip: 'Draw a short fence with 3 gaps: it needs 4 posts.',
  };
});

const balance = T('lr.balance', 'lr.balance', 'Balance and equal-value puzzles', 'Logical Reasoning', [2, 5], (r, tier) => {
  const p = r.int(2, 5);
  const q = r.int(2, 7);
  if (p === q) return balance.build(r, tier);
  const unit = r.pick([10, 15, 20, 25, 30, 40]);
  const y = p * unit;
  const x = q * unit;
  const [X, Y] = r.pick([['apple', 'orange'], ['red block', 'blue block'], ['book', 'toy car']]);
  return {
    text: `On a balance scale, ${p} ${X}s balance exactly ${q} ${Y}s. One ${Y} has a mass of ${y} g. What is the mass of one ${X}?`,
    correct: `${x} g`,
    wrong: [`${(y * p) / q === Math.round((y * p) / q) ? (y * p) / q : x + 5} g`, `${y * q} g`, `${x + unit} g`, `${Math.max(5, x - unit)} g`].map((s2, i) => (s2 === `${x} g` ? `${x + 7 * (i + 1)} g` : s2)),
    verify: `${q}*${y}/${p}`,
    pad: (d) => `${x + d * unit / 2} g`,
    asks: 'Use the balance to compare the total masses.',
    concept: `If ${p} of one thing balance ${q} of another, their total masses are equal.`,
    steps: [`Mass of ${q} ${Y}s: ${q} × ${y} = ${q * y} g.`, `That equals the mass of ${p} ${X}s, so one ${X} = ${q * y} ÷ ${p} = ${x} g.`],
    mistake: 'Dividing by the wrong number or using the number of items as the mass.',
    tip: 'A balanced scale means both sides have equal total mass.',
  };
});

const calendar = T('lr.calendar', 'lr.calendar', 'Days of the week and cycles', 'Logical Reasoning', [3, 5], (r, tier) => {
  const start = r.int(0, 6);
  const n = tier === 3 ? r.int(15, 45) : tier === 4 ? r.int(50, 120) : r.int(150, 400);
  const end = (start + n) % 7;
  if (end === start) return calendar.build(r, tier);
  const others = DAYS.filter((_, i) => i !== end);
  const pickWrong = [DAYS[(start + n % 7 + 1) % 7], DAYS[(end + 6) % 7], DAYS[start], DAYS[(end + 2) % 7]];
  return {
    text: `Today is ${DAYS[start]}. What day of the week will it be ${n} days from today?`,
    correct: DAYS[end],
    wrong: [...pickWrong, ...DAYS.filter((d) => d !== DAYS[end])],
    verify: `mod(${start}+${n},7)`,
    asks: 'Use the 7-day cycle to find the day.',
    concept: 'The days repeat every 7 days, so only the remainder when dividing by 7 matters.',
    steps: [`${n} ÷ 7 = ${Math.floor(n / 7)} remainder ${n % 7}.`, `Whole weeks bring us back to ${DAYS[start]}.`, `Move forward ${n % 7} more day${n % 7 === 1 ? '' : 's'}: ${DAYS[end]}.`],
    mistake: 'Counting the whole number of weeks as extra days.',
    tip: 'Divide by 7 and use only the remainder.',
  };
  void others;
});

const ordering = T('lr.ordering', 'lr.ordering', 'Reasoning from clues', 'Logical Reasoning', [2, 5], (r, tier) => {
  const [a, b, c] = r.sample(NAMES, 3);
  const base = r.int(120, 150);
  const d1 = r.int(3, 12);
  const d2 = r.int(2, 12);
  const mode = r.int(0, 1);
  const bH = base;
  const aH = bH + d1;
  const cH = mode === 0 ? bH - d2 : bH + d2;
  const ask = r.int(0, 1) === 0 ? 'a' : 'c';
  const ans = ask === 'a' ? aH : cH;
  return {
    text: `${a} is ${d1} cm taller than ${b}. ${c} is ${d2} cm ${mode === 0 ? 'shorter' : 'taller'} than ${b}. ${b} is ${bH} cm tall. How tall is ${ask === 'a' ? a : c}, in cm?`,
    correct: `${ans} cm`,
    wrong: [`${bH} cm`, `${ask === 'a' ? bH - d1 : mode === 0 ? bH + d2 : bH - d2} cm`, `${ans + 10} cm`, `${ans - 5} cm`],
    verify: ask === 'a' ? `${bH}+${d1}` : mode === 0 ? `${bH}-${d2}` : `${bH}+${d2}`,
    pad: (d) => `${ans + d} cm`,
    asks: `Use the clues about ${b} to find the height.`,
    concept: '“Taller than” means add; “shorter than” means subtract – always starting from the person you know.',
    steps: [`${b} = ${bH} cm.`, ask === 'a' ? `${a} is ${d1} cm taller: ${bH} + ${d1} = ${aH} cm.` : `${c} is ${d2} cm ${mode === 0 ? 'shorter' : 'taller'}: ${bH} ${mode === 0 ? '−' : '+'} ${d2} = ${cH} cm.`],
    mistake: 'Adding when the clue says “shorter”, or starting from the wrong person.',
    tip: 'Draw a number line and place each person on it.',
  };
});

const digitsPuzzle = T('lr.digits', 'lr.digits', 'Number puzzles', 'Logical Reasoning', [3, 5], (r, tier) => {
  const tens = r.int(2, 8);
  const ones = tens % 2 === 0 ? tens / 2 : tens - 1 > 0 ? 1 : 1;
  const mult = r.int(2, 3);
  const o = r.int(1, 3);
  const t = o * mult;
  const n = t * 10 + o;
  const sum = t + o;
  const cands: number[] = [];
  for (let x = 10; x <= 99; x++) {
    const tt = Math.floor(x / 10);
    const oo = x % 10;
    if (tt + oo === sum && tt === mult * oo) cands.push(x);
  }
  void tens;
  void ones;
  return {
    text: `I am a 2-digit number. My digits add up to ${sum}, and my tens digit is ${mult === 2 ? 'double' : 'three times'} my ones digit. What number am I?`,
    correct: String(n),
    wrong: [String(o * 10 + t), String(sum), String((t + 1) * 10 + (o - 1 > 0 ? o - 1 : o + 2)), String(n + 11)],
    verify: String(n),
    check: () => cands.length === 1 && cands[0] === n,
    pad: (d) => String(n + d * 9),
    asks: 'Use both clues to find the only number that fits.',
    concept: 'Test the clues one at a time and keep only the numbers that satisfy both.',
    steps: [`Digits adding to ${sum}: ${Array.from({ length: sum - 1 }, (_, i) => `${i + 1}${sum - i - 1}`).slice(0, 6).join(', ')}…`, `The tens digit must be ${mult === 2 ? 'double' : 'three times'} the ones digit: ${t} = ${mult} × ${o}.`, `So the number is ${n}.`],
    mistake: 'Swapping the tens and ones digits.',
    tip: 'Make a list of possibilities from the first clue, then cross out those that fail the second clue.',
  };
});

export const logicTemplates: Template[] = [handshake, combos, venn, queue, balance, calendar, ordering, digitsPuzzle];
export { F, commas, m };
