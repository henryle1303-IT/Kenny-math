import { T } from '../define';
import { Frac, gcd } from '../../math/fraction';
import { NAMES, commas, intWhere, m, money, moneyAuto } from '../h';
import type { Template } from '../types';

const F = (n: number, d = 1) => new Frac(n, d);

const simplify = T('ra.simplify', 'ra.equiv', 'Equivalent and simplified ratios', 'Ratios', [1, 4], (r, tier) => {
  const g = [r.int(2, 4), r.int(3, 6), r.int(4, 9), r.int(6, 12)][tier - 1];
  const sa = intWhere(r, 1, 9, () => true);
  const sb = intWhere(r, 2, 11, (x) => x !== sa && gcd(sa, x) === 1);
  const a = sa * g;
  const b = sb * g;
  const ctx = r.int(0, 2);
  const [x, y] = r.sample(['red', 'blue', 'green', 'yellow'], 2);
  const text =
    ctx === 0
      ? `Write the ratio ${a} : ${b} in its simplest form.`
      : ctx === 1
        ? `A bag has ${a} ${x} marbles and ${b} ${y} marbles. What is the ratio of ${x} to ${y} marbles in simplest form?`
        : `A class has ${a} boys and ${b} girls. What is the ratio of girls to boys in simplest form?`;
  const [ca, cb] = ctx === 2 ? [sb, sa] : [sa, sb];
  return {
    text,
    correct: `${ca} : ${cb}`,
    wrong: [`${cb} : ${ca}`, `${ca} : ${cb + 1}`, `${a - b < 0 ? b - a : a - b} : ${ca}`.replace(/^0 /, '1 '), `${ca + 1} : ${cb}`],
    verify: ctx === 2 ? `${b}/${a}` : `${a}/${b}`,
    pad: (d) => `${Math.max(1, ca + d)} : ${cb}`,
    asks: 'Write the ratio with the smallest whole numbers.',
    concept: 'A ratio compares two amounts. Simplify it by dividing both parts by the same number.',
    steps: [`Write the ratio in the order asked: ${ctx === 2 ? b : a} : ${ctx === 2 ? a : b}.`, `The greatest common factor of ${a} and ${b} is ${g}.`, `Divide both parts by ${g}: ${ca} : ${cb}.`],
    mistake: 'Writing the ratio in the wrong order.',
    tip: 'The order of the words in the question gives the order of the ratio.',
  };
});

const share = T('ra.share', 'ra.share', 'Sharing and ratio problems', 'Ratios', [2, 5], (r, tier) => {
  const a = r.int(1, tier <= 3 ? 4 : 6);
  const b = r.int(a + 1, a + (tier <= 3 ? 4 : 6));
  const parts = a + b;
  const unit = tier <= 3 ? r.int(2, 9) : r.int(4, 20);
  const total = parts * unit;
  const [n1, n2] = r.sample(NAMES, 2);
  const larger = r.chance(0.5);
  const ans = larger ? b * unit : a * unit;
  const dollars = r.chance(0.6);
  const f = (v: number) => (dollars ? moneyAuto(v) : commas(v));
  return {
    text: `${n1} and ${n2} share ${dollars ? moneyAuto(total) : total + ' stickers'} in the ratio ${a} : ${b}. How ${dollars ? 'much' : 'many'} ${larger ? 'does the person with the larger share get' : 'does the person with the smaller share get'}?`,
    correct: f(ans),
    wrong: [f(larger ? a * unit : b * unit), f(total / 2 === Math.round(total / 2) && total / 2 !== ans ? total / 2 : ans + unit), f(ans + unit), f(Math.max(unit, ans - unit))],
    verify: `${total}*${larger ? b : a}/${parts}`,
    pad: (d) => f(ans + d * unit),
    asks: 'Split the total into parts and find the bigger/smaller share.',
    concept: 'In a ratio a : b, the total is split into a + b equal parts.',
    steps: [`Total parts: ${a} + ${b} = ${parts}.`, `One part: ${total} ÷ ${parts} = ${unit}.`, `${larger ? 'Larger' : 'Smaller'} share: ${larger ? b : a} × ${unit} = ${ans}.`],
    mistake: 'Dividing the total by the ratio numbers separately instead of by the total number of parts.',
    tip: 'Add the ratio numbers first to get the number of equal parts.',
  };
});

