import { T } from '../define';
import { Frac } from '../../math/fraction';
import { NAMES, commas, decStr, intWhere, m } from '../h';
import type { Template } from '../types';

const F = (n: number, d = 1) => new Frac(n, d);
const ds = (f: Frac) => decStr(f);
const u = (v: number | Frac, unit: string) => `${typeof v === 'number' ? commas(v) : v.isInt ? commas(v.n) : ds(v)} ${unit}`;

const perimeter = T('ge.perimeter', 'ge.perimeter', 'Perimeter', 'Geometry', [1, 5], (r, tier) => {
  const unit = r.pick(['cm', 'm']);
  if (tier === 1 || (tier === 2 && r.chance(0.5))) {
    const l = r.int(5, 20);
    const w = r.int(2, l - 1);
    const p = 2 * (l + w);
    return {
      text: `A rectangle is ${l} ${unit} long and ${w} ${unit} wide. What is its perimeter?`,
      correct: u(p, unit),
      wrong: [u(l * w, unit), u(l + w, unit), u(p + 2, unit), u(2 * l + w, unit)],
      verify: `2*(${l}+${w})`,
      pad: (d) => u(p + 2 * d, unit),
      asks: 'Find the total distance around the rectangle.',
      concept: 'Perimeter is the distance around a shape. For a rectangle: 2 × (length + width).',
      steps: [`Length + width = ${l} + ${w} = ${l + w}.`, `A rectangle has two of each: 2 × ${l + w} = ${p} ${unit}.`],
      mistake: 'Adding only two sides, or multiplying (that gives area, not perimeter).',
      tip: 'Walk around the edge and add every side.',
    };
  }
  if (tier === 2 || tier === 3) {
    const n = r.pick([5, 6, 8, 10]);
    const s = r.int(3, 15);
    const names: Record<number, string> = { 5: 'pentagon', 6: 'hexagon', 8: 'octagon', 10: 'decagon' };
    return {
      text: `A regular ${names[n]} has sides that are each ${s} ${unit} long. What is its perimeter?`,
      correct: u(n * s, unit),
      wrong: [u(s * s, unit), u((n - 1) * s, unit), u((n + 1) * s, unit), u(n + s, unit)],
      verify: `${n}*${s}`,
      pad: (d) => u(n * s + d * s, unit),
      asks: `Find the distance around a shape with ${n} equal sides.`,
      concept: 'A regular polygon has all sides equal, so perimeter = number of sides × side length.',
      steps: [`A ${names[n]} has ${n} sides.`, `${n} × ${s} = ${n * s} ${unit}.`],
      mistake: 'Using the wrong number of sides.',
      tip: 'Count the sides carefully: pentagon 5, hexagon 6, octagon 8.',
    };
  }
  if (tier === 4) {
    const w = r.int(4, 15);
    const l = w + r.int(2, 12);
    const p = 2 * (l + w);
    return {
      text: `A rectangular garden has a perimeter of ${p} ${unit}. Its length is ${l} ${unit}. How wide is the garden?`,
      correct: u(w, unit),
      wrong: [u(p - l, unit), u(p - 2 * l, unit) === u(w, unit) ? u(w + 2, unit) : u(p - 2 * l, unit), u((p - l) / 2 + 1, unit), u(p / 2, unit)],
      verify: `${p}/2-${l}`,
      pad: (d) => u(w + d, unit),
      asks: 'Use the perimeter and the length to find the missing width.',
      concept: 'Half of the perimeter equals length + width.',
      steps: [`Half the perimeter: ${p} ÷ 2 = ${p / 2}.`, `Width = ${p / 2} − ${l} = ${w} ${unit}.`],
      mistake: 'Subtracting only one length from the perimeter without halving.',
      tip: 'Length + width = half of the perimeter.',
    };
  }
  const a = r.int(6, 20);
  const b = r.int(4, 12);
  const c = r.int(2, 5);
  const d = r.int(2, Math.max(2, Math.min(a, b) - 1));
  const p = 2 * (a + b);
  return {
    text: `A rectangle measures ${a} ${unit} by ${b} ${unit}. A ${c} ${unit} by ${d} ${unit} rectangle is cut out of one corner, as shown by an L-shape. What is the perimeter of the L-shaped figure?`,
    correct: u(p, unit),
    wrong: [u(p - 2 * c, unit), u(p + 2 * c, unit), u(p - c - d, unit), u(a * b - c * d, unit)],
    verify: `2*(${a}+${b})`,
    pad: (x) => u(p + 2 * x, unit),
    asks: 'Find the perimeter of a rectangle with a corner removed.',
    concept: 'Cutting a rectangular corner out does not change the perimeter; the new edges add exactly what was removed.',
    steps: [`The outline of the L-shape has the same perimeter as the big rectangle.`, `2 × (${a} + ${b}) = ${p} ${unit}.`],
    mistake: 'Subtracting the cut-out’s sides, which is not needed.',
    tip: 'Slide the cut edges to the outside: they fit exactly on the big rectangle’s sides.',
  };
});

