import { T } from '../define';
import { Frac } from '../../math/fraction';
import { NAMES, commas, m } from '../h';
import type { Template } from '../types';

const F = (n: number, d = 1) => new Frac(n, d);

const missing = T('rc.missing', 'rc.missing', 'Finding the unknown number', 'Reasoning Challenges', [2, 5], (r, tier) => {
  const x = r.int(3, tier <= 3 ? 15 : 30);
  const a = r.int(2, tier <= 3 ? 9 : 14);
  const b = r.int(2, 40);
  const c = a * x + b;
  const form = r.int(0, 2);
  if (form === 0) {
    return {
      text: `Find the value of ${m('\\square')} if ${m(`${a} \\times \\square + ${b} = ${c}`)}.`,
      correct: String(x),
      wrong: [String((c + b) / a === Math.round((c + b) / a) ? (c + b) / a : x + 3), String(c - b), String(Math.round(c / a)) === String(x) ? String(x + 4) : String(Math.round(c / a)), String(x + 1)],
      verify: `(${c}-${b})/${a}`,
      pad: (d) => String(x + d),
      asks: 'Work backwards to find the missing number.',
      concept: 'Undo each operation with its opposite, in reverse order.',
      steps: [`Undo “+ ${b}”: ${c} − ${b} = ${c - b}.`, `Undo “× ${a}”: ${c - b} ÷ ${a} = ${x}.`, `Check: ${a} × ${x} + ${b} = ${c}. ✓`],
      mistake: `Subtracting ${b} from the wrong place, or dividing before undoing the addition.`,
      tip: 'Always check by putting your answer back into the equation.',
    };
  }
  if (form === 1) {
    const big = a * x - b;
    if (big <= 0) return missing.build(r, tier);
    return {
      text: `${m(`${a} \\times \\square - ${b} = ${big}`)}. What number goes in the box?`,
      correct: String(x),
      wrong: [String((big - b) / a === Math.round((big - b) / a) ? (big - b) / a : x + 2), String(big + b), String(x - 1), String(x + 2)],
      verify: `(${big}+${b})/${a}`,
      pad: (d) => String(x + d),
      asks: 'Work backwards to find the missing number.',
      concept: 'Undo each operation with its opposite, in reverse order.',
      steps: [`Undo “− ${b}”: ${big} + ${b} = ${big + b}.`, `Undo “× ${a}”: ${big + b} ÷ ${a} = ${x}.`],
      mistake: 'Subtracting instead of adding when undoing a subtraction.',
      tip: 'Subtraction is undone by addition.',
    };
  }
  const k = r.int(2, 6);
  const rhs = (x + a) * k;
  return {
    text: `What number goes in the box? ${m(`${k} \\times (\\square + ${a}) = ${rhs}`)}`,
    correct: String(x),
    wrong: [String(rhs / k + a), String(rhs - a), String(Math.round(rhs / k)), String(x + k)].map((s, i) => (s === String(x) ? String(x + 5 + i) : s)),
    verify: `${rhs}/${k}-${a}`,
    pad: (d) => String(x + d),
    asks: 'Undo the multiplication first, then the addition.',
    concept: 'When brackets are involved, undo the outer operation first.',
    steps: [`Undo “× ${k}”: ${rhs} ÷ ${k} = ${rhs / k}.`, `Undo “+ ${a}”: ${rhs / k} − ${a} = ${x}.`],
    mistake: `Subtracting ${a} before dividing.`,
    tip: 'Peel the layers: outside first, inside last.',
  };
});

