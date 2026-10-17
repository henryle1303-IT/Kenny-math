import { describe, expect, it } from 'vitest';
import { blankNumbers, displayCorrect, displayOrder, displayResponse, isResponseCorrect, normalizeResponse, normalizeText, parseDefinition, studentView, textMatches, numericMatches, parseNumberInput, type TypedRow } from '@/lib/question-types';
import { gradeAnswers } from '@/lib/grading';
import { validateQuestion, type QuestionData } from '@/lib/validate/question';

const row = (type: string, def: unknown, correctAnswer = ''): TypedRow => ({ questionType: type, answerData: JSON.stringify(def), correctAnswer });

describe('typed text answers', () => {
  it('ignores capital letters, extra spaces and unicode forms', () => {
    expect(textMatches('  Hình   VUÔNG ', ['hình vuông'])).toBe(true);
    expect(textMatches('SQUARE', ['square'])).toBe(true);
    // decomposed (NFD) and composed (NFC) Vietnamese letters are the same answer
    expect(textMatches('hình vuông'.normalize('NFD'), ['hình vuông'.normalize('NFC')])).toBe(true);
  });
  it('keeps Vietnamese accents by default and can ignore them per question', () => {
    expect(textMatches('hinh vuong', ['hình vuông'])).toBe(false);
    expect(textMatches('hinh vuong', ['hình vuông'], { ignoreDiacritics: true })).toBe(true);
    expect(normalizeText('Đường', { ignoreDiacritics: true })).toBe('duong');
  });
  it('can be case sensitive when asked', () => {
    expect(textMatches('Cm', ['cm'], { caseSensitive: true })).toBe(false);
    expect(textMatches('cm', ['cm'], { caseSensitive: true })).toBe(true);
  });
  it('never accepts an empty answer', () => {
    expect(textMatches('   ', [''])).toBe(false);
  });
});

describe('numeric answers', () => {
  it('accepts equivalent forms', () => {
    for (const s of ['0.5', '.5', '1/2', '2/4', '0,5', '0.50', ' 1/2 ']) expect(numericMatches(s, ['1/2', '0.5'])).toBe(true);
    expect(numericMatches('1 1/2', ['3/2'])).toBe(true);
    expect(numericMatches('1,000', ['1000'])).toBe(true);
    expect(numericMatches('-3', ['-3'])).toBe(true);
    expect(numericMatches('$6.50', ['6.5'])).toBe(true);
  });
  it('rejects wrong values and non numbers', () => {
    for (const s of ['0.6', '1/3', 'abc', '', '1/0', '1..2', '3 apples']) expect(numericMatches(s, ['1/2'])).toBe(false);
  });
  it('handles units, tolerance and simplified fractions', () => {
    expect(numericMatches('40 CM', ['40'], { unit: 'cm' })).toBe(true);
    expect(numericMatches('40', ['40'], { unit: 'cm' })).toBe(true);
    expect(numericMatches('3.14', ['3.1416'], { tolerance: 0.01 })).toBe(true);
    expect(numericMatches('3.2', ['3.1416'], { tolerance: 0.01 })).toBe(false);
    expect(numericMatches('2/4', ['1/2'], { requireSimplified: true })).toBe(false);
    expect(numericMatches('1/2', ['1/2'], { requireSimplified: true })).toBe(true);
    expect(numericMatches('0.5', ['1/2'], { requireSimplified: true })).toBe(true);
  });
  it('parses safely', () => {
    expect(parseNumberInput('99999999999999999999/3')).toBeNull();
    expect(parseNumberInput('1 2/3')?.value.toString()).toBe('5/3');
  });
});

