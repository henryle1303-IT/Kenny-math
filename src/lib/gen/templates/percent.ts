import { T } from '../define';
import { Frac, gcd } from '../../math/fraction';
import { NAMES, commas, decStr, m, money, moneyAuto, tfrac } from '../h';

const F = (n: number, d = 1) => new Frac(n, d);
const pct = (n: number | Frac) => `${typeof n === 'number' ? n : decStr(n)}%`;
const numS = (f: Frac) => decStr(f);

const of = T('pc.of', 'pc.of', 'Percent of an amount', 'Percentages', [1, 5], (r, tier) => {
  const pcts = [[10, 50, 25], [20, 10, 50, 25, 75], [30, 40, 60, 80, 15, 5], [15, 35, 45, 12, 90], [12, 35, 65, 85, 2.5 as number]][tier - 1].filter((p) => Number.isInteger(p)) as number[];
  const p = r.pick(pcts);
  const unit = p % 25 === 0 ? 4 : p % 20 === 0 ? 5 : p % 10 === 0 ? 10 : 20;
  const total = unit * r.int(tier <= 2 ? 2 : 4, tier <= 2 ? 20 : 60);
  const v = F(total * p, 100);
  const name = r.pick(NAMES);
  const story = r.chance(0.5);
  const item = r.pick(['stickers', 'marbles', 'trading cards', 'pages', 'seeds']);
  return {
    text: story ? `${name} has ${total} ${item}. ${p}% of them are shiny. How many ${item} are shiny?` : `What is ${p}% of ${total}?`,
    correct: numS(v),
    wrong: [numS(F(total * (100 - p), 100)), numS(F(total * p, 10)), numS(v.add(F(p === 50 ? 5 : 10))), numS(v.sub(F(5)).n > 0 ? v.sub(F(5)) : v.add(F(15)))],
    verify: `${total}*${p}/100`,
    pad: (d) => numS(v.add(F(d))),
    asks: `Find ${p} out of every 100 in ${total}.`,
    concept: 'Percent means “out of 100”. To find a percent of an amount, turn the percent into a fraction or use 10% and 1% blocks.',
    steps:
      p % 10 === 0
        ? [`10% of ${total} = ${total} ÷ 10 = ${numS(F(total, 10))}.`, `${p}% is ${p / 10} lots of 10%: ${p / 10} × ${numS(F(total, 10))} = ${numS(v)}.`]
        : [`${p}% = ${p}/100.`, `${total} × ${p} ÷ 100 = ${numS(v)}.`],
    mistake: p === 50 || p === 25 || p === 75 ? `Mixing up the percent with the amount, or using the wrong fraction (25% is 1/4, not 1/25).` : 'Finding the amount that is left over instead of the percent asked for.',
    tip: 'Use easy benchmarks: 50% is half, 25% is a quarter, 10% is a tenth.',
  };
});

const discount = T('pc.discount', 'pc.change', 'Discounts and percent change', 'Percentages', [2, 5], (r, tier) => {
  const p = r.pick(tier === 2 ? [10, 20, 50, 25] : tier === 3 ? [15, 30, 40, 25, 20] : [12, 35, 15, 45, 60, 75]);
  const unit = p % 25 === 0 ? 4 : 20;
  const price = unit * r.int(5, tier <= 3 ? 20 : 40);
  const disc = F(price * p, 100);
  const sale = F(price).sub(disc);
  const item = r.pick(['jacket', 'backpack', 'pair of shoes', 'bike helmet', 'board game', 'science kit']);
  return {
    text: `A ${item} costs ${moneyAuto(price)}. In a sale, the price is reduced by ${p}%. What is the sale price?`,
    correct: moneyAuto(sale),
    wrong: [moneyAuto(disc), moneyAuto(F(price).add(disc)), moneyAuto(F(price - p)), moneyAuto(sale.add(F(5)))],
    verify: `${price}-${price}*${p}/100`,
    pad: (d) => moneyAuto(sale.add(F(d))),
    asks: 'Find the new price after taking off the discount.',
    concept: 'Sale price = original price − discount, where discount = percent × original price.',
    steps: [`Discount: ${p}% of ${money(price)} = ${money(disc)}.`, `Sale price: ${money(price)} − ${money(disc)} = ${money(sale)}.`],
    mistake: 'Stopping at the discount amount, or subtracting the percent number from the price (e.g. 80 − 25).',
    tip: `Another way: pay ${100 - p}% of the price: ${money(price)} × ${100 - p}/100.`,
  };
});

