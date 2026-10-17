import { BAND_NAMES, QUESTIONS_PER_TEST, TEST_COUNT, TOTAL_QUESTIONS, bandOf, levelOf } from '../gen/curriculum';
import { answerKeyText, typeOf } from '../question-types';
import { norm, validateQuestion, type Issue, type QuestionData, type QuestionValidation } from './question';

export interface RowIssue extends Issue {
  /** 1-based row number in the source file (or index+1 for stored banks). */
  row: number;
  questionId: string;
}

export interface BankValidationReport {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  missingFieldRows: number;
  testCountErrors: number;
  warningRows: number;
  reviewRows: number;
  verifiedRows: number;
  bankErrors: string[];
  bankWarnings: string[];
  issues: RowIssue[];
  perQuestion: { row: number; questionId: string; status: QuestionValidation['status']; method: QuestionValidation['method'] }[];
  /** True when nothing blocks publication. */
  ok: boolean;
  completeBank: boolean;
  generatedAt: string;
}

export interface BankValidationOptions {
  /** Require the full 30 × 30 structure. Defaults to true. */
  requireComplete?: boolean;
  /** Treat questions marked as manually reviewed as verified. */
  manuallyReviewed?: Set<string>;
}

export function validateBank(rows: QuestionData[], opts: BankValidationOptions = {}): BankValidationReport {
  const requireComplete = opts.requireComplete ?? true;
  const issues: RowIssue[] = [];
  const bankErrors: string[] = [];
  const bankWarnings: string[] = [];
  const perQuestion: BankValidationReport['perQuestion'] = [];
  const invalid = new Set<number>();
  const missing = new Set<number>();
  const warned = new Set<number>();
  const review = new Set<number>();
  const duplicateRows = new Set<number>();
  const verified = new Set<number>();

  rows.forEach((q, i) => {
    const row = i + 1;
    const res = validateQuestion(q);
    perQuestion.push({ row, questionId: q.questionId, status: res.status, method: res.method });
    const manual = opts.manuallyReviewed?.has(q.questionId);
    for (const is of res.issues) {
      if (manual && (is.severity === 'review' || is.severity === 'warning')) continue;
      issues.push({ ...is, row, questionId: q.questionId });
      if (is.severity === 'error') {
        invalid.add(row);
        if (is.code === 'MISSING_FIELD') missing.add(row);
      } else if (is.severity === 'warning') warned.add(row);
      else review.add(row);
    }
    if (res.status === 'VERIFIED' || (manual && res.status !== 'INVALID')) verified.add(row);
  });

  // --- unique ids / positions / text -----------------------------------------------------------
  const ids = new Map<string, number>();
  const positions = new Map<string, number>();
  const texts = new Map<string, number>();
  rows.forEach((q, i) => {
    const row = i + 1;
    const add = (code: string, message: string) => {
      issues.push({ severity: 'error', code, message, row, questionId: q.questionId });
      invalid.add(row);
      duplicateRows.add(row);
    };
    if (q.questionId) {
      const prev = ids.get(q.questionId);
      if (prev) add('DUPLICATE_ID', `question_id “${q.questionId}” already used in row ${prev}`);
      else ids.set(q.questionId, row);
    }
    const posKey = `${q.testNumber}:${q.position}`;
    const pp = positions.get(posKey);
    if (pp) add('DUPLICATE_POSITION', `Test ${q.testNumber} question ${q.position} is already used in row ${pp}`);
    else positions.set(posKey, row);
    const tk = norm(q.questionText) + '|' + norm(typeOf(q.questionType) === 'MCQ' ? (q.options[['A', 'B', 'C', 'D'].indexOf(q.correctAnswer)] ?? '') : answerKeyText({ questionType: q.questionType, answerData: q.answerData, correctAnswer: '' }) + '|' + (q.answerData ?? ''));
    const tp = texts.get(tk);
    if (tp) add('DUPLICATE_QUESTION', `Same question and answer as row ${tp}`);
    else texts.set(tk, row);
  });

  // --- structure -------------------------------------------------------------------------------
  let testCountErrors = 0;
  const byTest = new Map<number, QuestionData[]>();
  for (const q of rows) {
    if (!byTest.has(q.testNumber)) byTest.set(q.testNumber, []);
    byTest.get(q.testNumber)!.push(q);
  }
  if (requireComplete) {
    if (rows.length !== TOTAL_QUESTIONS) {
      bankErrors.push(`A complete bank needs ${TOTAL_QUESTIONS} questions (found ${rows.length}).`);
      testCountErrors++;
    }
    for (let t = 1; t <= TEST_COUNT; t++) {
      const list = byTest.get(t) ?? [];
      if (list.length !== QUESTIONS_PER_TEST) {
        bankErrors.push(`Test ${t} must have exactly ${QUESTIONS_PER_TEST} questions (found ${list.length}).`);
        testCountErrors++;
      }
      const seen = new Set(list.map((q) => q.position));
      const missingPos = Array.from({ length: QUESTIONS_PER_TEST }, (_, i) => i + 1).filter((p) => !seen.has(p));
      if (list.length && missingPos.length && list.length === QUESTIONS_PER_TEST) bankErrors.push(`Test ${t} has gaps in its positions (missing ${missingPos.slice(0, 5).join(', ')}).`);
    }
  }
  for (const t of byTest.keys()) {
    if (t < 1 || t > TEST_COUNT) {
      bankErrors.push(`Unexpected test number ${t}.`);
      testCountErrors++;
    }
  }

  // --- difficulty progression --------------------------------------------------------------------
  const levelAvg: Record<string, number[]> = {};
  for (const [t, list] of byTest) {
    if (list.length < QUESTIONS_PER_TEST) continue;
    const bands: number[][] = [[], [], [], []];
    for (const q of list) if (Number.isInteger(q.difficulty)) bands[bandOf(q.position)].push(q.difficulty);
    const avgs = bands.map((b) => (b.length ? b.reduce((a, c) => a + c, 0) / b.length : 0));
    for (let b = 1; b < 4; b++) {
      if (avgs[b] + 1e-9 < avgs[b - 1]) {
        bankErrors.push(`Test ${t}: difficulty drops from “${BAND_NAMES[b - 1]}” (avg ${avgs[b - 1].toFixed(1)}) to “${BAND_NAMES[b]}” (avg ${avgs[b].toFixed(1)}).`);
        testCountErrors++;
      }
    }
    if (avgs[3] <= avgs[0]) {
      bankErrors.push(`Test ${t}: the last questions must be harder than the first ones.`);
      testCountErrors++;
    }
    const lv = levelOf(t);
    (levelAvg[lv] ??= []).push(avgs.reduce((a, c) => a + c, 0) / 4);
  }
  const mean = (a: number[] | undefined) => (a && a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const [b, i, a] = [mean(levelAvg.Beginner), mean(levelAvg.Intermediate), mean(levelAvg.Advanced)];
  if (b !== null && i !== null && b >= i) bankWarnings.push('Intermediate tests should be harder on average than Beginner tests.');
  if (i !== null && a !== null && i >= a) bankWarnings.push('Advanced tests should be harder on average than Intermediate tests.');

  const invalidRows = invalid.size;
  const blocking = invalidRows > 0 || bankErrors.length > 0;
  return {
    totalRows: rows.length,
    validRows: rows.length - invalidRows,
    invalidRows,
    duplicateRows: duplicateRows.size,
    missingFieldRows: missing.size,
    testCountErrors,
    warningRows: warned.size,
    reviewRows: review.size,
    verifiedRows: verified.size,
    bankErrors,
    bankWarnings,
    issues,
    perQuestion,
    ok: !blocking,
    completeBank: rows.length === TOTAL_QUESTIONS,
    generatedAt: new Date().toISOString(),
  };
}
