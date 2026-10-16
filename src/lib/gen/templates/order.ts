import { T } from '../define';
import { evalExpr } from '../../math/expr';
import { commas, intWhere, m, NAMES } from '../h';
import type { Rng } from '../rng';
import type { Template, Tier } from '../types';

interface Form {
  tex: string;
  expr: string;
  steps: string[];
  /** Typical wrong values (e.g. working left to right). */
  wrong: number[];
  rule: string;
}

function formsFor(r: Rng, tier: Tier): Form {
  const kind = r.int(0, 3);
  if (tier === 1) {
    const [a, b, c] = [r.int(2, 20), r.int(2, 9), r.int(2, 9)];
    if (kind < 2) {
      return { tex: `${a} + ${b} \\times ${c}`, expr: `${a}+${b}*${c}`, wrong: [(a + b) * c], rule: 'Multiply before you add.', steps: [`Multiplication comes first: ${b} × ${c} = ${b * c}.`, `Then add: ${a} + ${b * c} = ${a + b * c}.`] };
    }
    const big = b * c + r.int(3, 30);
    return { tex: `${big} - ${b} \\times ${c}`, expr: `${big}-${b}*${c}`, wrong: [(big - b) * c], rule: 'Multiply before you subtract.', steps: [`Multiplication comes first: ${b} × ${c} = ${b * c}.`, `Then subtract: ${big} − ${b * c} = ${big - b * c}.`] };
  }
  if (tier === 2) {
    if (kind === 0) {
      const [a, b, c, d] = [r.int(5, 30), r.int(2, 9), r.int(2, 9), r.int(1, 12)];
      const v = a + b * c - d;
      return { tex: `${a} + ${b} \\times ${c} - ${d}`, expr: `${a}+${b}*${c}-${d}`, wrong: [(a + b) * c - d, a + b * (c - d)], rule: 'Multiply first, then add and subtract from left to right.', steps: [`Multiply first: ${b} × ${c} = ${b * c}.`, `Left to right: ${a} + ${b * c} = ${a + b * c}.`, `${a + b * c} − ${d} = ${v}.`] };
    }
    if (kind === 1) {
      const k = r.int(2, 9);
      const d = r.int(2, 9);
      const c = d * k;
      const [a, b] = [r.int(3, 12), r.int(3, 9)];
      const v = a * b - k;
      return { tex: `${a} \\times ${b} - ${c} \\div ${d}`, expr: `${a}*${b}-${c}/${d}`, wrong: [a * b - c, Math.round(((a * b - c) / d) * 100) / 100], rule: 'Multiply and divide before subtracting.', steps: [`Do both ×, ÷ first: ${a} × ${b} = ${a * b} and ${c} ÷ ${d} = ${k}.`, `Then subtract: ${a * b} − ${k} = ${v}.`] };
    }
    const [a, b, c] = [r.int(30, 99), r.int(2, 9), r.int(2, 9)];
    const v = a - b * c + 10;
    return { tex: `${a} - ${b} \\times ${c} + 10`, expr: `${a}-${b}*${c}+10`, wrong: [(a - b) * c + 10, a - b * (c + 10)], rule: 'Multiply first.', steps: [`Multiply first: ${b} × ${c} = ${b * c}.`, `Left to right: ${a} − ${b * c} = ${a - b * c}.`, `${a - b * c} + 10 = ${v}.`] };
  }
  if (tier === 3) {
    if (kind === 0) {
      const [a, b, c] = [r.int(3, 20), r.int(2, 15), r.int(2, 9)];
      const d = r.int(1, 15);
      const v = (a + b) * c - d;
      return { tex: `(${a} + ${b}) \\times ${c} - ${d}`, expr: `(${a}+${b})*${c}-${d}`, wrong: [a + b * c - d, (a + b) * (c - d)], rule: 'Brackets first, then multiply, then subtract.', steps: [`Brackets first: ${a} + ${b} = ${a + b}.`, `Multiply: ${a + b} × ${c} = ${(a + b) * c}.`, `Subtract: ${(a + b) * c} − ${d} = ${v}.`] };
    }
    if (kind === 1) {
      const [a, b, c, d] = [r.int(3, 9), r.int(10, 20), r.int(2, 9), r.int(2, 20)];
      const v = a * (b - c) + d;
      return { tex: `${a} \\times (${b} - ${c}) + ${d}`, expr: `${a}*(${b}-${c})+${d}`, wrong: [a * b - c + d, a * b - (c + d)], rule: 'Brackets first.', steps: [`Brackets first: ${b} − ${c} = ${b - c}.`, `Multiply: ${a} × ${b - c} = ${a * (b - c)}.`, `Add: ${a * (b - c)} + ${d} = ${v}.`] };
    }
    const c = r.int(2, 9);
    const sum = c * r.int(3, 12);
    const a = r.int(2, sum - 1);
    const b = sum - a;
    const d = r.int(1, 10);
    const v = sum / c + d;
    return { tex: `(${a} + ${b}) \\div ${c} + ${d}`, expr: `(${a}+${b})/${c}+${d}`, wrong: [a + b / c + d], rule: 'Brackets first, then divide, then add.', steps: [`Brackets first: ${a} + ${b} = ${sum}.`, `Divide: ${sum} ÷ ${c} = ${sum / c}.`, `Add: ${sum / c} + ${d} = ${v}.`] };
  }
  if (tier === 4) {
    if (kind === 0) {
      const [a, b, c, d] = [r.int(3, 15), r.int(3, 15), r.int(10, 25), r.int(2, 9)];
      const v = (a + b) * (c - d);
      return { tex: `(${a} + ${b}) \\times (${c} - ${d})`, expr: `(${a}+${b})*(${c}-${d})`, wrong: [a + b * c - d, (a + b) * c - d], rule: 'Work out both brackets before multiplying.', steps: [`First bracket: ${a} + ${b} = ${a + b}.`, `Second bracket: ${c} − ${d} = ${c - d}.`, `Multiply: ${a + b} × ${c - d} = ${v}.`] };
    }
    if (kind === 1) {
      const e = r.int(2, 6);
      const d = r.int(2, 9);
      const bc = e * r.int(2, 5);
      const b = r.int(2, bc - 1);
      const c = bc - b;
      const a = r.int(bc * d / e + 5, bc * d / e + 40);
      const v = a - (bc * d) / e;
      return { tex: `${a} - (${b} + ${c}) \\times ${d} \\div ${e}`, expr: `${a}-(${b}+${c})*${d}/${e}`, wrong: [(a - bc) * d / e, a - bc + d / e], rule: 'Brackets first, then × and ÷ from left to right, then subtract.', steps: [`Brackets: ${b} + ${c} = ${bc}.`, `Multiply: ${bc} × ${d} = ${bc * d}.`, `Divide: ${bc * d} ÷ ${e} = ${(bc * d) / e}.`, `Subtract: ${a} − ${(bc * d) / e} = ${v}.`] };
    }
    const [a, b, c, d] = [r.int(20, 60), r.int(3, 9), r.int(2, 8), r.int(2, 6)];
    const v = a + b * (c - d) * 2;
    return { tex: `${a} + ${b} \\times (${c} - ${d}) \\times 2`, expr: `${a}+${b}*(${c}-${d})*2`, wrong: [(a + b) * (c - d) * 2, a + b * c - d * 2], rule: 'Brackets, then multiplication, then addition.', steps: [`Brackets: ${c} − ${d} = ${c - d}.`, `Multiply left to right: ${b} × ${c - d} = ${b * (c - d)}, then × 2 = ${b * (c - d) * 2}.`, `Add: ${a} + ${b * (c - d) * 2} = ${v}.`] };
  }
  // tier 5: powers
  if (kind < 2) {
    const c = r.int(2, 6);
    const b = intWhere(r, 4, 12, (x) => (x * x) % c === 0);
    const [a, d, e] = [r.int(10, 40), r.int(2, 6), r.int(2, 6)];
    const v = a + (b * b) / c - d * e;
    return { tex: `${a} + ${b}^{2} \\div ${c} - ${d} \\times ${e}`, expr: `${a}+${b}^2/${c}-${d}*${e}`, wrong: [(a + b) ** 2 / c - d * e, a + b * 2 / c - d * e], rule: 'Powers first, then × and ÷, then + and −.', steps: [`Power first: ${b}² = ${b * b}.`, `Divide: ${b * b} ÷ ${c} = ${(b * b) / c}. Multiply: ${d} × ${e} = ${d * e}.`, `Left to right: ${a} + ${(b * b) / c} − ${d * e} = ${v}.`] };
  }
  const [a, b, c, d] = [r.int(2, 7), r.int(1, 5), r.int(2, 9), r.int(2, 9)];
  const v = (a + b) ** 2 - c * d;
  return { tex: `(${a} + ${b})^{2} - ${c} \\times ${d}`, expr: `(${a}+${b})^2-${c}*${d}`, wrong: [a ** 2 + b ** 2 - c * d, (a + b) * 2 - c * d], rule: 'Brackets, then powers, then multiplication, then subtraction.', steps: [`Brackets: ${a} + ${b} = ${a + b}.`, `Power: ${a + b}² = ${(a + b) ** 2}. Multiply: ${c} × ${d} = ${c * d}.`, `Subtract: ${(a + b) ** 2} − ${c * d} = ${v}.`] };
}

