import { TEMPLATES } from '../src/lib/gen/registry';
import { buildFromTemplate } from '../src/lib/gen/engine';
import { Rng } from '../src/lib/gen/rng';

const only = process.argv[2];
let bad = 0;
const errs = new Map<string, string>();
for (const t of TEMPLATES) {
  if (only && !t.id.startsWith(only)) continue;
  for (let tier = t.tiers[0]; tier <= t.tiers[1]; tier++) {
    for (let s = 0; s < 150; s++) {
      try {
        buildFromTemplate(t, new Rng(`${t.id}-${tier}-${s}`), tier as 1);
      } catch (e) {
        bad++;
        const k = `${t.id} tier${tier}`;
        if (!errs.has(k)) errs.set(k, (e as Error).message);
      }
    }
  }
}
for (const [k, v] of errs) console.log(k, '=>', v);
console.log(`templates=${TEMPLATES.length} failures=${bad}`);
if (only) {
  const t = TEMPLATES.find((x) => x.id.startsWith(only))!;
  for (let tier = t.tiers[0]; tier <= t.tiers[1]; tier++) {
    try {
      const q = buildFromTemplate(t, new Rng('show' + tier), tier as 1);
      console.log(`--- ${t.id} tier ${tier}\n${q.text}\n${q.options.map((o, i) => 'ABCD'[i] + ') ' + o).join('\n')}\nCorrect ${q.correct}\n${q.explanation}`);
    } catch (e) {
      console.log('ERR', (e as Error).message);
    }
  }
}