const sumDiff = T('rc.sumdiff', 'rc.sumdiff', 'Sum and difference problems', 'Reasoning Challenges', [2, 5], (r, tier) => {
  const small = r.int(8, tier <= 3 ? 40 : 120);
  const d = r.int(2, tier <= 3 ? 20 : 50);
  const large = small + d;
  const [a, b] = r.sample(NAMES, 2);
  const item = r.pick(['marbles', 'stickers', 'coins', 'cards']);
  return {
    text: `${a} and ${b} have ${small + large} ${item} altogether. ${a} has ${d} more ${item} than ${b}. How many ${item} does ${a} have?`,
    correct: String(large),
    wrong: [String(small), String((small + large) / 2 === Math.round((small + large) / 2) ? (small + large) / 2 : large + 1), String(large + d), String(small + large - d)],
    verify: `(${small + large}+${d})/2`,
    pad: (x) => String(large + x),
    asks: 'Use the total and the difference to find the bigger amount.',
    concept: 'Take the difference away from the total, share what is left equally, then add the difference back for the bigger share.',
    steps: [`Take away the extra ${d}: ${small + large} − ${d} = ${small + large - d}.`, `Share equally: ${small + large - d} ÷ 2 = ${small}. That is ${b}’s amount.`, `${a}: ${small} + ${d} = ${large}.`],
    mistake: 'Dividing the total by 2 and forgetting the difference.',
    tip: 'Draw two bars: one is longer by the difference.',
  };
});

const heads = T('rc.heads', 'rc.heads', 'Heads and legs puzzles', 'Reasoning Challenges', [3, 5], (r, tier) => {
  const hens = r.int(3, 15);
  const goats = r.int(3, 12);
  const heads = hens + goats;
  const legs = hens * 2 + goats * 4;
  const ask = r.chance(0.5);
  const cands: number[] = [];
  for (let g = 0; g <= heads; g++) if (2 * (heads - g) + 4 * g === legs) cands.push(g);
  return {
    text: `A farm has hens (2 legs each) and goats (4 legs each). There are ${heads} heads and ${legs} legs altogether. How many ${ask ? 'goats' : 'hens'} are on the farm?`,
    correct: String(ask ? goats : hens),
    wrong: [String(ask ? hens : goats), String(heads), String((ask ? goats : hens) + 2), String(Math.max(1, (ask ? goats : hens) - 2))],
    verify: ask ? `(${legs}-2*${heads})/2` : `${heads}-(${legs}-2*${heads})/2`,
    check: () => cands.length === 1 && cands[0] === goats,
    pad: (d) => String((ask ? goats : hens) + d),
    asks: 'Use the heads and legs to find how many of each animal.',
    concept: 'If every animal were a hen there would be 2 × heads legs. Each goat adds 2 extra legs.',
    steps: [`If all ${heads} were hens: ${heads} × 2 = ${heads * 2} legs.`, `Extra legs: ${legs} − ${heads * 2} = ${legs - heads * 2}. Each goat adds 2 extra legs.`, `Goats: ${legs - heads * 2} ÷ 2 = ${goats}. Hens: ${heads} − ${goats} = ${hens}.`],
    mistake: 'Dividing the legs by 4 and assuming all the animals are goats.',
    tip: 'Pretend they are all the smaller kind, then see how many legs are missing.',
  };
});

const consecutive = T('rc.consecutive', 'rc.consecutive', 'Consecutive numbers', 'Reasoning Challenges', [3, 5], (r, tier) => {
  const n = tier === 3 ? 3 : tier === 4 ? 5 : r.pick([5, 7]);
  const mid = r.int(8, 60);
  const sum = mid * n;
  const smallest = mid - (n - 1) / 2;
  const askSmallest = tier >= 4;
  return {
    text: `The sum of ${n} consecutive whole numbers is ${sum}. What is the ${askSmallest ? 'smallest' : 'middle'} number?`,
    correct: String(askSmallest ? smallest : mid),
    wrong: [String(askSmallest ? mid : smallest), String(Math.round(sum / n) + 1), String((askSmallest ? smallest : mid) + n), String(Math.max(1, (askSmallest ? smallest : mid) - 2))],
    verify: askSmallest ? `${sum}/${n}-${(n - 1) / 2}` : `${sum}/${n}`,
    pad: (d) => String((askSmallest ? smallest : mid) + d),
    asks: 'Use the fact that the middle number is the mean.',
    concept: 'For consecutive numbers the middle one equals the mean, which is the sum divided by how many there are.',
    steps: [`Middle number = ${sum} ÷ ${n} = ${mid}.`, askSmallest ? `The numbers are ${Array.from({ length: n }, (_, i) => smallest + i).join(', ')}.` : `Check: ${Array.from({ length: n }, (_, i) => smallest + i).join(' + ')} = ${sum}.`, `The ${askSmallest ? 'smallest' : 'middle'} number is ${askSmallest ? smallest : mid}.`],
    mistake: 'Dividing the sum by the wrong amount, or forgetting that the numbers must be consecutive.',
    tip: 'Consecutive numbers are balanced around the middle one.',
  };
});

