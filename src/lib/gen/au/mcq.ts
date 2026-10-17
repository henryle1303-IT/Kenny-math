import { Frac } from '../../math/fraction';
import { m, mfrac, mf, mm, money, NAMES } from '../h';
import type { Rng } from '../rng';
import type { Built, Tier } from '../types';
import type { AuMcq } from './types';

const nm = (r: Rng) => r.pick(NAMES);
const deg = (n: number) => `${n}°`;
const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

const mk = (id: string, section: AuMcq['section'], skill: string, build: (r: Rng, tier: Tier) => Built, typeable = true): AuMcq => ({ id, section, skill, typeable, build });

// ---- S4 fractions with related denominators -------------------------------------------------------------
const fracAddRel = mk('au.fr.addrel', 'S4', 'fr.addsub', (r, tier) => {
  const b = r.pick(tier <= 2 ? [2, 3, 4, 5] : [2, 3, 4, 5, 6]);
  const k = r.int(2, tier <= 2 ? 3 : 4);
  const d = b * k;
  const a = r.int(1, b - 1);
  const c = r.int(1, d - 1);
  const f1 = new Frac(a, b);
  const f2 = new Frac(c, d);
  const sum = f1.add(f2);
  return {
    text: `Calculate ${mfrac(a, b)} + ${mfrac(c, d)}. Give your answer in simplest form (use a mixed number if needed).`,
    correct: mm(sum),
    wrong: [mfrac(a + c, b + d), mfrac(a + c, d), mfrac(a + c, b), mm(sum.add(new Frac(1, d)))],
    verify: `${a}/${b}+${c}/${d}`,
    asks: 'Add two fractions whose denominators are related.',
    concept: `${d} is a multiple of ${b}, so change ${m(`\\frac{${a}}{${b}}`)} to an equivalent fraction with denominator ${d}.`,
    steps: [`${m(`\\frac{${a}}{${b}}`)} = ${m(`\\frac{${a * k}}{${d}}`)} (multiply top and bottom by ${k}).`, `${m(`\\frac{${a * k}}{${d}}`)} + ${m(`\\frac{${c}}{${d}}`)} = ${m(`\\frac{${a * k + c}}{${d}}`)}.`, `Simplify (and write as a mixed number if the top is bigger than the bottom) to get ${mm(sum)}.`],
    mistake: 'Adding the numerators and the denominators, for example 1/2 + 1/4 = 2/6.',
    tip: 'Make the denominators the same first. Only the numerators are added.',
    pad: (delta) => mm(sum.add(new Frac(delta, d))),
  };
});

const fracSubRel = mk('au.fr.subrel', 'S4', 'fr.addsub', (r, tier) => {
  const b = r.pick(tier <= 2 ? [2, 3, 4, 5] : [2, 3, 4, 5, 6]);
  const k = r.int(2, tier <= 2 ? 3 : 4);
  const d = b * k;
  const a = r.int(1, b - 1);
  const w = tier >= 4 ? r.int(2, 5) : 0;
  const big = new Frac(w * b + a, b);
  const maxC = w > 0 ? d - 1 : a * k - 1;
  if (maxC < 1) return fracSubRel.build(r, tier);
  const c = r.int(1, maxC);
  const small = new Frac(c, d);
  const diff = big.sub(small);
  const bigTeX = w > 0 ? m(`${w}\\frac{${a}}{${b}}`) : mfrac(a, b);
  return {
    text: `Calculate ${bigTeX} − ${mfrac(c, d)}. Give your answer in simplest form (use a mixed number if needed).`,
    correct: mm(diff),
    wrong: [mfrac(Math.max(1, a - c), Math.abs(b - d) || 1), mm(diff.add(new Frac(1, d))), mm(big.add(small)), mm(diff.sub(new Frac(1, d)))],
    verify: `${w * b + a}/${b}-${c}/${d}`,
    asks: 'Subtract fractions whose denominators are related.',
    concept: `${d} is a multiple of ${b}, so rewrite the first fraction with denominator ${d} before subtracting.`,
    steps: [`${bigTeX} = ${mf(new Frac(big.n * k, big.d * k))} (denominator ${d}).`, `Subtract the numerators: ${big.n * k} − ${c} = ${big.n * k - c}.`, `Simplify: ${mm(diff)}.`],
    mistake: 'Subtracting the denominators as well as the numerators.',
    tip: 'Same denominators first. Then subtract the numerators only.',
    pad: (delta) => mm(diff.add(new Frac(delta, d))),
  };
});

