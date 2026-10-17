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
  questionType?: string;
  answerData?: string | null;
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
    question_type: q.questionType ?? 'MCQ',
    answer_data: q.answerData ?? '',
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

function typedExample(id: string, type: string, text: string, data: string, verify: string, explanation: string): CsvRow {
  return {
    question_id: id, test_id: '1', question_number: String(Number(id.slice(-3))), test_level: 'Beginner', difficulty: '2', topic: 'Whole Numbers', skill: 'wn.addsub',
    question_text: text, option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: '', explanation,
    common_mistake: 'Rushing without checking.', learning_tip: 'Check your answer before moving on.', bank_id: '', bank_version: '', verify_expr: verify, validation_status: '', question_type: type, answer_data: data,
  };
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
      common_mistake: 'Forgetting to carry.', learning_tip: 'Add the hundreds first, then tens, then ones.', bank_id: '', bank_version: '', verify_expr: '345+128', validation_status: '', question_type: 'MCQ', answer_data: '',
    },
    {
      question_id: 'EXAMPLE-002', test_id: '1', question_number: '2', test_level: 'Beginner', difficulty: '1', topic: 'Fractions', skill: 'fr.add',
      question_text: 'Calculate \\(\\frac{1}{4} + \\frac{2}{4}\\). Give your answer in simplest form.', option_a: '\\(\\frac{3}{8}\\)', option_b: '\\(\\frac{3}{4}\\)', option_c: '\\(\\frac{2}{8}\\)', option_d: '\\(\\frac{1}{2}\\)', correct_answer: 'B',
      explanation: 'What it asks: Add two fractions.\nConcept: Same denominators – add only the numerators.\nStep 1: 1 + 2 = 3.\nStep 2: The denominator stays 4.\nAnswer: \\(\\frac{3}{4}\\)',
      common_mistake: 'Adding the denominators as well.', learning_tip: 'The denominator tells the size of the pieces; it does not change.', bank_id: '', bank_version: '', verify_expr: '1/4+2/4', validation_status: '', question_type: 'MCQ', answer_data: '',
    },
    {
      question_id: 'EXAMPLE-003', test_id: '1', question_number: '3', test_level: 'Beginner', difficulty: '2', topic: 'Geometry', skill: 'ge.area',
      question_text: 'A rectangle is 8 cm long and 5 cm wide. What is its area?', option_a: '13 cm²', option_b: '26 cm²', option_c: '40 cm²', option_d: '45 cm²', correct_answer: 'C',
      explanation: 'What it asks: Find the area.\nConcept: Area of a rectangle = length × width.\nStep 1: 8 × 5 = 40.\nAnswer: 40 cm²',
      common_mistake: 'Adding the sides instead of multiplying.', learning_tip: 'Area is measured in square units.', bank_id: '', bank_version: '', verify_expr: '8*5', validation_status: '', question_type: 'MCQ', answer_data: '',
    },
    typedExample('EXAMPLE-004', 'NUMERIC_INPUT', 'Type your answer as a number. Calculate \\(\\frac{1}{4} + \\frac{1}{2}\\).', '{"accepted":["3/4","0.75"]}', '1/4+1/2', 'Add the fractions.\nStep 1: 1/2 = 2/4.\nStep 2: 1/4 + 2/4 = 3/4.\nAnswer: 3/4'),
    typedExample('EXAMPLE-005', 'TRUE_FALSE', 'Say whether each statement is true or false.', '{"statements":[{"text":"\\\\(\\\\frac{1}{2} > \\\\frac{1}{3}\\\\)","truth":true},{"text":"0.5 is less than 0.25","truth":false}]}', '', 'Statement 1: halves are bigger than thirds, so it is true.\nStatement 2: 0.5 is bigger than 0.25, so it is false.\nAnswer: True, False'),
    typedExample('EXAMPLE-006', 'MULTI_SELECT', 'Choose ALL the multiples of 3.', '{"options":["6","8","9","10"],"correct":[0,2]}', '', 'Count in threes: 3, 6, 9, 12.\nAnswer: 6, 9'),
    typedExample('EXAMPLE-007', 'FILL_BLANK', 'Fill in the blanks: \\(\\frac{3}{4} + \\frac{1}{4} = \\) {1}, and \\(2 \\times 5 = \\) {2}.', '{"blanks":[{"accepted":["1"]},{"accepted":["10"]}]}', '', 'Three quarters plus one quarter makes one whole, and 2 x 5 = 10.\nAnswer: 1, 10'),
    typedExample('EXAMPLE-008', 'ORDERING', 'Put these from smallest to largest.', '{"items":["0.2","0.25","0.3"]}', '', 'Compare in hundredths: 0.20, 0.25, 0.30.\nAnswer: 0.2, 0.25, 0.3'),
    typedExample('EXAMPLE-009', 'SHORT_TEXT', 'What do we call a shape with 4 equal sides and 4 right angles?', '{"accepted":["square"]}', '', 'A shape with four equal sides and four right angles is a square.\nAnswer: square'),
  ];
  // Fix example 1 so that the options are distinct and consistent.
  examples[0].option_d = '372';
  const body = rowsToCsv(examples, ALL_COLUMNS).slice(BOM.length);
  return BOM + lines.join('\r\n') + '\r\n' + body;
}

export { CORE_COLUMNS };

/** `tests` accepts ranges and lists, e.g. 1-5,9,12 . Omit for the whole bank. */
export function parseTests(s: string | null): number[] | undefined {
  if (!s?.trim()) return undefined;
  const out = new Set<number>();
  for (const part of s.split(',')) {
    const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);
    if (!m) throw new RangeError('Enter test numbers from 1 to 30, for example 5, 1-10 or 3,7,12-14.');
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || a > 30 || b < 1 || b > 30) throw new RangeError('Test numbers must be between 1 and 30.');
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.add(i);
  }
  return [...out].sort((a, b) => a - b);
}
