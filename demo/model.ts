import { generateFullBank } from '../src/lib/gen/bank';
import { gradeAnswers } from '../src/lib/grading';
import type { QuestionData } from '../src/lib/validate/question';
import { validateBank } from '../src/lib/validate/bank';
import { mapCsvRows, parseCsvBytes, MAX_UPLOAD_BYTES } from '../src/lib/csv/import';
import { questionToCsvRow, rowsToCsv } from '../src/lib/csv/export';

export const STORAGE_KEY = 'kenny-math-demo-v1';
export type Question = QuestionData;
export interface Bank { id: string; name: string; status: 'DRAFT' | 'PUBLISHED'; questions: Question[] }
export interface Attempt {
  id: string; bankId: string; testNumber: number; practice: boolean; questions: Question[];
  answers: Record<string, string>; startedAt: number; expiresAt: number | null; submittedAt: number | null;
}
export interface DemoState { version: 1; studentName: string; banks: Bank[]; activeBankId: string; attempts: Attempt[] }
export const id = () => crypto.randomUUID();

export function newBank(name: string, seed: string, bankId = id()): Bank {
  return { id: bankId, name, status: 'DRAFT', questions: generateFullBank(seed).map((q) => ({
    questionId: q.questionId, testNumber: q.testNumber, position: q.position, level: q.level,
    difficulty: q.difficulty, topic: q.topic, skill: q.skill, questionText: q.text,
    options: q.options, correctAnswer: q.correct, explanation: q.explanation,
    commonMistake: q.commonMistake, learningTip: q.learningTip, verifyExpr: q.verifyExpr,
  })) };
}
export function initialState(): DemoState {
  const bank = newBank('Original Questions', 'kenny-grade5-v1', 'demo-original');
  bank.status = 'PUBLISHED';
  return { version: 1, studentName: 'Kenny', banks: [bank], activeBankId: bank.id, attempts: [] };
}
export function readState(text: string): DemoState {
  const value = JSON.parse(text) as DemoState;
  if (value.version !== 1 || !Array.isArray(value.banks) || !value.banks.length || !Array.isArray(value.attempts) ||
      !value.banks.every((b) => Array.isArray(b.questions) && b.questions.length === 900) ||
      !value.banks.some((b) => b.id === value.activeBankId)) throw new Error('Invalid demo data');
  return value;
}
export const grade = (a: Attempt) => gradeAnswers(a.questions.map((q) => ({
  questionId: q.questionId, correctAnswer: q.correctAnswer, topic: q.topic, difficulty: q.difficulty, selected: a.answers[q.questionId] ?? null,
})));
export function exportCsv(bank: Bank, tests?: number[]) {
  return rowsToCsv(bank.questions.filter((q) => !tests || tests.includes(q.testNumber)).map((q) => questionToCsvRow({
    ...q, optionA: q.options[0], optionB: q.options[1], optionC: q.options[2], optionD: q.options[3], validationStatus: '', verifyExpr: q.verifyExpr ?? null,
  }, bank.id, 1)));
}
export async function importCsv(file: File, base?: Bank) {
  if (!/\.csv$/i.test(file.name)) throw new Error('Please choose a .csv file.');
  if (!file.size || file.size > MAX_UPLOAD_BYTES) throw new Error('Use a non-empty CSV file up to 4 MB.');
  const parsed = parseCsvBytes(new Uint8Array(await file.arrayBuffer()));
  const mapped = mapCsvRows(parsed);
  const errors = [...parsed.parseErrors, ...mapped.missingColumns.map((c) => `Missing column: ${c}`), ...mapped.problems.map((p) => `Row ${p.row}: ${p.message}`)];
  const rows = mapped.rows.map((r) => r.data);
  if (base) {
    const existing = new Map(base.questions.map((q) => [q.questionId, q]));
    for (const q of rows) {
      const old = existing.get(q.questionId);
      if (!old) errors.push(`Unknown question_id: ${q.questionId}`);
      else if (old.testNumber !== q.testNumber || old.position !== q.position) errors.push(`Cannot move question ${q.questionId} to a different position.`);
    }
    const partial = validateBank(rows, { requireComplete: false });
    errors.push(...partial.issues.filter((i) => i.severity === 'error').map((i) => `Row ${i.row}: ${i.message}`));
  }
  const updates = new Map(rows.map((q) => [q.questionId, q]));
  const questions = base ? base.questions.map((q) => updates.get(q.questionId) ?? q) : rows;
  const report = validateBank(questions);
  errors.push(...report.bankErrors, ...report.issues.filter((i) => i.severity === 'error').map((i) => `Row ${i.row}: ${i.message}`));
  return { questions, report, errors, ok: !errors.length && report.ok && rows.length > 0 };
}
