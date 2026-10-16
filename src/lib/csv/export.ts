import Papa from 'papaparse';
import { ALL_COLUMNS, CORE_COLUMNS, COLUMN_DESCRIPTIONS, type CsvRow } from './columns';

export const BOM = '﻿';

/** Neutralise spreadsheet formulas. `unsanitizeCell` reverses it on import. */
export function sanitizeCell(value: string): string {
  if (/^[=+@\t\r]/.test(value) || /^-(?![\d.]\d*)/.test(value) || /^-$/.test(value)) return `'${value}`;
  return value;
}
export function unsanitizeCell(value: string): string {
  return /^'[=+@\t\r-]/.test(value) ? value.slice(1) : value;
}

export interface ExportQuestion {
  questionId: string;
  testNumber: number;
  position: number;
  level: string;
  difficulty: number;
  topic: string;
  skill: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  explanation: string;
  commonMistake: string;
  learningTip: string;
  verifyExpr: string | null;
  validationStatus: string;
}

export function questionToCsvRow(q: ExportQuestion, bankId: string, bankVersion: number): CsvRow {
  return {
    question_id: q.questionId,
    test_id: String(q.testNumber),
    question_number: String(q.position),
    test_level: q.level,
    difficulty: String(q.difficulty),
    topic: q.topic,
    skill: q.skill,
    question_text: q.questionText,
    option_a: q.optionA,
    option_b: q.optionB,
    option_c: q.optionC,
    option_d: q.optionD,
    correct_answer: q.correctAnswer,
    explanation: q.explanation,
    common_mistake: q.commonMistake,
    learning_tip: q.learningTip,
    bank_id: bankId,
    bank_version: String(bankVersion),
    verify_expr: q.verifyExpr ?? '',
    validation_status: q.validationStatus,
  };
}

/** Serialise rows as UTF-8-with-BOM CSV (CRLF line endings, quotes only where needed). */
export function rowsToCsv(rows: CsvRow[], columns: readonly string[] = ALL_COLUMNS): string {
  const data = rows.map((r) => columns.map((c) => sanitizeCell(String((r as Record<string, string>)[c] ?? ''))));
  return BOM + Papa.unparse({ fields: [...columns], data }, { newline: '\r\n', quotes: false, skipEmptyLines: false });
}

export function questionsToCsv(questions: ExportQuestion[], bankId: string, bankVersion: number): string {
  const sorted = questions.slice().sort((a, b) => a.testNumber - b.testNumber || a.position - b.position);
  return rowsToCsv(sorted.map((q) => questionToCsvRow(q, bankId, bankVersion)));
}

/** Template: comment lines describing each column, then a few clearly marked example rows. */
export function buildTemplateCsv(): string {
  const comment = (s: string) => `# ${s.replace(/[\r\n]+/g, ' ')}`;
  const lines: string[] = [
    comment('KENNY MATH CHALLENGE – question bank template. Lines starting with # are ignored on import.'),
    comment('Rows whose question_id starts with EXAMPLE- are examples and are skipped unless you tick “include example rows”.'),
    ...ALL_COLUMNS.map((c) => comment(`${c}: ${COLUMN_DESCRIPTIONS[c]}`)),
  ];
  const examples: CsvRow[] = [
    {
      question_id: 'EXAMPLE-001', test_id: '1', question_number: '1', test_level: 'Beginner', difficulty: '1', topic: 'Whole Numbers', skill: 'wn.addsub',
      question_text: 'Calculate \\(345 + 128\\).', option_a: '463', option_b: '473', option_c: '483', option_d: '473 ', correct_answer: 'B',
      explanation: 'What it asks: Find the total.\nConcept: Add column by column.\nStep 1: 345 + 100 = 445.\nStep 2: 445 + 28 = 473.\nAnswer: 473',
      common_mistake: 'Forgetting to carry.', learning_tip: 'Add the hundreds first, then tens, then ones.', bank_id: '', bank_version: '', verify_expr: '345+128', validation_status: '',
    },
    {
      question_id: 'EXAMPLE-002', test_id: '1', question_number: '2', test_level: 'Beginner', difficulty: '1', topic: 'Fractions', skill: 'fr.add',
      question_text: 'Calculate \\(\\frac{1}{4} + \\frac{2}{4}\\). Give your answer in simplest form.', option_a: '\\(\\frac{3}{8}\\)', option_b: '\\(\\frac{3}{4}\\)', option_c: '\\(\\frac{2}{8}\\)', option_d: '\\(\\frac{1}{2}\\)', correct_answer: 'B',
      explanation: 'What it asks: Add two fractions.\nConcept: Same denominators – add only the numerators.\nStep 1: 1 + 2 = 3.\nStep 2: The denominator stays 4.\nAnswer: \\(\\frac{3}{4}\\)',
      common_mistake: 'Adding the denominators as well.', learning_tip: 'The denominator tells the size of the pieces; it does not change.', bank_id: '', bank_version: '', verify_expr: '1/4+2/4', validation_status: '',
    },
    {
      question_id: 'EXAMPLE-003', test_id: '1', question_number: '3', test_level: 'Beginner', difficulty: '2', topic: 'Geometry', skill: 'ge.area',
      question_text: 'A rectangle is 8 cm long and 5 cm wide. What is its area?', option_a: '13 cm²', option_b: '26 cm²', option_c: '40 cm²', option_d: '45 cm²', correct_answer: 'C',
      explanation: 'What it asks: Find the area.\nConcept: Area of a rectangle = length × width.\nStep 1: 8 × 5 = 40.\nAnswer: 40 cm²',
      common_mistake: 'Adding the sides instead of multiplying.', learning_tip: 'Area is measured in square units.', bank_id: '', bank_version: '', verify_expr: '8*5', validation_status: '',
    },
  ];
  // Fix example 1 so that the options are distinct and consistent.
  examples[0].option_d = '372';
  const body = rowsToCsv(examples, ALL_COLUMNS).slice(BOM.length);
  return BOM + lines.join('\r\n') + '\r\n' + body;
}

export { CORE_COLUMNS };

/** `tests` accepts ranges and lists, e.g. 1-5,9,12 . Omit for the whole bank. */
export function parseTests(s: string | null): number[] | undefined {
  if (!s) return undefined;
  const out = new Set<number>();
  for (const part of s.split(',')) {
    const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b) && i <= 30; i++) if (i >= 1) out.add(i);
  }
  return [...out];
}