const areaRect = T('ge.area', 'ge.area', 'Area of rectangles and squares', 'Geometry', [1, 5], (r, tier) => {
  const unit = r.pick(['cm', 'm']);
  const decimal = tier >= 4;
  const l = decimal ? F(r.int(25, 95), 10) : F(r.int(4 + tier * 2, 12 + tier * 5));
  const w = decimal ? F(r.int(12, 60), 10) : F(r.int(3, 9 + tier * 3));
  const a = l.mul(w);
  const sq = tier <= 2 && r.chance(0.3);
  if (sq) {
    const s = r.int(4, 14);
    return {
      text: `A square has sides of ${s} ${unit}. What is its area?`,
      correct: u(s * s, `${unit}²`),
      wrong: [u(4 * s, `${unit}²`), u(2 * s, `${unit}²`), u(s * s + s, `${unit}²`), u(s * (s - 1), `${unit}²`)],
      verify: `${s}*${s}`,
      pad: (d) => u(s * s + d, `${unit}²`),
      asks: 'Find the amount of flat space inside the square.',
      concept: 'Area of a square = side × side. It is measured in square units.',
      steps: [`Area = ${s} × ${s} = ${s * s} ${unit}².`],
      mistake: 'Adding the sides (perimeter) or doubling instead of multiplying.',
      tip: 'Area is in square units; perimeter is in ordinary units.',
    };
  }
  return {
    text: tier >= 3 ? `A rectangular playground is ${ds(l)} ${unit} long and ${ds(w)} ${unit} wide. What is its area?` : `A rectangle is ${ds(l)} ${unit} long and ${ds(w)} ${unit} wide. What is its area?`,
    correct: u(a, `${unit}²`),
    wrong: [u(l.add(w).mul(F(2)), `${unit}²`), u(l.add(w), `${unit}²`), u(a.mul(F(10)), `${unit}²`), u(a.div(F(10)).add(F(0)), `${unit}²`)],
    verify: `${ds(l)}*${ds(w)}`,
    pad: (d) => u(a.add(F(d)), `${unit}²`),
    asks: 'Find how much flat space the rectangle covers.',
    concept: 'Area of a rectangle = length × width, measured in square units.',
    steps: [`Area = length × width = ${ds(l)} × ${ds(w)}.`, `${ds(l)} × ${ds(w)} = ${ds(a)} ${unit}².`],
    mistake: 'Finding the perimeter by adding instead of multiplying.',
    tip: 'Think of the number of 1-unit squares that fit inside.',
  };
});

const triangle = T('ge.triangle', 'ge.triangle', 'Area of triangles', 'Geometry', [2, 5], (r, tier) => {
  const unit = r.pick(['cm', 'm']);
  const b = r.int(4, 6 + tier * 4);
  const h = intWhere(r, 3, 6 + tier * 3, (x) => (b * x) % 2 === 0);
  const a = (b * h) / 2;
  return {
    text: `A triangle has a base of ${b} ${unit} and a height of ${h} ${unit}. What is its area?`,
    correct: u(a, `${unit}²`),
    wrong: [u(b * h, `${unit}²`), u(b + h, `${unit}²`), u(a + b, `${unit}²`), u((b * h) / 4 === Math.floor((b * h) / 4) ? (b * h) / 4 : a - 1, `${unit}²`)],
    verify: `${b}*${h}/2`,
    pad: (d) => u(a + d, `${unit}²`),
    asks: 'Find the area inside the triangle.',
    concept: 'A triangle is half of a rectangle (or parallelogram) with the same base and height: area = base × height ÷ 2.',
    steps: [`Base × height = ${b} × ${h} = ${b * h}.`, `Half of it: ${b * h} ÷ 2 = ${a} ${unit}².`],
    mistake: 'Forgetting to halve the answer.',
    tip: 'The height is measured at a right angle to the base – not along a slanted side.',
  };
});

