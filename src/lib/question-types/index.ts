import { z } from 'zod';
import { numericMatches, parseNumberInput } from './numeric';
import { textMatches } from './text';

export { normalizeText, textMatches } from './text';
export { numericMatches, parseNumberInput } from './numeric';

export const QUESTION_TYPES = ['MCQ', 'NUMERIC_INPUT', 'TRUE_FALSE', 'MULTI_SELECT', 'FILL_BLANK', 'ORDERING', 'SHORT_TEXT'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export function isQuestionType(v: unknown): v is QuestionType {
  return typeof v === 'string' && (QUESTION_TYPES as readonly string[]).includes(v);
}
export function typeOf(v: string | null | undefined): QuestionType {
  return isQuestionType(v) ? v : 'MCQ';
}

const str = (max: number) => z.string().trim().min(1).max(max);
const accepted = z.array(str(60)).min(1).max(10);

export const definitionSchemas = {
  NUMERIC_INPUT: z.object({ accepted, tolerance: z.number().min(0).max(1000).optional(), unit: z.string().trim().max(20).nullable().optional(), requireSimplified: z.boolean().optional() }).strict(),
  TRUE_FALSE: z.object({ statements: z.array(z.object({ text: str(300), truth: z.boolean() }).strict()).min(1).max(6) }).strict(),
  MULTI_SELECT: z.object({ options: z.array(str(200)).min(2).max(6), correct: z.array(z.number().int().min(0).max(5)).min(1).max(6) }).strict(),
  FILL_BLANK: z.object({ blanks: z.array(z.object({ accepted }).strict()).min(1).max(6) }).strict(),
  ORDERING: z.object({ items: z.array(str(120)).min(3).max(6) }).strict(),
  SHORT_TEXT: z.object({ accepted, caseSensitive: z.boolean().optional(), ignoreDiacritics: z.boolean().optional() }).strict(),
} as const;

export type Definition<T extends Exclude<QuestionType, 'MCQ'>> = z.infer<(typeof definitionSchemas)[T]>;

/** Blank placeholders such as {1}. Braces that belong to TeX (\\frac{3}{4}) are not placeholders. */
export const BLANK_RE = /(?<![\w}^_]){(\d+)}(?!{)/g;
export function blankNumbers(text: string): number[] {
  return [...text.matchAll(BLANK_RE)].map((m) => Number(m[1]));
}

/** The part of a stored question the type logic needs. */
export interface TypedRow {
  questionType?: string | null;
  answerData?: string | null;
  correctAnswer: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
}

export type ParsedDefinition = { type: 'MCQ' } | { [K in Exclude<QuestionType, 'MCQ'>]: { type: K; def: Definition<K> } }[Exclude<QuestionType, 'MCQ'>];

export function parseDefinition(type: QuestionType, answerData: string | null | undefined): { ok: true; value: ParsedDefinition } | { ok: false; message: string } {
  if (type === 'MCQ') return { ok: true, value: { type: 'MCQ' } };
  if (!answerData || !answerData.trim()) return { ok: false, message: 'answer_data is required for this question type' };
  let json: unknown;
  try {
    json = JSON.parse(answerData);
  } catch {
    return { ok: false, message: 'answer_data is not valid JSON' };
  }
  const res = definitionSchemas[type].safeParse(json);
  if (!res.success) return { ok: false, message: `answer_data: ${res.error.issues.slice(0, 2).map((i) => `${i.path.join('.') || 'value'} ${i.message}`).join('; ')}` };
  return { ok: true, value: { type, def: res.data } as ParsedDefinition };
}

function defOf(row: TypedRow): ParsedDefinition | null {
  const t = typeOf(row.questionType);
  const p = parseDefinition(t, row.answerData);
  return p.ok ? p.value : null;
}

// ---------------------------------------------------------------------------------------------
// Responses. Everything is stored as a string in StudentAnswer.selectedAnswer:
// MCQ "A".."D"; NUMERIC_INPUT / SHORT_TEXT the typed text; the others a JSON string.
// ---------------------------------------------------------------------------------------------

export type ResponseResult = { ok: true; value: string | null } | { ok: false; message: string };
const bad = (message: string): ResponseResult => ({ ok: false, message });

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Validate a student's raw response and return the canonical string to store (null = cleared / unanswered). */
export function normalizeResponse(row: TypedRow, raw: string | null): ResponseResult {
  const def = defOf(row);
  if (!def) return bad('This question is not set up correctly.');
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string' || raw.length > 600) return bad('That answer is too long.');
  switch (def.type) {
    case 'MCQ':
      return ['A', 'B', 'C', 'D'].includes(raw) ? { ok: true, value: raw } : bad('Please choose A, B, C or D.');
    case 'NUMERIC_INPUT': {
      const t = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
      if (t.length > 40) return bad('That answer is too long.');
      return { ok: true, value: t || null };
    }
    case 'SHORT_TEXT': {
      const t = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
      if (t.length > 80) return bad('That answer is too long.');
      return { ok: true, value: t || null };
    }
    case 'TRUE_FALSE': {
      const j = parseJson(raw);
      if (!Array.isArray(j) || j.length !== def.def.statements.length || j.some((x) => x !== true && x !== false && x !== null)) return bad('Answer every statement with True or False.');
      return { ok: true, value: j.every((x) => x === null) ? null : JSON.stringify(j) };
    }
    case 'MULTI_SELECT': {
      const j = parseJson(raw);
      const n = def.def.options.length;
      if (!Array.isArray(j) || j.some((x) => !Number.isInteger(x) || x < 0 || x >= n) || new Set(j).size !== j.length) return bad('Choose from the options shown.');
      return { ok: true, value: j.length ? JSON.stringify([...j].sort((a, b) => a - b)) : null };
    }
    case 'FILL_BLANK': {
      const j = parseJson(raw);
      if (!Array.isArray(j) || j.length !== def.def.blanks.length || j.some((x) => typeof x !== 'string' || x.length > 40)) return bad('Fill in the blanks.');
      const clean = (j as string[]).map((x) => x.normalize('NFC').replace(/\s+/g, ' ').trim());
      return { ok: true, value: clean.every((x) => !x) ? null : JSON.stringify(clean) };
    }
    case 'ORDERING': {
      const j = parseJson(raw);
      const n = def.def.items.length;
      if (!Array.isArray(j) || j.length !== n || j.some((x) => !Number.isInteger(x) || x < 0 || x >= n) || new Set(j).size !== n) return bad('Put every item in order.');
      return { ok: true, value: JSON.stringify(j) };
    }
  }
}

function isNumeric(accepted: string[]): boolean {
  return accepted.every((a) => parseNumberInput(a) !== null);
}

/** Is a stored response right? Unanswered (null/empty) is never right. */
export function isResponseCorrect(row: TypedRow, stored: string | null): boolean {
  if (stored === null || stored === '') return false;
  const def = defOf(row);
  if (!def) return false;
  switch (def.type) {
    case 'MCQ':
      return stored === row.correctAnswer;
    case 'NUMERIC_INPUT':
      return numericMatches(stored, def.def.accepted, def.def);
    case 'SHORT_TEXT':
      return textMatches(stored, def.def.accepted, def.def);
    case 'TRUE_FALSE': {
      const j = parseJson(stored);
      return Array.isArray(j) && j.length === def.def.statements.length && def.def.statements.every((s, i) => j[i] === s.truth);
    }
    case 'MULTI_SELECT': {
      const j = parseJson(stored);
      if (!Array.isArray(j)) return false;
      const want = [...new Set(def.def.correct)].sort((a, b) => a - b);
      const got = [...j].sort((a, b) => a - b);
      return want.length === got.length && want.every((x, i) => x === got[i]);
    }
    case 'FILL_BLANK': {
      const j = parseJson(stored);
      if (!Array.isArray(j) || j.length !== def.def.blanks.length) return false;
      return def.def.blanks.every((b, i) => (typeof j[i] === 'string' ? (isNumeric(b.accepted) ? numericMatches(j[i], b.accepted) : textMatches(j[i], b.accepted)) : false));
    }
    case 'ORDERING': {
      const j = parseJson(stored);
      return Array.isArray(j) && j.length === def.def.items.length && j.every((x, i) => x === i);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Display helpers (plain strings; they may contain \( \) maths).
// ---------------------------------------------------------------------------------------------

export function displayCorrect(row: TypedRow): string {
  const def = defOf(row);
  if (!def) return '';
  switch (def.type) {
    case 'MCQ': {
      const i = 'ABCD'.indexOf(row.correctAnswer);
      return i >= 0 ? [row.optionA, row.optionB, row.optionC, row.optionD][i] ?? '' : '';
    }
    case 'NUMERIC_INPUT':
      return def.def.accepted[0] + (def.def.unit ? ` ${def.def.unit}` : '');
    case 'SHORT_TEXT':
      return def.def.accepted[0];
    case 'TRUE_FALSE':
      return def.def.statements.map((s, i) => `${i + 1}) ${s.truth ? 'True' : 'False'}`).join('; ');
    case 'MULTI_SELECT':
      return [...def.def.correct].sort((a, b) => a - b).map((i) => def.def.options[i]).join(', ');
    case 'FILL_BLANK':
      return def.def.blanks.map((b, i) => `${i + 1}) ${b.accepted[0]}`).join('; ');
    case 'ORDERING':
      return def.def.items.join(' → ');
  }
}

export function displayResponse(row: TypedRow, stored: string | null): string {
  if (stored === null || stored === '') return '';
  const def = defOf(row);
  if (!def) return stored;
  const j = def.type === 'MCQ' || def.type === 'NUMERIC_INPUT' || def.type === 'SHORT_TEXT' ? null : parseJson(stored);
  switch (def.type) {
    case 'MCQ': {
      const i = 'ABCD'.indexOf(stored);
      return i >= 0 ? [row.optionA, row.optionB, row.optionC, row.optionD][i] ?? stored : stored;
    }
    case 'NUMERIC_INPUT':
    case 'SHORT_TEXT':
      return stored;
    case 'TRUE_FALSE':
      return Array.isArray(j) ? j.map((x, i) => `${i + 1}) ${x === null ? '–' : x ? 'True' : 'False'}`).join('; ') : stored;
    case 'MULTI_SELECT':
      return Array.isArray(j) ? j.map((i) => def.def.options[i] ?? '?').join(', ') : stored;
    case 'FILL_BLANK':
      return Array.isArray(j) ? j.map((x, i) => `${i + 1}) ${x || '–'}`).join('; ') : stored;
    case 'ORDERING':
      return Array.isArray(j) ? j.map((i) => def.def.items[i] ?? '?').join(' → ') : stored;
  }
}

// ---------------------------------------------------------------------------------------------
// What a student may see while a test is open: never the answers.
// ---------------------------------------------------------------------------------------------

export type StudentView =
  | { type: 'MCQ'; options: string[] }
  | { type: 'NUMERIC_INPUT'; unit: string | null }
  | { type: 'TRUE_FALSE'; statements: string[] }
  | { type: 'MULTI_SELECT'; options: string[] }
  | { type: 'FILL_BLANK'; blanks: number }
  | { type: 'ORDERING'; items: { index: number; text: string }[] }
  | { type: 'SHORT_TEXT' };

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Deterministic shuffle that is never the identity, so the starting order is never already correct. */
export function displayOrder(n: number, seed: string): number[] {
  for (let attempt = 0; attempt < 20; attempt++) {
    let a = hashSeed(`${seed}#${attempt}`);
    const rnd = () => ((a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 4294967296);
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    if (idx.some((v, i) => v !== i)) return idx;
  }
  return Array.from({ length: n }, (_, i) => (i + 1) % n);
}

export function studentView(row: TypedRow, seed: string): StudentView | null {
  const def = defOf(row);
  if (!def) return null;
  switch (def.type) {
    case 'MCQ':
      return { type: 'MCQ', options: [row.optionA ?? '', row.optionB ?? '', row.optionC ?? '', row.optionD ?? ''] };
    case 'NUMERIC_INPUT':
      return { type: 'NUMERIC_INPUT', unit: def.def.unit ?? null };
    case 'SHORT_TEXT':
      return { type: 'SHORT_TEXT' };
    case 'TRUE_FALSE':
      return { type: 'TRUE_FALSE', statements: def.def.statements.map((s) => s.text) };
    case 'MULTI_SELECT':
      return { type: 'MULTI_SELECT', options: def.def.options };
    case 'FILL_BLANK':
      return { type: 'FILL_BLANK', blanks: def.def.blanks.length };
    case 'ORDERING':
      return { type: 'ORDERING', items: displayOrder(def.def.items.length, seed).map((index) => ({ index, text: def.def.items[index] })) };
  }
}

/** Text that should state the correct answer (used to check explanations), per type. */
export function answerKeyText(row: TypedRow): string {
  return displayCorrect(row);
}