const unitRate = T('ra.unitrate', 'ra.rates', 'Unit rates and scale', 'Ratios', [1, 5], (r, tier) => {
  const n = r.int(3, tier <= 2 ? 6 : 9);
  const cents = r.int(tier <= 2 ? 20 : 15, 95);
  const unitPrice = F(cents, 100);
  const total = unitPrice.mul(F(n));
  const m2 = r.int(n + 2, n + (tier <= 3 ? 8 : 15));
  const item = r.pick(['pencils', 'erasers', 'rulers', 'juice boxes', 'notebooks', 'apples']);
  const v = unitPrice.mul(F(m2));
  return {
    text: `${n} ${item} cost ${money(total)}. At the same price, how much do ${m2} ${item} cost?`,
    correct: money(v),
    wrong: [money(unitPrice), money(total.add(F(m2 - n, 100))), money(total.add(F(m2 - n))), money(v.add(F(1, 10)))],
    verify: `${total.value.toFixed(2)}/${n}*${m2}`,
    pad: (d) => money(v.add(F(d, 10))),
    asks: 'Find the price of one item first, then the price of the new amount.',
    concept: 'A unit rate tells the amount for ONE item. Multiply the unit rate by the number you need.',
    steps: [`Cost of 1: ${money(total)} ÷ ${n} = ${money(unitPrice)}.`, `Cost of ${m2}: ${m2} × ${money(unitPrice)} = ${money(v)}.`],
    mistake: 'Adding the extra items’ count to the price instead of multiplying the unit price.',
    tip: 'Find the cost of one first – it unlocks every other quantity.',
  };
});

const scale = T('ra.scale', 'ra.rates', 'Unit rates and scale', 'Ratios', [2, 5], (r, tier) => {
  const ctx = r.int(0, 1);
  if (ctx === 0) {
    const k = r.pick([2, 5, 10, 20, 25]);
    const cm = tier <= 3 ? r.int(3, 12) : r.pick([2.5, 3.5, 4.5, 6.5, 7.5]);
    const v = F(Math.round(cm * 10) * k, 10);
    return {
      text: `On a map, 1 cm represents ${k} km. Two towns are ${cm} cm apart on the map. How far apart are they in real life, in kilometres?`,
      correct: `${v.isInt ? v.n : v.value} km`,
      wrong: [`${cm + k} km`, `${F(Math.round(cm * 10), 10).div(F(k)).terminating ? F(Math.round(cm * 10), 10).div(F(k)).value : cm} km`.replace(/\.(\d{3})\d+/, '.$1'), `${v.add(F(k)).value} km`, `${Math.max(1, v.sub(F(k)).value)} km`],
      verify: `${cm}*${k}`,
      pad: (d) => `${v.value + d * k} km`,
      asks: 'Use the map scale to find the real distance.',
      concept: 'A scale is a ratio: every 1 cm on the map matches the same real distance.',
      steps: [`1 cm → ${k} km.`, `${cm} cm → ${cm} × ${k} = ${v.value} km.`],
      mistake: 'Adding the scale number instead of multiplying.',
      tip: 'Write the scale as “1 cm = … km”, then multiply by the number of centimetres.',
    };
  }
  const people = r.pick([4, 6, 8]);
  const target = people * r.int(2, 4) + (tier >= 4 ? people / 2 : 0);
  const flour = r.pick([200, 300, 150, 250]);
  const v = F(flour * target, people);
  return {
    text: `A recipe for ${people} people needs ${flour} g of flour. How many grams of flour are needed for ${target} people?`,
    correct: `${v.value} g`,
    wrong: [`${flour + target - people} g`, `${v.add(F(flour, people)).value} g`, `${F(flour * people, target).value} g`, `${v.sub(F(flour, people)).value} g`],
    verify: `${flour}*${target}/${people}`,
    pad: (d) => `${v.value + d * 10} g`,
    asks: 'Scale the recipe up in the same proportion.',
    concept: 'Keep the ratio of flour to people the same: find the amount for 1 person first.',
    steps: [`Flour for 1 person: ${flour} ÷ ${people} = ${F(flour, people).value} g.`, `Flour for ${target} people: ${target} × ${F(flour, people).value} = ${v.value} g.`],
    mistake: 'Adding the extra number of people to the amount of flour.',
    tip: 'Multiply or divide – do not add – when scaling a recipe.',
  };
});

