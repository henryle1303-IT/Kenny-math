import { T } from '../define';
import { Frac } from '../../math/fraction';
import { NAMES, commas, decStr, m, money, moneyAuto, tfrac } from '../h';
import type { Template } from '../types';

const F = (n: number, d = 1) => new Frac(n, d);
const ds = (f: Frac) => decStr(f);

const SCEN = [
  { per: 'muffins', cont: 'tray', contPl: 'trays', who: 'A baker' },
  { per: 'pencils', cont: 'box', contPl: 'boxes', who: 'A shopkeeper' },
  { per: 'books', cont: 'shelf', contPl: 'shelves', who: 'A librarian' },
  { per: 'eggs', cont: 'carton', contPl: 'cartons', who: 'A farmer' },
  { per: 'stickers', cont: 'sheet', contPl: 'sheets', who: 'A teacher' },
  { per: 'seedlings', cont: 'pot', contPl: 'pots', who: 'A gardener' },
];

const twoStep = T('wp.twostep', 'wp.twostep', 'Two-step word problems', 'Word Problems', [1, 5], (r, tier) => {
  const s = r.pick(SCEN);
  const per = tier === 1 ? r.int(4, 9) : tier === 2 ? r.int(6, 15) : tier === 3 ? r.int(12, 28) : r.int(15, 45);
  const n = tier === 1 ? r.int(3, 8) : tier === 2 ? r.int(5, 12) : r.int(8, 25);
  const extra = r.int(3, tier <= 2 ? 15 : 60);
  const mode = r.int(0, 2);
  let text: string;
  let v: number;
  let verify: string;
  let steps: string[];
  let wrong: number[];
  if (mode === 0) {
    v = per * n + extra;
    text = `${s.who} fills ${n} ${s.contPl} with ${per} ${s.per} in each, and then has ${extra} ${s.per} left over. How many ${s.per} did they have at the start?`;
    verify = `${per}*${n}+${extra}`;
    steps = [`${n} ${s.contPl} × ${per} = ${per * n} ${s.per}.`, `Add the ${extra} left over: ${per * n} + ${extra} = ${v}.`];
    wrong = [per * n, per * n - extra, per + n + extra, v + per];
  } else if (mode === 1) {
    const total = per * n + extra;
    v = total - extra;
    const buy = r.int(2, 5);
    v = per * n - extra * 0;
    // sold some from full containers
    const sold = r.int(2, Math.max(3, Math.floor(per * n * 0.3)));
    v = per * n - sold;
    text = `${s.who} has ${n} full ${s.contPl} with ${per} ${s.per} in each. They sell ${sold} of the ${s.per}. How many ${s.per} are left?`;
    verify = `${per}*${n}-${sold}`;
    steps = [`Total: ${n} × ${per} = ${per * n}.`, `After selling: ${per * n} − ${sold} = ${v}.`];
    wrong = [per * n, per * n + sold, per * (n - sold) > 0 ? per * (n - sold) : v + per, v - per];
    void buy;
    void total;
  } else {
    const people = r.int(4, tier <= 2 ? 9 : 16);
    const each = r.int(3, tier <= 2 ? 9 : 14);
    const joined = r.int(2, 6);
    v = (people + joined) * each;
    text = `${people} children each collect ${each} ${s.per}. Then ${joined} more children join and each of them also collects ${each} ${s.per}. How many ${s.per} are collected altogether?`;
    verify = `(${people}+${joined})*${each}`;
    steps = [`First group: ${people} × ${each} = ${people * each}.`, `New children: ${joined} × ${each} = ${joined * each}.`, `Total: ${people * each} + ${joined * each} = ${v}.`];
    wrong = [people * each, joined * each, people * each + joined, v + each];
  }
  return {
    text,
    correct: commas(v),
    wrong: wrong.filter((w) => w > 0 && w !== v).map(commas),
    verify,
    pad: (d) => commas(v + d),
    asks: 'Work out the two steps one at a time.',
    concept: 'A two-step problem needs two calculations: do the first to unlock the second.',
    steps,
    mistake: 'Doing only the first step, or adding the numbers in the story without thinking about what they mean.',
    tip: 'Underline the question, circle the numbers, and decide which operation each step needs.',
  };
});

