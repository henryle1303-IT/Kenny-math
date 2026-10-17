import { Frac } from '../../math/fraction';
import { D, commas, decStr, m, mfrac } from '../h';
import type { Rng } from '../rng';
import type { Tier } from '../types';
import { DIRS_LIST } from './shared';
import { SOLIDS_LIST, SYMMETRY_LIST, SURVEY_LIST } from './shared';
import type { TypedBuilt, TypedTemplate, OtherKind } from './types';
import type { SectionId } from './sections';

const T = (id: string, section: SectionId, skill: string, kind: OtherKind, build: (r: Rng, tier: Tier) => TypedBuilt): TypedTemplate => ({ id, section, skill, kind, build });

const frTex = (n: number, d: number) => m(`\\frac{${n}}{${d}}`);
const num = (n: number) => (Number.isInteger(n) ? commas(n) : String(Math.round(n * 1000) / 1000));
const isPrime = (n: number) => { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };

// ============================== TRUE / FALSE ==================================================================
interface Stmt { text: string; truth: boolean; why: string }
function tfBuild(r: Rng, cands: Stmt[], n: number, concept: string, mistake: string, tip: string): TypedBuilt {
  let pick = r.shuffle(cands).slice(0, n);
  if (pick.every((s) => s.truth) || pick.every((s) => !s.truth)) {
    const want = !pick[0].truth;
    const alt = cands.find((c) => c.truth === want && !pick.includes(c));
    if (!alt) throw new Error('true/false template needs both kinds of statement');
    pick = [...pick.slice(0, n - 1), alt];
    pick = r.shuffle(pick);
  }
  return {
    text: 'Say whether each statement is true or false.',
    asks: 'Decide whether each statement is true or false.',
    concept,
    steps: pick.map((s, i) => `Statement ${i + 1} is ${s.truth ? 'true' : 'false'}: ${s.why}`),
    answer: pick.map((s) => (s.truth ? 'True' : 'False')).join(', '),
    mistake,
    tip,
    verify: null,
    def: { statements: pick.map((s) => ({ text: s.text, truth: s.truth })) },
  };
}
const nStmts = (tier: Tier) => (tier <= 2 ? 2 : 3);

const tfFrac = T('au.tf.fractions', 'S4', 'fr.compare', 'TRUE_FALSE', (r, tier) => {
  const dens = [2, 3, 4, 5, 6, 8, 10, 12];
  const cands: Stmt[] = [];
  for (let i = 0; i < 3; i++) {
    const b = r.pick(dens);
    const d = r.pick(dens);
    const a = r.int(1, b - 1);
    const c = r.int(1, d - 1);
    if (a * d === c * b) continue;
    const bigger = a * d > c * b;
    const askGreater = r.chance(0.5);
    const truth = askGreater ? bigger : !bigger;
    cands.push({ text: `${frTex(a, b)} ${askGreater ? '>' : '<'} ${frTex(c, d)}`, truth, why: `use a common denominator: ${a * d}/${b * d} and ${c * b}/${b * d}, so ${frTex(a, b)} is ${bigger ? 'greater' : 'less'}.` });
  }
  for (let i = 0; i < 2; i++) {
    const b = r.pick([2, 3, 4, 5]);
    const a = r.int(1, b - 1);
    const k = r.int(2, 4);
    const ok = i === 0;
    cands.push({ text: `${frTex(a, b)} = ${frTex(ok ? a * k : a * k + 1, b * k)}`, truth: ok, why: ok ? `multiplying top and bottom by ${k} gives an equal fraction.` : `${frTex(a * k + 1, b * k)} is not made by multiplying both numbers by the same amount.` });
  }
  const b = r.int(2, 9);
  const nn = r.int(b + 1, b * 2 - 1);
  cands.push({ text: `${frTex(nn, b)} is greater than 1 whole`, truth: true, why: `${nn} is bigger than ${b}, so there is more than one whole.` });
  cands.push({ text: `${frTex(b - 1, b)} is greater than 1 whole`, truth: false, why: `${b - 1} is less than ${b}, so it is less than one whole.` });
  return tfBuild(r, cands, nStmts(tier), 'Compare fractions with a common denominator; equal fractions come from multiplying or dividing top and bottom by the same number.', 'Thinking a bigger denominator means a bigger fraction.', 'Change to the same denominator before you compare.');
});

const tfDec = T('au.tf.decimals', 'S5', 'dec.compare', 'TRUE_FALSE', (r, tier) => {
  const cands: Stmt[] = [];
  for (let i = 0; i < 3; i++) {
    const a = r.int(11, 99) / 10;
    const bb = r.int(100, 999) / 1000;
    const x = i % 2 === 0 ? a : Math.round(a * 100) / 100;
    const y = r.chance(0.5) ? Math.round((x + r.pick([0.05, -0.05, 0.5, -0.5])) * 1000) / 1000 : bb;
    if (x === y || y < 0) continue;
    const greater = x > y;
    const askGreater = r.chance(0.5);
    cands.push({ text: `${x} ${askGreater ? '>' : '<'} ${y}`, truth: askGreater ? greater : !greater, why: `write both with the same number of decimal places: ${x.toFixed(3)} and ${y.toFixed(3)}.` });
  }
  const t = r.int(1, 9);
  cands.push({ text: `0.${t}0 = 0.${t}`, truth: true, why: 'a zero on the end of a decimal does not change its value.' });
  cands.push({ text: `0.${t} = 0.0${t}`, truth: false, why: `0.${t} is ${t} tenths but 0.0${t} is only ${t} hundredths.` });
  const u = r.int(2, 8);
  cands.push({ text: `${u}.${u} × 10 = ${u}${u}`, truth: true, why: `multiplying by 10 moves each digit one place left: ${u}.${u} × 10 = ${u}${u}.` });
  cands.push({ text: `${u}.${u} × 10 = ${u}.${u}0`, truth: false, why: `the digits move one place left, so the answer is ${u}${u}, not ${u}.${u}0.` });
  void tier;
  return tfBuild(r, cands, nStmts(tier), 'Line up the decimal places to compare decimals. Multiplying by 10 moves digits one place to the left.', 'Believing a longer decimal is always a bigger number.', 'Give every decimal the same number of places before comparing.');
});

const tfFactors = T('au.tf.factors', 'S3', 'wn.factors', 'TRUE_FALSE', (r, tier) => {
  const hi = tier <= 2 ? 60 : 150;
  const cands: Stmt[] = [];
  for (let i = 0; i < 2; i++) {
    const k = r.int(3, tier <= 2 ? 9 : 12);
    const nn = r.int(k * 2, hi);
    const mult = nn % k === 0;
    cands.push({ text: `${nn} is a multiple of ${k}`, truth: mult, why: mult ? `${k} × ${nn / k} = ${nn}.` : `${nn} ÷ ${k} leaves a remainder of ${nn % k}.` });
  }
  const p = r.int(11, 61);
  cands.push({ text: `${p} is a prime number`, truth: isPrime(p), why: isPrime(p) ? `${p} has only two factors, 1 and ${p}.` : `${p} can be divided by ${[2, 3, 5, 7].find((q) => p % q === 0)}, so it has more than two factors.` });
  const q = r.pick([13, 17, 19, 23, 29, 31, 37, 41, 43, 47]);
  const c = r.pick([21, 27, 33, 39, 49, 51, 57, 63]);
  cands.push({ text: `${q} is a prime number`, truth: true, why: `${q} has only two factors, 1 and ${q}.` });
  cands.push({ text: `${c} is a prime number`, truth: false, why: `${c} = ${[3, 7].find((x) => c % x === 0)} × ${c / ([3, 7].find((x) => c % x === 0) as number)}, so it is composite.` });
  const sq = r.pick([16, 25, 36, 49, 64, 81, 100]);
  const notSq = sq + r.pick([2, 3, 5]);
  cands.push({ text: `${sq} is a square number`, truth: true, why: `${Math.sqrt(sq)} × ${Math.sqrt(sq)} = ${sq}.` });
  cands.push({ text: `${notSq} is a square number`, truth: false, why: `No whole number multiplied by itself makes ${notSq}.` });
  const nn2 = r.pick([24, 30, 36, 40, 42, 48, 60]);
  const f = r.pick([2, 3, 4, 5, 6, 8, 12].filter((x) => nn2 % x === 0));
  cands.push({ text: `${f} is a factor of ${nn2}`, truth: true, why: `${nn2} ÷ ${f} = ${nn2 / f} with no remainder.` });
  const nf = r.pick([7, 9, 11, 13].filter((x) => nn2 % x !== 0));
  cands.push({ text: `${nf} is a factor of ${nn2}`, truth: false, why: `${nn2} ÷ ${nf} leaves a remainder.` });
  return tfBuild(r, cands, nStmts(tier), 'A multiple is in the times table of the number. A factor divides exactly. A prime has exactly two factors.', 'Thinking 1 is prime, or that every odd number is prime.', 'Test small primes 2, 3, 5 and 7 before you decide a number is prime.');
});