const parallelogram = T('ge.parallelogram', 'ge.parallelogram', 'Area of parallelograms', 'Geometry', [3, 5], (r, tier) => {
  const b = r.int(6, 10 + tier * 3);
  const h = r.int(4, 6 + tier * 2);
  const slant = h + r.int(2, 5);
  const a = b * h;
  return {
    text: `A parallelogram has a base of ${b} cm, a slanted side of ${slant} cm and a perpendicular height of ${h} cm. What is its area?`,
    correct: u(a, 'cm²'),
    wrong: [u(b * slant, 'cm²'), u((b * h) / 2 === Math.floor((b * h) / 2) ? (b * h) / 2 : a + 1, 'cm²'), u(2 * (b + slant), 'cm²'), u(a + b, 'cm²')],
    verify: `${b}*${h}`,
    pad: (d) => u(a + d, 'cm²'),
    asks: 'Use the base and the perpendicular height to find the area.',
    concept: 'Area of a parallelogram = base × perpendicular height. The slanted side is not used.',
    steps: [`Use the base (${b} cm) and the perpendicular height (${h} cm).`, `${b} × ${h} = ${a} cm².`],
    mistake: 'Using the slanted side instead of the perpendicular height.',
    tip: 'The slanted side is a distraction – the height must make a right angle with the base.',
  };
});

const composite = T('ge.composite', 'ge.composite', 'Area of composite shapes', 'Geometry', [3, 5], (r, tier) => {
  const a1 = r.int(6, 14);
  const b1 = r.int(4, 9);
  const a2 = r.int(3, 7);
  const b2 = r.int(2, 6);
  const cut = tier === 5 && r.chance(0.5);
  const name = r.pick(NAMES);
  if (cut) {
    const big = (a1 + 2) * (b1 + 2);
    const hole = a2 * b2;
    return {
      text: `${name} paints a wall that is ${a1 + 2} m wide and ${b1 + 2} m high. A window of ${a2} m by ${b2} m is not painted. What area is painted?`,
      correct: u(big - hole, 'm²'),
      wrong: [u(big + hole, 'm²'), u(big, 'm²'), u(hole, 'm²'), u(big - hole + a2, 'm²')],
      verify: `${a1 + 2}*${b1 + 2}-${a2}*${b2}`,
      pad: (d) => u(big - hole + d, 'm²'),
      asks: 'Find the area of the wall without the window.',
      concept: 'For a shape with a hole, find the area of the whole and subtract the area of the hole.',
      steps: [`Wall: ${a1 + 2} × ${b1 + 2} = ${big} m².`, `Window: ${a2} × ${b2} = ${hole} m².`, `Painted: ${big} − ${hole} = ${big - hole} m².`],
      mistake: 'Adding the window area instead of subtracting it.',
      tip: 'Hole in a shape? Whole minus hole.',
    };
  }
  const v = a1 * b1 + a2 * b2;
  return {
    text: `An L-shaped room is made by joining a ${a1} m by ${b1} m rectangle to a ${a2} m by ${b2} m rectangle. The two rectangles do not overlap. What is the total floor area?`,
    correct: u(v, 'm²'),
    wrong: [u(a1 * b1, 'm²'), u(2 * (a1 + b1 + a2 + b2), 'm²'), u(v + a2, 'm²'), u((a1 + a2) * (b1 + b2), 'm²') === u(v, 'm²') ? u(v + 5, 'm²') : u((a1 + a2) * (b1 + b2), 'm²')],
    verify: `${a1}*${b1}+${a2}*${b2}`,
    pad: (d) => u(v + d, 'm²'),
    asks: 'Split the shape into rectangles and add their areas.',
    concept: 'Composite shapes can be split into simple shapes; add the separate areas.',
    steps: [`First rectangle: ${a1} × ${b1} = ${a1 * b1} m².`, `Second rectangle: ${a2} × ${b2} = ${a2 * b2} m².`, `Total: ${a1 * b1} + ${a2 * b2} = ${v} m².`],
    mistake: 'Multiplying the overall length and width, which would include space that is not part of the room.',
    tip: 'Draw a line to split the shape into rectangles you can measure.',
  };
});

