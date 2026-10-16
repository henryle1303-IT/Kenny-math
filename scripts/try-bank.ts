import { planBank, generateForSlot, DEFAULT_BANK_SEED } from '../src/lib/gen/bank';
const t0 = Date.now();
const plan = planBank();
const taken = new Set<string>();
const topicCount: Record<string, number> = {};
const tplCount: Record<string, number> = {};
const skel = new Map<string, number>();
let n = 0;
for (const s of plan) {
  const q = generateForSlot(DEFAULT_BANK_SEED, s, taken);
  taken.add(q.fingerprint);
  topicCount[q.topic] = (topicCount[q.topic] ?? 0) + 1;
  tplCount[q.templateId] = (tplCount[q.templateId] ?? 0) + 1;
  skel.set(q.skeleton, (skel.get(q.skeleton) ?? 0) + 1);
  n++;
  if (process.argv[2] && q.testNumber === Number(process.argv[2])) {
    console.log(`T${q.testNumber} Q${q.position} [${q.topic}/${q.templateId} d${q.difficulty}] ${q.text}\n    ${q.options.map((o, i) => 'ABCD'[i] + ')' + o).join('  ')}  => ${q.correct}`);
  }
}
console.log('generated', n, 'in', Date.now() - t0, 'ms');
console.log(topicCount);
console.log('templates used', Object.keys(tplCount).length, 'min/max use', Math.min(...Object.values(tplCount)), Math.max(...Object.values(tplCount)));
console.log('distinct skeletons', skel.size, 'top:', [...skel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8));
