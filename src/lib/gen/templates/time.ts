import { T } from '../define';
import { Frac } from '../../math/fraction';
import { NAMES, commas, decStr, m } from '../h';
import type { Template } from '../types';

const F = (n: number, d = 1) => new Frac(n, d);
const ds = (f: Frac) => decStr(f);

const clock = (mins: number): string => {
  const h24 = Math.floor(mins / 60) % 24;
  const mm = mins % 60;
  const ap = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(mm).padStart(2, '0')} ${ap}`;
};
const hm = (mins: number): string => `${Math.floor(mins / 60)} h ${mins % 60} min`;

const elapsed = T('ts.elapsed', 'ts.clock', 'Clock time and elapsed time', 'Time & Speed', [1, 4], (r, tier) => {
  const start = r.int(7 * 60, 15 * 60) + 5 * r.int(0, 11);
  const dur = tier === 1 ? 5 * r.int(6, 17) : tier === 2 ? r.int(41, 150) : r.int(70, 330);
  const d = dur % 60 === 0 ? dur + 5 : dur;
  const end = start + d;
  const name = r.pick(NAMES);
  const ev = r.pick(['film', 'football match', 'swimming lesson', 'art class', 'train journey']);
  return {
    text: `A ${ev} starts at ${clock(start)} and ends at ${clock(end)}. How long does it last?`,
    correct: hm(d),
    wrong: [hm(d + 10), hm(Math.max(5, d - 10)), hm(d + 60), hm(d + 40 > 0 ? d + 100 - 60 * Math.floor((d + 100) / 60) + 60 * Math.floor(d / 60) : d + 5)],
    verify: `${end}-${start}`,
    pad: (x) => hm(d + 5 * x),
    asks: 'Find the time between the start and the end.',
    concept: 'Elapsed time = end time − start time. Count up to the next hour, then add the rest.',
    steps: [`From ${clock(start)} to the next hour is ${60 - (start % 60) || 60} min.`, `Then count on to ${clock(end)}.`, `Total: ${hm(d)}.`],
    mistake: 'Subtracting the minutes as if there were 100 minutes in an hour.',
    tip: `There are 60 minutes in an hour. Use a number line to hop from ${clock(start)} to ${clock(end)}.`,
  };
});

const arrival = T('ts.arrival', 'ts.clock', 'Clock time and elapsed time', 'Time & Speed', [2, 5], (r, tier) => {
  const start = r.int(6 * 60, 14 * 60) + 5 * r.int(0, 11);
  const dur = tier === 2 ? r.int(35, 95) : tier === 3 ? r.int(80, 190) : r.int(150, 400);
  const d = dur % 5 === 0 ? dur : dur + (5 - (dur % 5));
  const end = start + d;
  const reverse = tier >= 4 && r.chance(0.5);
  const name = r.pick(NAMES);
  if (reverse) {
    return {
      text: `${name}’s bus journey takes ${hm(d)} and the bus must arrive at ${clock(end)}. What is the latest time the bus can leave?`,
      correct: clock(start),
      wrong: [clock(start + 60), clock(start - 60), clock(start + 10), clock(start - 10)],
      verify: `${end}-${d}`,
      pad: (x) => clock(start + 5 * x),
      asks: 'Work backwards from the arrival time.',
      concept: 'Departure time = arrival time − journey time.',
      steps: [`Subtract the hours: ${clock(end)} − ${Math.floor(d / 60)} h.`, `Then subtract the minutes: ${d % 60} min.`, `The bus leaves at ${clock(start)}.`],
      mistake: 'Adding the journey time instead of subtracting.',
      tip: 'Going back in time means subtracting.',
    };
  }
  return {
    text: `${name} starts homework at ${clock(start)} and it takes ${hm(d)}. What time does ${name} finish?`,
    correct: clock(end),
    wrong: [clock(end + 10), clock(end - 10), clock(end + 60), clock(end - 60)],
    verify: `${start}+${d}`,
    pad: (x) => clock(end + 5 * x),
    asks: 'Add the time taken to the start time.',
    concept: 'End time = start time + duration. Remember 60 minutes make 1 hour.',
    steps: [`Add the hours: ${clock(start)} + ${Math.floor(d / 60)} h = ${clock(start + Math.floor(d / 60) * 60)}.`, `Add the minutes: + ${d % 60} min = ${clock(end)}.`],
    mistake: 'Carrying over 100 minutes instead of 60.',
    tip: 'Add the hours first, then the minutes.',
  };
});

const distance = T('ts.distance', 'ts.speed', 'Distance, speed and time', 'Time & Speed', [1, 5], (r, tier) => {
  const vehicle = r.pick(['A car', 'A bus', 'A cyclist', 'A train', 'A runner']);
  const speed = tier === 1 ? r.int(4, 12) * 5 : tier <= 3 ? r.int(8, 18) * 5 : r.int(12, 30) * 5;
  const hours = tier === 1 ? r.int(2, 4) : tier <= 3 ? r.pick([2.5, 3.5, 1.5, 4.5]) : r.pick([2.25, 1.75, 3.75, 2.5, 4.25]);
  const d = F(Math.round(speed * hours * 100), 100);
  return {
    text: `${vehicle} travels at a steady speed of ${speed} km/h for ${hours} hours. How far does it travel?`,
    correct: `${ds(d)} km`,
    wrong: [`${ds(F(speed).div(F(Math.round(hours * 100), 100)).terminating ? F(speed).div(F(Math.round(hours * 100), 100)) : d.add(F(10)))} km`, `${ds(d.add(F(speed)))} km`, `${ds(F(speed).add(F(Math.round(hours * 100), 100)))} km`, `${ds(d.sub(F(speed)).n > 0 ? d.sub(F(speed)) : d.add(F(20)))} km`],
    verify: `${speed}*${hours}`,
    pad: (x) => `${ds(d.add(F(x * 5)))} km`,
    asks: 'Use speed and time to find the distance.',
    concept: 'Distance = speed × time.',
    steps: [`Distance = speed × time = ${speed} × ${hours}.`, `${speed} × ${hours} = ${ds(d)} km.`],
    mistake: 'Dividing speed by time instead of multiplying.',
    tip: 'Remember the triangle: Distance = Speed × Time; Speed = Distance ÷ Time; Time = Distance ÷ Speed.',
  };
});

const speedFind = T('ts.speed', 'ts.speed', 'Distance, speed and time', 'Time & Speed', [2, 5], (r, tier) => {
  const speed = r.int(5, 24) * (tier <= 3 ? 5 : 4);
  const hours = tier <= 3 ? r.int(2, 6) : r.pick([2.5, 3.5, 1.5, 4.5, 2.25]);
  const d = F(Math.round(speed * hours * 100), 100);
  const who = r.pick(NAMES);
  return {
    text: `${who} rides ${ds(d)} km in ${hours} hours at a constant speed. What is the speed in km/h?`,
    correct: `${speed} km/h`,
    wrong: [`${ds(d.add(F(Math.round(hours * 100), 100)))} km/h`, `${speed + 5} km/h`, `${Math.max(1, speed - 5)} km/h`, `${speed * 2} km/h`],
    verify: `${ds(d)}/${hours}`,
    pad: (x) => `${speed + 5 * x} km/h`,
    asks: 'Find how far is travelled in one hour.',
    concept: 'Speed = distance ÷ time.',
    steps: [`Speed = ${ds(d)} ÷ ${hours}.`, `${ds(d)} ÷ ${hours} = ${speed} km/h.`],
    mistake: 'Multiplying the distance by the time.',
    tip: 'Speed means “how far in ONE hour”, so divide by the number of hours.',
  };
});

const timeFind = T('ts.timefind', 'ts.speed', 'Distance, speed and time', 'Time & Speed', [2, 5], (r, tier) => {
  const speed = r.pick(tier <= 3 ? [40, 50, 60, 80, 30, 45] : [48, 36, 72, 54, 84, 66]);
  const mins = tier <= 3 ? speed * 0 + r.pick([1, 2, 3, 4]) * 60 + r.pick([15, 30, 45]) * (speed % 20 === 0 ? 1 : 0) : r.pick([75, 105, 135, 165, 195, 150, 90]);
  const total = tier <= 3 ? (mins % 60 === 0 ? mins + 30 : mins) : mins;
  const d = F(speed * total, 60);
  if (!d.isInt && !d.terminating) return timeFind.build(r, tier);
  return {
    text: r.pick([
      `A train travels at ${speed} km/h. How long does it take to travel ${ds(d)} km?`,
      `A coach drives at a steady ${speed} km/h. How long will it take to cover ${ds(d)} km?`,
      `A ferry sails at ${speed} km/h. How much time does it need to cross ${ds(d)} km of sea?`,
      `${r.pick(NAMES)}’s family drives at ${speed} km/h on a motorway. How long does a ${ds(d)} km trip take?`,
    ]),
    correct: hm(total),
    wrong: [hm(total + 30), hm(Math.max(15, total - 30)), hm(total + 60), hm(total + 15)],
    verify: `${ds(d)}/${speed}*60`,
    pad: (x) => hm(total + 15 * x),
    asks: 'Work out the travel time and give it in hours and minutes.',
    concept: 'Time = distance ÷ speed. A decimal part of an hour can be changed to minutes by multiplying by 60.',
    steps: [`Time = ${ds(d)} ÷ ${speed} = ${ds(F(total, 60).terminating ? F(total, 60) : F(total, 60))} hours.`.replace(/\d+\/\d+ hours/, `${total} ÷ 60 hours`), `${total} minutes = ${hm(total)}.`],
    mistake: 'Writing 2.5 hours as 2 hours 50 minutes.',
    tip: '0.5 hour = 30 minutes, 0.25 hour = 15 minutes, 0.75 hour = 45 minutes.',
  };
});

const unitsConvert = T('ts.convert', 'ts.convert', 'Converting units of time', 'Time & Speed', [1, 4], (r, tier) => {
  const kind = r.int(0, tier === 1 ? 1 : 3);
  if (kind === 0) {
    const h = tier === 1 ? r.int(2, 6) : r.pick([2.5, 3.5, 1.25, 4.75, 5.5]);
    const v = F(Math.round(h * 100) * 60, 100);
    return {
      text: `How many minutes are there in ${h} hours?`,
      correct: `${ds(v)} minutes`,
      wrong: [`${ds(F(Math.round(h * 100) * 100, 100))} minutes`, `${ds(v.add(F(10)))} minutes`, `${ds(v.div(F(60)).add(F(0)))} minutes`.replace(/^[\d.]+ /, `${Math.round(h * 50)} `), `${ds(v.sub(F(30)))} minutes`],
      verify: `${h}*60`,
      pad: (x) => `${ds(v.add(F(x * 5)))} minutes`,
      asks: 'Change hours into minutes.',
      concept: '1 hour = 60 minutes.',
      steps: [`${h} × 60 = ${ds(v)} minutes.`],
      mistake: 'Using 100 instead of 60.',
      tip: 'Half an hour is 30 minutes, a quarter of an hour is 15 minutes.',
    };
  }
  if (kind === 1) {
    const min = r.int(3, 20);
    return {
      text: `How many seconds are there in ${min} minutes?`,
      correct: `${commas(min * 60)} seconds`,
      wrong: [`${commas(min * 100)} seconds`, `${commas(min * 60 + 60)} seconds`, `${commas(min * 6)} seconds`, `${commas(min * 60 - 60)} seconds`],
      verify: `${min}*60`,
      pad: (x) => `${commas(min * 60 + 30 * x)} seconds`,
      asks: 'Change minutes into seconds.',
      concept: '1 minute = 60 seconds.',
      steps: [`${min} × 60 = ${commas(min * 60)} seconds.`],
      mistake: 'Using 100 seconds in a minute.',
      tip: 'Multiply by 60 when you go from minutes to seconds.',
    };
  }
  if (kind === 2) {
    const d = r.int(2, 6);
    const h = r.int(3, 20);
    return {
      text: `A camping trip lasts ${d} days and ${h} hours. How many hours is that altogether?`,
      correct: `${d * 24 + h} hours`,
      wrong: [`${d * 12 + h} hours`, `${d * 100 + h} hours`, `${d * 24 + h + 12} hours`, `${d * 24} hours`],
      verify: `${d}*24+${h}`,
      pad: (x) => `${d * 24 + h + x} hours`,
      asks: 'Change the days into hours and add the extra hours.',
      concept: '1 day = 24 hours.',
      steps: [`${d} × 24 = ${d * 24} hours.`, `${d * 24} + ${h} = ${d * 24 + h} hours.`],
      mistake: 'Forgetting to add the extra hours.',
      tip: 'Do the big unit first, then add what is left.',
    };
  }
  const w = r.int(2, 9);
  const d = r.int(1, 6);
  return {
    text: `A school holiday lasts ${w} weeks and ${d} days. How many days is that altogether?`,
    correct: `${w * 7 + d} days`,
    wrong: [`${w * 10 + d} days`, `${w * 7} days`, `${w * 7 + d + 7} days`, `${w * 5 + d} days`],
    verify: `${w}*7+${d}`,
    pad: (x) => `${w * 7 + d + x} days`,
    asks: 'Change weeks into days and add the extra days.',
    concept: '1 week = 7 days.',
    steps: [`${w} × 7 = ${w * 7} days.`, `${w * 7} + ${d} = ${w * 7 + d} days.`],
    mistake: 'Using 10 days in a week.',
    tip: 'Seven days make a week.',
  };
});

const avgSpeed = T('ts.avgspeed', 'ts.advanced', 'Average speed and meeting problems', 'Time & Speed', [4, 5], (r, tier) => {
  const s1 = r.pick([40, 60, 80, 50, 30]);
  const t1 = r.int(1, 3);
  const s2 = r.pick([30, 50, 60, 90, 70].filter((x) => x !== s1));
  const t2 = r.int(1, 4);
  const d = s1 * t1 + s2 * t2;
  const T = t1 + t2;
  const avg = F(d, T);
  if (!avg.terminating) return avgSpeed.build(r, tier);
  const name = r.pick(NAMES);
  return {
    text: `${name}’s family drives ${t1} hours at ${s1} km/h and then ${t2} hours at ${s2} km/h. What is the average speed for the whole journey in km/h?`,
    correct: `${ds(avg)} km/h`,
    wrong: [`${ds(F(s1 + s2, 2))} km/h`, `${ds(avg.add(F(5)))} km/h`, `${d} km/h`, `${ds(avg.sub(F(5)))} km/h`].map((s, i) => (i === 0 && F(s1 + s2, 2).eq(avg) ? `${ds(avg.add(F(10)))} km/h` : s)),
    verify: `(${s1}*${t1}+${s2}*${t2})/(${t1}+${t2})`,
    pad: (x) => `${ds(avg.add(F(x * 5)))} km/h`,
    asks: 'Use total distance and total time.',
    concept: 'Average speed = total distance ÷ total time (not the average of the two speeds unless the times are equal).',
    steps: [`Distances: ${s1} × ${t1} = ${s1 * t1} km and ${s2} × ${t2} = ${s2 * t2} km. Total ${d} km.`, `Total time: ${t1} + ${t2} = ${T} hours.`, `Average speed: ${d} ÷ ${T} = ${ds(avg)} km/h.`],
    mistake: `Averaging the two speeds (${s1} + ${s2}) ÷ 2.`,
    tip: 'Always divide the TOTAL distance by the TOTAL time.',
  };
});

const meet = T('ts.meet', 'ts.advanced', 'Average speed and meeting problems', 'Time & Speed', [5, 5], (r, tier) => {
  const s1 = r.pick([40, 50, 60, 45]);
  const s2 = r.pick([30, 40, 55, 60].filter((x) => x !== s1));
  const t = r.int(2, 5);
  const d = (s1 + s2) * t;
  const [a, b] = r.sample(NAMES, 2);
  return {
    text: `${a} and ${b} live ${d} km apart. They leave their homes at the same time and travel towards each other along the same road, ${a} at ${s1} km/h and ${b} at ${s2} km/h. After how many hours do they meet?`,
    correct: `${t} hours`,
    wrong: [`${t + 1} hours`, `${Math.max(1, t - 1)} hours`, `${F(d, s1).terminating ? ds(F(d, s1)) : t + 2} hours`, `${F(d, 2 * Math.max(s1, s2)).terminating ? ds(F(d, 2 * Math.max(s1, s2))) : t + 3} hours`].map((s, i) => (s.startsWith(`${t} `) ? `${t + 4} hours` : s)),
    verify: `${d}/(${s1}+${s2})`,
    pad: (x) => `${t + x} hours`,
    asks: 'Find when the gap between them closes to zero.',
    concept: 'When two things move towards each other, the gap closes at the SUM of their speeds.',
    steps: [`Together they close ${s1} + ${s2} = ${s1 + s2} km every hour.`, `Time = ${d} ÷ ${s1 + s2} = ${t} hours.`],
    mistake: 'Dividing the distance by only one speed.',
    tip: 'Add the speeds when moving towards each other.',
  };
});

export const timeTemplates: Template[] = [elapsed, arrival, distance, speedFind, timeFind, unitsConvert, avgSpeed, meet];
export { m };