const volume = T('ge.volume', 'ge.volume', 'Volume of cuboids', 'Geometry', [1, 5], (r, tier) => {
  const unit = 'cm';
  const cube = tier <= 2 && r.chance(0.35);
  if (cube) {
    const s = r.int(2, tier === 1 ? 6 : 10);
    return {
      text: `A cube has edges of ${s} cm. What is its volume?`,
      correct: u(s ** 3, 'cm³'),
      wrong: [u(s * s, 'cm³'), u(3 * s, 'cm³'), u(6 * s * s, 'cm³'), u(s ** 3 + s, 'cm³')],
      verify: `${s}^3`,
      pad: (d) => u(s ** 3 + d, 'cm³'),
      asks: 'Find how many 1 cm cubes fill the cube.',
      concept: 'Volume of a cube = side × side × side, measured in cubic units.',
      steps: [`${s} × ${s} × ${s} = ${s ** 3}.`],
      mistake: 'Multiplying by 3 instead of using the side three times.',
      tip: 'Volume has 3 dimensions, so the unit is cubed (cm³).',
    };
  }
  const l = r.int(3, 6 + tier * 2);
  const w = r.int(2, 5 + tier);
  const h = r.int(2, 5 + tier);
  const v = l * w * h;
  const obj = r.pick(['box', 'fish tank', 'toy chest', 'packing crate']);
  return {
    text: `A ${obj} is ${l} ${unit} long, ${w} ${unit} wide and ${h} ${unit} high. What is its volume?`,
    correct: u(v, 'cm³'),
    wrong: [u(l * w + h, 'cm³'), u(2 * (l * w + l * h + w * h), 'cm³'), u(l + w + h, 'cm³'), u(v + l * w, 'cm³')],
    verify: `${l}*${w}*${h}`,
    pad: (d) => u(v + d * w, 'cm³'),
    asks: 'Find how much space is inside the box.',
    concept: 'Volume of a cuboid = length × width × height.',
    steps: [`Base layer: ${l} × ${w} = ${l * w} cubes.`, `${h} layers: ${l * w} × ${h} = ${v} cm³.`],
    mistake: 'Adding the dimensions, or finding the surface area.',
    tip: 'Find one layer first, then multiply by the number of layers.',
  };
});

const volumeMissing = T('ge.volumemissing', 'ge.volumemissing', 'Missing dimension from volume', 'Geometry', [3, 5], (r, tier) => {
  const l = r.int(3, 12);
  const w = r.int(2, 9);
  const h = r.int(2, 12);
  const v = l * w * h;
  return {
    text: `A cuboid has a volume of ${commas(v)} cm³. It is ${l} cm long and ${w} cm wide. How high is it?`,
    correct: u(h, 'cm'),
    wrong: [u(v / l, 'cm'), u(l * w, 'cm'), u(h + l, 'cm'), u(Math.max(1, v / (l + w)) % 1 === 0 ? v / (l + w) : h + 2, 'cm')],
    verify: `${v}/(${l}*${w})`,
    pad: (d) => u(h + d, 'cm'),
    asks: 'Work backwards from the volume to find the missing height.',
    concept: 'Volume = base area × height, so height = volume ÷ base area.',
    steps: [`Base area: ${l} × ${w} = ${l * w} cm².`, `Height = ${commas(v)} ÷ ${l * w} = ${h} cm.`],
    mistake: 'Dividing the volume by only one dimension.',
    tip: 'Check: base area × height should give back the volume.',
  };
});