const UNITS: [string, string, number][] = [['m', 'cm', 100], ['km', 'm', 1000], ['kg', 'g', 1000], ['L', 'mL', 1000], ['cm', 'mm', 10]];
const tfUnits = T('au.tf.units', 'S8', 'me.convert', 'TRUE_FALSE', (r, tier) => {
  const cands: Stmt[] = [];
  for (const [big, small, f] of r.sample(UNITS, 4)) {
    const q = r.pick(tier <= 2 ? [2, 3, 4, 5, 6, 8] : [0.5, 1.5, 2.5, 3, 7, 12]);
    const v = Math.round(q * f * 100) / 100;
    cands.push({ text: `${q} ${big} = ${num(v)} ${small}`, truth: true, why: `1 ${big} = ${num(f)} ${small}, so ${q} × ${num(f)} = ${num(v)}.` });
    const wrongV = r.pick([v * 10, v / 10, v + f]);
    cands.push({ text: `${q} ${big} = ${num(Math.round(wrongV * 100) / 100)} ${small}`, truth: false, why: `1 ${big} = ${num(f)} ${small}, so ${q} ${big} = ${num(v)} ${small}.` });
  }
  return tfBuild(r, cands, nStmts(tier), 'Metric units change by 10, 100 or 1000. To change to a smaller unit, multiply.', 'Dividing instead of multiplying when changing to a smaller unit.', 'Bigger unit to smaller unit: multiply. Smaller to bigger: divide.');
});

const tfArea = T('au.tf.area', 'S9', 'ge.area', 'TRUE_FALSE', (r, tier) => {
  const l = r.int(4, tier <= 2 ? 12 : 25);
  const w = r.int(2, l - 1);
  const s = r.int(3, 12);
  const cands: Stmt[] = [
    { text: `A rectangle ${l} m long and ${w} m wide has an area of ${l * w} m²`, truth: true, why: `${l} × ${w} = ${l * w}.` },
    { text: `A rectangle ${l} m long and ${w} m wide has an area of ${l + w} m²`, truth: false, why: `area is length × width = ${l * w}, not ${l} + ${w}.` },
    { text: `A rectangle ${l} m long and ${w} m wide has a perimeter of ${2 * (l + w)} m`, truth: true, why: `2 × (${l} + ${w}) = ${2 * (l + w)}.` },
    { text: `A rectangle ${l} m long and ${w} m wide has a perimeter of ${l * w} m`, truth: false, why: `${l * w} is the area. The perimeter is ${2 * (l + w)} m.` },
    { text: `A square with sides of ${s} cm has a perimeter of ${4 * s} cm`, truth: true, why: `4 × ${s} = ${4 * s}.` },
    { text: `A square with sides of ${s} cm has a perimeter of ${2 * s} cm`, truth: false, why: `a square has 4 equal sides: 4 × ${s} = ${4 * s}.` },
    { text: `A cube with edges of ${Math.min(s, 6)} cm has a volume of ${Math.min(s, 6) ** 3} cm³`, truth: true, why: `${Math.min(s, 6)} × ${Math.min(s, 6)} × ${Math.min(s, 6)} = ${Math.min(s, 6) ** 3}.` },
    { text: `A cube with edges of ${Math.min(s, 6)} cm has a volume of ${Math.min(s, 6) * 3} cm³`, truth: false, why: `volume is edge × edge × edge = ${Math.min(s, 6) ** 3}.` },
  ];
  return tfBuild(r, cands, nStmts(tier), 'Area = length × width (in square units). Perimeter is the distance around. Volume = length × width × height (in cubic units).', 'Mixing up area and perimeter.', 'Area covers the inside; perimeter walks around the outside.');
});

function angleClass(a: number): string { return a < 90 ? 'acute' : a === 90 ? 'a right angle' : a < 180 ? 'obtuse' : a === 180 ? 'a straight angle' : a < 360 ? 'reflex' : 'a full turn'; }
const tfAngles = T('au.tf.angles', 'S11', 'ge.angles', 'TRUE_FALSE', (r, tier) => {
  const cands: Stmt[] = [];
  const classes = ['acute', 'a right angle', 'obtuse', 'a straight angle', 'reflex'];
  for (let i = 0; i < 4; i++) {
    const a = r.pick([25, 40, 65, 90, 90, 110, 135, 150, 180, 200, 250, 300]);
    const real = angleClass(a);
    const claim = i % 2 === 0 ? real : r.pick(classes.filter((c) => c !== real));
    cands.push({ text: `An angle of ${a}° is ${claim}`, truth: claim === real, why: `${a}° is ${real}.` });
  }
  cands.push({ text: 'Angles on a straight line add up to 180°', truth: true, why: 'a straight line is half a turn, 180°.' });
  cands.push({ text: 'Angles around a point add up to 180°', truth: false, why: 'a full turn is 360°, so angles around a point add up to 360°.' });
  void tier;
  return tfBuild(r, cands, nStmts(tier), 'Acute < 90°, right angle = 90°, obtuse between 90° and 180°, straight = 180°, reflex between 180° and 360°.', 'Calling a 90° angle acute or obtuse.', 'Compare with a square corner (90°) first.');
});

const tfRound = T('au.tf.round', 'S1', 'wn.round', 'TRUE_FALSE', (r, tier) => {
  const cands: Stmt[] = [];
  const places: [string, number][] = [['ten', 10], ['hundred', 100], ['thousand', 1000]];
  for (let i = 0; i < 4; i++) {
    const n = r.int(tier <= 2 ? 1200 : 12000, tier <= 2 ? 9999 : 489999);
    const [name, unit] = r.pick(places.slice(0, tier <= 2 ? 3 : 3));
    const rounded = Math.round(n / unit) * unit;
    const claim = i % 2 === 0 ? rounded : rounded + r.pick([-1, 1]) * unit;
    cands.push({ text: `${num(n)} rounded to the nearest ${name} is ${num(claim)}`, truth: claim === rounded, why: `look at the digit to the right of the ${name}s place; ${num(n)} is closest to ${num(rounded)}.` });
  }
  const n2 = r.int(4000, 9999);
  const place = ['ones', 'tens', 'hundreds', 'thousands'];
  const digit = String(n2)[0];
  cands.push({ text: `In ${num(n2)}, the digit ${digit} is in the thousands place`, truth: true, why: `${digit} × 1,000 = ${num(Number(digit) * 1000)}.` });
  cands.push({ text: `In ${num(n2)}, the digit ${digit} is in the ${place[2]} place`, truth: false, why: `it is in the thousands place.` });
  return tfBuild(r, cands, nStmts(tier), 'To round, look at the digit to the right of the place you are rounding to: 5 or more rounds up.', 'Rounding down when the next digit is 5 or more.', 'Underline the rounding place, then check the next digit.');
});

const tfPattern = T('au.tf.pattern', 'S7', 'pa.arith', 'TRUE_FALSE', (r, tier) => {
  const s = r.int(2, 20);
  const d = r.int(2, tier <= 2 ? 6 : 12);
  const seq = [s, s + d, s + 2 * d, s + 3 * d];
  const k = r.int(6, 12);
  const cands: Stmt[] = [
    { text: `The pattern ${seq.join(', ')}, … adds ${d} each time`, truth: true, why: `each term is ${d} more than the one before.` },
    { text: `The pattern ${seq.join(', ')}, … adds ${d + 1} each time`, truth: false, why: `the difference between terms is ${d}.` },
    { text: `The next number in ${seq.join(', ')}, … is ${s + 4 * d}`, truth: true, why: `${seq[3]} + ${d} = ${s + 4 * d}.` },
    { text: `The next number in ${seq.join(', ')}, … is ${s + 4 * d + 1}`, truth: false, why: `${seq[3]} + ${d} = ${s + 4 * d}.` },
    { text: `The ${k}th number in ${seq.join(', ')}, … is ${s + (k - 1) * d}`, truth: true, why: `${s} + ${k - 1} × ${d} = ${s + (k - 1) * d}.` },
    { text: `The ${k}th number in ${seq.join(', ')}, … is ${s + k * d}`, truth: false, why: `the ${k}th number is ${s} + ${k - 1} × ${d} = ${s + (k - 1) * d}.` },
  ];
  return tfBuild(r, cands, nStmts(tier), 'In a number pattern, find the rule from the difference between terms.', 'Using the term number instead of the number of steps.', 'The 10th term is 9 steps after the first.');
});