const toPercent = T('pc.convert', 'pc.convert', 'Fractions, decimals and percentages', 'Percentages', [1, 4], (r, tier) => {
  const sets: [number, number][][] = [
    [[1, 2], [1, 4], [3, 4], [1, 5], [1, 10]],
    [[3, 5], [2, 5], [7, 10], [9, 20], [3, 20]],
    [[3, 8], [1, 8], [5, 8], [7, 25], [13, 50]],
    [[7, 8], [11, 40], [17, 20], [19, 25], [27, 50]],
  ];
  const [n, d] = r.pick(sets[tier - 1]);
  const v = F(n * 100, d);
  const kind = r.int(0, 2);
  if (kind === 0) {
    return {
      text: `Write ${m(tfrac(n, d))} as a percentage.`,
      correct: pct(v),
      wrong: [pct(F(n * 10, d)), pct(F(d * 100, n * 10) .terminating ? F(d * 100, n * 10) : F(n + d)), pct(v.add(F(5))), pct(F(n, d))],
      verify: `${n}/${d}*100`,
      pad: (x) => pct(v.add(F(x * 5))),
      asks: 'Change the fraction into “out of 100”.',
      concept: 'Percent means out of 100: divide the numerator by the denominator, then multiply by 100.',
      steps: [`${n}/${d} = ${n} ÷ ${d} = ${numS(F(n, d))}.`, `${numS(F(n, d))} × 100 = ${numS(v)}, so ${pct(v)}.`],
      mistake: 'Forgetting to multiply by 100, or writing the numerator as the percent.',
      tip: 'Remember: 1/2 = 50%, 1/4 = 25%, 1/5 = 20%, 1/10 = 10%.',
    };
  }
  if (kind === 1) {
    return {
      text: `Write ${numS(F(n, d))} as a percentage.`,
      correct: pct(v),
      wrong: [pct(F(n * 10, d)), pct(F(n, d * 10)), pct(v.mul(F(10))), pct(v.add(F(10)))],
      verify: `${numS(F(n, d))}*100`,
      pad: (x) => pct(v.add(F(x * 5))),
      asks: 'Change the decimal into a percentage.',
      concept: 'To change a decimal to a percent, multiply by 100 (move the decimal point two places right).',
      steps: [`${numS(F(n, d))} × 100 = ${numS(v)}.`, `So ${numS(F(n, d))} = ${pct(v)}.`],
      mistake: 'Moving the decimal point only one place, or in the wrong direction.',
      tip: '0.7 is 70%, not 7%.',
    };
  }
  return {
    text: `Write ${pct(v)} as a decimal.`,
    correct: numS(F(n, d)),
    wrong: [numS(F(n, d).mul(F(10))), numS(F(n, d).div(F(10))), numS(v), numS(F(n, d).add(F(1, 10)))],
    verify: `${numS(v)}/100`,
    pad: (x) => numS(F(n, d).add(F(x, 100))),
    asks: 'Change the percentage into a decimal.',
    concept: 'To change a percent to a decimal, divide by 100.',
    steps: [`${pct(v)} means ${numS(v)} out of 100.`, `${numS(v)} ÷ 100 = ${numS(F(n, d))}.`],
    mistake: 'Dividing by 10 instead of 100.',
    tip: 'Move the decimal point two places to the left.',
  };
});

