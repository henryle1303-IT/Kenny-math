import { T } from '../define';
import { Frac } from '../../math/fraction';
import { D, NAMES, decStr, m, money, commas } from '../h';

const F = (n: number, d = 1) => new Frac(n, d);
const ds = (f: Frac, places?: number) => decStr(f, places);

const addsub = T('dec.addsub', 'dec.addsub', 'Adding and subtracting decimals', 'Decimals', [1, 5], (r, tier) => {
  const pl = tier === 1 ? 1 : tier <= 3 ? 2 : 3;
  const mag = [90, 500, 900, 2500, 9000][tier - 1];
  const a = D(r.int(11, mag * Math.pow(10, pl - 1) + 40), pl);
  const b = D(r.int(11, mag * Math.pow(10, pl - 1) + 40), pl);
  const add = r.chance(0.5);
  const [x, y] = add ? [a, b] : a.cmp(b) >= 0 ? [a, b] : [b, a];
  if (x.eq(y)) return addsub.build(r, tier);
  const v = add ? x.add(y) : x.sub(y);
  const fmt = (f: Frac) => ds(f, pl);
  const verb = r.pick(['Calculate', 'What is', 'Find the value of']);
  const tex = `${fmt(x)} ${add ? '+' : '-'} ${fmt(y)}`;
  const unit = Math.pow(10, -pl);
  const alt = (k: number) => fmt(v.add(F(k, Math.pow(10, pl))));
  return {
    text: verb === 'What is' ? `What is ${m(tex)}?` : `${verb} ${m(tex)}.`,
    correct: fmt(v),
    wrong: [alt(10), alt(-10), alt(1), alt(100)].map((s) => (s.startsWith('-') ? fmt(v.add(F(2, Math.pow(10, pl)))) : s)),
    verify: `${fmt(x)}${add ? '+' : '-'}${fmt(y)}`,
    pad: (d) => fmt(v.add(F(d, Math.pow(10, pl)))),
    asks: `${add ? 'Add' : 'Subtract'} the two decimal numbers.`,
    concept: 'Line up the decimal points so tenths are under tenths and hundredths under hundredths, then calculate as with whole numbers.',
    steps: [`Line up the decimal points: ${fmt(x)} and ${fmt(y)}.`, `${add ? 'Add' : 'Subtract'} column by column from the right${add ? ', carrying when needed' : ', regrouping when needed'}.`, `${fmt(x)} ${add ? '+' : '−'} ${fmt(y)} = ${fmt(v)}.`],
    mistake: 'Lining up the digits on the right instead of lining up the decimal points.',
    tip: `Write extra zeros so both numbers have the same number of decimal places (${unit === 0.1 ? 'tenths' : 'hundredths or thousandths'}).`,
  };
});

const mul = T('dec.mul', 'dec.mul', 'Multiplying decimals', 'Decimals', [1, 5], (r, tier) => {
  let a: Frac, b: Frac;
  if (tier === 1) [a, b] = [D(r.int(11, 99), 1), F(r.int(2, 9))];
  else if (tier === 2) [a, b] = [D(r.int(101, 999), 2), F(r.int(3, 9))];
  else if (tier === 3) [a, b] = [D(r.int(12, 99), 1), D(r.int(3, 9), 1)];
  else if (tier === 4) [a, b] = [D(r.int(12, 99), 1), D(r.int(12, 49), 1)];
  else [a, b] = [D(r.int(125, 999), 2), D(r.int(12, 49), 1)];
  const v = a.mul(b);
  const fmt = (f: Frac) => ds(f);
  const shift = (k: number) => ds(v.mul(F(k < 0 ? 1 : Math.pow(10, k), k < 0 ? Math.pow(10, -k) : 1)));
  return {
    text: `Calculate ${m(`${fmt(a)} \\times ${fmt(b)}`)}.`,
    correct: fmt(v),
    wrong: [shift(1), shift(-1), shift(2), shift(-2)].map((s) => s),
    verify: `${fmt(a)}*${fmt(b)}`,
    pad: (d) => ds(v.add(F(d, 10))),
    asks: 'Multiply the decimals and place the decimal point correctly.',
    concept: 'Multiply as if there were no decimal points, then put back as many decimal places as the two numbers had together.',
    steps: [`Ignore the points: ${ds(a.mul(F(Math.pow(10, Math.max(0, decPlaces(a)))))) } × ${ds(b.mul(F(Math.pow(10, Math.max(0, decPlaces(b))))))} = ${ds(v.mul(F(Math.pow(10, decPlaces(a) + decPlaces(b)))))}.`, `Count decimal places: ${decPlaces(a)} + ${decPlaces(b)} = ${decPlaces(a) + decPlaces(b)}.`, `Place the point: ${fmt(v)}.`],
    mistake: 'Putting the decimal point in the wrong place in the product.',
    tip: 'Estimate first: round each number and multiply to check the size of your answer.',
  };
});