const capacity = T('ge.capacity', 'ge.capacity', 'Volume and capacity', 'Geometry', [4, 5], (r, tier) => {
  const [l, w, h] = [r.pick([20, 25, 40, 50]), r.pick([20, 25, 40, 50, 30]), r.pick([10, 20, 30, 40])];
  const v = l * w * h;
  if (v % 1000 !== 0) return capacity.build(r, tier);
  const litres = v / 1000;
  return {
    text: `A fish tank is ${l} cm long, ${w} cm wide and ${h} cm high. How many litres of water does it hold when it is completely full? (1 litre = 1,000 cm³)`,
    correct: u(litres, 'litres'),
    wrong: [u(v, 'litres'), u(litres * 10, 'litres'), u(litres / 10 === Math.floor(litres / 10) ? litres / 10 : litres + 2, 'litres'), u(litres + 5, 'litres')],
    verify: `${l}*${w}*${h}/1000`,
    pad: (d) => u(litres + d, 'litres'),
    asks: 'Find the volume in cm³, then change it to litres.',
    concept: '1 litre = 1,000 cm³. Volume in cm³ ÷ 1,000 gives litres.',
    steps: [`Volume: ${l} × ${w} × ${h} = ${commas(v)} cm³.`, `${commas(v)} ÷ 1,000 = ${litres} litres.`],
    mistake: 'Forgetting to convert from cm³ to litres.',
    tip: 'A 10 cm × 10 cm × 10 cm cube holds exactly 1 litre.',
  };
});

const squarePA = T('ge.squarepa', 'ge.squarepa', 'Perimeter and area connections', 'Geometry', [3, 5], (r, tier) => {
  const s = r.int(4, 14);
  const toArea = r.chance(0.5);
  if (toArea) {
    return {
      text: `The perimeter of a square is ${4 * s} cm. What is the area of the square?`,
      correct: u(s * s, 'cm²'),
      wrong: [u(4 * s * 4 * s, 'cm²'), u(2 * s, 'cm²'), u(4 * s, 'cm²'), u(s * s + s, 'cm²')],
      verify: `(${4 * s}/4)^2`,
      pad: (d) => u(s * s + d, 'cm²'),
      asks: 'Use the perimeter to find the side, then the area.',
      concept: 'A square has 4 equal sides: side = perimeter ÷ 4. Area = side × side.',
      steps: [`Side: ${4 * s} ÷ 4 = ${s} cm.`, `Area: ${s} × ${s} = ${s * s} cm².`],
      mistake: 'Squaring the perimeter instead of the side.',
      tip: 'Always find the side length first.',
    };
  }
  return {
    text: `The area of a square is ${s * s} cm². What is its perimeter?`,
    correct: u(4 * s, 'cm'),
    wrong: [u(2 * s, 'cm'), u(s * s, 'cm'), u(4 * s * s, 'cm'), u(4 * s + 4, 'cm')],
    verify: `4*sqrt(${s * s})`,
    pad: (d) => u(4 * s + 4 * d, 'cm'),
    asks: 'Use the area to find the side, then the perimeter.',
    concept: 'Area = side × side, so the side is the number that multiplies by itself to give the area.',
    steps: [`${s} × ${s} = ${s * s}, so the side is ${s} cm.`, `Perimeter: 4 × ${s} = ${4 * s} cm.`],
    mistake: 'Multiplying the area by 4.',
    tip: 'Think: which number times itself gives the area?',
  };
});