function clock12(totalMin: number): string {
  const h24 = Math.floor(totalMin / 60) % 24;
  const mi = totalMin % 60;
  return `${h24 % 12 === 0 ? 12 : h24 % 12}:${String(mi).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}
const t24 = (total: number) => `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
const tfTime = T('au.tf.time', 'S10', 'ts.clock', 'TRUE_FALSE', (r, tier) => {
  const cands: Stmt[] = [];
  for (let i = 0; i < 3; i++) {
    const total = r.int(1, 23 * 60 + 59);
    const real = clock12(total);
    const wrongT = (total + (r.chance(0.5) ? 12 * 60 : 60)) % 1440;
    const ok = i % 2 === 0;
    cands.push({ text: `${t24(total)} is the same time as ${ok ? real : clock12(wrongT)}`, truth: ok, why: `${t24(total)} is ${real}.` });
  }
  const h = r.int(1, 4);
  const mi = r.pick([10, 15, 20, 30, 40, 45, 50]);
  cands.push({ text: `${h} hours ${mi} minutes is ${h * 60 + mi} minutes`, truth: true, why: `${h} × 60 + ${mi} = ${h * 60 + mi}.` });
  cands.push({ text: `${h} hours ${mi} minutes is ${h * 100 + mi} minutes`, truth: false, why: `1 hour is 60 minutes, so ${h} hours ${mi} minutes is ${h * 60 + mi} minutes.` });
  const start = r.int(8 * 60, 15 * 60);
  const dur = r.pick([45, 75, 100, 135]);
  cands.push({ text: `A movie from ${clock12(start)} to ${clock12(start + dur)} lasts ${Math.floor(dur / 60) ? `${Math.floor(dur / 60)} h ` : ''}${dur % 60} min`.replace(/ 0 min$/, ''), truth: true, why: `count on from the start time: ${dur} minutes.` });
  void tier;
  return tfBuild(r, cands, nStmts(tier), '24-hour times from 13:00 are PM (subtract 12). 1 hour = 60 minutes.', 'Treating an hour as 100 minutes.', 'Think "after noon, subtract 12".');
});

interface Fact { text: string; truth: boolean; why: string }
const SHAPE_FACTS: Fact[] = [
  { text: 'A square has 4 equal sides and 4 right angles', truth: true, why: 'that describes a square.' },
  { text: 'A rectangle has 2 pairs of parallel sides', truth: true, why: 'opposite sides of a rectangle are parallel.' },
  { text: 'A rhombus has 4 equal sides', truth: true, why: 'a rhombus is a "pushed-over square".' },
  { text: 'A trapezium has exactly one pair of parallel sides', truth: true, why: 'that is what makes it a trapezium.' },
  { text: 'A parallelogram has opposite sides that are parallel', truth: true, why: 'that is its definition.' },
  { text: 'A circle has no straight sides', truth: true, why: 'a circle is one curved line.' },
  { text: 'A cylinder has 2 flat circular faces', truth: true, why: 'a cylinder has a circle at each end.' },
  { text: 'A sphere has no edges', truth: true, why: 'a sphere is completely curved.' },
  { text: 'A rectangle always has 4 equal sides', truth: false, why: 'only a square has 4 equal sides; a rectangle has equal opposite sides.' },
  { text: 'A trapezium has 2 pairs of parallel sides', truth: false, why: 'a trapezium has only one pair of parallel sides.' },
  { text: 'A cone has 2 flat faces', truth: false, why: 'a cone has one flat circular face and a curved surface.' },
  { text: 'A rhombus always has 4 right angles', truth: false, why: 'a rhombus can lean over; only a square has 4 right angles.' },
  { text: 'A triangle has 4 vertices', truth: false, why: 'a triangle has 3 vertices.' },
  { text: 'A sphere has 1 flat face', truth: false, why: 'a sphere has no flat faces.' },
];
const tfShapes = T('au.tf.shapes', 'S12', 'au.shapes', 'TRUE_FALSE', (r, tier) => {
  const cands: Stmt[] = [...SHAPE_FACTS];
  for (const s of r.sample(SOLIDS_LIST, 3)) {
    const prop = r.pick(['faces', 'edges', 'vertices'] as const);
    cands.push({ text: `A ${s.name} has ${s[prop]} ${prop}`, truth: true, why: `${s.note}` });
    cands.push({ text: `A ${s.name} has ${s[prop] + r.pick([1, 2, -1])} ${prop}`.replace(/ -?0 /, ' 1 '), truth: false, why: `it has ${s[prop]} ${prop}.` });
  }
  void tier;
  return tfBuild(r, cands, nStmts(tier) + (tier >= 4 ? 1 : 0), 'Know the properties of 2D shapes and 3D objects: sides, parallel lines, right angles, faces, edges and vertices.', 'Mixing up the properties of a square, rectangle and rhombus.', 'Sketch the shape and count carefully.');
});

const tfSym = T('au.tf.symmetry', 'S13', 'au.transform', 'TRUE_FALSE', (r, tier) => {
  const cands: Stmt[] = [];
  for (const [name, n] of r.sample(SYMMETRY_LIST, 3)) {
    cands.push({ text: `A ${name} has ${n} line${n === 1 ? '' : 's'} of symmetry`, truth: true, why: `a ${name} has ${n}.` });
    const w = n + r.pick([1, 2]);
    cands.push({ text: `A ${name} has ${w} lines of symmetry`, truth: false, why: `a ${name} has ${n}, not ${w}.` });
  }
  cands.push({ text: 'A slide of a shape is called a translation', truth: true, why: 'sliding is a translation.' });
  cands.push({ text: 'A flip of a shape is called a reflection', truth: true, why: 'flipping over a mirror line is a reflection.' });
  cands.push({ text: 'A turn of a shape is called a translation', truth: false, why: 'a turn is a rotation.' });
  cands.push({ text: 'A half turn is 90°', truth: false, why: 'a half turn is 180°; a quarter turn is 90°.' });
  void tier;
  return tfBuild(r, cands, nStmts(tier), 'Lines of symmetry fold a shape onto itself. Slide = translation, flip = reflection, turn = rotation.', 'Counting diagonals of a rectangle as lines of symmetry.', 'Fold it in your mind: do both halves match exactly?');
});

const tfMap = T('au.tf.maps', 'S14', 'au.maps', 'TRUE_FALSE', (r, tier) => {
  const cands: Stmt[] = [];
  for (let i = 0; i < 3; i++) {
    const a = r.int(0, 7);
    const ok = i % 2 === 0;
    const b = ok ? (a + 4) % 8 : r.pick([0, 1, 2, 3, 4, 5, 6, 7].filter((x) => x !== (a + 4) % 8 && x !== a));
    cands.push({ text: `${DIRS_LIST[a]} is opposite ${DIRS_LIST[b]}`, truth: ok, why: `the opposite of ${DIRS_LIST[a]} is ${DIRS_LIST[(a + 4) % 8]}.` });
  }
  for (let i = 0; i < 2; i++) {
    const k = r.pick([2, 5, 10, 20]);
    const n = r.int(3, 9);
    const ok = i === 0;
    cands.push({ text: `With a scale of 1 cm to ${k} km, ${n} cm on the map is ${ok ? n * k : n * k + k} km`, truth: ok, why: `${n} × ${k} = ${n * k}.` });
  }
  const from = r.pick([0, 2, 4, 6]);
  cands.push({ text: `Turning clockwise through 90° from ${DIRS_LIST[from]}, you face ${DIRS_LIST[(from + 2) % 8]}`, truth: true, why: `90° is two compass steps clockwise.` });
  cands.push({ text: `Turning clockwise through 90° from ${DIRS_LIST[from]}, you face ${DIRS_LIST[(from + 6) % 8]}`, truth: false, why: `that is the anticlockwise direction.` });
  void tier;
  return tfBuild(r, cands, nStmts(tier), 'Compass points are 45° apart. A map scale tells how far 1 cm stands for.', 'Turning anticlockwise when the question says clockwise.', 'Clockwise goes N → E → S → W.');
});

const tfData = T('au.tf.data', 'S15', 'au.data', 'TRUE_FALSE', (r, tier) => {
  const cats = r.pick(SURVEY_LIST).slice(0, 4);
  const counts = r.shuffle([4, 7, 9, 12, 15, 18, 21]).slice(0, 4);
  const sum = counts.reduce((a, b) => a + b, 0);
  const idx = counts.map((_, i) => i);
  const top = counts.indexOf(Math.max(...counts));
  const low = counts.indexOf(Math.min(...counts));
  const [i, j] = r.sample(idx, 2);
  const table = cats.map((c, k) => `${c} ${counts[k]}`).join(', ');
  const cands: Stmt[] = [
    { text: `${cats[i]} got more votes than ${cats[j]}`, truth: counts[i] > counts[j], why: `${cats[i]} has ${counts[i]} and ${cats[j]} has ${counts[j]}.` },
    { text: `${cats[j]} got more votes than ${cats[i]}`, truth: counts[j] > counts[i], why: `${cats[j]} has ${counts[j]} and ${cats[i]} has ${counts[i]}.` },
    { text: `The total number of votes was ${sum}`, truth: true, why: `${counts.join(' + ')} = ${sum}.` },
    { text: `The total number of votes was ${sum + 10}`, truth: false, why: `${counts.join(' + ')} = ${sum}.` },
    { text: `${cats[top]} was the most popular choice`, truth: true, why: `${cats[top]} has the most votes (${counts[top]}).` },
    { text: `${cats[low]} was the most popular choice`, truth: false, why: `${cats[low]} has the fewest votes (${counts[low]}).` },
  ];
  const b = tfBuild(r, cands, nStmts(tier), 'Read the table carefully: compare values, add them for a total, find the largest and smallest.', 'Reading the wrong row of the table.', 'Point to each number with your finger as you read.');
  return { ...b, text: `A class survey recorded these votes: ${table}. Say whether each statement is true or false.` };
});

export interface Event { text: string; level: string }
export const EVENTS: Event[] = [
  { text: 'The sun rises tomorrow morning', level: 'certain' },
  { text: 'A dropped ball falls to the ground', level: 'certain' },
  { text: 'Rolling a number less than 7 on a standard six-sided die', level: 'certain' },
  { text: 'A spinner with 4 equal colours lands on one of those 4 colours', level: 'certain' },
  { text: 'Rolling a 7 on a standard six-sided die', level: 'impossible' },
  { text: 'You grow a tail tomorrow', level: 'impossible' },
  { text: 'Pulling a green counter from a bag that holds only red counters', level: 'impossible' },
  { text: 'Getting heads when you toss a fair coin', level: 'even chance' },
  { text: 'Rolling an even number on a standard six-sided die', level: 'even chance' },
  { text: 'Picking a red card from a standard deck of cards', level: 'even chance' },
  { text: 'Picking a red marble from a bag of 9 red and 1 blue marbles', level: 'likely' },
  { text: 'Rolling a number greater than 1 on a standard six-sided die', level: 'likely' },
  { text: 'Picking a blue marble from a bag of 9 red and 1 blue marbles', level: 'unlikely' },
  { text: 'Rolling a 1 on a standard six-sided die', level: 'unlikely' },
  { text: 'Tossing two heads in a row with a fair coin', level: 'unlikely' },
];
const LEVEL_WORDS: Record<string, string> = { certain: 'certain', impossible: 'impossible', 'even chance': 'an even chance', likely: 'likely', unlikely: 'unlikely' };
const LEVEL_RANK: Record<string, number> = { impossible: 0, unlikely: 1, 'even chance': 2, likely: 3, certain: 4 };

const tfChance = T('au.tf.chance', 'S16', 'au.chance', 'TRUE_FALSE', (r, tier) => {
  const cands: Stmt[] = [];
  for (const ev of r.sample(EVENTS, 4)) {
    cands.push({ text: `${ev.text} is ${LEVEL_WORDS[ev.level]}`, truth: true, why: `this event is ${LEVEL_WORDS[ev.level]}.` });
    const other = r.pick(Object.keys(LEVEL_WORDS).filter((l) => l !== ev.level));
    cands.push({ text: `${ev.text} is ${LEVEL_WORDS[other]}`, truth: false, why: `it is ${LEVEL_WORDS[ev.level]}, not ${LEVEL_WORDS[other]}.` });
  }
  return tfBuild(r, cands, nStmts(tier), 'Chance words: impossible, unlikely, even chance, likely, certain.', 'Calling an event with a 1 in 6 chance "even".', 'Count the ways it can happen out of all the ways.');
});

// ============================== MULTI SELECT =================================================================
function multiBuild(r: Rng, question: string, pool: { text: string; ok: boolean; why: string }[], n: number, concept: string, mistake: string, tip: string): TypedBuilt {
  const good = r.shuffle(pool.filter((p) => p.ok));
  const bad = r.shuffle(pool.filter((p) => !p.ok));
  const nGood = Math.min(good.length, r.int(2, 3));
  const nBad = n - nGood;
  if (good.length < 2 || bad.length < nBad) throw new Error('multi select pool too small');
  const chosen = r.shuffle([...good.slice(0, nGood), ...bad.slice(0, nBad)]);
  const correct = chosen.map((c, i) => (c.ok ? i : -1)).filter((i) => i >= 0);
  return {
    text: question,
    asks: 'Choose every correct answer.',
    concept,
    steps: chosen.map((c) => `${c.text}: ${c.ok ? 'yes' : 'no'}, ${c.why}`),
    answer: correct.map((i) => chosen[i].text).join(', '),
    mistake,
    tip,
    verify: null,
    def: { options: chosen.map((c) => c.text), correct },
  };
}

const multiMultiples = T('au.multi.multiples', 'S3', 'wn.factors', 'MULTI_SELECT', (r, tier) => {
  const k = r.int(3, tier <= 2 ? 7 : 12);
  const hi = tier <= 2 ? 60 : 130;
  const pool: { text: string; ok: boolean; why: string }[] = [];
  const seen = new Set<number>();
  while (pool.length < 10) {
    const n = r.int(k + 1, hi);
    if (seen.has(n)) continue;
    seen.add(n);
    pool.push({ text: String(n), ok: n % k === 0, why: n % k === 0 ? `${k} × ${n / k} = ${n}.` : `${n} ÷ ${k} has a remainder of ${n % k}.` });
  }
  if (pool.filter((p) => p.ok).length < 2) { for (const mult of [k * 3, k * 4, k * 5]) if (mult <= hi && !seen.has(mult)) pool.push({ text: String(mult), ok: true, why: `${k} × ${mult / k} = ${mult}.` }); }
  return multiBuild(r, `Choose ALL the multiples of ${k}.`, pool, 5, 'A multiple of a number is in its times table.', 'Choosing numbers that are only close to a multiple.', 'Skip count by the number and check each option.');
});

const multiFactors = T('au.multi.factors', 'S3', 'wn.factors', 'MULTI_SELECT', (r, tier) => {
  const nn = r.pick(tier <= 2 ? [12, 18, 20, 24, 30] : [36, 40, 42, 48, 60, 72]);
  const pool: { text: string; ok: boolean; why: string }[] = [];
  for (let d = 2; d <= nn / 2 + 3; d++) if (d !== nn) pool.push({ text: String(d), ok: nn % d === 0, why: nn % d === 0 ? `${nn} ÷ ${d} = ${nn / d}.` : `${nn} ÷ ${d} leaves a remainder.` });
  return multiBuild(r, `Choose ALL the factors of ${nn}.`, pool, 5, 'A factor divides a number exactly with no remainder.', 'Mixing up factors and multiples.', 'Factors come in pairs that multiply to the number.');
});

const multiPrimes = T('au.multi.primes', 'S3', 'wn.primes', 'MULTI_SELECT', (r, tier) => {
  const hi = tier <= 2 ? 30 : 60;
  const pool: { text: string; ok: boolean; why: string }[] = [];
  for (let n = 2; n <= hi; n++) pool.push({ text: String(n), ok: isPrime(n), why: isPrime(n) ? `${n} has only the factors 1 and ${n}.` : `${n} = ${[2, 3, 5, 7].find((q) => n % q === 0)} × ${n / ([2, 3, 5, 7].find((q) => n % q === 0) as number)}.` });
  return multiBuild(r, 'Choose ALL the prime numbers.', pool, 5, 'A prime number has exactly two factors: 1 and itself.', 'Thinking an odd number must be prime (for example 9 or 15).', 'Test 2, 3, 5 and 7 first.');
});

const multiEqualFr = T('au.multi.equalfractions', 'S4', 'fr.forms', 'MULTI_SELECT', (r, tier) => {
  const [a, b] = r.pick(tier <= 2 ? [[1, 2], [1, 3], [3, 4], [2, 3]] : [[2, 5], [3, 5], [5, 6], [3, 8], [2, 3]]);
  const pool: { text: string; ok: boolean; why: string }[] = [];
  for (const k of [2, 3, 4, 5]) {
    pool.push({ text: frTex(a * k, b * k), ok: true, why: `multiply top and bottom of ${frTex(a, b)} by ${k}.` });
    pool.push({ text: frTex(a * k + 1, b * k), ok: false, why: `the top should be ${a * k} to stay equal.` });
    pool.push({ text: frTex(a * k, b * k + 1), ok: false, why: `the bottom should be ${b * k} to stay equal.` });
  }
  return multiBuild(r, `Choose ALL the fractions that are equal to ${frTex(a, b)}.`, pool, 5, 'Equal fractions come from multiplying (or dividing) the top and the bottom by the same number.', 'Adding the same number to the top and bottom.', 'Check that top ÷ bottom gives the same value.');
});

const multiDecGt = T('au.multi.decimals', 'S5', 'dec.compare', 'MULTI_SELECT', (r, tier) => {
  const t = r.pick(tier <= 2 ? [1.5, 2.5, 3.2, 4.5] : [1.25, 2.75, 3.5, 4.05]);
  const pool: { text: string; ok: boolean; why: string }[] = [];
  const seen = new Set<number>();
  let guard = 0;
  while ((pool.length < 12 || pool.filter((p) => p.ok).length < 3 || pool.filter((p) => !p.ok).length < 3) && guard++ < 300) {
    const v = Math.round((t + (r.int(-18, 18) / (tier <= 2 ? 10 : 100))) * 1000) / 1000;
    if (v <= 0 || v === t || seen.has(v)) continue;
    seen.add(v);
    pool.push({ text: String(v), ok: v > t, why: v > t ? `${v} is more than ${t}.` : `${v} is less than ${t}.` });
  }
  return multiBuild(r, `Choose ALL the numbers that are greater than ${t}.`, pool, 5, 'Compare decimals place by place from the left.', 'Thinking more digits means a bigger decimal.', 'Write each decimal with the same number of places.');
});

const multiRound = T('au.multi.rounding', 'S1', 'wn.round', 'MULTI_SELECT', (r, tier) => {
  const unit = tier <= 2 ? 100 : 1000;
  const target = unit === 100 ? r.int(2, 9) * 100 + r.int(0, 3) * 1000 : r.int(2, 9) * 1000 + r.int(1, 3) * 10000;
  const pool: { text: string; ok: boolean; why: string }[] = [];
  const seen = new Set<number>();
  let guard = 0;
  while ((pool.length < 12 || pool.filter((p) => p.ok).length < 3 || pool.filter((p) => !p.ok).length < 3) && guard++ < 400) {
    const n = target + r.int(-unit, unit);
    if (n <= 0 || seen.has(n)) continue;
    seen.add(n);
    const ok = Math.round(n / unit) * unit === target;
    pool.push({ text: num(n), ok, why: ok ? `${num(n)} is closest to ${num(target)}.` : `${num(n)} rounds to ${num(Math.round(n / unit) * unit)}.` });
  }
  return multiBuild(r, `Choose ALL the numbers that round to ${num(target)} when rounded to the nearest ${unit === 100 ? 'hundred' : 'thousand'}.`, pool, 5, 'A number rounds to a target if it is within half a unit of it.', 'Always rounding up.', `Numbers from ${num(target - unit / 2)} up to ${num(target + unit / 2 - 1)} round to ${num(target)}.`);
});

interface Shape2 { name: string; sides: number; parallel: number; right: number; allEqual: boolean }
const SHAPES2: Shape2[] = [
  { name: 'square', sides: 4, parallel: 2, right: 4, allEqual: true },
  { name: 'rectangle', sides: 4, parallel: 2, right: 4, allEqual: false },
  { name: 'rhombus', sides: 4, parallel: 2, right: 0, allEqual: true },
  { name: 'parallelogram', sides: 4, parallel: 2, right: 0, allEqual: false },
  { name: 'trapezium', sides: 4, parallel: 1, right: 0, allEqual: false },
  { name: 'equilateral triangle', sides: 3, parallel: 0, right: 0, allEqual: true },
  { name: 'right-angled triangle', sides: 3, parallel: 0, right: 1, allEqual: false },
  { name: 'regular pentagon', sides: 5, parallel: 0, right: 0, allEqual: true },
  { name: 'regular hexagon', sides: 6, parallel: 3, right: 0, allEqual: true },
];
const multiShapes = T('au.multi.shapes', 'S12', 'au.shapes', 'MULTI_SELECT', (r) => {
  const props: [string, (s: Shape2) => boolean, (s: Shape2) => string][] = [
    ['have exactly 4 sides', (s) => s.sides === 4, (s) => `a ${s.name} has ${s.sides} sides.`],
    ['have at least one pair of parallel sides', (s) => s.parallel >= 1, (s) => `a ${s.name} has ${s.parallel} pair(s) of parallel sides.`],
    ['have at least one right angle', (s) => s.right >= 1, (s) => `a ${s.name} has ${s.right} right angle(s).`],
    ['have all sides equal in length', (s) => s.allEqual, (s) => `${s.allEqual ? 'all' : 'not all'} the sides of a ${s.name} are equal.`],
  ];
  const [phrase, test, why] = r.pick(props);
  const pool = SHAPES2.map((s) => ({ text: s.name, ok: test(s), why: why(s) }));
  return multiBuild(r, `Choose ALL the shapes that ${phrase}.`, pool, 5, 'Know the properties of common 2D shapes.', 'Forgetting that a square is also a rectangle and a rhombus.', 'Sketch each shape and check the property.');
});

const multiUnits = T('au.multi.units', 'S8', 'me.convert', 'MULTI_SELECT', (r, tier) => {
  const q = r.pick(tier <= 2 ? [2, 3, 4, 5] : [1.5, 2.5, 3.5, 6, 7, 12]);
  const mass = r.chance(0.35);
  const pool: { text: string; ok: boolean; why: string }[] = [];
  if (!mass) {
    // target in metres
    pool.push({ text: `${num(q * 100)} cm`, ok: true, why: `${q} m = ${num(q * 100)} cm.` });
    pool.push({ text: `${num(q * 1000)} mm`, ok: true, why: `${q} m = ${num(q * 1000)} mm.` });
    pool.push({ text: `${num(q / 1000)} km`, ok: true, why: `${q} m = ${num(q / 1000)} km.` });
    for (const [v, u] of [[q * 10, 'cm'], [q * 10000, 'mm'], [q * 100, 'mm'], [q / 100, 'km'], [q / 10, 'km'], [q * 1000, 'cm']] as [number, string][]) {
      const ok = false;
      pool.push({ text: `${num(v)} ${u}`, ok, why: `that is not the same length as ${q} m.` });
    }
  } else {
    // target in kilograms
    pool.push({ text: `${num(q * 1000)} g`, ok: true, why: `${q} kg = ${num(q * 1000)} g.` });
    pool.push({ text: `${num(q / 1000)} t`, ok: true, why: `${q} kg = ${num(q / 1000)} tonnes.` });
    pool.push({ text: `${num(q * 1000 * 1000)} mg`, ok: true, why: `${q} kg = ${num(q * 1000000)} mg.` });
    for (const [v, u] of [[q * 100, 'g'], [q * 10000, 'g'], [q / 100, 't'], [q / 10, 't'], [q * 10, 'g'], [q * 100000, 'mg']] as [number, string][]) pool.push({ text: `${num(v)} ${u}`, ok: false, why: `that is not the same mass as ${q} kg.` });
  }
  const seen = new Set<string>();
  const uniq = pool.filter((p) => (seen.has(p.text) ? false : (seen.add(p.text), true)));
  return multiBuild(r, `Choose ALL the measurements that are equal to ${q} ${mass ? 'kg' : 'm'}.`, uniq, 5, 'Metric units change by factors of 10, 100 and 1000.', 'Moving the decimal point the wrong number of places.', 'Convert every option to the same unit.');
});

const multiChance = T('au.multi.chance', 'S16', 'au.chance', 'MULTI_SELECT', (r) => {
  const level = r.pick(['certain', 'impossible', 'unlikely', 'even chance', 'likely']);
  const pool = EVENTS.map((e) => ({ text: e.text, ok: e.level === level, why: `this event is ${LEVEL_WORDS[e.level]}.` }));
  if (pool.filter((p) => p.ok).length < 2) throw new Error('not enough events');
  return multiBuild(r, `Choose ALL the events that are ${LEVEL_WORDS[level]}.`, pool, 5, 'Describe chance with words: impossible, unlikely, even chance, likely, certain.', 'Confusing "unlikely" with "impossible".', 'Think about how many outcomes make the event happen.');
});

const multiSeq = T('au.multi.pattern', 'S7', 'pa.arith', 'MULTI_SELECT', (r, tier) => {
  const s = r.int(2, 12);
  const d = r.int(3, tier <= 2 ? 6 : 9);
  const seq = [s, s + d, s + 2 * d];
  const pool: { text: string; ok: boolean; why: string }[] = [];
  const seen = new Set<number>();
  for (let i = 3; i < 12; i++) {
    const v = s + i * d;
    pool.push({ text: String(v), ok: true, why: `${s} + ${i} × ${d} = ${v}.` });
    seen.add(v);
    const off = v + r.pick([-2, -1, 1, 2]);
    if (!seen.has(off) && (off - s) % d !== 0) { pool.push({ text: String(off), ok: false, why: `${off} is not ${s} plus a multiple of ${d}.` }); seen.add(off); }
  }
  return multiBuild(r, `A number pattern starts ${seq.join(', ')}, … and keeps adding ${d}. Choose ALL the numbers that will be in the pattern.`, pool, 5, 'Every number in an adding pattern is the first number plus a multiple of the step.', 'Choosing numbers that are near the pattern but not on it.', `Check that (number − ${s}) divides by ${d}.`);
});

const multiTime = T('au.multi.time', 'S10', 'ts.clock', 'MULTI_SELECT', (r) => {
  const hour = r.int(13, 22);
  const mi = r.pick([5, 10, 20, 25, 35, 40, 50, 55]);
  const total = hour * 60 + mi;
  const mm2 = String(mi).padStart(2, '0');
  const pool = [
    { text: `${hour}:${mm2}`, ok: true, why: `${hour}:${mm2} is ${clock12(total)}.` },
    { text: `${hour}${mm2} hours`, ok: true, why: `1${String(hour - 10)}${mm2} hours is another way to write ${hour}:${mm2}.`.replace(/^1\d\d\d/, `${hour}${mm2}`) },
    { text: `${String(hour - 12).padStart(2, '0')}:${mm2}`, ok: false, why: `that is ${clock12(total - 720).replace('PM', 'AM')} in the morning.` },
    { text: `${hour - 12}:${mm2} AM`, ok: false, why: `${hour}:${mm2} is in the afternoon or evening: PM.` },
    { text: `${hour - 2}:${mm2}`, ok: false, why: `that is two hours earlier.` },
    { text: `${hour + 1 > 23 ? 23 : hour + 1}:${mm2}`, ok: false, why: `that is an hour later.` },
    { text: `${hour}:${String(60 - mi).padStart(2, '0')}`, ok: mi === 30, why: `the minutes are ${mm2}, not ${60 - mi}.` },
    { text: `${hour - 12}.${mm2} pm`, ok: true, why: `${hour - 12}.${mm2} pm is the same as ${clock12(total)}.` },
  ].filter((p, i, a) => a.findIndex((q) => q.text === p.text) === i);
  return multiBuild(r, `Choose ALL the times that are the same as ${clock12(total)}.`, pool, 5, '24-hour times from 13:00 are PM: subtract 12 for 12-hour time.', 'Forgetting whether it is AM or PM.', 'After noon, add 12 to the hour for 24-hour time.');
});

// ============================== FILL IN THE BLANKS ===============================================================
function fillBuild(text: string, answers: (string | number)[], asks: string, concept: string, steps: string[], mistake: string, tip: string): TypedBuilt {
  return {
    text,
    asks,
    concept,
    steps,
    answer: answers.map((a, i) => `${i + 1}) ${a}`).join(', '),
    mistake,
    tip,
    verify: null,
    def: { blanks: answers.map((a) => ({ accepted: [String(a)] })) },
  };
}
const fillSeq = T('au.fill.sequence', 'S7', 'pa.arith', 'FILL_BLANK', (r, tier) => {
  const step = r.pick(tier <= 2 ? [2, 3, 4, 5] : tier <= 4 ? [6, 7, 8, 9, 11, 12, 15] : [0.5, 1.5, 25, 125, 12, 15]);
  const down = tier >= 3 && r.chance(0.35);
  const start = down ? Math.round((step * 8 + r.int(5, 40)) * 100) / 100 : r.int(1, tier <= 2 ? 12 : 40);
  const terms = Array.from({ length: 7 }, (_, i) => Math.round((down ? start - i * step : start + i * step) * 100) / 100);
  const [h1, h2] = r.pick([[2, 5], [1, 4], [3, 6], [2, 4], [1, 5]]);
  const shown = terms.map((t, i) => (i === h1 ? '{1}' : i === h2 ? '{2}' : String(t)));
  return fillBuild(`Complete the number pattern: ${shown.join(', ')}.`, [terms[h1], terms[h2]], 'Find the rule of the pattern, then fill the missing numbers.', `The pattern ${down ? 'goes down' : 'goes up'} by ${step} each time.`, [`The difference between neighbouring numbers is ${step}.`, `Blank 1: ${terms[h1]}. Blank 2: ${terms[h2]}.`], 'Using the wrong step size for the second gap.', 'Subtract two neighbouring numbers to find the step.');
});

const fillConv = T('au.fill.units', 'S8', 'me.convert', 'FILL_BLANK', (r, tier) => {
  const [one, two] = r.sample(UNITS, 2);
  const mk2 = (u: [string, string, number]) => {
    const q = r.pick(tier <= 2 ? [2, 3, 4, 5, 7] : [0.5, 1.5, 2.5, 3.5, 6, 12]);
    return { q, v: Math.round(q * u[2] * 100) / 100, big: u[0], small: u[1], f: u[2] };
  };
  const a = mk2(one);
  const b = mk2(two);
  return fillBuild(`Convert: ${a.q} ${a.big} = {1} ${a.small} and ${b.q} ${b.big} = {2} ${b.small}.`, [a.v, b.v], 'Change between metric units.', 'To change to a smaller unit, multiply by 10, 100 or 1000.', [`1 ${a.big} = ${num(a.f)} ${a.small}, so ${a.q} × ${num(a.f)} = ${num(a.v)}.`, `1 ${b.big} = ${num(b.f)} ${b.small}, so ${b.q} × ${num(b.f)} = ${num(b.v)}.`], 'Dividing instead of multiplying.', 'Larger unit to smaller unit: multiply.');
});

const fillEquiv = T('au.fill.equivalentfractions', 'S4', 'fr.forms', 'FILL_BLANK', (r, tier) => {
  const b = r.pick([2, 3, 4, 5, 6]);
  const a = r.int(1, b - 1);
  const k1 = r.int(2, tier <= 2 ? 4 : 6);
  const b2 = r.pick([2, 3, 4, 5]);
  const a2 = r.int(1, b2 - 1);
  const k2 = r.int(2, tier <= 2 ? 4 : 6);
  return fillBuild(`Complete these equivalent fractions: ${a}/${b} = {1}/${b * k1} and ${a2 * k2}/${b2 * k2} = ${a2}/{2}.`, [a * k1, b2], 'Find the missing numbers in equal fractions.', 'Multiply or divide the top and the bottom by the same number.', [`${b} × ${k1} = ${b * k1}, so ${a} × ${k1} = ${a * k1}.`, `${a2 * k2} ÷ ${k2} = ${a2}, so ${b2 * k2} ÷ ${k2} = ${b2}.`], 'Changing only the top or only the bottom.', 'Whatever you do to the top, do to the bottom.');
});

const fillPlace = T('au.fill.placevalue', 'S1', 'wn.place', 'FILL_BLANK', (r, tier) => {
  const th = r.int(1, 9) * (tier >= 4 ? 10 : 1) + (tier >= 4 ? r.int(0, 9) : 0);
  const h = r.int(0, 9);
  const t = r.int(0, 9);
  const o = r.int(0, 9);
  const n = th * 1000 + h * 100 + t * 10 + o;
  const hide: [number, number] = r.pick([[0, 3], [1, 2], [0, 2], [1, 3]]);
  const parts = [th, h, t, o];
  const labels = ['thousands', 'hundreds', 'tens', 'ones'];
  const text = `Complete the place value: ${num(n)} = ${parts.map((p, i) => (i === hide[0] ? '{1}' : i === hide[1] ? '{2}' : String(p)) + ' ' + labels[i]).join(' + ')}.`;
  return fillBuild(text, [parts[hide[0]], parts[hide[1]]], 'Split a number into its place values.', 'Each digit is worth its place: thousands, hundreds, tens or ones.', [`${num(n)} has ${th} thousands, ${h} hundreds, ${t} tens and ${o} ones.`], 'Writing the digit in the wrong place.', 'Zero still holds a place.');
});

const fillCoord = T('au.fill.coordinates', 'S13', 'au.transform', 'FILL_BLANK', (r, tier) => {
  const x = r.int(1, 8);
  const y = r.int(3, 9);
  const right = r.int(1, 6);
  const up = r.chance(0.5);
  const v = r.int(1, up ? 5 : Math.min(3, y));
  const nx = x + right;
  const ny = up ? y + v : y - v;
  void tier;
  return fillBuild(`A point at (${x}, ${y}) is moved ${right} to the right and ${v} ${up ? 'up' : 'down'}. Its new position is ({1}, {2}).`, [nx, ny], 'Find the new coordinates after a translation.', 'Right/left changes x. Up/down changes y.', [`x: ${x} + ${right} = ${nx}.`, `y: ${y} ${up ? '+' : '−'} ${v} = ${ny}.`], 'Changing x when the move is up or down.', 'x first, then y: along the corridor, then up the stairs.');
});

const fillTime = T('au.fill.time', 'S10', 'ts.clock', 'FILL_BLANK', (r, tier) => {
  const h = r.int(1, 5);
  const mi = r.pick([10, 15, 20, 30, 40, 45]);
  const pmHour = r.int(1, 11);
  void tier;
  return fillBuild(`${h} hours ${mi} minutes = {1} minutes. ${pmHour} PM is ${'{2}'} o'clock in 24-hour time (type the hour number).`, [h * 60 + mi, pmHour + 12], 'Change between hours, minutes and 24-hour time.', '1 hour = 60 minutes. After noon, add 12 to get 24-hour time.', [`${h} × 60 = ${h * 60}, plus ${mi} = ${h * 60 + mi}.`, `${pmHour} + 12 = ${pmHour + 12}.`], 'Using 100 minutes in an hour.', 'An hour is 60 minutes, not 100.');
});

const fillChange = T('au.fill.money', 'S6', 'au.money', 'FILL_BLANK', (r, tier) => {
  const cost = r.int(1, tier <= 2 ? 4 : 18) + r.int(1, 19) * 5 / 100 + (r.chance(0.5) ? 0 : 0.5 * 0);
  const costR = Math.round(cost * 100) / 100;
  const pay = Math.ceil(costR / 5) * 5 + (tier >= 4 ? 5 : 0);
  const change = Math.round((pay - costR) * 100) / 100;
  const dollars = r.int(5, 40);
  let cents = r.int(1, 99);
  while (cents % 5 === 0) cents = r.int(1, 99);
  const bill = dollars + cents / 100;
  const rounded = Math.round(((dollars * 100 + cents) / 5)) * 5 / 100;
  const f2 = (v: number) => v.toFixed(2);
  return fillBuild(`A pen costs $${f2(costR)} and it is paid for with $${f2(pay)}. The change is $ {1}. A bill of $${f2(bill)} rounded to the nearest 5 cents is $ {2}.`, [f2(change), f2(rounded)], 'Work out change and round a cash total to 5 cents.', 'Change = amount paid − cost. Cash totals round to the nearest 5 cents.', [`${f2(pay)} − ${f2(costR)} = ${f2(change)}.`, `${f2(bill)} is closest to ${f2(rounded)}.`], 'Subtracting the cents incorrectly.', 'Count up from the cost to the amount paid.');
});

const fillMult = T('au.fill.operations', 'S2', 'wn.muldiv', 'FILL_BLANK', (r, tier) => {
  const a = r.int(tier <= 2 ? 3 : 6, tier <= 2 ? 9 : 19);
  const b = r.int(tier <= 2 ? 3 : 12, tier <= 2 ? 9 : 24);
  const c = r.int(3, tier <= 2 ? 9 : 15);
  const d = r.int(4, tier <= 2 ? 12 : 29);
  return fillBuild(`Complete the number sentences: {1} × ${b} = ${a * b} and ${c * d} ÷ {2} = ${c}.`, [a, d], 'Use multiplication and division as opposite operations.', 'Multiplication and division undo each other.', [`${a * b} ÷ ${b} = ${a}.`, `${c * d} ÷ ${c} = ${d}.`], 'Using the wrong operation to find the missing number.', 'To find a missing factor, divide the product by the known factor.');
});

const fillAngle = T('au.fill.angles', 'S11', 'ge.angles', 'FILL_BLANK', (r, tier) => {
  const a = r.int(20, 160);
  const p = r.int(60, 150);
  const q = r.int(60, 360 - p - 40);
  void tier;
  return fillBuild(`On a straight line, ${a}° + {1}° = 180°. Around a point, ${p}° + ${q}° + {2}° = 360°.`, [180 - a, 360 - p - q], 'Find missing angles on a straight line and around a point.', 'Angles on a straight line add to 180°. Angles around a point add to 360°.', [`180 − ${a} = ${180 - a}.`, `360 − ${p} − ${q} = ${360 - p - q}.`], 'Using 180° for angles around a point.', 'Straight line 180°, full turn 360°.');
});

const fillDec = T('au.fill.decimals', 'S5', 'dec.addsub', 'FILL_BLANK', (r, tier) => {
  const x = r.int(1, 9) / 10;
  const y = tier <= 2 ? r.int(11, 99) / 10 : r.int(101, 999) / 100;
  const div = r.chance(0.5);
  const one = `${Math.round((1 - x) * 100) / 100}`;
  return fillBuild(`Complete: ${x} + {1} = 1 and ${div ? `${y} ÷ 10 = {2}` : `${y} × 10 = {2}`}.`, [one, decStr(div ? new Frac(Math.round(y * 1000), 10000) : new Frac(Math.round(y * 1000) * 10, 1000))], 'Use decimals to make 1 and to multiply or divide by 10.', 'Multiplying by 10 moves the digits one place left; dividing by 10 moves them one place right.', [`1 − ${x} = ${one}.`], 'Moving the decimal point the wrong way.', 'Check: the answer to × 10 is bigger, to ÷ 10 is smaller.');
});

// ============================== ORDERING ======================================================================================
function ordBuild(text: string, items: string[], dirText: string, concept: string, mistake: string, tip: string): TypedBuilt {
  return {
    text,
    asks: `Put the items in order, ${dirText}.`,
    concept,
    steps: [`Compare them one pair at a time.`, `The correct order is ${items.join(', ')}.`],
    answer: items.join(', '),
    mistake,
    tip,
    verify: null,
    def: { items },
  };
}
const ordLarge = T('au.order.largenumbers', 'S1', 'wn.place', 'ORDERING', (r, tier) => {
  const digits = tier <= 2 ? [4, 5] : tier <= 4 ? [5, 6] : [6, 7];
  const set = new Set<number>();
  while (set.size < (tier <= 2 ? 4 : 5)) set.add(r.int(10 ** (r.pick(digits) - 1), 10 ** r.pick(digits) - 1));
  const asc = r.chance(0.6);
  const sorted = [...set].sort((a, b) => (asc ? a - b : b - a));
  return ordBuild(`Put these numbers in order from ${asc ? 'smallest to largest' : 'largest to smallest'}.`, sorted.map(num), asc ? 'smallest to largest' : 'largest to smallest', 'Compare the number of digits first, then the digits from the left.', 'Comparing only the last digits.', 'More digits means a bigger number; then compare place by place.');
});

const ordFrac = T('au.order.fractions', 'S4', 'fr.compare', 'ORDERING', (r, tier) => {
  const fam = r.pick([[2, 4, 8], [3, 6, 12], [5, 10], [2, 4], [3, 6]]);
  const set = new Map<string, [number, number]>();
  let guard = 0;
  while (set.size < (tier <= 2 ? 3 : 4) && guard++ < 100) {
    const d = r.pick(fam);
    const n = r.int(1, Math.floor(tier <= 2 ? d - 1 : d * 1.5 - 1));
    const f = new Frac(n, d);
    const key = `${f.n}/${f.d}`;
    if (![...set.values()].some(([a, b]) => new Frac(a, b).eq(f)) && n !== d) set.set(key, [n, d]);
  }
  const arr = [...set.values()];
  if (arr.length < 3) return ordFrac.build(r, tier);
  const asc = r.chance(0.6);
  arr.sort((x, y) => (asc ? new Frac(x[0], x[1]).cmp(new Frac(y[0], y[1])) : new Frac(y[0], y[1]).cmp(new Frac(x[0], x[1]))));
  return ordBuild(`Put these fractions in order from ${asc ? 'smallest to largest' : 'largest to smallest'}.`, arr.map(([n, d]) => frTex(n, d)), asc ? 'smallest to largest' : 'largest to smallest', 'Change the fractions to the same denominator to compare them.', 'Comparing only the bottom numbers.', 'Use equivalent fractions with a common denominator.');
});

const ordDec = T('au.order.decimals', 'S5', 'dec.compare', 'ORDERING', (r, tier) => {
  const set = new Set<number>();
  while (set.size < (tier <= 2 ? 4 : 5)) set.add(Math.round(r.int(1, 99) * (tier <= 2 ? 1 : r.pick([1, 10, 100])) ) / (tier <= 2 ? 10 : 100) + (tier <= 2 ? 0 : r.int(0, 9) / 1000));
  const vals = [...set].map((v) => Math.round(v * 1000) / 1000);
  const asc = r.chance(0.6);
  const sorted = vals.sort((a, b) => (asc ? a - b : b - a));
  return ordBuild(`Put these decimals in order from ${asc ? 'smallest to largest' : 'largest to smallest'}.`, sorted.map((v) => String(v)), asc ? 'smallest to largest' : 'largest to smallest', 'Give each decimal the same number of places, then compare.', 'Thinking 0.45 is bigger than 0.5 because 45 is bigger than 5.', 'Write 0.5 as 0.50 to compare with 0.45.');
});

const ordUnits = T('au.order.units', 'S8', 'me.convert', 'ORDERING', (r, tier) => {
  const mmV = new Set<number>();
  const items: { mm: number; text: string }[] = [];
  while (items.length < (tier <= 2 ? 3 : 4)) {
    const kind = r.pick(['m', 'cm', 'mm'] as const);
    const v = kind === 'm' ? r.pick([0.5, 0.8, 1.2, 1.5, 2, 2.4]) : kind === 'cm' ? r.int(20, 240) : r.int(150, 2400);
    const mmVal = Math.round((kind === 'm' ? v * 1000 : kind === 'cm' ? v * 10 : v) * 10) / 10;
    if (mmV.has(mmVal)) continue;
    mmV.add(mmVal);
    items.push({ mm: mmVal, text: `${num(v)} ${kind}`.replace(/^(\d+)\.0 /, '$1 ') });
  }
  items.sort((a, b) => a.mm - b.mm);
  return ordBuild('Put these lengths in order from shortest to longest.', items.map((i) => i.text), 'shortest to longest', 'Change every length to the same unit before comparing.', 'Comparing the numbers without the units.', '1 m = 100 cm = 1,000 mm.');
});

const ordTime = T('au.order.durations', 'S10', 'ts.clock', 'ORDERING', (r, tier) => {
  const mins = new Set<number>();
  const items: { mi: number; text: string }[] = [];
  while (items.length < (tier <= 2 ? 3 : 4)) {
    const mi = r.int(40, 190);
    if (mins.has(mi)) continue;
    mins.add(mi);
    const style = r.int(0, 2);
    const h = Math.floor(mi / 60);
    const rest = mi % 60;
    const text = style === 0 || h === 0 ? `${mi} minutes` : style === 1 ? `${h} h ${rest} min` : mi % 30 === 0 ? `${mi / 60} hours`.replace(/^(\d+)\.5 /, '$1½ ') : `${mi} minutes`;
    items.push({ mi, text });
  }
  items.sort((a, b) => a.mi - b.mi);
  return ordBuild('Put these times in order from shortest to longest.', items.map((i) => i.text), 'shortest to longest', 'Change every time to minutes before you compare.', 'Treating an hour as 100 minutes.', '1 hour = 60 minutes.');
});

const ordChance = T('au.order.chance', 'S16', 'au.chance', 'ORDERING', (r, tier) => {
  const levels = r.sample(['impossible', 'unlikely', 'even chance', 'likely', 'certain'], tier <= 2 ? 3 : 4).sort((a, b) => LEVEL_RANK[a] - LEVEL_RANK[b]);
  const events = levels.map((l) => r.pick(EVENTS.filter((e) => e.level === l)));
  const asc = true;
  void asc;
  return ordBuild('Put these events in order from least likely to most likely.', events.map((e) => e.text), 'least likely to most likely', 'Impossible, unlikely, even chance, likely, certain: the chance gets bigger.', 'Mixing up unlikely and impossible.', 'Think about how many ways each event can happen.');
});

const ordAngles = T('au.order.angles', 'S11', 'ge.angles', 'ORDERING', (r, tier) => {
  const pool: { deg: number; text: string }[] = [
    { deg: 90, text: 'a right angle' }, { deg: 180, text: 'a straight angle' }, { deg: 360, text: 'a full turn' }, { deg: 270, text: 'a three-quarter turn' },
    ...[20, 35, 55, 75, 120, 140, 165, 200, 240, 300].map((d) => ({ deg: d, text: `${d}°` })),
  ];
  const picked = r.sample(pool, tier <= 2 ? 4 : 5).sort((a, b) => a.deg - b.deg);
  return ordBuild('Put these angles in order from smallest to largest.', picked.map((p) => p.text), 'smallest to largest', 'Right angle = 90°, straight angle = 180°, three-quarter turn = 270°, full turn = 360°.', 'Forgetting the size of a straight angle or a full turn.', 'Change every angle to degrees first.');
});

// ============================== SHORT TEXT ======================================================================================
const shortFacts: [SectionId, string, string, string[], string][] = [
  ['S12', 'What is the name of a 2D shape with 5 sides?', 'au.shapes', ['pentagon'], 'A shape with five sides is a pentagon.'],
  ['S12', 'What is the name of a 2D shape with 6 sides?', 'au.shapes', ['hexagon'], 'A shape with six sides is a hexagon.'],
  ['S12', 'What is the name of a 2D shape with 7 sides?', 'au.shapes', ['heptagon'], 'A shape with seven sides is a heptagon.'],
  ['S12', 'What is the name of a 2D shape with 8 sides?', 'au.shapes', ['octagon'], 'A shape with eight sides is an octagon.'],
  ['S12', 'What is the name of a 2D shape with 10 sides?', 'au.shapes', ['decagon'], 'A shape with ten sides is a decagon.'],
  ['S12', 'Which 3D object has 6 square faces?', 'au.shapes', ['cube'], 'A cube has 6 identical square faces.'],
  ['S12', 'Which 3D object has a circular base and one pointed top (apex)?', 'au.shapes', ['cone'], 'A cone has a circular base and a point.'],
  ['S12', 'Which 3D object is perfectly round like a ball?', 'au.shapes', ['sphere'], 'A sphere is a round ball shape.'],
  ['S12', 'Which 3D object has 2 triangular ends and 3 rectangular faces?', 'au.shapes', ['triangular prism'], 'A triangular prism has 2 triangles and 3 rectangles.'],
  ['S12', 'Which 3D object has a square base and 4 triangular faces?', 'au.shapes', ['square pyramid', 'pyramid'], 'A square pyramid has a square base and 4 triangles.'],
  ['S12', 'Which quadrilateral has 4 equal sides but no right angles?', 'au.shapes', ['rhombus'], 'A rhombus has 4 equal sides; its angles are not right angles.'],
  ['S12', 'Which quadrilateral has exactly one pair of parallel sides?', 'au.shapes', ['trapezium'], 'A trapezium has exactly one pair of parallel sides.'],
  ['S12', 'Which quadrilateral has two pairs of parallel sides and no right angles?', 'au.shapes', ['parallelogram'], 'A parallelogram has opposite sides parallel.'],
  ['S12', 'Which 3D object has 2 flat circular faces and a curved surface?', 'au.shapes', ['cylinder'], 'A cylinder has a circle at each end.'],
  ['S11', 'What do we call an angle that is smaller than 90°?', 'ge.angles', ['acute'], 'Angles smaller than 90° are acute.'],
  ['S11', 'What do we call an angle that is bigger than 90° but smaller than 180°?', 'ge.angles', ['obtuse'], 'Angles between 90° and 180° are obtuse.'],
  ['S11', 'What do we call an angle of exactly 90°?', 'ge.angles', ['right angle', 'right'], 'An angle of 90° is a right angle.'],
  ['S11', 'What do we call an angle of exactly 180°?', 'ge.angles', ['straight angle', 'straight'], 'An angle of 180° is a straight angle.'],
  ['S11', 'What do we call an angle bigger than 180° but smaller than 360°?', 'ge.angles', ['reflex'], 'Angles between 180° and 360° are reflex.'],
  ['S14', 'Which compass direction is opposite North?', 'au.maps', ['south'], 'South is opposite North.'],
  ['S14', 'Which compass direction is opposite East?', 'au.maps', ['west'], 'West is opposite East.'],
  ['S14', 'Which compass direction is halfway between North and East?', 'au.maps', ['north-east', 'north east', 'northeast'], 'Halfway between North and East is North-East.'],
  ['S14', 'What is the name for the list on a map that explains what the symbols mean?', 'au.maps', ['key', 'legend'], 'The key (or legend) explains the map symbols.'],
  ['S16', 'What word do we use for an event that cannot happen?', 'au.chance', ['impossible'], 'An event that cannot happen is impossible.'],
  ['S16', 'What word do we use for an event that must happen?', 'au.chance', ['certain'], 'An event that must happen is certain.'],
  ['S16', 'What word do we use for an event that has a 1 in 2 chance (two words)?', 'au.chance', ['even chance', 'equal chance'], 'A 1 in 2 chance is an even chance.'],
  ['S15', 'In a set of data, what do we call the value that appears most often?', 'au.data', ['mode'], 'The value that appears most often is the mode.'],
  ['S15', 'What do we call a chart that uses marks grouped in fives to count (one word)?', 'au.data', ['tally'], 'A tally chart groups marks in fives.'],
  ['S13', 'What is the name of a transformation that flips a shape over a line?', 'au.transform', ['reflection'], 'Flipping a shape over a mirror line is a reflection.'],
  ['S13', 'What is the name of a transformation that slides a shape without turning it?', 'au.transform', ['translation'], 'Sliding a shape is a translation.'],
  ['S13', 'What is the name of a transformation that turns a shape around a point?', 'au.transform', ['rotation'], 'Turning a shape around a point is a rotation.'],
  ['S9', 'What do we call the distance around the outside of a 2D shape?', 'ge.perimeter', ['perimeter'], 'The distance around a shape is its perimeter.'],
  ['S9', 'What do we call the amount of surface inside a 2D shape?', 'ge.area', ['area'], 'The surface inside a 2D shape is its area.'],
  ['S9', 'What do we call the amount of space inside a 3D object?', 'ge.volume', ['volume'], 'The space inside a 3D object is its volume.'],
  ['S3', 'What do we call a number that has exactly two factors, 1 and itself?', 'wn.factors', ['prime', 'prime number'], 'A number with exactly two factors is prime.'],
  ['S3', 'What do we call a number that has more than two factors?', 'wn.factors', ['composite', 'composite number'], 'A number with more than two factors is composite.'],
  ['S1', 'In the number 4,305, what is the name of the place where the digit 3 sits?', 'wn.place', ['hundreds', 'hundred'], 'The 3 in 4,305 is in the hundreds place.'],
  ['S1', 'In the number 56,200, what is the name of the place where the digit 6 sits?', 'wn.place', ['thousands', 'thousand'], 'The 6 in 56,200 is in the thousands place.'],
  ['S5', 'In the decimal 3.47, what is the name of the place where the digit 4 sits?', 'dec.place', ['tenths', 'tenth'], 'The 4 in 3.47 is in the tenths place.'],
  ['S5', 'In the decimal 3.47, what is the name of the place where the digit 7 sits?', 'dec.place', ['hundredths', 'hundredth'], 'The 7 in 3.47 is in the hundredths place.'],
  ['S4', 'What is the top number of a fraction called?', 'fr.forms', ['numerator'], 'The top number is the numerator.'],
  ['S4', 'What is the bottom number of a fraction called?', 'fr.forms', ['denominator'], 'The bottom number is the denominator.'],
  ['S10', 'How many minutes are in a quarter of an hour? Write it in words (for example "twenty").', 'ts.convert', ['fifteen'], 'A quarter of 60 minutes is fifteen minutes.'],
  ['S8', 'What is the metric unit used to measure the mass of a small bag of sugar: grams or litres? Type the unit.', 'me.convert', ['grams', 'gram', 'g'], 'Mass is measured in grams (g) or kilograms (kg).'],
];
const shortTemplates: TypedTemplate[] = shortFacts.map(([section, text, skill, accepted, expl], i) =>
  T(`au.short.${String(i + 1).padStart(2, '0')}`, section, skill, 'SHORT_TEXT', () => ({
    text,
    asks: 'Answer with the correct word.',
    concept: expl,
    steps: [expl],
    answer: accepted[0],
    mistake: 'Mixing up two words with similar meanings.',
    tip: 'Say the word in a sentence to check it.',
    verify: null,
    def: { accepted },
  })),
);

export const AU_TYPED: TypedTemplate[] = [
  tfFrac, tfDec, tfFactors, tfUnits, tfArea, tfAngles, tfRound, tfPattern, tfTime, tfShapes, tfSym, tfMap, tfData, tfChance,
  multiMultiples, multiFactors, multiPrimes, multiEqualFr, multiDecGt, multiRound, multiShapes, multiUnits, multiChance, multiSeq, multiTime,
  fillSeq, fillConv, fillEquiv, fillPlace, fillCoord, fillTime, fillChange, fillMult, fillAngle, fillDec,
  ordLarge, ordFrac, ordDec, ordUnits, ordTime, ordChance, ordAngles,
  ...shortTemplates,
];
void D;
void mfrac;
