import { T } from '../define';
import { Frac } from '../../math/fraction';
import { NAMES, commas, decStr, m, money, moneyAuto } from '../h';
import type { Template } from '../types';

const F = (n: number, d = 1) => new Frac(n, d);
const ds = (f: Frac) => decStr(f);

const shop = T('ms.shop', 'ms.shop', 'Shopping with discounts', 'Multi-step Problems', [2, 5], (r, tier) => {
  const name = r.pick(NAMES);
  const p = r.pick([10, 20, 25, 50]);
  const n = r.int(2, 5);
  const price = r.pick([8, 12, 16, 20, 24, 40]) ;
  const extra = r.int(3, 18);
  const sub = n * price;
  const disc = (sub * p) / 100;
  const total = sub - disc + extra;
  const pay = Math.ceil(total / 10) * 10 + (total % 10 === 0 ? 10 : 0);
  if (!Number.isInteger(disc)) return shop.build(r, tier);
  const change = pay - total;
  return {
    text: `${name} buys ${n} T-shirts at $${price} each. There is ${p}% off the T-shirts. ${name} also buys a cap for $${extra} (no discount). ${name} pays with $${pay}. How much change does ${name} get?`,
    correct: moneyAuto(change),
    wrong: [moneyAuto(pay - sub - extra > 0 ? pay - sub - extra : change + 5), moneyAuto(pay - total + disc), moneyAuto(total), moneyAuto(change + extra)],
    verify: `${pay}-(${n}*${price}-${n}*${price}*${p}/100+${extra})`,
    pad: (d) => moneyAuto(change + d),
    asks: 'Work out the discounted cost, add the cap, then find the change.',
    concept: 'Multi-step problems: break them into small steps and keep track of each result.',
    steps: [`T-shirts before discount: ${n} × $${price} = $${sub}.`, `Discount: ${p}% of $${sub} = $${disc}, so they cost $${sub - disc}.`, `Add the cap: $${sub - disc} + $${extra} = $${total}.`, `Change: $${pay} − $${total} = $${change}.`],
    mistake: 'Applying the discount to the cap too, or forgetting to subtract the total from the money paid.',
    tip: 'Write one line for each step so you can check your work.',
  };
});

const garden = T('ms.fence', 'ms.fence', 'Perimeter and cost', 'Multi-step Problems', [3, 5], (r, tier) => {
  const l = r.int(8, 25);
  const w = r.int(5, l - 1);
  const rate = r.pick([3, 4, 5, 6, 8]);
  const gate = r.int(1, 3);
  const per = 2 * (l + w);
  const fence = per - gate;
  const cost = fence * rate;
  return {
    text: `A rectangular garden is ${l} m long and ${w} m wide. A fence goes all the way around it, except for a ${gate} m gap for the gate. The fence costs $${rate} per metre. What is the total cost of the fence?`,
    correct: `$${commas(cost)}`,
    wrong: [`$${commas(per * rate)}`, `$${commas(l * w * rate)}`, `$${commas(cost + rate * gate * 2)}`, `$${commas((l + w) * rate)}`],
    verify: `(2*(${l}+${w})-${gate})*${rate}`,
    pad: (d) => `$${commas(cost + d * rate)}`,
    asks: 'Find the length of fence needed and then its cost.',
    concept: 'Perimeter gives the distance around; multiply by the price per metre for the cost.',
    steps: [`Perimeter: 2 × (${l} + ${w}) = ${per} m.`, `Fence needed (without the gate): ${per} − ${gate} = ${fence} m.`, `Cost: ${fence} × $${rate} = $${commas(cost)}.`],
    mistake: 'Forgetting the gate gap, or using the area instead of the perimeter.',
    tip: 'Ask yourself: do I need the distance around (perimeter) or the space inside (area)?',
  };
});

