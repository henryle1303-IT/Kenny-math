import { describe, expect, it } from 'vitest';
import { validateQuestion, type QuestionData } from '@/lib/validate/question';
import { validateBank } from '@/lib/validate/bank';

const base: QuestionData = {
  questionId: 'T01-Q01', testNumber: 1, position: 1, level: 'Beginner', difficulty: 1, topic: 'Whole Numbers', skill: 'wn.addsub',
  questionText: 'Calculate \\(345 + 128\\).', options: ['463', '473', '483', '373'], correctAnswer: 'B',
  explanation: 'What it asks: total.\nStep 1: 345 + 128 = 473.\nAnswer: 473', commonMistake: 'Forgetting to carry.', learningTip: 'Add by parts.', verifyExpr: '345+128',
};

describe('validateQuestion', () => {
  it('accepts a correct question and verifies it', () => {
    const v = validateQuestion(base);
    expect(v.status).toBe('VERIFIED');
    expect(v.method).toBe('both');
  });
  it('detects a wrong answer key', () => {
    const v = validateQuestion({ ...base, correctAnswer: 'C', explanation: base.explanation.replace('473', '483') });
    expect(v.status).toBe('INVALID');
    expect(v.issues.some((i) => i.code === 'MATH_MISMATCH')).toBe(true);
  });
  it('detects duplicate and equivalent options', () => {
    expect(validateQuestion({ ...base, options: ['463', '473', '473', '373'] }).issues.some((i) => i.code === 'DUPLICATE_OPTIONS')).toBe(true);
    const eq = validateQuestion({ ...base, options: ['0.5', '1/2', '0.7', '0.9'], correctAnswer: 'A', questionText: 'Write one half.', verifyExpr: '1/2', explanation: 'Answer: 0.5' });
    expect(eq.issues.some((i) => i.code === 'EQUIVALENT_OPTIONS')).toBe(true);
  });
  it('detects an explanation that does not state the answer', () => {
    const v = validateQuestion({ ...base, explanation: 'Step 1: add them. Answer: 999' });
    expect(v.issues.some((i) => i.code === 'EXPLANATION_MISMATCH')).toBe(true);
  });
  it('flags missing fields and bad values', () => {
    const v = validateQuestion({ ...base, learningTip: '  ', difficulty: 9, correctAnswer: 'E' });
    const codes = v.issues.map((i) => i.code);
    expect(codes).toContain('MISSING_FIELD');
    expect(codes).toContain('BAD_DIFFICULTY');
    expect(codes).toContain('BAD_CORRECT');
  });
  it('flags invalid math syntax', () => {
    const v = validateQuestion({ ...base, questionText: 'Calculate \\(\\frac{1}{\\).' });
    expect(v.issues.some((i) => i.code === 'MATH_SYNTAX')).toBe(true);
  });
  it('marks unverifiable answers for manual review', () => {
    const v = validateQuestion({ ...base, questionText: 'Which shape has three sides?', options: ['Triangle', 'Square', 'Circle', 'Hexagon'], correctAnswer: 'A', explanation: 'Answer: Triangle', verifyExpr: null });
    expect(v.status).toBe('NEEDS_REVIEW');
  });
  it('checks unit consistency', () => {
    const v = validateQuestion({ ...base, questionText: 'A rope is 5 m long.', options: ['12 cm', '12', '14 cm', '15 cm'], correctAnswer: 'A', explanation: 'Answer: 12 cm', verifyExpr: '12' });
    expect(v.issues.some((i) => i.code === 'UNIT_MISMATCH')).toBe(true);
  });
  it('rejects a level that does not match the test', () => {
    expect(validateQuestion({ ...base, level: 'Advanced' }).issues.some((i) => i.code === 'BAD_LEVEL')).toBe(true);
  });
});

describe('validateBank', () => {
  const mk = (t: number, p: number, d = 1): QuestionData => ({ ...base, questionId: `T${t}-Q${p}`, testNumber: t, position: p, level: t <= 10 ? 'Beginner' : t <= 20 ? 'Intermediate' : 'Advanced', difficulty: d, questionText: `Calculate \\(${t * 100 + p} + 1\\).`, options: [String(t * 100 + p), String(t * 100 + p + 1), String(t * 100 + p + 2), String(t * 100 + p + 3)], correctAnswer: 'B', explanation: `Answer: ${t * 100 + p + 1}`, verifyExpr: `${t * 100 + p}+1` });
  it('rejects an incomplete bank but accepts a partial one when allowed', () => {
    const rows = [mk(1, 1), mk(1, 2)];
    expect(validateBank(rows).ok).toBe(false);
    expect(validateBank(rows).bankErrors[0]).toMatch(/900/);
    expect(validateBank(rows, { requireComplete: false }).ok).toBe(true);
  });
  it('detects duplicate ids, positions and questions', () => {
    const r = validateBank([mk(1, 1), mk(1, 1)], { requireComplete: false });
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('DUPLICATE_ID');
    expect(codes).toContain('DUPLICATE_POSITION');
    expect(codes).toContain('DUPLICATE_QUESTION');
    expect(r.duplicateRows).toBe(1);
  });
  it('requires exactly 30 questions per test with rising difficulty', () => {
    const rows: QuestionData[] = [];
    for (let t = 1; t <= 30; t++) for (let p = 1; p <= 30; p++) rows.push(mk(t, p, 1 + Math.floor((p - 1) / 8)));
    const ok = validateBank(rows);
    expect(ok.totalRows).toBe(900);
    expect(ok.testCountErrors).toBe(0);
    rows.pop();
    expect(validateBank(rows).bankErrors.join(' ')).toMatch(/Test 30 must have exactly 30/);
    const flat = rows.concat(mk(30, 30, 1)).map((q) => ({ ...q, difficulty: 2 }));
    expect(validateBank(flat).bankErrors.join(' ')).toMatch(/harder/);
  });
});