// ---- S6 money ---------------------------------------------------------------------------------------------
const moneyRound5 = mk('au.money.round5', 'S6', 'au.money', (r, tier) => {
  const dollars = tier <= 2 ? r.int(3, 19) : r.int(12, 189);
  let cents = r.int(1, 99);
  while (cents % 5 === 0) cents = r.int(1, 99);
  const total = dollars * 100 + cents;
  const rounded = Math.round(total / 5) * 5;
  const down = Math.floor(total / 5) * 5;
  const up = down + 5;
  const other = rounded === down ? up : down;
  const who = nm(r);
  const f = (c: number) => money(new Frac(c, 100));
  return {
    text: `${who}'s shopping bill is ${f(total)}. ${who} pays with cash. In Australia, a cash total is rounded to the nearest 5 cents. How much does ${who} pay?`,
    correct: f(rounded),
    wrong: [f(other), f(total), f(Math.floor(total / 10) * 10 + 10 === rounded ? Math.floor(total / 10) * 10 : Math.floor(total / 10) * 10 + 10), f(rounded + 10), f(rounded - 10)],
    verify: `${rounded}/100`,
    asks: 'Round a money total to the nearest 5 cents.',
    concept: 'Cash amounts in Australia are rounded to the nearest 5 cents: 1 and 2 cents round down, 3 and 4 cents round up (to the next 5 or 10).',
    steps: [`The bill is ${f(total)}; look at the last digit of the cents, ${total % 10}.`, `It is closer to ${f(rounded)} than to ${f(other)}.`],
    mistake: 'Rounding to the nearest 10 cents, or not rounding at all.',
    tip: 'Last digit 1, 2, 6 or 7 goes down; 3, 4, 8 or 9 goes up.',
    pad: (d) => f(rounded + d * 5),
  };
});

const moneyDiscount = mk('au.money.discount', 'S6', 'au.money', (r, tier) => {
  const pct = tier <= 1 ? 50 : tier <= 3 ? r.pick([50, 25, 10]) : r.pick([25, 10, 75]);
  const unit = pct === 50 ? 2 : pct === 25 ? 4 : pct === 75 ? 4 : 10;
  const price = unit * r.int(Math.ceil((tier <= 2 ? 6 : 12) / unit), Math.floor((tier <= 2 ? 40 : 60) / unit));
  const off = (price * pct) / 100;
  const sale = price - off;
  const item = r.pick(['a cap', 'a backpack', 'a pair of sandals', 'a cricket bat', 'a skateboard helmet', 'a soccer ball', 'a drink bottle']);
  const f = (v: number) => money(new Frac(Math.round(v * 100), 100));
  return {
    text: `${item.charAt(0).toUpperCase() + item.slice(1)} costs ${f(price)}. It is on sale for ${pct}% off. What is the sale price?`,
    correct: f(sale),
    wrong: [f(off), f(price - pct), f(price + off), f(sale + off / 2)],
    verify: `${price}-${price}*${pct}/100`,
    asks: `Find the price after a ${pct}% discount.`,
    concept: pct === 50 ? '50% is a half, so halve the price.' : pct === 25 ? '25% is a quarter: halve and halve again.' : pct === 10 ? '10% is one tenth: divide by 10.' : '75% is three quarters; take off a quarter.',
    steps: [`${pct}% of ${f(price)} = ${f(off)}.`, `${f(price)} − ${f(off)} = ${f(sale)}.`],
    mistake: 'Giving the amount of the discount instead of the new price.',
    tip: 'Work out the discount first, then subtract it from the original price.',
    pad: (d) => f(sale + d),
  };
});

// ---- S10 time ---------------------------------------------------------------------------------------------
function clock12(totalMin: number): string {
  const h24 = Math.floor(totalMin / 60) % 24;
  const mi = totalMin % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(mi).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}
const time24 = mk('au.time.24h', 'S10', 'ts.clock', (r, tier) => {
  const pm = r.chance(0.8);
  const h24 = pm ? r.int(13, 23) : r.int(0, 11);
  const minute = tier <= 1 ? 0 : tier <= 3 ? r.pick([0, 15, 30, 45]) : r.int(1, 59);
  const total = h24 * 60 + minute;
  const t24 = `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const other = (total + 12 * 60) % (24 * 60);
  return {
    text: `A train timetable shows a departure at ${t24}. What time is that in 12-hour time?`,
    correct: clock12(total),
    wrong: [clock12(other), clock12((total + 60) % 1440), clock12((total + 1440 - 60) % 1440), clock12((total + 10 * 60) % 1440)],
    verify: String(total),
    asks: 'Change a 24-hour time to 12-hour time with AM or PM.',
    concept: '24-hour times from 13:00 onwards are PM: subtract 12 hours. 00:xx is 12:xx AM and 12:xx is 12:xx PM.',
    steps: h24 >= 13 ? [`${h24} − 12 = ${h24 - 12}.`, `So ${t24} is ${clock12(total)}.`] : [`${t24} is before noon, so it is AM${h24 === 0 ? ' (00 hours is 12 AM)' : ''}.`, `So ${t24} is ${clock12(total)}.`],
    mistake: 'Writing AM instead of PM, or forgetting to subtract 12 hours.',
    tip: 'After noon, subtract 12 from the hour and write PM.',
    pad: (d) => clock12((total + d * 15 + 1440) % 1440),
  };
}, false);

const timeMinutes = mk('au.time.minutes', 'S10', 'ts.clock', (r, tier) => {
  const start = r.int(6 * 60, 15 * 60 + 40);
  const dur = tier <= 2 ? r.int(12, 55) : r.int(65, 190);
  const end = start + dur;
  const who = nm(r);
  const place = r.pick(['Central', 'Parramatta', 'Richmond', 'Southbank', 'Fremantle', 'Glenelg']);
  return {
    text: `${who}'s tram leaves ${place} at ${clock12(start).replace(' ', ' ')} and arrives at ${clock12(end)}. How many minutes does the trip take?`,
    correct: `${dur} minutes`,
    wrong: [`${dur + 10} minutes`, `${dur - 10} minutes`, `${dur + 40} minutes`, `${Math.max(1, dur - 40)} minutes`],
    verify: String(dur),
    asks: 'Find how much time passes between two clock times.',
    concept: 'Count on from the first time to the next hour, then to the finish time.',
    steps: [`From ${clock12(start)} to ${clock12(end)}.`, `${dur} minutes pass.`],
    mistake: 'Subtracting the minutes only, or treating 60 minutes as 100.',
    tip: 'Count on to the next hour, then add the remaining minutes.',
    pad: (d) => `${dur + d} minutes`,
  };
});