describe('response checking per type', () => {
  it('MCQ is unchanged', () => {
    const r = { questionType: 'MCQ', answerData: null, correctAnswer: 'B' };
    expect(isResponseCorrect(r, 'B')).toBe(true);
    expect(isResponseCorrect(r, 'A')).toBe(false);
    expect(isResponseCorrect(r, null)).toBe(false);
    expect(isResponseCorrect({ correctAnswer: 'C' }, 'C')).toBe(true);
    expect(normalizeResponse(r, 'E').ok).toBe(false);
  });
  it('TRUE_FALSE needs every statement right', () => {
    const r = row('TRUE_FALSE', { statements: [{ text: 'a', truth: true }, { text: 'b', truth: false }] });
    expect(isResponseCorrect(r, '[true,false]')).toBe(true);
    expect(isResponseCorrect(r, '[true,true]')).toBe(false);
    expect(isResponseCorrect(r, '[true,null]')).toBe(false);
    expect(normalizeResponse(r, '[true]').ok).toBe(false);
    expect(normalizeResponse(r, '[null,null]')).toEqual({ ok: true, value: null });
    expect(displayCorrect(r)).toBe('1) True; 2) False');
  });
  it('MULTI_SELECT needs exactly the right set', () => {
    const r = row('MULTI_SELECT', { options: ['a', 'b', 'c', 'd'], correct: [0, 2] });
    expect(isResponseCorrect(r, '[0,2]')).toBe(true);
    expect(isResponseCorrect(r, '[0]')).toBe(false);
    expect(isResponseCorrect(r, '[0,1,2]')).toBe(false);
    expect(normalizeResponse(r, '[2,0]')).toEqual({ ok: true, value: '[0,2]' });
    expect(normalizeResponse(r, '[0,0]').ok).toBe(false);
    expect(normalizeResponse(r, '[7]').ok).toBe(false);
    expect(normalizeResponse(r, '[]')).toEqual({ ok: true, value: null });
    expect(displayResponse(r, '[0,2]')).toBe('a, c');
  });
  it('FILL_BLANK checks each blank, numerically when possible', () => {
    const r = row('FILL_BLANK', { blanks: [{ accepted: ['1/2'] }, { accepted: ['cat'] }] });
    expect(isResponseCorrect(r, '["0.5","CAT"]')).toBe(true);
    expect(isResponseCorrect(r, '["0.5","dog"]')).toBe(false);
    expect(normalizeResponse(r, '["1"]').ok).toBe(false);
    expect(normalizeResponse(r, '["",""]')).toEqual({ ok: true, value: null });
  });
  it('ORDERING needs the exact order', () => {
    const r = row('ORDERING', { items: ['a', 'b', 'c'] });
    expect(isResponseCorrect(r, '[0,1,2]')).toBe(true);
    expect(isResponseCorrect(r, '[1,0,2]')).toBe(false);
    expect(normalizeResponse(r, '[0,1]').ok).toBe(false);
    expect(normalizeResponse(r, '[0,0,1]').ok).toBe(false);
    expect(displayResponse(r, '[2,1,0]')).toBe('c → b → a');
  });
  it('NUMERIC_INPUT and SHORT_TEXT store trimmed text', () => {
    expect(normalizeResponse(row('NUMERIC_INPUT', { accepted: ['3/4'] }), '  3/4 ')).toEqual({ ok: true, value: '3/4' });
    expect(normalizeResponse(row('SHORT_TEXT', { accepted: ['cube'] }), 'x'.repeat(200)).ok).toBe(false);
    expect(normalizeResponse(row('SHORT_TEXT', { accepted: ['cube'] }), '   ')).toEqual({ ok: true, value: null });
  });
  it('rejects a broken setup instead of marking anything right', () => {
    const broken = { questionType: 'NUMERIC_INPUT', answerData: '{oops', correctAnswer: '' };
    expect(isResponseCorrect(broken, '1')).toBe(false);
    expect(normalizeResponse(broken, '1').ok).toBe(false);
    expect(parseDefinition('ORDERING', JSON.stringify({ items: ['a'] })).ok).toBe(false);
  });
});