const squaresGrid = T('rc.squares', 'rc.squares', 'Counting shapes in grids', 'Reasoning Challenges', [4, 5], (r, tier) => {
  const n = tier === 4 ? r.int(2, 3) : r.int(3, 5);
  let total = 0;
  for (let k = 1; k <= n; k++) total += (n - k + 1) * (n - k + 1);
  return {
    text: `A square grid is made of ${n} × ${n} small squares. How many squares of ANY size can you find in the grid (include the big ${n} × ${n} square)?`,
    correct: String(total),
    wrong: [String(n * n), String(total + n), String(total - 1), String(2 * n * n - n)],
    verify: Array.from({ length: n }, (_, i) => `${i + 1}^2`).join('+'),
    pad: (d) => String(total + d),
    asks: 'Count squares of every size, not only the smallest ones.',
    concept: `Count by size: ${Array.from({ length: n }, (_, i) => `${n - i}×${n - i} squares: ${(i + 1) ** 2}`).slice(0, 0).join('')}there are ${(n - 0) ** 2} of size 1×1, ${(n - 1) ** 2} of size 2×2, and so on.`,
    steps: Array.from({ length: n }, (_, i) => `Squares of size ${i + 1}×${i + 1}: ${(n - i) ** 2}.`).concat([`Total: ${Array.from({ length: n }, (_, i) => (n - i) ** 2).join(' + ')} = ${total}.`]),
    mistake: `Counting only the ${n * n} small squares.`,
    tip: 'Organise your counting by size so you do not miss any.',
  };
});

const giving = T('rc.sharing', 'rc.sharing', 'Equalising problems', 'Reasoning Challenges', [3, 5], (r, tier) => {
  const k = r.int(2, 15);
  const [a, b] = r.sample(NAMES, 2);
  const item = r.pick(['marbles', 'stickers', 'stamps']);
  const mult = tier >= 5 ? 3 : 2;
  // a has mult*b; after giving k from a to b equal => mult*B - k = B + k => B = 2k/(mult-1)
  const B = (2 * k) / (mult - 1);
  if (!Number.isInteger(B)) return giving.build(r, tier);
  const A = mult * B;
  const cands: number[] = [];
  for (let bb = 1; bb <= 200; bb++) if (mult * bb - k === bb + k) cands.push(mult * bb);
  return {
    text: `${a} has ${mult === 2 ? 'twice' : 'three times'} as many ${item} as ${b}. After ${a} gives ${k} ${item} to ${b}, they have the same number. How many ${item} did ${a} have at the start?`,
    correct: String(A),
    wrong: [String(B), String(A + k), String(A - k), String(B + k)].map((s, i) => (s === String(A) ? String(A + 2 + i) : s)),
    verify: `${mult}*2*${k}/(${mult}-1)`,
    check: () => cands.length === 1 && cands[0] === A,
    pad: (d) => String(A + d * 2),
    asks: 'Use the fact that the totals become equal.',
    concept: `Moving ${k} from one to the other changes the gap by 2 × ${k} = ${2 * k}.`,
    steps: [`Before: ${a} has ${mult} parts, ${b} has 1 part, so the gap is ${mult - 1} part${mult > 2 ? 's' : ''}.`, `The gap closes by ${k} + ${k} = ${2 * k}, so ${mult - 1} part${mult > 2 ? 's' : ''} = ${2 * k}, and 1 part = ${B}.`, `${a} started with ${mult} × ${B} = ${A}.`],
    mistake: `Thinking the gap closes by ${k} instead of 2 × ${k}.`,
    tip: 'Giving some away changes both people: one loses, one gains.',
  };
});