// ---- S11 angles ----------------------------------------------------------------------------------------------
const anglePoint = mk('au.angle.point', 'S11', 'ge.angles', (r, tier) => {
  const parts = tier <= 2 ? 2 : 3;
  const known: number[] = [];
  let left = 360;
  for (let i = 0; i < parts; i++) {
    const v = r.int(40, tier <= 2 ? 160 : 110);
    known.push(v);
    left -= v;
  }
  if (left < 20) return anglePoint.build(r, tier);
  const names = known.map(deg).join(', ');
  return {
    text: `Angles around a point add up to 360°. ${parts === 2 ? 'Two angles are' : 'Three angles are'} ${names}. The angle that completes the turn is x. What is x?`,
    correct: deg(left),
    wrong: [deg(180 - (360 - left) + 180 > 0 ? Math.abs(180 - known.reduce((a, b) => a + b, 0)) || 10 : 10), deg(left + 20), deg(left - 20), deg(360 - known[0])],
    verify: `360-${known.join('-')}`,
    asks: 'Find a missing angle around a point.',
    concept: 'A full turn is 360°, so all the angles around one point add to 360°.',
    steps: [`Add the known angles: ${known.join(' + ')} = ${known.reduce((a, b) => a + b, 0)}.`, `360 − ${known.reduce((a, b) => a + b, 0)} = ${left}.`],
    mistake: 'Subtracting from 180° instead of 360°.',
    tip: 'Straight line = 180°. Full turn around a point = 360°.',
    pad: (d) => deg(left + d * 5),
  };
});

const angleRight = mk('au.angle.right', 'S11', 'ge.angles', (r) => {
  const a = r.int(12, 78);
  return {
    text: `A right angle is split into two angles. One of them is ${deg(a)}. What is the size of the other angle?`,
    correct: deg(90 - a),
    wrong: [deg(180 - a), deg(a), deg(90 + a), deg(100 - a)],
    verify: `90-${a}`,
    asks: 'Find an angle inside a right angle.',
    concept: 'A right angle is 90°.',
    steps: [`90 − ${a} = ${90 - a}.`],
    mistake: 'Using 180° (a straight line) instead of 90° (a right angle).',
    tip: 'A right angle is a square corner and measures 90°.',
    pad: (d) => deg(90 - a + d * 3),
  };
});

// ---- S12 shapes ------------------------------------------------------------------------------------------------
interface Solid { name: string; faces: number; edges: number; vertices: number; hard: boolean; note: string }
const solids = (): Solid[] => {
  const prism = (n: number, nm2: string, hard: boolean): Solid => ({ name: `${nm2} prism`, faces: n + 2, edges: 3 * n, vertices: 2 * n, hard, note: `A ${nm2} prism has 2 ${nm2} ends and ${n} rectangular sides.` });
  const pyr = (n: number, nm2: string, hard: boolean): Solid => ({ name: `${nm2} pyramid`, faces: n + 1, edges: 2 * n, vertices: n + 1, hard, note: `A ${nm2} pyramid has a ${nm2} base and ${n} triangular faces.` });
  return [
    { name: 'cube', faces: 6, edges: 12, vertices: 8, hard: false, note: 'A cube has 6 square faces.' },
    { name: 'rectangular prism', faces: 6, edges: 12, vertices: 8, hard: false, note: 'A rectangular prism has 6 rectangular faces.' },
    prism(3, 'triangular', false), pyr(4, 'square', false), pyr(3, 'triangular', false),
    prism(5, 'pentagonal', true), prism(6, 'hexagonal', true), pyr(5, 'pentagonal', true), pyr(6, 'hexagonal', true), prism(8, 'octagonal', true),
  ];
};
export const SOLIDS = solids;