describe('what a student can see', () => {
  const r = row('ORDERING', { items: ['1', '2', '3', '4'] });
  it('shuffles ordering items deterministically and never in the right order', () => {
    for (let i = 0; i < 50; i++) {
      const o = displayOrder(4, `seed-${i}`);
      expect([...o].sort()).toEqual([0, 1, 2, 3]);
      expect(o).not.toEqual([0, 1, 2, 3]);
      expect(displayOrder(4, `seed-${i}`)).toEqual(o);
    }
  });
  it('never contains answers', () => {
    const views = [
      studentView(row('NUMERIC_INPUT', { accepted: ['secret-84'], unit: 'cm' }), 's'),
      studentView(row('TRUE_FALSE', { statements: [{ text: 'a', truth: true }] }), 's'),
      studentView(row('MULTI_SELECT', { options: ['a', 'b'], correct: [1] }), 's'),
      studentView(row('FILL_BLANK', { blanks: [{ accepted: ['secret-84'] }] }), 's'),
      studentView(r, 's'),
      studentView(row('SHORT_TEXT', { accepted: ['secret-84'] }), 's'),
    ];
    const json = JSON.stringify(views);
    expect(json).not.toContain('secret-84');
    expect(json).not.toContain('truth');
    expect(json).not.toContain('correct');
    expect(json).not.toContain('accepted');
  });
});

describe('grading mixes types', () => {
  it('scores each type with the same one point rule', () => {
    const items = [
      { questionId: 'a', correctAnswer: 'A', topic: 'T', difficulty: 1, selected: 'A' },
      { questionId: 'b', correctAnswer: '', questionType: 'NUMERIC_INPUT', answerData: JSON.stringify({ accepted: ['0.5'] }), topic: 'T', difficulty: 1, selected: '1/2' },
      { questionId: 'c', correctAnswer: '', questionType: 'ORDERING', answerData: JSON.stringify({ items: ['x', 'y', 'z'] }), topic: 'U', difficulty: 2, selected: '[2,1,0]' },
      { questionId: 'd', correctAnswer: '', questionType: 'SHORT_TEXT', answerData: JSON.stringify({ accepted: ['cube'] }), topic: 'U', difficulty: 2, selected: null },
    ];
    const g = gradeAnswers(items);
    expect(g.correct).toBe(2);
    expect(g.incorrect).toBe(1);
    expect(g.unanswered).toBe(1);
    expect(g.perQuestion.map((p) => p.isCorrect)).toEqual([true, true, false, null]);
  });
});

describe('validation of typed questions', () => {
  const base: QuestionData = { questionId: 'X-1', testNumber: 1, position: 1, level: 'Beginner', difficulty: 2, topic: 'Fractions', skill: 'fr.addsub', questionText: 'Type the answer.', options: ['', '', '', ''], correctAnswer: '', explanation: 'It is 3/4. Answer: 3/4', commonMistake: 'x', learningTip: 'y', questionType: 'NUMERIC_INPUT', answerData: JSON.stringify({ accepted: ['3/4', '0.75'] }), verifyExpr: '1/4+1/2' };
  const codes = (q: QuestionData) => validateQuestion(q).issues.map((i) => i.code);
  it('accepts a good numeric question and verifies it', () => {
    const v = validateQuestion(base);
    expect(v.status).toBe('VERIFIED');
    expect(v.method).toBe('expression');
  });
  it('catches a wrong verify expression, mixed values and a missing answer in the explanation', () => {
    expect(codes({ ...base, verifyExpr: '1/4+1/4' })).toContain('MATH_MISMATCH');
    expect(codes({ ...base, answerData: JSON.stringify({ accepted: ['3/4', '0.7'] }) })).toContain('BAD_ANSWER_DATA');
    expect(codes({ ...base, explanation: 'No idea.' })).toContain('EXPLANATION_MISMATCH');
  });
  it('flags a numeric question that cannot be verified for manual review', () => {
    expect(validateQuestion({ ...base, verifyExpr: null }).status).toBe('NEEDS_REVIEW');
  });
  it('rejects stray options, bad json and unknown types', () => {
    expect(codes({ ...base, options: ['a', '', '', ''] })).toContain('UNEXPECTED_OPTIONS');
    expect(codes({ ...base, answerData: 'nope' })).toContain('BAD_ANSWER_DATA');
    expect(codes({ ...base, answerData: null })).toContain('BAD_ANSWER_DATA');
    expect(codes({ ...base, questionType: 'DRAWING' })).toContain('BAD_TYPE');
  });
  it('checks fill in the blank placeholders and multiple select answers', () => {
    const fill = { ...base, questionType: 'FILL_BLANK', verifyExpr: null, answerData: JSON.stringify({ blanks: [{ accepted: ['1'] }, { accepted: ['2'] }] }), questionText: 'Fill {1} only' };
    expect(codes(fill)).toContain('BLANK_MISMATCH');
    expect(validateQuestion({ ...fill, questionText: 'Fill {1} and {2}' }).status).toBe('VERIFIED');
    const multi = { ...base, questionType: 'MULTI_SELECT', verifyExpr: null, answerData: JSON.stringify({ options: ['a', 'a', 'b'], correct: [0] }) };
    expect(codes(multi)).toContain('DUPLICATE_OPTIONS');
    expect(codes({ ...multi, answerData: JSON.stringify({ options: ['a', 'b'], correct: [5] }) })).toContain('BAD_ANSWER_DATA');
  });
  it('still validates plain multiple choice exactly as before', () => {
    const mcq: QuestionData = { ...base, questionType: undefined, answerData: undefined, options: ['1/2', '3/4', '1/4', '2/3'], correctAnswer: 'B', questionText: 'Calculate \\(\\frac{1}{4} + \\frac{1}{2}\\).' };
    expect(validateQuestion(mcq).status).toBe('VERIFIED');
  });
});