const trip = T('ms.trip', 'ms.trip', 'Journey problems', 'Multi-step Problems', [3, 5], (r, tier) => {
  const speed = r.pick([40, 50, 60, 80, 75]);
  const hours = r.pick([2, 3, 4, 2.5, 3.5]);
  const dist = F(Math.round(speed * hours * 10), 10);
  const kmPerL = r.pick([10, 12, 15, 20]);
  const litres = dist.div(F(kmPerL));
  if (!litres.terminating) return trip.build(r, tier);
  const price = r.pick([1.5, 2, 2.5, 1.2]);
  const cost = litres.mul(F(Math.round(price * 10), 10));
  const name = r.pick(NAMES);
  return {
    text: `${name}’s family drives for ${hours} hours at ${speed} km/h. Their car uses 1 litre of fuel for every ${kmPerL} km. Fuel costs $${price.toFixed(2)} per litre. How much does the fuel for the trip cost?`,
    correct: money(cost),
    wrong: [money(litres), money(dist.mul(F(Math.round(price * 10), 10))), money(cost.add(F(2))), money(cost.sub(F(1)).n > 0 ? cost.sub(F(1)) : cost.add(F(3)))],
    verify: `${speed}*${hours}/${kmPerL}*${price}`,
    pad: (d) => money(cost.add(F(d))),
    asks: 'Find the distance, then the litres of fuel, then the cost.',
    concept: 'Chain the steps: distance → fuel used → cost.',
    steps: [`Distance = ${speed} × ${hours} = ${ds(dist)} km.`, `Fuel = ${ds(dist)} ÷ ${kmPerL} = ${ds(litres)} litres.`, `Cost = ${ds(litres)} × $${price.toFixed(2)} = ${money(cost)}.`],
    mistake: 'Skipping the middle step and multiplying distance by the price of fuel.',
    tip: 'Keep track of the units: km → litres → dollars.',
  };
});

const recipe = T('ms.recipe', 'ms.recipe', 'Scaling with conversions', 'Multi-step Problems', [3, 5], (r, tier) => {
  const people = r.pick([4, 6, 8]);
  const mult = r.pick([2, 3, 5]);
  const flourG = r.pick([250, 300, 400, 150]);
  const target = people * mult;
  const need = flourG * mult;
  const bag = 1000;
  const bags = Math.ceil(need / bag);
  return {
    text: `A recipe for ${people} people uses ${flourG} g of flour. Flour is sold in 1 kg bags. How many bags must be bought to make the recipe for ${target} people?`,
    correct: String(bags),
    wrong: [String(bags + 1), String(Math.max(1, bags - 1)), String(need), String(Math.round(need / 100))],
    verify: `ceil(${flourG}*${mult}/1000)`,
    pad: (d) => String(bags + d),
    asks: 'Scale the recipe, change grams to kilograms, then decide how many bags.',
    concept: 'Scale up the amount, convert units, then round up because bags are sold whole.',
    steps: [`${target} people is ${mult} times ${people} people, so flour needed = ${flourG} × ${mult} = ${commas(need)} g.`, `${commas(need)} g = ${ds(F(need, 1000))} kg.`, `Bags are whole, so round up: ${bags}.`],
    mistake: 'Not rounding up, or forgetting to convert grams to kilograms.',
    tip: 'When you buy things in packs, always round up.',
  };
});

const percentChain = T('ms.percentchain', 'ms.percentchain', 'Successive percent changes', 'Multi-step Problems', [4, 5], (r, tier) => {
  const base = r.pick([100, 200, 400, 500, 800]);
  const up = r.pick([10, 20, 50, 25]);
  const down = r.pick([10, 20, 25, 50]);
  const after1 = (base * (100 + up)) / 100;
  const after2 = (after1 * (100 - down)) / 100;
  if (!Number.isInteger(after2)) return percentChain.build(r, tier);
  return {
    text: `A bike costs $${base}. The shop raises the price by ${up}%. Later the new price is reduced by ${down}%. What is the final price?`,
    correct: `$${commas(after2)}`,
    wrong: [`$${commas(base + (base * (up - down)) / 100)}`, `$${commas(after1)}`, `$${commas(after2 + 20)}`, `$${commas(Math.max(10, after2 - 20))}`].map((x, i) => (x === `$${commas(after2)}` ? `$${commas(after2 + 5 * (i + 1))}` : x)),
    verify: `${base}*(100+${up})/100*(100-${down})/100`,
    pad: (d) => `$${commas(after2 + 5 * d)}`,
    asks: 'Apply each change to the price at that moment.',
    concept: 'The second percent change applies to the NEW price, not the original.',
    steps: [`Increase: ${up}% of $${base} = $${(base * up) / 100}, so the price is $${after1}.`, `Decrease: ${down}% of $${after1} = $${(after1 * down) / 100}.`, `Final price: $${after1} − $${(after1 * down) / 100} = $${after2}.`],
    mistake: `Thinking that +${up}% and −${down}% simply cancel to ${up - down}%.`,
    tip: 'Do the percent changes one at a time, and use the latest price each time.',
  };
});