const average = T('wp.average', 'wp.average', 'Mean (average)', 'Word Problems', [2, 5], (r, tier) => {
  const k = tier <= 2 ? 4 : tier <= 4 ? 5 : 6;
  const mean = r.int(tier <= 2 ? 12 : 40, tier <= 2 ? 40 : 95);
  const vals: number[] = [];
  for (let i = 0; i < k - 1; i++) vals.push(mean + r.int(-10, 10));
  const last = mean * k - vals.reduce((a, b) => a + b, 0);
  const name = r.pick(NAMES);
  const missing = tier >= 3 && last > 0 && r.chance(0.6);
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].slice(0, k);
  const all = [...vals, last];
  if (last <= 0) return average.build(r, tier);
  if (missing) {
    return {
      text: `${name} scored ${vals.join(', ')} in ${k - 1} tests. What score does ${name} need in the next test so that the mean of all ${k} tests is ${mean}?`,
      correct: String(last),
      wrong: [String(mean), String(last + k), String(Math.max(1, last - k)), String(mean * 2 - vals[0])],
      verify: `${mean}*${k}-(${vals.join('+')})`,
      pad: (d) => String(last + d),
      asks: 'Find the score that makes the mean the target.',
      concept: 'Mean = total ÷ number of values, so total = mean × number of values.',
      steps: [`Total needed: ${mean} × ${k} = ${mean * k}.`, `Total so far: ${vals.join(' + ')} = ${vals.reduce((a, b) => a + b, 0)}.`, `Needed: ${mean * k} − ${vals.reduce((a, b) => a + b, 0)} = ${last}.`],
      mistake: 'Simply using the mean as the next score.',
      tip: 'Work with totals: target total − current total = missing amount.',
    };
  }
  const items = r.pick(['visitors to the library', 'books read', 'goals scored', 'minutes of reading']);
  return {
    text: `The number of ${items} on ${k} days was ${all.join(', ')}. What is the mean (average) number per day?`,
    correct: String(mean),
    wrong: [String(all.reduce((a, b) => a + b, 0)), String(mean + 3), String(Math.max(...all)), String(Math.max(1, mean - 4))],
    verify: `(${all.join('+')})/${k}`,
    pad: (d) => String(mean + d),
    asks: 'Share the total equally across the days.',
    concept: 'Mean = sum of all values ÷ how many values there are.',
    steps: [`Add: ${all.join(' + ')} = ${mean * k}.`, `Divide by ${k}: ${mean * k} ÷ ${k} = ${mean}.`],
    mistake: 'Giving the total, or dividing by the wrong count.',
    tip: `Count the values carefully – here there are ${k}.`,
  };
});

const groups = T('wp.groups', 'wp.groups', 'Division with remainders in context', 'Word Problems', [2, 5], (r, tier) => {
  const cap = tier <= 2 ? r.int(4, 9) : r.int(12, 45);
  const n = cap * r.int(3, tier <= 2 ? 8 : 14) + r.int(1, cap - 1);
  const k = Math.ceil(n / cap);
  const ctx = r.int(0, 2);
  const text =
    ctx === 0
      ? `A school trip has ${n} students. Each minibus holds ${cap} students. How many minibuses are needed so that every student has a seat?`
      : ctx === 1
        ? `${n} eggs are packed into cartons that hold ${cap} eggs each. How many cartons are needed to pack all the eggs?`
        : `${n} chairs are put in rows of ${cap}. How many rows are needed to seat everyone, if the last row can be shorter?`;
  return {
    text,
    correct: String(k),
    wrong: [String(k - 1), String(k + 1), String(Math.round(n / cap) === k ? k + 2 : Math.round(n / cap)), String(n - cap)],
    verify: `ceil(${n}/${cap})`,
    pad: (d) => String(k + d),
    asks: 'Decide what to do with the leftover.',
    concept: 'When there is a remainder you still need one more container, so round UP.',
    steps: [`${n} ÷ ${cap} = ${Math.floor(n / cap)} remainder ${n % cap}.`, `The ${n % cap} left over still need space, so add one more.`, `${Math.floor(n / cap)} + 1 = ${k}.`],
    mistake: 'Ignoring the remainder and rounding down.',
    tip: 'Ask: “Does the leftover still need a place?” If yes, round up.',
  };
});