const shapeCounts = mk('au.shape.counts', 'S12', 'au.shapes', (r, tier) => {
  const pool = solids().filter((s) => tier >= 3 || !s.hard);
  const s = r.pick(pool);
  const prop = r.pick(['faces', 'edges', 'vertices'] as const);
  const val = s[prop];
  const others = (['faces', 'edges', 'vertices'] as const).filter((p) => p !== prop).map((p) => s[p]);
  return {
    text: `How many ${prop} does a ${s.name} have?`,
    correct: String(val),
    wrong: [String(others[0]), String(others[1]), String(val + 1), String(Math.max(1, val - 1)), String(val + 2)],
    verify: String(val),
    asks: `Count the ${prop} of a 3D object.`,
    concept: `${s.note} Faces are the flat surfaces, edges are where two faces meet, and vertices are the corners.`,
    steps: [`Faces: ${s.faces}, edges: ${s.edges}, vertices: ${s.vertices}.`, `The question asks for the ${prop}: ${val}.`],
    mistake: 'Mixing up faces, edges and vertices, or missing the hidden ones at the back.',
    tip: 'Check with Euler: faces + vertices − edges = 2.',
    pad: (d) => String(val + d),
  };
});

const POLY = [['triangle', 3], ['quadrilateral', 4], ['pentagon', 5], ['hexagon', 6], ['heptagon', 7], ['octagon', 8], ['nonagon', 9], ['decagon', 10]] as const;
const shapeSides = mk('au.shape.sides', 'S12', 'au.shapes', (r, tier) => {
  if (tier <= 2) {
    const [name, n] = r.pick(POLY.slice(2));
    return { text: `How many sides does a ${name} have?`, correct: String(n), wrong: [String(n - 1), String(n + 1), String(n + 2), String(n - 2)], verify: String(n), asks: 'Know the number of sides of a polygon.', concept: `The name ${name} tells you the number of sides: ${n}.`, steps: [`A ${name} has ${n} sides.`], mistake: 'Mixing up hexagon (6) and octagon (8).', tip: 'Penta 5, hexa 6, hepta 7, octa 8, nona 9, deca 10.', pad: (d) => String(n + d) };
  }
  const [n1, n2] = r.sample(POLY.slice(0, 6), 2);
  const c1 = r.int(2, tier >= 4 ? 6 : 4);
  const c2 = r.int(2, tier >= 4 ? 6 : 4);
  const tot = c1 * n1[1] + c2 * n2[1];
  return {
    text: `A design uses ${c1} ${n1[0] === 'quadrilateral' ? 'quadrilaterals' : n1[0] + 's'} and ${c2} ${n2[0] === 'quadrilateral' ? 'quadrilaterals' : n2[0] + 's'}. How many sides are there altogether?`,
    correct: String(tot),
    wrong: [String(c1 + c2 + n1[1] + n2[1]), String(c1 * n1[1] + c2), String(c1 * c2 * (n1[1] + n2[1])), String(tot + n1[1])],
    verify: `${c1}*${n1[1]}+${c2}*${n2[1]}`,
    asks: 'Count the sides of several shapes together.',
    concept: 'Multiply the number of shapes by the sides of each, then add.',
    steps: [`${c1} × ${n1[1]} = ${c1 * n1[1]}.`, `${c2} × ${n2[1]} = ${c2 * n2[1]}.`, `${c1 * n1[1]} + ${c2 * n2[1]} = ${tot}.`],
    mistake: 'Adding the counts of shapes instead of multiplying by the sides of each.',
    tip: 'Number of shapes × sides per shape, for each kind of shape.',
    pad: (d) => String(tot + d),
  };
});

// ---- S13 transformations & symmetry ------------------------------------------------------------------------------
const SYM: [string, number, boolean][] = [['square', 4, false], ['equilateral triangle', 3, false], ['rectangle (not a square)', 2, false], ['regular pentagon', 5, true], ['regular hexagon', 6, true], ['regular octagon', 8, true], ['rhombus (not a square)', 2, true], ['kite (not a rhombus)', 1, true], ['isosceles triangle (not equilateral)', 1, true], ['parallelogram (not a rectangle)', 0, true]];
export const SYMMETRY = SYM;
const symLines = mk('au.sym.lines', 'S13', 'au.transform', (r, tier) => {
  const [name, n] = r.pick(SYM.filter((x) => tier >= 3 || !x[2]));
  return {
    text: `How many lines of symmetry does a ${name} have?`,
    correct: String(n),
    wrong: [String(n + 1), String(n + 2), String(Math.max(0, n - 1)), String(n * 2)],
    verify: String(n),
    asks: 'Count the lines of symmetry of a shape.',
    concept: 'A line of symmetry is a fold line that makes the two halves match exactly.',
    steps: [`A ${name} has ${n} line${n === 1 ? '' : 's'} of symmetry.`],
    mistake: 'Counting the diagonals of a rectangle or rhombus that are not lines of symmetry.',
    tip: 'Imagine folding the shape: both halves must fit exactly on top of each other.',
    pad: (d) => String(Math.max(0, n + d)),
  };
});