function decPlaces(f: Frac): number {
  let p = 0;
  while (!new Frac(f.n * Math.pow(10, p), f.d).isInt) p++;
  return p;
}

const div = T('dec.div', 'dec.div', 'Dividing decimals', 'Decimals', [2, 5], (r, tier) => {
  const k = tier === 2 ? r.int(2, 9) : tier === 3 ? r.int(3, 12) : r.int(4, 15);
  const q = tier <= 3 ? D(r.int(12, 99), 1) : D(r.int(112, 499), 2);
  const dividend = q.mul(F(k));
  const useDec = tier === 5;
  if (useDec) {
    const dv = D(r.pick([2, 4, 5, 25]), 1);
    const quo = F(r.int(12, 90));
    const total = quo.mul(dv);
    return {
      text: `Calculate ${m(`${ds(total)} \\div ${ds(dv)}`)}.`,
      correct: ds(quo),
      wrong: [ds(quo.div(F(10))), ds(quo.mul(F(10))), ds(quo.add(F(1))), ds(total.div(F(10)))],
      verify: `${ds(total)}/${ds(dv)}`,
      pad: (d) => ds(quo.add(F(d))),
      asks: 'Divide by a decimal.',
      concept: 'Multiply both numbers by 10 (or 100) to make the divisor a whole number; the answer stays the same.',
      steps: [`Multiply both by 10: ${ds(total.mul(F(10)))} ÷ ${ds(dv.mul(F(10)))}.`, `${ds(total.mul(F(10)))} ÷ ${ds(dv.mul(F(10)))} = ${ds(quo)}.`],
      mistake: 'Moving the decimal point in only one of the numbers.',
      tip: 'Make the divisor a whole number by shifting both decimal points the same way.',
    };
  }
  const name = r.pick(NAMES);
  const story = r.chance(0.5) && tier >= 3;
  return {
    text: story
      ? `${name} cuts a ribbon that is ${ds(dividend)} metres long into ${k} equal pieces. How long is each piece, in metres?`
      : `Calculate ${m(`${ds(dividend)} \\div ${k}`)}.`,
    correct: ds(q),
    wrong: [ds(q.div(F(10))), ds(q.mul(F(10))), ds(q.add(D(1, 1))), ds(q.sub(D(1, 2)).n > 0 ? q.sub(D(1, 2)) : q.add(D(2, 2)))],
    verify: `${ds(dividend)}/${k}`,
    pad: (d) => ds(q.add(D(d, 2))),
    asks: story ? 'Find the length of one piece.' : 'Divide the decimal by the whole number.',
    concept: 'Divide as usual and keep the decimal point in the answer directly above the decimal point in the number being divided.',
    steps: [`Ignore the decimal point: ${ds(dividend.mul(F(Math.pow(10, decPlaces(dividend)))))} ÷ ${k}.`, `Divide as with whole numbers, then put the decimal point back.`, `${ds(dividend)} ÷ ${k} = ${ds(q)}.`],
    mistake: 'Putting the decimal point in the wrong place in the quotient.',
    tip: `Check by multiplying: ${ds(q)} × ${k} should be ${ds(dividend)}.`,
  };
});

