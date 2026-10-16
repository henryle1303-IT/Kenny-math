import { T } from '../define';
import { Frac } from '../../math/fraction';
import { NAMES, commas, decStr, m } from '../h';

const F = (n: number, d = 1) => new Frac(n, d);
const ds = (f: Frac) => decStr(f);

interface Conv {
  from: string;
  to: string;
  factor: number; // 1 from = factor to
  fromName: string;
  toName: string;
  kind: string;
}
const CONVS: Conv[] = [
  { from: 'm', to: 'cm', factor: 100, fromName: 'metres', toName: 'centimetres', kind: 'length' },
  { from: 'km', to: 'm', factor: 1000, fromName: 'kilometres', toName: 'metres', kind: 'length' },
  { from: 'cm', to: 'mm', factor: 10, fromName: 'centimetres', toName: 'millimetres', kind: 'length' },
  { from: 'kg', to: 'g', factor: 1000, fromName: 'kilograms', toName: 'grams', kind: 'mass' },
  { from: 'L', to: 'mL', factor: 1000, fromName: 'litres', toName: 'millilitres', kind: 'capacity' },
  { from: 't', to: 'kg', factor: 1000, fromName: 'tonnes', toName: 'kilograms', kind: 'mass' },
];

const convert = T('me.convert', 'me.convert', 'Converting metric units', 'Measurement', [1, 5], (r, tier) => {
  const c = r.pick(CONVS.filter((x) => (tier <= 2 ? x.kind === 'length' || x.from === 'kg' : true)));
  const down = tier === 1 ? true : r.chance(0.5);
  const maxWhole = [9, 30, 99, 99, 99][tier - 1];
  const wholeVal = tier <= 2 ? F(r.int(2, maxWhole)) : tier === 3 ? F(r.int(11, 99), 10) : tier === 4 ? F(r.int(101, 999), 100) : F(r.int(1001, 9999), 1000);
  const big = wholeVal;
  const small = big.mul(F(c.factor));
  const fmtS = (f: Frac) => `${ds(f)} ${down ? c.to : c.from}`;
  const answerVal = down ? small : big;
  const givenVal = down ? big : small;
  const text = down
    ? `How many ${c.toName} are there in ${ds(givenVal)} ${c.fromName}?`
    : `How many ${c.fromName} are there in ${commas(Number(ds(givenVal))) === ds(givenVal) ? commas(givenVal.n / givenVal.d) : ds(givenVal)} ${c.toName}?`;
  const fmt = (f: Frac) => `${f.isInt ? commas(f.n) : ds(f)} ${down ? c.to : c.from}`;
  const wrongA = down ? answerVal.div(F(10)) : answerVal.mul(F(10));
  return {
    text,
    correct: fmt(answerVal),
    wrong: [fmt(down ? answerVal.mul(F(10)) : answerVal.div(F(10))), fmt(wrongA), fmt(down ? givenVal.mul(F(c.factor / 10 === 1 ? 100 : c.factor / 10)) : givenVal.div(F(c.factor / 10 === 1 ? 100 : c.factor / 10))), fmt(down ? answerVal.add(F(c.factor)) : answerVal.add(F(1)))],
    verify: down ? `${ds(givenVal)}*${c.factor}` : `${ds(givenVal)}/${c.factor}`,
    pad: (d) => fmt(answerVal.add(F(d, down ? 1 : 10))),
    asks: `Change ${down ? c.fromName : c.toName} into ${down ? c.toName : c.fromName}.`,
    concept: `1 ${c.from} = ${commas(c.factor)} ${c.to}. Going to the smaller unit means multiplying; going to the bigger unit means dividing.`,
    steps: [`1 ${c.from} = ${commas(c.factor)} ${c.to}.`, down ? `${ds(givenVal)} × ${commas(c.factor)} = ${ds(answerVal)}.` : `${ds(givenVal)} ÷ ${commas(c.factor)} = ${ds(answerVal)}.`],
    mistake: 'Multiplying when you should divide (or the other way around), or using the wrong power of 10.',
    tip: 'Smaller unit → bigger number (multiply). Bigger unit → smaller number (divide).',
  };
});

const mixedAdd = T('me.mixedunits', 'me.problems', 'Measurement problems', 'Measurement', [2, 5], (r, tier) => {
  const kind = r.pick(['length', 'mass', 'capacity'] as const);
  const [big, small, f] = kind === 'length' ? ['m', 'cm', 100] : kind === 'mass' ? ['kg', 'g', 1000] : ['L', 'mL', 1000];
  const [b1, s1] = [r.int(1, 6), r.int(1, f === 100 ? 99 : 9) * (f === 100 ? 1 : 100) + (tier >= 4 ? 50 : 0)];
  const [b2, s2] = [r.int(1, 5), r.int(1, f === 100 ? 99 : 9) * (f === 100 ? 1 : 100)];
  const add = tier <= 3 || r.chance(0.5);
  const t1 = b1 * f + s1;
  const t2 = b2 * f + s2;
  const [hi, lo] = t1 >= t2 ? [t1, t2] : [t2, t1];
  const res = add ? t1 + t2 : hi - lo;
  const fmtBS = (t: number) => `${Math.floor(t / f)} ${big} ${t % f} ${small}`;
  const [A, B] = add ? [t1, t2] : [hi, lo];
  const thing = kind === 'length' ? 'ribbon' : kind === 'mass' ? 'bag of flour' : 'bottle of water';
  const name = r.pick(NAMES);
  return {
    text: `${name} has a ${thing} of ${fmtBS(A)} and ${add ? 'another one of' : 'uses'} ${fmtBS(B)}. ${add ? 'What is the total' : 'How much is left'} in ${small}?`,
    correct: `${commas(res)} ${small}`,
    wrong: [`${commas(add ? A + B + (f === 100 ? 100 : 1000) : A - B + (f === 100 ? 100 : 1000))} ${small}`, `${commas(add ? Math.abs(A - B) : A + B)} ${small}`, `${commas(res + 10)} ${small}`, `${commas(Math.max(1, res - (f === 100 ? 100 : 100)))} ${small}`],
    verify: add ? `${A}+${B}` : `${A}-${B}`,
    pad: (d) => `${commas(res + d * 10)} ${small}`,
    asks: `Change both amounts to ${small} and ${add ? 'add' : 'subtract'}.`,
    concept: `Convert everything to the same unit first. 1 ${big} = ${commas(f)} ${small}.`,
    steps: [`${fmtBS(A)} = ${commas(A)} ${small}.`, `${fmtBS(B)} = ${commas(B)} ${small}.`, `${commas(A)} ${add ? '+' : '−'} ${commas(B)} = ${commas(res)} ${small}.`],
    mistake: 'Adding the big units and small units separately and forgetting to convert when the small units go past the limit.',
    tip: 'Change everything into the smallest unit, calculate, then change back if needed.',
  };
});