const angles = T('ge.angles', 'ge.angles', 'Angles', 'Geometry', [1, 4], (r, tier) => {
  const kind = tier === 1 ? r.int(0, 1) : r.int(0, 3);
  if (kind === 0) {
    const a = r.int(30, 100);
    const b = r.int(25, 170 - a - 10);
    const c = 180 - a - b;
    return {
      text: `Two angles in a triangle are ${a}° and ${b}°. What is the third angle?`,
      correct: `${c}°`,
      wrong: [`${360 - a - b}°`, `${90 - a}°`.replace(/^-/, ''), `${c + 10}°`, `${a + b}°`],
      verify: `180-${a}-${b}`,
      pad: (d) => `${c + d * 5}°`,
      asks: 'Find the missing angle in the triangle.',
      concept: 'The three angles in a triangle always add up to 180°.',
      steps: [`${a} + ${b} = ${a + b}.`, `180 − ${a + b} = ${c}°.`],
      mistake: 'Using 360° (that is for four-sided shapes) or 90°.',
      tip: 'Triangle → 180°. Quadrilateral → 360°.',
    };
  }
  if (kind === 1) {
    const a = r.int(25, 150);
    return {
      text: `Angles on a straight line add up to 180°. One of the angles is ${a}°. What is the other angle?`,
      correct: `${180 - a}°`,
      wrong: [`${90 - (a % 90)}°`, `${360 - a}°`, `${a}°`, `${180 - a + 10}°`],
      verify: `180-${a}`,
      pad: (d) => `${180 - a + d * 5}°`,
      asks: 'Use the straight line to find the missing angle.',
      concept: 'Angles on a straight line add up to 180°.',
      steps: [`180 − ${a} = ${180 - a}°.`],
      mistake: 'Subtracting from 90° or 360° instead of 180°.',
      tip: 'A straight line is a half turn: 180°.',
    };
  }
  if (kind === 2) {
    const a = r.int(60, 120);
    const b = r.int(70, 130);
    const c = r.int(40, 100);
    const d = 360 - a - b - c;
    if (d < 30) return angles.build(r, tier);
    return {
      text: `Three angles in a four-sided shape are ${a}°, ${b}° and ${c}°. What is the fourth angle?`,
      correct: `${d}°`,
      wrong: [`${180 - a - b - c > 0 ? 180 - a - b - c : d + 20}°`, `${d + 10}°`, `${d - 10}°`, `${a + b + c}°`],
      verify: `360-${a}-${b}-${c}`,
      pad: (x) => `${d + x * 5}°`,
      asks: 'Find the missing angle in the quadrilateral.',
      concept: 'The four angles in any quadrilateral add up to 360°.',
      steps: [`${a} + ${b} + ${c} = ${a + b + c}.`, `360 − ${a + b + c} = ${d}°.`],
      mistake: 'Using 180° as the total.',
      tip: 'Split a four-sided shape into two triangles: 2 × 180° = 360°.',
    };
  }
  const n = r.int(2, 4);
  const each = r.pick([40, 50, 60, 30, 45, 70].filter((x) => x * n < 330));
  const rest = 360 - each * n;
  return {
    text: `${n} equal angles and one angle of ${rest}° meet at a point. Angles around a point add up to 360°. What is the size of each of the ${n} equal angles?`,
    correct: `${each}°`,
    wrong: [`${each + 10}°`, `${Math.max(5, each - 10)}°`, `${(360 / n)}°`, `${180 / n}°`].map((s, i) => (i === 2 && 360 / n === each ? `${each + 20}°` : s)),
    verify: `(360-${rest})/${n}`,
    pad: (d) => `${each + d * 5}°`,
    asks: 'Share the remaining angle equally.',
    concept: 'Angles around a point add up to 360°.',
    steps: [`The ${n} equal angles share 360 − ${rest} = ${360 - rest}°.`, `Each is ${360 - rest} ÷ ${n} = ${each}°.`],
    mistake: 'Dividing 360° by the number of equal angles without removing the other angle.',
    tip: 'Subtract the known angles first, then share what is left.',
  };
});

const cubesFit = T('ge.cubesfit', 'ge.cubesfit', 'Packing with unit cubes', 'Geometry', [3, 5], (r, tier) => {
  const s = r.pick([2, 3, 4, 5]);
  const [a, b, c] = [s * r.int(2, 5), s * r.int(2, 4), s * r.int(1, 4)];
  const n = (a / s) * (b / s) * (c / s);
  return {
    text: `A box is ${a} cm long, ${b} cm wide and ${c} cm high. How many cubes with edges of ${s} cm can be packed into the box with no gaps?`,
    correct: String(n),
    wrong: [String(Math.round((a * b * c) / s)), String(a * b * c), String(n + (a / s)), String(Math.max(1, n - (b / s)))],
    verify: `(${a}/${s})*(${b}/${s})*(${c}/${s})`,
    pad: (d) => String(n + d),
    asks: 'Count how many small cubes fit along each edge, then multiply.',
    concept: 'Number of cubes = (length ÷ s) × (width ÷ s) × (height ÷ s).',
    steps: [`Along the length: ${a} ÷ ${s} = ${a / s}. Along the width: ${b} ÷ ${s} = ${b / s}. Up the height: ${c} ÷ ${s} = ${c / s}.`, `${a / s} × ${b / s} × ${c / s} = ${n}.`],
    mistake: 'Dividing the big volume by the small side length instead of the small volume.',
    tip: `Or: box volume ${commas(a * b * c)} ÷ cube volume ${s ** 3} = ${n}.`,
  };
});

export const geometryTemplates: Template[] = [perimeter, areaRect, triangle, parallelogram, composite, volume, volumeMissing, capacity, squarePA, angles, cubesFit];
export { m };