describe('blank placeholders', () => {
  it('does not confuse TeX braces with blanks', () => {
    expect(blankNumbers('\\(\\frac{3}{4} + \\frac{1}{4} = \\) {1}, and \\(2 \\times 5 = \\) {2}.')).toEqual([1, 2]);
    expect(blankNumbers('3, 7, {1}, 19, {2}')).toEqual([1, 2]);
    expect(blankNumbers('no blanks \\(x^{2}\\)')).toEqual([]);
  });
});

describe('answer formats', () => {
  it('ratio answers are written a:b and compared by value', () => {
    const o = { format: 'ratio' as const, requireSimplified: true };
    expect(numericMatches('2:3', ['2:3'], o)).toBe(true);
    expect(numericMatches('2 : 3', ['2:3'], o)).toBe(true);
    expect(numericMatches('4:6', ['2:3'], o)).toBe(false); // not simplified
    expect(numericMatches('4:6', ['2:3'], { format: 'ratio' })).toBe(true); // same ratio when simplifying is not required
    expect(numericMatches('3:2', ['2:3'], o)).toBe(false);
    expect(numericMatches('2/3', ['2:3'], o)).toBe(false); // a ratio question wants a colon
    expect(numericMatches('2:0', ['2:3'], o)).toBe(false);
  });
  it('fraction and number questions do not read a colon as a fraction', () => {
    expect(numericMatches('1:2', ['1/2'])).toBe(false);
    expect(numericMatches('1:2', ['1/2'], { format: 'fraction' })).toBe(false);
    expect(numericMatches('1/2', ['1/2'], { format: 'fraction' })).toBe(true);
  });
  it('the student view tells the browser which input to show, without the answer', () => {
    const v = studentView(row('NUMERIC_INPUT', { accepted: ['2:3'], format: 'ratio' }), 's');
    expect(v).toEqual({ type: 'NUMERIC_INPUT', unit: null, format: 'ratio' });
    expect(studentView(row('NUMERIC_INPUT', { accepted: ['5'] }), 's')).toMatchObject({ format: 'number' });
  });
  it('validation checks accepted ratios', () => {
    const q: QuestionData = { questionId: 'R-1', testNumber: 1, position: 1, level: 'Beginner', difficulty: 2, topic: 'Ratios', skill: 'ra.equiv', questionText: 'Write the ratio.', options: ['', '', '', ''], correctAnswer: '', explanation: 'It is 2:3.', commonMistake: 'x', learningTip: 'y', questionType: 'NUMERIC_INPUT', answerData: JSON.stringify({ accepted: ['2:3'], format: 'ratio' }), verifyExpr: '2/3' };
    expect(validateQuestion(q).status).toBe('VERIFIED');
    expect(validateQuestion({ ...q, answerData: JSON.stringify({ accepted: ['2/3'], format: 'ratio' }) }).issues.map((i) => i.code)).toContain('BAD_ANSWER_DATA');
  });
});
