// Writes the reference 900-question bank to exports/kenny-math-bank-v1.csv (UTF-8 with BOM).
import fs from 'node:fs';
import path from 'node:path';
import { generateFullBank, DEFAULT_BANK_SEED } from '../src/lib/gen/bank';
import { questionsToCsv, type ExportQuestion } from '../src/lib/csv/export';
import { validateQuestion } from '../src/lib/validate/question';

const qs = generateFullBank(DEFAULT_BANK_SEED);
const rows: ExportQuestion[] = qs.map((g) => {
  const v = validateQuestion({
    questionId: g.questionId, testNumber: g.testNumber, position: g.position, level: g.level, difficulty: g.difficulty, topic: g.topic, skill: g.skill,
    questionText: g.text, options: g.options, correctAnswer: g.correct, explanation: g.explanation, commonMistake: g.commonMistake, learningTip: g.learningTip, verifyExpr: g.verifyExpr,
  });
  return {
    questionId: g.questionId, testNumber: g.testNumber, position: g.position, level: g.level, difficulty: g.difficulty, topic: g.topic, skill: g.skill,
    questionText: g.text, optionA: g.options[0], optionB: g.options[1], optionC: g.options[2], optionD: g.options[3], correctAnswer: g.correct,
    explanation: g.explanation, commonMistake: g.commonMistake, learningTip: g.learningTip, verifyExpr: g.verifyExpr, validationStatus: v.status,
  };
});
const out = path.resolve(__dirname, '../exports/kenny-math-bank-v1.csv');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, questionsToCsv(rows, 'reference-bank', 1), 'utf8');
console.log(`Wrote ${rows.length} questions to ${path.relative(process.cwd(), out)}`);