const times = T('wp.times', 'wp.times', 'Multiplicative comparison', 'Word Problems', [2, 5], (r, tier) => {
  const [a, b] = r.sample(NAMES, 2);
  const k = r.int(2, tier <= 3 ? 5 : 9);
  const base = r.int(6, tier <= 3 ? 20 : 45);
  const item = r.pick(['marbles', 'stickers', 'stamps', 'shells', 'cards']);
  const mode = r.int(0, 2);
  if (mode === 0) {
    return {
      text: `${a} has ${base} ${item}. ${b} has ${k} times as many ${item} as ${a}. How many ${item} do they have together?`,
      correct: String(base * (k + 1)),
      wrong: [String(base * k), String(base + k), String(base * (k + 2)), String(base * k - base)],
      verify: `${base}+${base}*${k}`,
      pad: (d) => String(base * (k + 1) + d),
      asks: 'Find both amounts and add them.',
      concept: '“k times as many” means multiply by k.',
      steps: [`${b} has ${k} × ${base} = ${base * k}.`, `Together: ${base} + ${base * k} = ${base * (k + 1)}.`],
      mistake: 'Stopping after finding only one person’s amount.',
      tip: 'Re-read the question to see whether it asks for one amount or the total.',
    };
  }
  if (mode === 1) {
    const more = r.int(5, 40);
    const big = base * k;
    return {
      text: `${a} has ${big} ${item}. This is ${k} times as many as ${b} has. ${b} then gives ${more > base ? base - 1 : more} of ${b === a ? 'them' : 'them'} to ${a}. How many ${item} does ${a} have now?`,
      correct: String(big + (more > base ? base - 1 : more)),
      wrong: [String(base + (more > base ? base - 1 : more)), String(big), String(big - (more > base ? base - 1 : more)), String(big + base)],
      verify: `${base}*${k}+${more > base ? base - 1 : more}`,
      pad: (d) => String(big + (more > base ? base - 1 : more) + d),
      asks: 'Use the first fact to find the amounts and then apply the gift.',
      concept: 'Read each sentence in order and keep track of every change.',
      steps: [`${a} starts with ${big}.`, `${b} gives ${more > base ? base - 1 : more} to ${a}: ${big} + ${more > base ? base - 1 : more} = ${big + (more > base ? base - 1 : more)}.`],
      mistake: 'Subtracting when the amount is being given to the person asked about.',
      tip: 'Is the person gaining or losing? That tells you add or subtract.',
    };
  }
  const total = base * (k + 1);
  return {
    text: `${a} and ${b} have ${total} ${item} altogether. ${a} has ${k} times as many ${item} as ${b}. How many ${item} does ${b} have?`,
    correct: String(base),
    wrong: [String(base * k), String(Math.round(total / k)), String(total / 2), String(base + k)].map((x, i) => (x === String(base) ? String(base + 2 * (i + 1)) : x)),
    verify: `${total}/(${k}+1)`,
    pad: (d) => String(base + d),
    asks: `Split the total into ${k + 1} equal parts.`,
    concept: `If one amount is ${k} times the other, the total is ${k} + 1 = ${k + 1} equal parts.`,
    steps: [`${b} has 1 part and ${a} has ${k} parts: ${k + 1} parts in total.`, `1 part = ${total} ÷ ${k + 1} = ${base}.`],
    mistake: `Dividing by ${k} instead of ${k + 1}.`,
    tip: 'Draw a bar model: one short bar and k bars of the same length.',
  };
});