const round = T('dec.round', 'dec.round', 'Rounding decimals', 'Decimals', [1, 5], (r, tier) => {
  const pl = tier <= 2 ? 1 : 2;
  const raw = r.int(2, 9) * 1000 + r.int(100, 999);
  const val = D(raw, 3 + (tier >= 4 ? 1 : 0) - (tier === 1 ? 1 : 0));
  const target = tier === 1 ? 0 : pl;
  const unit = Math.pow(10, target);
  const scaled = val.mul(F(unit));
  const rounded = F(scaled.add(F(1, 2)).floor(), unit);
  const names = ['whole number', 'tenth', 'hundredth'];
  const down = F(scaled.floor(), unit);
  const up = F(scaled.floor() + 1, unit);
  if (scaled.sub(F(scaled.floor())).eq(F(1, 2))) return round.build(r, tier);
  const places = target;
  return {
    text: `Round ${ds(val)} to the nearest ${names[target]}.`,
    correct: ds(rounded, places),
    wrong: [ds(rounded.eq(up) ? down : up, places), ds(F(Math.round(val.value * Math.pow(10, target + 1)), Math.pow(10, target + 1)), target + 1), ds(rounded.add(F(1, unit)), places), ds(rounded.sub(F(1, unit)).n >= 0 ? rounded.sub(F(1, unit)) : rounded.add(F(2, unit)), places)],
    verify: `round(${ds(val)}*${unit})/${unit}`,
    pad: (d) => ds(rounded.add(F(d, unit)), places),
    asks: `Find the ${names[target]} that ${ds(val)} is nearest to.`,
    concept: 'Look at the digit one place to the right of the rounding place: 5 or more rounds up, 4 or less stays.',
    steps: [`${ds(val)} is between ${ds(down, places)} and ${ds(up, places)}.`, `Look at the next digit to decide: it is closer to ${ds(rounded, places)}.`],
    mistake: 'Rounding down every time, or changing the wrong place.',
    tip: 'Keep the zero at the end if you round to a place (for example 3.50 to the nearest hundredth).',
  };
});

const compare = T('dec.compare', 'dec.compare', 'Comparing decimals', 'Decimals', [1, 5], (r, tier) => {
  const isMax = r.chance(0.6);
  const pl = tier <= 2 ? 1 : tier === 3 ? 2 : 3;
  const base = r.int(1, 9);
  const vals: Frac[] = [];
  while (vals.length < 4) {
    const frac = tier === 1 ? r.int(1, 99) : tier === 2 ? r.int(1, 999) : r.int(1, 999);
    const v = tier === 1 ? D(base * 100 + frac, 2).mul(F(1)) : D(base * 1000 + frac, 3);
    if (vals.some((x) => x.eq(v))) continue;
    vals.push(v);
  }
  const shown = vals.map((v) => (tier === 1 ? ds(v) : ds(v)));
  const sorted = vals.slice().sort((x, y) => x.cmp(y));
  const target = isMax ? sorted[3] : sorted[0];
  const strs = new Map<Frac, string>(vals.map((v, i) => [v, shown[i]]));
  return {
    text: `Which of these decimals is the ${isMax ? 'greatest' : 'smallest'}?`,
    correct: strs.get(target)!,
    wrong: vals.filter((v) => v !== target).map((v) => strs.get(v)!),
    verify: `${isMax ? 'max' : 'min'}(${shown.join(',')})`,
    asks: `Pick the decimal with the ${isMax ? 'largest' : 'smallest'} value.`,
    concept: 'Compare decimals place by place from the left: ones, then tenths, then hundredths, then thousandths.',
    steps: [`Write them with the same number of decimal places: ${vals.map((v) => ds(v, 3)).join(', ')}.`, `Compare digit by digit from the left.`, `${isMax ? 'Greatest' : 'Smallest'}: ${strs.get(target)}.`],
    mistake: 'Thinking a decimal with more digits is bigger (0.45 is NOT smaller than 0.4500, and 0.5 is bigger than 0.499).',
    tip: 'Add zeros at the end so all decimals have the same length, then compare as whole numbers.',
    pad: undefined,
  };
});