const tank = T('ms.tank', 'ms.tank', 'Filling and emptying', 'Multi-step Problems', [4, 5], (r, tier) => {
  const cap = r.pick([600, 800, 1000, 1200, 1500]);
  const startPc = r.pick([20, 25, 40, 50]);
  const fillRate = r.pick([20, 25, 30, 40, 50]);
  const leakRate = r.pick([5, 10, 15].filter((x) => x < fillRate));
  const start = (cap * startPc) / 100;
  const net = fillRate - leakRate;
  const need = cap - start;
  if (need % net !== 0) return tank.build(r, tier);
  const mins = need / net;
  return {
    text: `A tank holds ${commas(cap)} litres. It is ${startPc}% full. A tap adds ${fillRate} litres every minute, but a leak loses ${leakRate} litres every minute. How many minutes will it take to fill the tank completely?`,
    correct: `${mins} minutes`,
    wrong: [`${need % fillRate === 0 ? need / fillRate : mins + 3} minutes`, `${mins + 5} minutes`, `${Math.max(1, mins - 4)} minutes`, `${(cap % fillRate === 0 ? cap / fillRate : mins + 8)} minutes`].map((s, i) => (s === `${mins} minutes` ? `${mins + 10 + i} minutes` : s)),
    verify: `(${cap}-${cap}*${startPc}/100)/(${fillRate}-${leakRate})`,
    pad: (d) => `${mins + d} minutes`,
    asks: 'Find how much more water is needed and how fast the tank really fills.',
    concept: 'Net rate = rate in − rate out. Time = amount needed ÷ net rate.',
    steps: [`Already in the tank: ${startPc}% of ${commas(cap)} = ${commas(start)} L, so ${commas(need)} L is still needed.`, `Net fill rate: ${fillRate} − ${leakRate} = ${net} L per minute.`, `Time: ${commas(need)} ÷ ${net} = ${mins} minutes.`],
    mistake: 'Ignoring the leak, or forgetting that the tank is already partly full.',
    tip: 'When something fills and drains at the same time, subtract the rates.',
  };
});

const party = T('ms.party', 'ms.party', 'Planning and sharing', 'Multi-step Problems', [2, 5], (r, tier) => {
  const kids = r.int(10, 30);
  const adults = r.int(3, 8);
  const slicePer = r.pick([2, 3]);
  const sliceAdult = 2;
  const pizza = r.pick([8, 6]);
  const slices = kids * slicePer + adults * sliceAdult;
  const pizzas = Math.ceil(slices / pizza);
  const price = r.pick([9, 10, 12, 14]);
  const cost = pizzas * price;
  return {
    text: `At a party there are ${kids} children and ${adults} adults. Each child eats ${slicePer} slices of pizza and each adult eats ${sliceAdult} slices. Each pizza has ${pizza} slices and costs $${price}. What is the least amount of money needed to buy enough pizza?`,
    correct: `$${cost}`,
    wrong: [`$${(pizzas - 1) * price}`, `$${(pizzas + 1) * price}`, `$${Math.round(slices / pizza) * price === cost ? cost + price * 2 : Math.round(slices / pizza) * price}`, `$${slices * price}`],
    verify: `ceil((${kids}*${slicePer}+${adults}*${sliceAdult})/${pizza})*${price}`,
    pad: (d) => `$${cost + d * price}`,
    asks: 'Count the slices, then the pizzas (whole ones), then the cost.',
    concept: 'Find the total needed, divide by the pack size, round up, then multiply by the price.',
    steps: [`Slices: ${kids} × ${slicePer} + ${adults} × ${sliceAdult} = ${slices}.`, `Pizzas: ${slices} ÷ ${pizza} = ${(slices / pizza).toFixed(2)}, so round up to ${pizzas}.`, `Cost: ${pizzas} × $${price} = $${cost}.`],
    mistake: 'Rounding down the number of pizzas, so some people go hungry.',
    tip: 'You cannot buy part of a pizza – round up.',
  };
});

export const multistepTemplates: Template[] = [shop, garden, trip, recipe, percentChain, tank, party];
export { m, moneyAuto };
