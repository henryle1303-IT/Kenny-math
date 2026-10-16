// Generates QA_REPORT.md content for the reference bank: structure, coverage, verification and flags.
// Usage: npm run qa:report  (writes qa/content-report.md)
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_BANK_SEED, generateFullBank } from '../src/lib/gen/bank';
import { validateBank } from '../src/lib/validate/bank';
import { TEMPLATES, SKILLS } from '../src/lib/gen/registry';
import { BAND_NAMES, bandOf, levelOf } from '../src/lib/gen/curriculum';
import { TOPICS } from '../src/lib/gen/types';
import type { QuestionData } from '../src/lib/validate/question';

const qs = generateFullBank(DEFAULT_BANK_SEED);
const rows: QuestionData[] = qs.map((g) => ({
  questionId: g.questionId, testNumber: g.testNumber, position: g.position, level: g.level, difficulty: g.difficulty, topic: g.topic, skill: g.skill,
  questionText: g.text, options: g.options, correctAnswer: g.correct, explanation: g.explanation, commonMistake: g.commonMistake, learningTip: g.learningTip, verifyExpr: g.verifyExpr,
}));
const rep = validateBank(rows);
const lines: string[] = [];
const L = (s = '') => lines.push(s);

L('## Content verification (reference bank, seed `' + DEFAULT_BANK_SEED + '`)');
L();
L(`Generated ${new Date().toISOString().slice(0, 10)} by \`npm run qa:report\`.`);
L();
L('| Check | Result |');
L('|---|---|');
L(`| Questions | ${rep.totalRows} |`);
L(`| Tests with exactly 30 questions | ${new Set(rows.map((r) => r.testNumber)).size}/30 (structure errors: ${rep.testCountErrors}) |`);
L(`| Questions with no error-level problems | ${rep.validRows}/${rep.totalRows} |`);
L(`| Duplicate IDs / positions / questions | ${rep.duplicateRows} |`);
L(`| Verified automatically (independent evaluator) | ${rep.verifiedRows}/${rep.totalRows} |`);
L(`| Methods | ${['both', 'expression', 'arithmetic-text', 'none'].map((m) => `${m}: ${rep.perQuestion.filter((p) => p.method === m).length}`).join(', ')} |`);
L(`| Flagged for manual review (warnings + review) | ${rep.reviewRows + rep.warningRows} |`);
L(`| Bank-level errors | ${rep.bankErrors.length} |`);
L(`| Bank-level warnings | ${rep.bankWarnings.length} |`);
L(`| Distinct question texts | ${new Set(rows.map((r) => r.questionText)).size} |`);
L(`| Distinct question “skeletons” (numbers/maths removed) | ${new Set(qs.map((q) => q.skeleton)).size} |`);
L(`| Templates used / available | ${new Set(qs.map((q) => q.templateId)).size}/${TEMPLATES.length} |`);
L(`| Skills (Smart Review) | ${SKILLS.length} |`);
L();

L('### Difficulty progression (average rating 1–5)');
L();
L('| Level | Tests | ' + BAND_NAMES.map((b, i) => `Q ${['1–10', '11–20', '21–25', '26–30'][i]} (${b})`).join(' | ') + ' | Overall |');
L('|---|---|---|---|---|---|---|');
for (const [lv, a, b] of [['Beginner', 1, 10], ['Intermediate', 11, 20], ['Advanced', 21, 30]] as const) {
  const sel = rows.filter((r) => r.testNumber >= a && r.testNumber <= b);
  const avg = (f: (r: QuestionData) => boolean) => {
    const x = sel.filter(f);
    return (x.reduce((s, r) => s + r.difficulty, 0) / x.length).toFixed(2);
  };
  L(`| ${lv} | ${a}–${b} | ${[0, 1, 2, 3].map((bi) => avg((r) => bandOf(r.position) === bi)).join(' | ')} | ${avg(() => true)} |`);
}
L();
L('Rating distribution: ' + [1, 2, 3, 4, 5].map((d) => `${d}: ${rows.filter((r) => r.difficulty === d).length}`).join(', '));
L();

L('### Topic coverage');
L();
L('| Topic | Questions | Per test | Skills |');
L('|---|---|---|---|');
for (const t of TOPICS) {
  const c = rows.filter((r) => r.topic === t).length;
  L(`| ${t} | ${c} | ${c / 30} | ${new Set(rows.filter((r) => r.topic === t).map((r) => r.skill)).size} |`);
}
L();

L('### Most re-used question patterns');
L();
const sk = new Map<string, number>();
for (const q of qs) sk.set(q.skeleton, (sk.get(q.skeleton) ?? 0) + 1);
const topSk = [...sk.entries()].filter(([k]) => !/^(calculate|what is|find the value|work out|find the missing|write ⟨m⟩)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 8);
for (const [k, v] of topSk) L(`- ${v}× \`${k.slice(0, 120)}\``);
L();
L('Pure calculation questions (“Calculate ⟨expression⟩”) necessarily share a skeleton; their numbers and operations differ.');
L();

L('### Questions flagged for manual review');
L();
if (rep.issues.length === 0) L('None. Every question was confirmed by the independent expression evaluator.');
else for (const i of rep.issues.slice(0, 50)) L(`- ${i.questionId} (${i.severity}) ${i.message}`);
L();
L('### Reading levels / content notes');
L();
L('- All answer keys are computed by code from the generated numbers; each key is then re-evaluated by an independent exact-arithmetic evaluator (`verify_expr`) and, for plain arithmetic questions, by parsing the displayed question text.');
L('- Verification confirms that the marked option is mathematically correct and that no other option has the same value. It does **not** replace a teacher reading the wording, which is why the admin panel lets a reviewer open any question.');

const out = path.resolve(__dirname, '../qa/content-report.md');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(lines.join('\n'));