const placeDec = T('dec.place', 'dec.place', 'Decimal place value', 'Decimals', [1, 4], (r, tier) => {
  const len = tier === 1 ? 2 : tier === 2 ? 3 : 4;
  const digits = r.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, len + 1);
  const whole = digits[0];
  const decs = digits.slice(1);
  const pos = r.int(1, len);
  const d = decs[pos - 1];
  const v = F(d, Math.pow(10, pos));
  const names = ['', 'tenths', 'hundredths', 'thousandths', 'ten-thousandths'];
  const n = `${whole}.${decs.join('')}`;
  return {
    text: `What is the value of the digit ${d} in ${n}?`,
    correct: ds(v),
    wrong: [ds(F(d, Math.pow(10, pos + 1))), ds(F(d, Math.pow(10, Math.max(1, pos - 1)))), String(d), ds(F(d * 10, Math.pow(10, pos)).add(F(0)))].map((s, i) => (i === 3 ? ds(F(d, Math.pow(10, pos + 2))) : s)),
    verify: `${d}/${Math.pow(10, pos)}`,
    pad: (x) => ds(F(d + x, Math.pow(10, pos))),
    asks: `Find what the digit ${d} is worth in the ${names[pos]} place.`,
    concept: 'Each place to the right of the decimal point is ten times smaller than the one before.',
    steps: [`In ${n}, the digit ${d} is in the ${names[pos]} place.`, `${names[pos]} means ${d} ÷ ${Math.pow(10, pos)} = ${ds(v)}.`],
    mistake: 'Mixing up tenths (0.1) with tens (10) or reading the wrong place.',
    tip: 'Say the number aloud: 3.25 is “three and twenty-five hundredths”.',
  };
});

const pow10 = T('dec.pow10', 'dec.pow10', 'Multiplying and dividing by 10, 100, 1000', 'Decimals', [1, 3], (r, tier) => {
  const k = r.pick([10, 100, 1000]);
  const base = tier === 1 ? D(r.int(11, 99), 1) : tier === 2 ? D(r.int(101, 999), 2) : D(r.int(1001, 9999), 3);
  const mulIt = r.chance(0.5);
  const v = mulIt ? base.mul(F(k)) : base.div(F(k));
  return {
    text: `What is ${m(`${ds(base)} ${mulIt ? '\\times' : '\\div'} ${commas(k)}`)}?`,
    correct: ds(v),
    wrong: [ds(mulIt ? base.div(F(k)) : base.mul(F(k))), ds(mulIt ? v.mul(F(10)) : v.div(F(10))), ds(mulIt ? v.div(F(10)) : v.mul(F(10))), ds(mulIt ? base.add(F(k)) : base.sub(F(1)).n > 0 ? base.sub(F(1)) : base.add(F(2)))],
    verify: `${ds(base)}${mulIt ? '*' : '/'}${k}`,
    pad: (x) => ds(v.add(F(x, 10))),
    asks: `Shift the digits ${mulIt ? 'to the left' : 'to the right'} by the right number of places.`,
    concept: `${mulIt ? 'Multiplying' : 'Dividing'} by ${commas(k)} moves every digit ${String(k).length - 1} place${k > 10 ? 's' : ''} ${mulIt ? 'left (bigger)' : 'right (smaller)'}.`,
    steps: [`${commas(k)} has ${String(k).length - 1} zero${k > 10 ? 's' : ''}, so move the digits ${String(k).length - 1} place${k > 10 ? 's' : ''} ${mulIt ? 'left' : 'right'}.`, `${ds(base)} ${mulIt ? '×' : '÷'} ${commas(k)} = ${ds(v)}.`],
    mistake: 'Moving the decimal point the wrong way or by the wrong number of places.',
    tip: 'Bigger number = point moves right. Smaller number = point moves left.',
  };
});