const pieces = T('me.pieces', 'me.problems', 'Measurement problems', 'Measurement', [3, 5], (r, tier) => {
  const kind = r.pick(['rope', 'water', 'flour'] as const);
  if (kind === 'rope') {
    const piece = r.pick([20, 25, 40, 50, 15]);
    const n = r.int(4, tier === 3 ? 12 : 30);
    const total = piece * n;
    const mtr = total / 100;
    return {
      text: `A rope is ${ds(F(total, 100))} m long. It is cut into pieces that are each ${piece} cm long. How many pieces are there?`,
      correct: String(n),
      wrong: [String(Math.round((mtr * 10) / (piece / 10))), String(n * 10), String(n + piece / 5), String(Math.max(1, n - 1))].map((x, i) => (i === 0 ? String(n + 10) : x)),
      verify: `${ds(F(total, 100))}*100/${piece}`,
      pad: (d) => String(n + d),
      asks: 'Change the rope length to centimetres, then divide.',
      concept: 'To divide a length into pieces, both lengths must use the same unit.',
      steps: [`${ds(F(total, 100))} m = ${total} cm.`, `${total} ÷ ${piece} = ${n}.`],
      mistake: 'Dividing 2.4 by 20 without changing the units.',
      tip: 'Always check that both measurements use the same unit before dividing.',
    };
  }
  const cup = r.pick([200, 250, 150, 125, 300]);
  const n = r.int(4, tier === 3 ? 10 : 20);
  const litres = F(cup * n, 1000);
  const what = kind === 'water' ? 'water' : 'juice';
  return {
    text: `A jug holds ${ds(litres)} L of ${what}. How many glasses of ${cup} mL can be filled completely from the jug?`,
    correct: String(n),
    wrong: [String(n + 10), String(Math.max(1, n - 1)), String(n * 10), String(n + 1)],
    verify: `${ds(litres)}*1000/${cup}`,
    pad: (d) => String(n + d),
    asks: 'Change litres to millilitres, then see how many glasses fit.',
    concept: '1 L = 1,000 mL. Use the same unit for the jug and the glass.',
    steps: [`${ds(litres)} L = ${commas(cup * n)} mL.`, `${commas(cup * n)} ÷ ${cup} = ${n}.`],
    mistake: 'Dividing litres by millilitres without converting.',
    tip: 'Convert first, divide second.',
  };
});

const compareUnits = T('me.compare', 'me.problems', 'Measurement problems', 'Measurement', [2, 4], (r, tier) => {
  const name = r.pick(NAMES);
  const a = r.int(11, 49) * 10; // cm
  const bM = F(r.int(11, 49), 10); // m
  const bCm = bM.mul(F(100));
  const diff = F(a).sub(bCm);
  const sign = diff.n >= 0;
  const abs = diff.n >= 0 ? diff : diff.neg();
  if (abs.n === 0) return compareUnits.build(r, tier);
  const [n1, n2] = r.sample(NAMES, 2);
  const [x, y] = sign ? [n1, n2] : [n2, n1];
  return {
    text: `${n1}’s ribbon is ${a} cm long. ${n2}’s ribbon is ${ds(bM)} m long. How many centimetres ${sign ? 'longer is ' + n1 + '’s ribbon' : 'longer is ' + n2 + '’s ribbon'}?`,
    correct: `${commas(abs.n)} cm`,
    wrong: [`${commas(Math.abs(a - bM.value))} cm`.replace(/\.\d+/, ''), `${commas(abs.n + 10)} cm`, `${commas(abs.n * 10)} cm`, `${commas(Math.max(1, abs.n - 10))} cm`].map((s, i) => (i === 0 ? `${commas(a + bCm.n)} cm` : s)),
    verify: `abs(${a}-${ds(bM)}*100)`,
    pad: (d) => `${commas(abs.n + d * 10)} cm`,
    asks: 'Compare the two lengths using the same unit.',
    concept: 'You can only compare or subtract lengths that use the same unit.',
    steps: [`${ds(bM)} m = ${commas(bCm.n)} cm.`, `Difference: ${commas(Math.max(a, bCm.n))} − ${commas(Math.min(a, bCm.n))} = ${commas(abs.n)} cm.`, `${x}’s ribbon is longer than ${y}’s by ${commas(abs.n)} cm.`],
    mistake: `Subtracting ${ds(bM)} from ${a} without changing metres to centimetres.`,
    tip: 'Convert to the smaller unit (centimetres) to avoid decimals.',
  };
});

export const measureTemplates = [convert, mixedAdd, pieces, compareUnits];
export { m };