const turnDeg = mk('au.turn.deg', 'S13', 'au.transform', (r, tier) => {
  const k = tier <= 2 ? r.int(1, 3) : r.int(3, 9);
  const who = nm(r);
  return {
    text: `${who} turns a shape clockwise through ${k} quarter turn${k === 1 ? '' : 's'}. How many degrees does the shape turn altogether?`,
    correct: deg(90 * k),
    wrong: [deg(45 * k), deg(180 * k), deg(90 * k + 90), deg(90 * Math.max(1, k - 1))],
    verify: String(90 * k),
    asks: 'Turn quarter turns into degrees.',
    concept: 'One quarter turn is 90°. A half turn is 180° and a full turn is 360°.',
    steps: [`${k} × 90° = ${90 * k}°.`],
    mistake: 'Using 45° or 180° for a quarter turn.',
    tip: 'Quarter turn 90°, half turn 180°, three-quarter turn 270°, full turn 360°.',
    pad: (d) => deg(90 * (k + d)),
  };
});

const mirrorGap = mk('au.mirror.gap', 'S13', 'au.transform', (r, tier) => {
  const a = r.int(2, tier <= 2 ? 6 : 15);
  const thing = r.pick(['dot', 'star', 'corner of a triangle', 'flag']);
  return {
    text: `A ${thing} is ${a} squares from a mirror line. Its reflection is on the other side of the line, the same distance away. How many squares apart are the ${thing} and its reflection?`,
    correct: `${2 * a} squares`,
    wrong: [`${a} squares`, `${a + 2} squares`, `${2 * a + 2} squares`, `${a * a} squares`],
    verify: String(2 * a),
    asks: 'Find the distance between a shape and its reflection.',
    concept: 'A reflection is as far behind the mirror line as the original is in front of it.',
    steps: [`Each is ${a} squares from the line.`, `${a} + ${a} = ${2 * a}.`],
    mistake: 'Giving the distance to the mirror line only.',
    tip: 'Distance to the line, doubled.',
    pad: (d) => `${2 * a + d} squares`,
  };
});

const translCoord = mk('au.transl.coord', 'S13', 'au.transform', (r, tier) => {
  const x = r.int(1, 8);
  const y = r.int(tier <= 2 ? 1 : 4, 9);
  const right = r.int(1, 6);
  const dirV = tier <= 1 ? 'up' : r.pick(['up', 'down']);
  const v = r.int(1, dirV === 'down' ? Math.min(4, y) : 5);
  const axis = r.pick(['x', 'y'] as const);
  const nx = x + right;
  const ny = dirV === 'up' ? y + v : y - v;
  const ans = axis === 'x' ? nx : ny;
  return {
    text: `A point at (${x}, ${y}) is moved ${right} unit${right === 1 ? '' : 's'} to the right and ${v} unit${v === 1 ? '' : 's'} ${dirV}. What is the ${axis}-coordinate of the new point? (The first number is the x-coordinate, the second is the y-coordinate.)`,
    correct: String(ans),
    wrong: [String(axis === 'x' ? ny : nx), String(axis === 'x' ? x : y), String(ans + 1), String(Math.max(0, ans - 1)), String(ans + 2)],
    verify: String(ans),
    asks: 'Translate a point on a grid.',
    concept: 'Moving right or left changes the x-coordinate. Moving up or down changes the y-coordinate.',
    steps: [`New x: ${x} + ${right} = ${nx}.`, `New y: ${y} ${dirV === 'up' ? '+' : '−'} ${v} = ${ny}.`, `The ${axis}-coordinate is ${ans}.`],
    mistake: 'Changing the wrong coordinate, or adding when the move is down.',
    tip: 'x goes along the corridor (left/right), y goes up the stairs (up/down).',
    pad: (d) => String(Math.max(0, ans + d)),
  };
});

// ---- S14 location & maps -------------------------------------------------------------------------------------------
const mapGrid = mk('au.map.grid', 'S14', 'au.maps', (r, tier) => {
  const cols = 'ABCDEFGHIJ';
  const c1 = r.int(0, 4);
  const c2 = r.int(c1 + 1, 9);
  const r1 = r.int(1, 4);
  const r2 = r.int(r1 + 1, 9);
  const place = r.pick([['library', 'park'], ['school', 'pool'], ['station', 'beach'], ['museum', 'oval']] as const);
  if (tier <= 2) {
    const horizontal = r.chance(0.5);
    const d = horizontal ? c2 - c1 : r2 - r1;
    return {
      text: horizontal
        ? `On a town map the ${place[0][0] ? place[0] : ''} is at ${cols[c1]}${r1} and the ${place[1]} is at ${cols[c2]}${r1}. How many squares east of the ${place[0]} is the ${place[1]}? (Letters run west to east.)`
        : `On a town map the ${place[0]} is at ${cols[c1]}${r1} and the ${place[1]} is at ${cols[c1]}${r2}. How many squares north of the ${place[0]} is the ${place[1]}? (Numbers rise going north.)`,
      correct: `${d} squares`,
      wrong: [`${d + 1} squares`, `${Math.max(1, d - 1)} squares`, `${d + 2} squares`, `${d * 2} squares`],
      verify: String(d),
      asks: 'Use a grid reference to count squares between two places.',
      concept: 'A grid reference gives the column letter, then the row number. Count the squares between the references.',
      steps: [horizontal ? `The letters go from ${cols[c1]} to ${cols[c2]}: ${d} squares.` : `The numbers go from ${r1} to ${r2}: ${d} squares.`],
      mistake: 'Counting the square you start on as well.',
      tip: 'Subtract the two column positions (or row numbers); do not count the start square.',
      pad: (x) => `${d + x} squares`,
    };
  }
  const d = c2 - c1 + (r2 - r1);
  return {
    text: `On a town map the ${place[0]} is at ${cols[c1]}${r1} and the ${place[1]} is at ${cols[c2]}${r2}. Walking along the grid lines (only east and north), how many squares must you cross to get from the ${place[0]} to the ${place[1]}?`,
    correct: `${d} squares`,
    wrong: [`${Math.max(c2 - c1, r2 - r1)} squares`, `${d + 1} squares`, `${d - 1} squares`, `${(c2 - c1) * (r2 - r1)} squares`],
    verify: String(d),
    asks: 'Find the number of grid steps between two places.',
    concept: 'Add the steps east and the steps north.',
    steps: [`East: ${cols[c1]} to ${cols[c2]} = ${c2 - c1}.`, `North: ${r1} to ${r2} = ${r2 - r1}.`, `${c2 - c1} + ${r2 - r1} = ${d}.`],
    mistake: 'Taking only the larger of the two distances.',
    tip: 'Along grid lines, you add the two sides of the rectangle.',
    pad: (x) => `${d + x} squares`,
  };
});