const find = T('pc.find', 'pc.find', 'Finding what percent', 'Percentages', [1, 5], (r, tier) => {
  const whole = r.pick(tier <= 2 ? [20, 25, 40, 50, 100] : tier <= 4 ? [40, 60, 80, 120, 200, 250] : [80, 120, 160, 240, 300, 400]);
  const p = r.pick(tier <= 2 ? [10, 20, 25, 50, 75] : [5, 15, 35, 45, 60, 80]);
  const part = (whole * p) / 100;
  if (!Number.isInteger(part)) return find.build(r, tier);
  const name = r.pick(NAMES);
  const story = r.chance(0.6);
  return {
    text: story ? `${name} answered ${part} out of ${whole} questions correctly in a quiz. What percentage did ${name} get correct?` : `What percent of ${whole} is ${part}?`,
    correct: pct(p),
    wrong: [pct(whole - part), pct(F(part * 10, whole)), pct(p + 10), pct(Math.max(5, p - 10))],
    verify: `${part}/${whole}*100`,
    pad: (x) => pct(p + 5 * x),
    asks: 'Compare the part to the whole as a percentage.',
    concept: 'Percentage = part ÷ whole × 100.',
    steps: [`Write as a fraction: ${part}/${whole}.`, `${part} ÷ ${whole} = ${numS(F(part, whole))}.`, `${numS(F(part, whole))} × 100 = ${p}%.`],
    mistake: 'Dividing the whole by the part, or forgetting to multiply by 100.',
    tip: 'The “whole” is the number that comes after the word “of” or “out of”.',
  };
});

const increase = T('pc.increase', 'pc.change', 'Discounts and percent change', 'Percentages', [3, 5], (r, tier) => {
  const p = r.pick(tier === 3 ? [10, 20, 50, 25] : tier === 4 ? [15, 30, 40, 5, 12] : [35, 45, 8, 60, 120]);
  const base = r.pick([200, 400, 500, 800, 250, 600, 1000, 1200, 150]);
  const inc = F(base * p, 100);
  const v = F(base).add(inc);
  const ctx = r.int(0, 2);
  const text =
    ctx === 0
      ? `A school has ${commas(base)} students. The number of students goes up by ${p}% next year. How many students will there be?`
      : ctx === 1
        ? `A plant is ${base} mm tall. It grows ${p}% taller in a month. How tall is it now, in millimetres?`
        : `A video game costs ${moneyAuto(base / 10)}. The price increases by ${p}%. What is the new price?`;
  const baseV = ctx === 2 ? F(base, 10) : F(base);
  const incV = ctx === 2 ? F(base * p, 1000) : inc;
  const total = baseV.add(incV);
  const f = (x: Frac) => (ctx === 2 ? moneyAuto(x) : numS(x));
  return {
    text,
    correct: f(total),
    wrong: [f(incV), f(baseV.sub(incV)), f(baseV.add(F(p))), f(total.add(ctx === 2 ? F(1) : F(10)))],
    verify: `${decStr(baseV)}+${decStr(baseV)}*${p}/100`,
    pad: (x) => f(total.add(F(x * (ctx === 2 ? 1 : 10)))),
    asks: 'Work out the amount of the increase and add it on.',
    concept: 'New amount = original + (percent × original).',
    steps: [`${p}% of ${f(baseV)} = ${f(incV)}.`, `Add the increase: ${f(baseV)} + ${f(incV)} = ${f(total)}.`],
    mistake: 'Giving only the increase, or subtracting instead of adding.',
    tip: `A ${p}% rise means the new amount is ${100 + p}% of the old amount.`,
  };
});

const whole = T('pc.whole', 'pc.find', 'Finding what percent', 'Percentages', [3, 5], (r, tier) => {
  const p = r.pick(tier === 3 ? [50, 25, 10, 20] : tier === 4 ? [30, 40, 75, 60] : [15, 35, 45, 12, 85]);
  const k = 100 / gcd(p, 100);
  const total = k * r.int(2, Math.max(2, Math.floor(60 / k)));
  const part = (total * p) / 100;
  const name = r.pick(NAMES);
  return {
    text: `${name} reads ${part} pages of a book, which is ${p}% of the whole book. How many pages are in the book?`,
    correct: String(total),
    wrong: [String(part * p), String(part + p), String(Math.round((part * (100 - p)) / p)), String(total + k)],
    verify: `${part}*100/${p}`,
    pad: (x) => String(total + x * k),
    asks: 'Use the percent and the part to find the whole.',
    concept: `If ${p}% is ${part}, find 1% by dividing, then multiply by 100.`,
    steps: [`${p}% = ${part}, so 1% = ${part} ÷ ${p} = ${numS(F(part, p))}.`, `100% = ${numS(F(part, p))} × 100 = ${total}.`],
    mistake: `Taking ${p}% of ${part} instead of working backwards.`,
    tip: 'Check: take your answer’s percent and see if you get the part back.',
  };
});

export const percentTemplates = [of, discount, toPercent, find, increase, whole];