const leftover = T('wp.fractionchain', 'wp.fractionchain', 'Fractions of what is left', 'Word Problems', [3, 5], (r, tier) => {
  const name = r.pick(NAMES);
  const [d1, n1] = r.pick([[3, 1], [4, 1], [5, 2], [4, 3], [6, 1], [5, 1]]);
  const [d2, n2] = r.pick([[2, 1], [3, 1], [4, 1], [3, 2]]);
  const unitAll = d1 * d2;
  const total = unitAll * r.int(2, tier === 3 ? 8 : 20);
  const spent1 = (total * n1) / d1;
  const rest1 = total - spent1;
  const spent2 = (rest1 * n2) / d2;
  if (!Number.isInteger(spent1) || !Number.isInteger(spent2)) return leftover.build(r, tier);
  const rest2 = rest1 - spent2;
  const it = r.pick(['$', 'dollars']);
  void it;
  return {
    text: `${name} has $${total}. ${name} spends ${m(tfrac(n1, d1))} of it on a book, and then spends ${m(tfrac(n2, d2))} of the money that is left on a snack. How much money does ${name} have left?`,
    correct: `$${rest2}`,
    wrong: [`$${total - spent1 - (total * n2) / d2 > 0 && Number.isInteger((total * n2) / d2) ? total - spent1 - (total * n2) / d2 : rest2 + d1}`, `$${rest1}`, `$${spent2}`, `$${rest2 + d2}`],
    verify: `${total}-${total}*${n1}/${d1}-(${total}-${total}*${n1}/${d1})*${n2}/${d2}`,
    pad: (d) => `$${rest2 + d}`,
    asks: 'Find what is left after each purchase, step by step.',
    concept: 'The second fraction is a fraction of the REMAINING amount, not of the original amount.',
    steps: [`Book: ${m(tfrac(n1, d1))} of $${total} = $${spent1}. Left: $${total} − $${spent1} = $${rest1}.`, `Snack: ${m(tfrac(n2, d2))} of $${rest1} = $${spent2}.`, `Left: $${rest1} − $${spent2} = $${rest2}.`],
    mistake: 'Taking the second fraction from the original amount.',
    tip: 'After each step, write down “what is left” before you do the next step.',
  };
});

const savings = T('wp.savings', 'wp.savings', 'Saving up', 'Word Problems', [2, 5], (r, tier) => {
  const name = r.pick(NAMES);
  const price = r.int(4, tier <= 3 ? 12 : 30) * 10 + r.pick([0, 5]);
  const have = r.int(1, Math.floor(price / 20)) * 5;
  const per = r.pick(tier <= 3 ? [5, 6, 8, 10] : [7, 9, 12, 15]);
  const weeks = Math.ceil((price - have) / per);
  const item = r.pick(['bike lock', 'football', 'telescope', 'skateboard', 'science kit']);
  return {
    text: `${name} wants to buy a ${item} that costs $${price}. ${name} already has $${have} and saves $${per} each week. What is the smallest number of weeks ${name} needs to save to afford it?`,
    correct: String(weeks),
    wrong: [String(weeks - 1), String(weeks + 1), String(Math.round(price / per) === weeks ? weeks + 2 : Math.round(price / per)), String(Math.floor((price - have) / per) === weeks ? weeks - 2 : Math.floor((price - have) / per))],
    verify: `ceil((${price}-${have})/${per})`,
    pad: (d) => String(weeks + d),
    asks: 'Find how many weekly savings are needed to reach the price.',
    concept: 'First find how much is still needed, then divide by the weekly saving and round up.',
    steps: [`Still needed: $${price} − $${have} = $${price - have}.`, `${price - have} ÷ ${per} = ${((price - have) / per).toFixed(2)}, so after ${weeks - 1} weeks it is not enough.`, `${name} needs ${weeks} weeks.`],
    mistake: 'Dividing the full price and forgetting the money already saved, or rounding down.',
    tip: 'If the answer is not a whole number, you still need to wait the whole extra week.',
  };
});