const DIRS = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
const mapCompass = mk('au.map.compass', 'S14', 'au.maps', (r, tier) => {
  const pool = tier <= 2 ? [0, 2, 4, 6] : [0, 1, 2, 3, 4, 5, 6, 7];
  const i = r.pick(pool);
  let j = r.pick(pool);
  while (j === i) j = r.pick(pool);
  const steps = (j - i + 8) % 8;
  const who = nm(r);
  return {
    text: `${who} is facing ${DIRS[i]}. ${who} turns clockwise to face ${DIRS[j]}. Through how many degrees does ${who} turn?`,
    correct: deg(steps * 45),
    wrong: [deg((8 - steps) * 45), deg(steps * 45 + 45), deg(Math.max(45, steps * 45 - 45)), deg(steps * 90)].filter((x) => x !== deg(steps * 45)),
    verify: String(steps * 45),
    asks: 'Turn between compass directions in degrees.',
    concept: 'Between two neighbouring compass points there is a 45° turn. North to East is 90°.',
    steps: [`From ${DIRS[i]} clockwise to ${DIRS[j]} is ${steps} step${steps === 1 ? '' : 's'} of 45°.`, `${steps} × 45° = ${steps * 45}°.`],
    mistake: 'Turning the wrong way (anticlockwise).',
    tip: 'Clockwise is the way the hands of a clock move. N→E→S→W.',
    pad: (d) => deg(steps * 45 + d * 45),
  };
});

const mapScale = mk('au.map.scale', 'S14', 'au.maps', (r, tier) => {
  const k = r.pick([2, 5, 10, 20, 50]);
  if (tier >= 4 && r.chance(0.5)) {
    const n = r.int(3, 14);
    return {
      text: `A map scale says 1 cm on the map is ${k} km in real life. A real road is ${n * k} km long. How long is the road on the map?`,
      correct: `${n} cm`,
      wrong: [`${n * k} cm`, `${n + k} cm`, `${n + 1} cm`, `${Math.max(1, n - 1)} cm`],
      verify: `${n * k}/${k}`,
      asks: 'Use a map scale to find the length on the map.',
      concept: 'Divide the real distance by the number of kilometres that 1 cm stands for.',
      steps: [`${n * k} ÷ ${k} = ${n}.`],
      mistake: 'Multiplying instead of dividing.',
      tip: 'Map to real: multiply. Real to map: divide.',
      pad: (d) => `${n + d} cm`,
    };
  }
  const n = r.int(3, tier <= 2 ? 9 : 16);
  return {
    text: `On a map, 1 cm stands for ${k} km. Two towns are ${n} cm apart on the map. What is the real distance between the towns?`,
    correct: `${n * k} km`,
    wrong: [`${n + k} km`, `${n * k * 10} km`, `${n * k + k} km`, `${Math.max(k, n * k - k)} km`],
    verify: `${n}*${k}`,
    asks: 'Use a map scale to find a real distance.',
    concept: 'Multiply the map distance by the number of kilometres that 1 cm stands for.',
    steps: [`${n} × ${k} = ${n * k}.`],
    mistake: 'Adding the scale instead of multiplying.',
    tip: 'Each centimetre is the same real distance, so multiply.',
    pad: (d) => `${n * k + d * k} km`,
  };
});