const money_ = T('dec.money', 'dec.money', 'Money with decimals', 'Decimals', [1, 4], (r, tier) => {
  const name = r.pick(NAMES);
  const shop = r.pick(['the school store', 'the book fair', 'the corner shop', 'the toy shop']);
  const itemsA = r.pick([['pencils', 'a ruler'], ['notebooks', 'a pen'], ['stickers', 'a pencil case'], ['erasers', 'a sharpener']]);
  const n = tier === 1 ? r.int(2, 4) : r.int(3, 8);
  const price = D(r.int(35, 275), 2);
  const other = D(r.int(60, 480), 2);
  const spent = price.mul(F(n)).add(tier >= 3 ? other : F(0));
  const pay = F(Math.ceil(spent.value / 5) * 5 + (tier >= 3 ? 5 : 0));
  const change = pay.sub(spent);
  return {
    text:
      tier >= 3
        ? `At ${shop}, ${name} buys ${n} ${itemsA[0]} at ${money(price)} each and ${itemsA[1]} for ${money(other)}. ${name} pays with ${money(pay)}. How much change does ${name} get?`
        : `At ${shop}, ${name} buys ${n} ${itemsA[0]} at ${money(price)} each and pays with ${money(pay)}. How much change does ${name} get?`,
    correct: money(change),
    wrong: [money(spent), money(change.add(D(10, 2))), money(pay.sub(price.mul(F(n))).add(tier >= 3 ? D(0, 0) : D(0, 0)).eq(change) ? change.add(D(1, 2)) : pay.sub(price.mul(F(n)))), money(change.sub(D(10, 2)).n > 0 ? change.sub(D(10, 2)) : change.add(D(20, 2)))],
    verify: `${ds(pay)}-(${ds(price)}*${n}${tier >= 3 ? `+${ds(other)}` : ''})`,
    pad: (x) => money(change.add(D(x * 5, 2))),
    asks: 'Find how much money is left after paying.',
    concept: 'Total cost = number × price (+ other items). Change = money paid − total cost.',
    steps: [`Cost of the ${itemsA[0]}: ${n} × ${money(price)} = ${money(price.mul(F(n)))}.`, ...(tier >= 3 ? [`Add ${itemsA[1]}: ${money(price.mul(F(n)))} + ${money(other)} = ${money(spent)}.`] : []), `Change: ${money(pay)} − ${money(spent)} = ${money(change)}.`],
    mistake: 'Giving the total cost instead of the change.',
    tip: 'Estimate first by rounding prices to the nearest dollar.',
  };
});

const fracDec = T('dec.fraction', 'dec.fraction', 'Fractions and decimals', 'Decimals', [1, 5], (r, tier) => {
  const options: [number, number][] = [
    [[1, 2], [1, 4], [3, 4], [1, 5], [3, 5]],
    [[2, 5], [4, 5], [1, 8], [3, 10], [7, 10]],
    [[3, 8], [5, 8], [7, 8], [3, 20], [9, 20]],
    [[7, 25], [13, 20], [11, 40], [17, 50], [9, 25]],
    [[19, 40], [27, 50], [33, 40], [37, 80], [21, 125]],
  ][tier - 1] as [number, number][];
  const [n, d] = r.pick(options);
  const f = F(n, d);
  const toDec = tier % 2 === 1 || r.chance(0.5);
  if (toDec) {
    return {
      text: `Write ${m(tfrac2(n, d))} as a decimal.`,
      correct: ds(f),
      wrong: [ds(F(n, d * 10)), `${n}.${d}`, ds(f.mul(F(10))), ds(f.add(D(1, 2)))],
      verify: `${n}/${d}`,
      pad: (x) => ds(f.add(D(x, 2))),
      asks: 'Change the fraction into a decimal number.',
      concept: 'A fraction is a division: numerator ÷ denominator. Or make the denominator 10, 100 or 1000.',
      steps: [`${n}/${d} means ${n} ÷ ${d}.`, `${n} ÷ ${d} = ${ds(f)}.`],
      mistake: 'Writing the numerator and denominator on either side of a decimal point (e.g. 3/4 = 3.4).',
      tip: 'Remember: 1/2 = 0.5, 1/4 = 0.25, 1/5 = 0.2, 1/8 = 0.125.',
    };
  }
  return {
    text: `Write ${ds(f)} as a fraction in simplest form.`,
    correct: m(tfrac2(n, d)),
    wrong: [m(tfrac2(d, n)), m(tfrac2(n + 1, d)), m(tfrac2(n, d + 1)), m(tfrac2(n * 2 + 1, d * 2))],
    verify: `${n}/${d}`,
    pad: (x) => m(tfrac2(Math.max(1, n + x), d)),
    asks: 'Change the decimal into a fraction and simplify.',
    concept: 'Read the decimal as tenths, hundredths or thousandths, then simplify.',
    steps: [`${ds(f)} = ${f.n * (Math.pow(10, decPlaces(f)) / f.d)}/${Math.pow(10, decPlaces(f))}.`, `Simplify by dividing by the greatest common factor: ${n}/${d}.`],
    mistake: 'Forgetting to simplify, or using the wrong denominator.',
    tip: 'Count the decimal places to choose 10, 100 or 1000 as the denominator.',
  };
});

function tfrac2(n: number, d: number): string {
  return `\\frac{${n}}{${d}}`;
}

export const decimalTemplates = [addsub, mul, div, round, compare, placeDec, pow10, money_, fracDec];