const basic: Template = T('oo.basic', 'oo.basic', 'Order of operations', 'Order of Operations', [1, 5], (r, tier) => {
  const f = formsFor(r, tier);
  const v = evalExpr(f.expr).n;
  if (v < 0) return basic.build(r, tier);
  const verb = r.pick(['Calculate', 'What is', 'Find the value of', 'Work out']);
  const text = verb === 'What is' ? `What is ${m(f.tex)}?` : `${verb} ${m(f.tex)}.`;
  const wrongs = f.wrong.filter((w) => Number.isInteger(w) && w !== v).map(commas);
  return {
    text,
    correct: commas(v),
    wrong: [...wrongs, commas(v + 10), commas(v - 10), commas(v + 1)],
    verify: f.expr,
    pad: (d) => commas(v + d),
    asks: 'Work out the value of the expression using the correct order of operations.',
    concept: 'Order of operations: Brackets, then powers, then × and ÷ (left to right), then + and − (left to right).',
    steps: f.steps,
    mistake: 'Working strictly from left to right and ignoring that multiplication, division and brackets have priority.',
    tip: `Remember BODMAS/PEMDAS. ${f.rule}`,
  };
});

const error = T('oo.error', 'oo.basic', 'Order of operations', 'Order of Operations', [2, 4], (r, tier) => {
  const name = r.pick(NAMES);
  const a = r.int(5, 30);
  const b = r.int(2, 9);
  const c = r.int(2, 9);
  const wrongV = (a + b) * c;
  const v = a + b * c;
  const useMinus = tier >= 3 && a > b * c;
  const vv = useMinus ? a - b * c : v;
  const ww = useMinus ? (a - b) * c : wrongV;
  const tex = `${a} ${useMinus ? '-' : '+'} ${b} \\times ${c}`;
  return {
    text: `${name} worked out ${m(tex)} and got ${ww}. ${name}’s answer is not correct. What is the correct value?`,
    correct: String(vv),
    wrong: [String(ww + 1), String(vv + 10), String(vv - 10), String(Math.abs(vv - b))],
    verify: `${a}${useMinus ? '-' : '+'}${b}*${c}`,
    pad: (d) => String(vv + d),
    asks: `Find the mistake in ${name}’s method and give the correct value.`,
    concept: 'Multiplication is done before addition and subtraction unless brackets say otherwise.',
    steps: [`${name} worked left to right and got ${ww}.`, `The correct order is to multiply first: ${b} × ${c} = ${b * c}.`, `Then ${useMinus ? 'subtract' : 'add'}: ${a} ${useMinus ? '−' : '+'} ${b * c} = ${vv}.`],
    mistake: 'Doing the operations in the order they are written instead of the order of operations.',
    tip: 'Underline the multiplication or division first, work it out, then rewrite the expression.',
  };
});

export const orderTemplates = [basic, error];
