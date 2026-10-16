import katex from 'katex';
import { Frac } from '../math/fraction';
import { evalExpr } from '../math/expr';
import { evaluateArithmeticQuestion, parseOptionValue, texToPlain } from '../math/parse';
import { levelOf } from '../gen/curriculum';

export type Severity = 'error' | 'warning' | 'review';

export interface Issue {
  severity: Severity;
  code: string;
  message: string;
}

export interface QuestionData {
  questionId: string;
  testNumber: number;
  position: number;
  level: string;
  difficulty: number;
  topic: string;
  skill: string;
  questionText: string;
  options: [string, string, string, string];
  correctAnswer: string;
  explanation: string;
  commonMistake: string;
  learningTip: string;
  verifyExpr?: string | null;
}

export type ValidationStatus = 'VERIFIED' | 'NEEDS_REVIEW' | 'INVALID';

export interface QuestionValidation {
  status: ValidationStatus;
  issues: Issue[];
  /** How the answer key was checked, if it was. */
  method: 'expression' | 'arithmetic-text' | 'both' | 'none';
}

const LETTERS = ['A', 'B', 'C', 'D'];
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Compare strings ignoring TeX decoration, spacing and punctuation. */
export function squash(s: string): string {
  return texToPlain(s)
    .toLowerCase()
    .replace(/[\s,.:;!?'’"“”()[\]{}*]/g, '');
}

function checkKatex(text: string, where: string, issues: Issue[]) {
  const opens = (text.match(/\\\(/g) ?? []).length;
  const closes = (text.match(/\\\)/g) ?? []).length;
  if (opens !== closes) {
    issues.push({ severity: 'error', code: 'MATH_DELIMITERS', message: `${where}: unbalanced math delimiters \\( \\)` });
    return;
  }
  for (const m of text.matchAll(/\\\((.+?)\\\)/gs)) {
    try {
      katex.renderToString(m[1], { throwOnError: true, strict: 'ignore' });
    } catch (e) {
      issues.push({ severity: 'error', code: 'MATH_SYNTAX', message: `${where}: invalid math “${m[1].slice(0, 40)}” (${(e as Error).message.slice(0, 60)})` });
    }
  }
}

/** Reduce an option to a signature of its non-numeric parts (units, symbols) to compare consistency. */
export function unitSignature(opt: string): string {
  if (!/\d/.test(opt)) return 'text';
  return texToPlain(opt)
    .replace(/\d+\s+\d+\/\d+/g, '#')
    .replace(/\d+\/\d+/g, '#')
    .replace(/\d[\d,]*(?:\.\d+)?/g, '#')
    .replace(/#\s*:\s*#/g, '#:#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b(am|pm)\b/g, 'ampm');
}

export function validateQuestion(q: QuestionData): QuestionValidation {
  const issues: Issue[] = [];
  const err = (code: string, message: string) => issues.push({ severity: 'error', code, message });
  const warn = (code: string, message: string) => issues.push({ severity: 'warning', code, message });
  const review = (code: string, message: string) => issues.push({ severity: 'review', code, message });

  // --- required fields -----------------------------------------------------------------------
  const req: [string, string][] = [
    ['question_id', q.questionId],
    ['topic', q.topic],
    ['skill', q.skill],
    ['question_text', q.questionText],
    ['option_a', q.options[0]],
    ['option_b', q.options[1]],
    ['option_c', q.options[2]],
    ['option_d', q.options[3]],
    ['explanation', q.explanation],
    ['common_mistake', q.commonMistake],
    ['learning_tip', q.learningTip],
  ];
  for (const [name, v] of req) if (!v || !v.trim()) err('MISSING_FIELD', `Missing required field: ${name}`);
  if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 5) err('BAD_DIFFICULTY', `difficulty must be an integer 1–5 (got ${q.difficulty})`);
  if (!LETTERS.includes(q.correctAnswer)) err('BAD_CORRECT', `correct_answer must be A, B, C or D (got “${q.correctAnswer}”)`);
  if (!Number.isInteger(q.testNumber) || q.testNumber < 1 || q.testNumber > 30) err('BAD_TEST', `test_id must be 1–30 (got ${q.testNumber})`);
  if (!Number.isInteger(q.position) || q.position < 1 || q.position > 30) err('BAD_POSITION', `question_number must be 1–30 (got ${q.position})`);
  if (Number.isInteger(q.testNumber) && q.testNumber >= 1 && q.testNumber <= 30 && q.level !== levelOf(q.testNumber)) {
    err('BAD_LEVEL', `test_level “${q.level}” does not match test ${q.testNumber} (expected ${levelOf(q.testNumber)})`);
  }

  const all = [q.questionText, ...q.options, q.explanation, q.commonMistake, q.learningTip].join('\n');
  if (CONTROL.test(all)) err('BAD_CHARACTERS', 'Contains control characters');

  // --- options --------------------------------------------------------------------------------
  const normOpts = q.options.map(norm);
  if (new Set(normOpts).size < 4 && normOpts.every(Boolean)) err('DUPLICATE_OPTIONS', 'Two or more answer options are identical');
  const vals = q.options.map(parseOptionValue);
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      const a = vals[i];
      const b = vals[j];
      if (a && b && a.eq(b) && normOpts[i] !== normOpts[j]) err('EQUIVALENT_OPTIONS', `Options ${LETTERS[i]} and ${LETTERS[j]} have the same value`);
    }
  }
  const sigs = new Set(q.options.map(unitSignature));
  if (sigs.size > 1) warn('UNIT_MISMATCH', 'Answer options use inconsistent units or formats');
  const nums = vals.filter((v): v is Frac => v !== null);
  if (nums.length === 4) {
    let big = false;
    let bigDen = false;
    q.options.forEach((o, i) => {
      const v = nums[i];
      if (Math.abs(v.value) > 10_000_000) big = true;
      if (v.d > 1000 && /frac|\//.test(o)) bigDen = true;
    });
    if (big) warn('UNREASONABLE_VALUE', 'An option has an unusually large value');
    if (bigDen) warn('UNREASONABLE_VALUE', 'An option has an unusually large denominator');
  }

  // --- math syntax ----------------------------------------------------------------------------
  checkKatex(q.questionText, 'question_text', issues);
  q.options.forEach((o, i) => checkKatex(o, `option_${'abcd'[i]}`, issues));
  checkKatex(q.explanation, 'explanation', issues);

  // --- explanation matches the key -------------------------------------------------------------
  const idx = LETTERS.indexOf(q.correctAnswer);
  if (idx >= 0 && q.explanation.trim()) {
    const keyText = squash(q.options[idx]);
    if (keyText && !squash(q.explanation).includes(keyText)) err('EXPLANATION_MISMATCH', 'The explanation never states the correct answer');
    for (let i = 0; i < 4; i++) {
      if (i === idx) continue;
      const lastLine = q.explanation.trim().split('\n').pop() ?? '';
      if (/^answer\s*:/i.test(lastLine.trim()) && squash(lastLine).endsWith(squash(q.options[i])) && squash(q.options[i]) !== keyText && !squash(lastLine).endsWith(keyText)) {
        err('EXPLANATION_MISMATCH', `The final line of the explanation gives option ${LETTERS[i]}`);
      }
    }
  }

  // --- mathematical verification ---------------------------------------------------------------
  let method: QuestionValidation['method'] = 'none';
  const keyVal = idx >= 0 ? vals[idx] : null;
  let byExpr: boolean | null = null;
  let byText: boolean | null = null;
  if (idx >= 0) {
    if (q.verifyExpr && q.verifyExpr.trim()) {
      try {
        const v = evalExpr(q.verifyExpr);
        if (!keyVal) {
          review('UNVERIFIED', 'Could not read the correct option as a number to compare with verify_expr');
        } else if (!v.eq(keyVal)) {
          byExpr = false;
          err('MATH_MISMATCH', `verify_expr evaluates to ${v.toString()} but the marked answer is ${keyVal.toString()}`);
        } else {
          byExpr = true;
          vals.forEach((o, i) => {
            if (i !== idx && o && o.eq(v)) err('MULTIPLE_CORRECT', `Option ${LETTERS[i]} also equals the correct value`);
          });
        }
      } catch (e) {
        review('UNVERIFIED', `verify_expr could not be evaluated: ${(e as Error).message}`);
      }
    }
    const arith = evaluateArithmeticQuestion(q.questionText);
    if (arith) {
      if (!keyVal || !arith.eq(keyVal)) {
        byText = false;
        err('MATH_MISMATCH', `The arithmetic in the question equals ${arith.toString()} but the marked answer is ${keyVal ? keyVal.toString() : 'not numeric'}`);
      } else {
        byText = true;
        vals.forEach((o, i) => {
          if (i !== idx && o && o.eq(arith)) err('MULTIPLE_CORRECT', `Option ${LETTERS[i]} also equals the correct value`);
        });
      }
    }
    if (byExpr && byText) method = 'both';
    else if (byExpr) method = 'expression';
    else if (byText) method = 'arithmetic-text';
    if (byExpr !== true && byText !== true && !issues.some((i) => i.code === 'MATH_MISMATCH')) {
      review('UNVERIFIED', 'The answer could not be verified automatically – please check it manually');
    }
  }

  const hasError = issues.some((i) => i.severity === 'error');
  const needsReview = issues.some((i) => i.severity === 'review' || i.severity === 'warning');
  return { status: hasError ? 'INVALID' : needsReview ? 'NEEDS_REVIEW' : 'VERIFIED', issues, method };
}
