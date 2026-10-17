// Builds the Australian Year 5 mixed-type question bank as CSV files you can upload in Admin > Import / Export.
// Usage: npm run bank:au   (writes exports/kenny-math-v2.csv and exports/kenny-math-v2-sets/set-01.csv ... set-30.csv)
import fs from 'node:fs';
import path from 'node:path';
import { buildAuBank, toQuestionData, AU_SEED } from '../src/lib/gen/au/plan';
import { auRowsToCsv } from '../src/lib/gen/au/csv';
import { validateBank } from '../src/lib/validate/bank';

const seed = process.env.AU_SEED || AU_SEED;
const rows = buildAuBank(seed);
const data = rows.map(toQuestionData);

const report = validateBank(data, { requireComplete: true });
const verified = report.perQuestion.filter((p) => p.status === 'VERIFIED').length;
console.log(`Seed ${seed}: ${rows.length} questions, ${verified} verified, ${report.invalidRows} invalid, ${report.reviewRows + report.warningRows} flagged for review.`);
if (!report.ok) {
  for (const e of report.bankErrors.slice(0, 20)) console.error('BANK ERROR:', e);
  for (const i of report.issues.filter((x) => x.severity === 'error').slice(0, 20)) console.error(`ROW ${i.row} ${i.questionId}: ${i.message}`);
  process.exit(1);
}

const out = path.resolve('exports');
fs.mkdirSync(path.join(out, 'kenny-math-v2-sets'), { recursive: true });
fs.writeFileSync(path.join(out, 'kenny-math-v2.csv'), auRowsToCsv(rows));
for (let t = 1; t <= 30; t++) {
  fs.writeFileSync(path.join(out, 'kenny-math-v2-sets', `set-${String(t).padStart(2, '0')}.csv`), auRowsToCsv(rows.filter((r) => r.testNumber === t)));
}

const byType = new Map<string, number>();
const bySection = new Map<string, number>();
for (const r of rows) {
  byType.set(r.question.questionType, (byType.get(r.question.questionType) ?? 0) + 1);
  bySection.set(r.topic, (bySection.get(r.topic) ?? 0) + 1);
}
console.log('By type:', Object.fromEntries(byType));
console.log('By section:', Object.fromEntries(bySection));
console.log('Wrote exports/kenny-math-v2.csv and exports/kenny-math-v2-sets/set-01.csv .. set-30.csv');