const tableTotals = T('wp.table', 'wp.table', 'Reading data in problems', 'Word Problems', [2, 5], (r, tier) => {
  const cats = r.pick([['Apples', 'Bananas', 'Cherries', 'Grapes'], ['Cats', 'Dogs', 'Fish', 'Birds'], ['Red', 'Blue', 'Green', 'Yellow']]);
  const vals = cats.map(() => r.int(8, tier <= 3 ? 40 : 90));
  const i = r.int(0, 3);
  let j = r.int(0, 3);
  if (j === i) j = (i + 1) % 4;
  const total = vals.reduce((a, b) => a + b, 0);
  const mode = r.int(0, 1);
  const data = cats.map((c, k) => `${c}: ${vals[k]}`).join(', ');
  if (mode === 0 || vals[i] === vals[j]) {
    const diff = vals[i] - vals[j];
    const ab = Math.abs(diff);
    if (ab === 0) return tableTotals.build(r, tier);
    const [hi, lo] = diff > 0 ? [i, j] : [j, i];
    return {
      text: `A class survey recorded these numbers. ${data}. How many more votes did ${cats[hi]} get than ${cats[lo]}?`,
      correct: String(ab),
      wrong: [String(vals[hi] + vals[lo]), String(ab + 10), String(Math.max(1, ab - 10)), String(vals[hi])],
      verify: `${vals[hi]}-${vals[lo]}`,
      pad: (d) => String(ab + d),
      asks: 'Compare the two numbers by subtracting.',
      concept: '“How many more” is found by subtraction.',
      steps: [`${cats[hi]} = ${vals[hi]} and ${cats[lo]} = ${vals[lo]}.`, `${vals[hi]} − ${vals[lo]} = ${ab}.`],
      mistake: 'Adding the two numbers.',
      tip: '“More than” and “fewer than” are comparison words that usually mean subtract.',
    };
  }
  return {
    text: `A class survey recorded these numbers. ${data}. How many votes were there altogether?`,
    correct: String(total),
    wrong: [String(total - vals[i]), String(total + 10), String(Math.max(...vals)), String(total - 10)],
    verify: vals.join('+'),
    pad: (d) => String(total + d),
    asks: 'Add all the votes.',
    concept: '“Altogether” means add every group.',
    steps: [`${vals.join(' + ')} = ${total}.`],
    mistake: 'Leaving one of the groups out.',
    tip: 'Tick each number as you add it.',
  };
});

const money_ = T('wp.moneyunit', 'wp.moneyunit', 'Money problems', 'Word Problems', [1, 5], (r, tier) => {
  const name = r.pick(NAMES);
  const p1 = F(r.int(120, 650), 100);
  const n1 = r.int(2, 4);
  const p2 = F(r.int(150, 900), 100);
  const n2 = tier >= 3 ? r.int(2, 3) : 1;
  const cost = p1.mul(F(n1)).add(p2.mul(F(n2)));
  const pay = F(Math.ceil(cost.value / 10) * 10 + (tier >= 4 ? 10 : 0));
  const change = pay.sub(cost);
  if (change.n === 0) return money_.build(r, tier);
  return {
    text: `${name} buys ${n1} notebooks at ${money(p1)} each and ${n2 === 1 ? 'a calculator' : n2 + ' calculators'} at ${money(p2)} ${n2 === 1 ? '' : 'each '}and pays with ${money(pay)}. How much change should ${name} get?`.replace('  ', ' '),
    correct: money(change),
    wrong: [money(cost), money(change.add(F(1))), money(pay.sub(p1.mul(F(n1)))), money(change.sub(F(1, 2)).n > 0 ? change.sub(F(1, 2)) : change.add(F(2)))],
    verify: `${ds(pay)}-(${ds(p1)}*${n1}+${ds(p2)}*${n2})`,
    pad: (d) => money(change.add(F(d, 2))),
    asks: 'Find the total cost first, then the change.',
    concept: 'Change = money given − total cost.',
    steps: [`Notebooks: ${n1} × ${money(p1)} = ${money(p1.mul(F(n1)))}.`, `Calculator${n2 > 1 ? 's' : ''}: ${n2} × ${money(p2)} = ${money(p2.mul(F(n2)))}.`, `Total: ${money(cost)}. Change: ${money(pay)} − ${money(cost)} = ${money(change)}.`],
    mistake: 'Forgetting to multiply by the number of items.',
    tip: 'Line up the decimal points when adding and subtracting money.',
  };
});

export const wordTemplates: Template[] = [twoStep, average, groups, times, leftover, savings, tableTotals, money_];
export { moneyAuto };