const divisibleChallenge = T('rc.divisible', 'rc.divisible', 'Common multiples puzzles', 'Reasoning Challenges', [3, 5], (r, tier) => {
  const pairs: [number, number][] = [[4, 6], [6, 8], [5, 6], [6, 9], [4, 10], [8, 12], [9, 12], [10, 15]];
  const [a, b] = r.pick(pairs);
  const L = (a * b) / g(a, b);
  const lo = r.int(2, tier === 3 ? 5 : 15) * 10;
  const v = Math.floor(lo / L + 1) * L;
  return {
    text: `What is the smallest whole number greater than ${lo} that can be divided exactly by both ${a} and ${b}?`,
    correct: String(v),
    wrong: [String(v + L), String(L), String(Math.floor(lo / a + 1) * a), String(Math.floor(lo / b + 1) * b)].map((s, i) => (s === String(v) ? String(v + L * (i + 2)) : s)),
    verify: `(floor(${lo}/lcm(${a},${b}))+1)*lcm(${a},${b})`,
    pad: (d) => String(v + d * L),
    asks: `Find a multiple of both ${a} and ${b} that is just above ${lo}.`,
    concept: `Numbers divisible by both ${a} and ${b} are multiples of their LCM, which is ${L}.`,
    steps: [`LCM of ${a} and ${b} is ${L}.`, `Multiples of ${L}: …, ${(Math.floor(lo / L)) * L}, ${v}, …`, `The first one greater than ${lo} is ${v}.`],
    mistake: `Choosing a multiple of only one of the numbers.`,
    tip: 'Find the LCM first, then list its multiples.',
  };
});

function g(a: number, b: number): number {
  return b === 0 ? a : g(b, a % b);
}

const ages = T('rc.ages', 'rc.ages', 'Age problems', 'Reasoning Challenges', [3, 5], (r, tier) => {
  const kid = r.int(6, 12);
  const times = r.int(2, 4);
  const years = r.int(3, 10);
  const parent = kid * times;
  const [a, b] = ['Mum', 'Dad'];
  const diff = parent - kid;
  const sumLater = parent + kid + 2 * years;
  const name = r.pick(NAMES);
  return {
    text: `${a} is ${times} times as old as ${name}. The sum of their ages in ${years} years’ time will be ${sumLater}. How old is ${name} now?`,
    correct: String(kid),
    wrong: [String(parent), String(kid + years), String(Math.max(1, kid - 2)), String(kid + 3)].map((s, i) => (s === String(kid) ? String(kid + 4 + i) : s)),
    verify: `(${sumLater}-2*${years})/(${times}+1)`,
    pad: (d) => String(kid + d),
    asks: 'Remove the future years, then split the total into parts.',
    concept: 'Take the extra years away from the total, then share the rest using the age ratio.',
    steps: [`Now: sum of ages = ${sumLater} − ${years} − ${years} = ${sumLater - 2 * years}.`, `${a} is ${times} times ${name}, so there are ${times} + 1 = ${times + 1} parts.`, `${name}: ${sumLater - 2 * years} ÷ ${times + 1} = ${kid}.`],
    mistake: 'Forgetting that BOTH people get older, so 2 × years must be removed.',
    tip: 'Convert the future total back to a “now” total first.',
  };
  void b;
  void diff;
});

export const reasoningTemplates: Template[] = [missing, sumDiff, heads, consecutive, squaresGrid, giving, divisibleChallenge, ages];
export { F, commas };