const equiv: Template = T('ra.equiv', 'ra.equiv', 'Equivalent and simplified ratios', 'Ratios', [1, 4], (r, tier) => {
  const a = r.int(2, 9);
  const b = intWhere(r, 2, 11, (x) => x !== a);
  const k = [r.int(2, 4), r.int(3, 6), r.int(4, 9), r.int(6, 12)][tier - 1];
  const second = r.chance(0.5);
  return {
    text: `Find the missing number: ${m(`${a} : ${b} = ${second ? `${a * k} : \\square` : `\\square : ${b * k}`}`)}`,
    correct: String(second ? b * k : a * k),
    wrong: [String(second ? b + a * k - a : b + a * k - b), String(second ? b * k + k : a * k + k), String(second ? a * k + b : b * k + a), String(second ? b * k - b : a * k - a)],
    verify: second ? `${b}*${a * k}/${a}` : `${a}*${b * k}/${b}`,
    pad: (d) => String((second ? b * k : a * k) + d),
    asks: 'Find the number that keeps the ratio the same.',
    concept: 'Equivalent ratios are made by multiplying both parts by the same number.',
    steps: [`${second ? a : b} × ${k} = ${second ? a * k : b * k}, so both parts are multiplied by ${k}.`, `The missing number is ${second ? b : a} × ${k} = ${second ? b * k : a * k}.`],
    mistake: 'Adding the same amount to both parts instead of multiplying.',
    tip: 'Find the multiplier from the part you know, then use it on the missing part.',
  };
});

const part = T('ra.part', 'ra.share', 'Sharing and ratio problems', 'Ratios', [3, 5], (r, tier) => {
  const a = r.int(2, 5);
  const b = r.int(a + 1, 8);
  const unit = r.int(2, tier === 3 ? 6 : 12);
  const known = r.chance(0.5) ? a : b;
  const knownVal = known * unit;
  const [x, y] = r.pick([['boys', 'girls'], ['red beads', 'blue beads'], ['cats', 'dogs'], ['oak trees', 'pine trees']]);
  const askTotal = tier >= 4 || r.chance(0.5);
  const other = known === a ? b : a;
  const v = askTotal ? (a + b) * unit : other * unit;
  const knownName = known === a ? x : y;
  const otherName = known === a ? y : x;
  return {
    text: `The ratio of ${x} to ${y} is ${a} : ${b}. There are ${knownVal} ${knownName}. ${askTotal ? `How many ${x} and ${y} are there altogether?` : `How many ${otherName} are there?`}`,
    correct: String(v),
    wrong: [String(askTotal ? other * unit : (a + b) * unit), String(knownVal + other), String(v + unit), String(Math.max(1, v - unit))],
    verify: askTotal ? `${knownVal}/${known}*${a + b}` : `${knownVal}/${known}*${other}`,
    pad: (d) => String(v + d * unit),
    asks: askTotal ? 'Find the total using the part you know.' : 'Find the other part using the ratio.',
    concept: 'Find the value of ONE part of the ratio, then multiply.',
    steps: [`${known} parts = ${knownVal}, so 1 part = ${knownVal} ÷ ${known} = ${unit}.`, askTotal ? `Total parts: ${a} + ${b} = ${a + b}; ${a + b} × ${unit} = ${v}.` : `${otherName}: ${other} × ${unit} = ${v}.`],
    mistake: 'Adding the ratio number to the known quantity.',
    tip: 'Always find what ONE part is worth first.',
  };
});

const better = T('ra.better', 'ra.rates', 'Unit rates and scale', 'Ratios', [3, 5], (r, tier) => {
  const n1 = r.pick([4, 5, 6, 8]);
  const n2 = n1 * r.int(2, 3);
  const up1 = F(r.int(20, 45), 100);
  const diff = F(r.int(2, 9), 100);
  const up2 = up1.sub(diff);
  const p1 = up1.mul(F(n1));
  const p2 = up2.mul(F(n2));
  const item = r.pick(['juice boxes', 'granola bars', 'pencils', 'batteries']);
  return {
    text: `A small pack of ${n1} ${item} costs ${money(p1)}. A large pack of ${n2} ${item} costs ${money(p2)}. How much cheaper is each item in the large pack than in the small pack?`,
    correct: money(diff),
    wrong: [money(p1.sub(p2).n > 0 ? p1.sub(p2) : p2.sub(p1)), money(diff.add(F(1, 100))), money(diff.mul(F(n2))), money(diff.add(F(2, 100)))],
    verify: `${decStrP(p1)}/${n1}-${decStrP(p2)}/${n2}`,
    pad: (d) => money(diff.add(F(d, 100))),
    asks: 'Compare the price of ONE item in each pack.',
    concept: 'To compare deals, work out the unit price (price for one) of each.',
    steps: [`Small pack: ${money(p1)} ÷ ${n1} = ${money(up1)} each.`, `Large pack: ${money(p2)} ÷ ${n2} = ${money(up2)} each.`, `Difference: ${money(up1)} − ${money(up2)} = ${money(diff)}.`],
    mistake: 'Comparing the pack prices directly instead of the price per item.',
    tip: 'A bigger pack is not always cheaper per item – always check the unit price.',
  };
});

function decStrP(f: Frac): string {
  return (f.n / f.d).toFixed(2);
}

export const ratioTemplates = [simplify, share, unitRate, scale, equiv, part, better];
