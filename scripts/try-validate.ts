import { planBank, generateForSlot, DEFAULT_BANK_SEED } from '../src/lib/gen/bank';
import { validateBank } from '../src/lib/validate/bank';
import type { QuestionData } from '../src/lib/validate/question';
const plan = planBank();
const taken = new Set<string>();
const rows: QuestionData[] = [];
for (const s of plan) {
  const q = generateForSlot(DEFAULT_BANK_SEED, s, taken);
  taken.add(q.fingerprint);
  rows.push({ questionId: q.questionId, testNumber: q.testNumber, position: q.position, level: q.level, difficulty: q.difficulty, topic: q.topic, skill: q.skill, questionText: q.text, options: q.options, correctAnswer: q.correct, explanation: q.explanation, commonMistake: q.commonMistake, learningTip: q.learningTip, verifyExpr: q.verifyExpr });
}
const t0 = Date.now();
const rep = validateBank(rows);
console.log('validated in', Date.now() - t0, 'ms');
const { issues, perQuestion, ...summary } = rep;
console.log(summary);
const counts: Record<string, number> = {};
for (const i of issues) counts[i.code] = (counts[i.code] ?? 0) + 1;
console.log(counts);
for (const i of issues.slice(0, 25)) console.log(i.row, i.questionId, i.severity, i.code, i.message, '\n   ', rows[i.row - 1].questionText.slice(0, 100), '|', rows[i.row - 1].options.join(' / '));