// ---- S15 data --------------------------------------------------------------------------------------------------
const mapSurveyCats = [['Cricket', 'Netball', 'Swimming', 'Tennis', 'Soccer', 'Basketball'], ['Vegemite', 'Honey', 'Jam', 'Peanut butter', 'Cheese', 'Butter'], ['Dogs', 'Cats', 'Fish', 'Birds', 'Rabbits', 'Lizards'], ['Bus', 'Train', 'Bike', 'Walk', 'Car', 'Scooter']] as const;
export const SURVEY_SETS = mapSurveyCats;
const dataKey = mk('au.data.key', 'S15', 'au.data', (r, tier) => {
  const k = r.pick(tier <= 2 ? [2, 5, 10] : [4, 5, 6, 8, 20, 25]);
  const a = r.int(3, 9);
  const b = r.int(2, 8);
  const total = r.chance(0.5);
  if (!total && a === b) return dataKey.build(r, tier);
  const [c1, c2] = r.sample(['Class 5A', 'Class 5B', 'Class 5C', 'Class 5D'], 2);
  return {
    text: `In a picture graph, each ★ stands for ${k} students who walk to school. ${c1} has ${a} ★ and ${c2} has ${b} ★. ${total ? 'How many students walk to school altogether?' : `How many more students walk to school in ${a > b ? c1 : c2} than in ${a > b ? c2 : c1}?`}`,
    correct: String(total ? (a + b) * k : Math.abs(a - b) * k),
    wrong: [String(total ? a + b : Math.abs(a - b)), String(total ? (a + b) * k + k : Math.abs(a - b) * k + k), String(total ? a * b * k : (a + b) * k), String(total ? (a + b) * k - k : Math.max(k, Math.abs(a - b) * k - k))],
    verify: total ? `(${a}+${b})*${k}` : `${Math.max(a, b)}*${k}-${Math.min(a, b)}*${k}`,
    asks: 'Read a picture graph that uses a key.',
    concept: `The key says each ★ is worth ${k}, so multiply the number of stars by ${k}.`,
    steps: [`${c1}: ${a} × ${k} = ${a * k}. ${c2}: ${b} × ${k} = ${b * k}.`, total ? `${a * k} + ${b * k} = ${(a + b) * k}.` : `${Math.max(a, b) * k} − ${Math.min(a, b) * k} = ${Math.abs(a - b) * k}.`],
    mistake: 'Forgetting that each symbol stands for more than one student.',
    tip: 'Always read the key first.',
    pad: (d) => String((total ? (a + b) * k : Math.abs(a - b) * k) + d * k),
  };
});

const dataColumn = mk('au.data.col', 'S15', 'au.data', (r, tier) => {
  const s = r.pick(tier <= 2 ? [2, 5, 10] : [4, 5, 20, 25, 50]);
  const g1 = r.int(2, 6);
  const g2 = r.int(g1 + 1, 9);
  return {
    text: `A column graph shows the number of books read each week. Each gridline is ${s} books. The bar for Week 1 reaches the ${ord(g1)} gridline and the bar for Week 2 reaches the ${ord(g2)} gridline. How many more books were read in Week 2 than in Week 1?`,
    correct: String((g2 - g1) * s),
    wrong: [String(g2 - g1), String(g2 * s), String((g2 - g1) * s + s), String(Math.max(s, (g2 - g1) * s - s))],
    verify: `${g2}*${s}-${g1}*${s}`,
    asks: 'Read a column graph with a scale.',
    concept: `Each gridline stands for ${s}. Find each bar's value, then subtract.`,
    steps: [`Week 1: ${g1} × ${s} = ${g1 * s}. Week 2: ${g2} × ${s} = ${g2 * s}.`, `${g2 * s} − ${g1 * s} = ${(g2 - g1) * s}.`],
    mistake: 'Subtracting the gridline numbers without using the scale.',
    tip: 'Check how much one gridline is worth before reading a bar.',
    pad: (d) => String((g2 - g1) * s + d * s),
  };
});

const dataDiff = mk('au.data.diff', 'S15', 'au.data', (r, tier) => {
  const cats = r.pick(mapSurveyCats).slice(0, tier <= 2 ? 4 : 5);
  const counts = cats.map(() => r.int(4, tier <= 2 ? 15 : 28));
  if (new Set(counts).size < counts.length) return dataDiff.build(r, tier);
  const table = cats.map((c, i) => `${c} ${counts[i]}`).join(', ');
  const mx = Math.max(...counts);
  const mn = Math.min(...counts);
  const i1 = counts.indexOf(mx);
  const i2 = counts.indexOf(mn);
  const sum = counts.reduce((a, b) => a + b, 0);
  const mode = r.int(0, 2);
  if (mode === 0 && tier <= 3) {
    return { text: `A class survey recorded these votes: ${table}. How many students voted altogether?`, correct: String(sum), wrong: [String(sum + 10), String(sum - 10), String(mx + mn), String(sum + 1)], verify: counts.join('+'), asks: 'Add all the values in a table.', concept: 'Add every category to find the total.', steps: [`${counts.join(' + ')} = ${sum}.`], mistake: 'Leaving out one of the categories.', tip: 'Tick off each category as you add it.', pad: (d) => String(sum + d) };
  }
  if (mode === 1 || tier <= 3) {
    return { text: `A class survey recorded these votes: ${table}. How many more students chose ${cats[i1]} than ${cats[i2]}?`, correct: String(mx - mn), wrong: [String(mx + mn), String(mx - mn + 2), String(mx - mn - 2 > 0 ? mx - mn - 2 : mx - mn + 3), String(mx)], verify: `${mx}-${mn}`, asks: 'Find the difference between the largest and smallest values.', concept: 'Subtract the smaller number from the larger.', steps: [`${cats[i1]} has ${mx}; ${cats[i2]} has ${mn}.`, `${mx} − ${mn} = ${mx - mn}.`], mistake: 'Adding the two categories instead of finding the difference.', tip: '"How many more" means subtract.', pad: (d) => String(mx - mn + d) };
  }
  const other = r.int(0, cats.length - 1);
  return { text: `A class survey recorded these votes: ${table}. How many students did NOT choose ${cats[other]}?`, correct: String(sum - counts[other]), wrong: [String(counts[other]), String(sum), String(sum - counts[other] + 2), String(sum - counts[other] - 2)], verify: `${sum}-${counts[other]}`, asks: 'Use a table to find the total of all other choices.', concept: 'Total minus the category you are leaving out.', steps: [`Total = ${sum}.`, `${sum} − ${counts[other]} = ${sum - counts[other]}.`], mistake: 'Giving the number who did choose it.', tip: 'Find the total, then subtract the group you do not want.', pad: (d) => String(sum - counts[other] + d) };
});

// ---- S16 chance --------------------------------------------------------------------------------------------------
const chanceProb = mk('au.chance.prob', 'S16', 'au.chance', (r, tier) => {
  const colours = r.sample(['red', 'blue', 'green', 'yellow', 'purple'], tier <= 2 ? 2 : 3);
  const counts = colours.map(() => r.int(1, tier <= 2 ? 5 : 9));
  const total = counts.reduce((a, b) => a + b, 0);
  const pick = r.int(0, colours.length - 1);
  const p = new Frac(counts[pick], total);
  if (p.isInt) return chanceProb.build(r, tier);
  const parts = colours.map((c, i) => `${counts[i]} ${c}`).join(', ');
  const odds = new Frac(counts[pick], total - counts[pick]);
  return {
    text: `A bag has ${parts} marbles. One marble is taken out without looking. What is the chance of taking a ${colours[pick]} marble? Give a fraction in simplest form.`,
    correct: mf(p),
    wrong: [mf(odds), mf(new Frac(total - counts[pick], total)), mf(new Frac(1, colours.length)), mf(new Frac(counts[pick], total + counts[pick]))],
    verify: `${counts[pick]}/${total}`,
    asks: 'Write a chance as a fraction.',
    concept: 'Chance = number of ways to get the result ÷ total number of equally likely outcomes.',
    steps: [`Total marbles: ${counts.join(' + ')} = ${total}.`, `${colours[pick]} marbles: ${counts[pick]}.`, `Chance = ${mfrac(counts[pick], total)}${p.d === total ? '' : ' = ' + mf(p)}.`],
    mistake: 'Comparing red to non-red marbles instead of using the total.',
    tip: 'The bottom number is always the total number of marbles.',
    pad: (d) => mf(new Frac(Math.max(1, counts[pick] + d), total + 1)),
  };
});

const chanceOutcomes = mk('au.chance.outcomes', 'S16', 'au.chance', (r, tier) => {
  const v = r.int(0, tier <= 2 ? 1 : 3);
  const [text, n, expl]: [string, number, string] = v === 0 ? ['A coin is tossed and a standard six-sided die is rolled.', 12, '2 coin results × 6 die results'] : v === 1 ? [`A spinner with ${r.pick([3, 4, 5])} equal sections is spun and a coin is tossed.`, 0, ''] : v === 2 ? ['Two standard six-sided dice are rolled, one red and one blue.', 36, '6 × 6'] : ['A coin is tossed three times.', 8, '2 × 2 × 2'];
  let nn = n;
  let ex = expl;
  let t = text;
  if (v === 1) {
    const secs = Number(/with (\d)/.exec(text)![1]);
    nn = secs * 2;
    ex = `${secs} spinner results × 2 coin results`;
    t = text;
  }
  return {
    text: `${t} How many different outcomes are possible?`,
    correct: String(nn),
    wrong: [String(nn / 2 + (nn % 2)), String(nn + 2), String(nn - 2 > 0 ? nn - 2 : nn + 3), String(nn * 2)],
    verify: String(nn),
    asks: 'Count all the possible outcomes of a chance experiment.',
    concept: 'Multiply the number of outcomes of each part of the experiment.',
    steps: [`${ex} = ${nn}.`],
    mistake: 'Adding the outcomes of each part instead of multiplying.',
    tip: 'List the outcomes in an organised table or tree if you are unsure.',
    pad: (d) => String(Math.max(1, nn + d)),
  };
});

export const AU_MCQ: AuMcq[] = [
  fracAddRel, fracSubRel, moneyRound5, moneyDiscount, time24, timeMinutes, anglePoint, angleRight, shapeCounts, shapeSides,
  symLines, turnDeg, mirrorGap, translCoord, mapGrid, mapCompass, mapScale, dataKey, dataColumn, dataDiff, chanceProb, chanceOutcomes,
];
