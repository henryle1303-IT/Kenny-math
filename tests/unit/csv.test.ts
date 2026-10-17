import { describe, expect, it } from 'vitest';
import { BOM, buildTemplateCsv, parseTests, questionsToCsv, sanitizeCell, unsanitizeCell, type ExportQuestion } from '@/lib/csv/export';
import { decodeCsvBytes, mapCsvRows, parseCsvBytes, parseCsvText } from '@/lib/csv/import';
import { validateBank } from '@/lib/validate/bank';

const q = (over: Partial<ExportQuestion> = {}): ExportQuestion => ({
  questionId: 'T01-Q01', testNumber: 1, position: 1, level: 'Beginner', difficulty: 1, topic: 'Fractions', skill: 'fr.add',
  questionText: 'Calculate \\(\\frac{1}{4} + \\frac{2}{4}\\), then "check" it,\nthen explain.', optionA: '\\(\\frac{3}{8}\\)', optionB: '\\(\\frac{3}{4}\\)', optionC: 'a, b', optionD: 'Tiếng Việt – ½',
  correctAnswer: 'B', explanation: 'Step 1: add.\nStep 2: "done", really.\nAnswer: \\(\\frac{3}{4}\\)', commonMistake: 'Adding denominators, too.', learningTip: 'Tip, with comma.', verifyExpr: '1/4+2/4', validationStatus: 'VERIFIED', ...over,
});

describe('CSV export', () => {
  it('starts with a UTF-8 BOM and uses CRLF', () => {
    const csv = questionsToCsv([q()], 'bank1', 3);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv).toContain('\r\n');
    expect(csv.split('\r\n')[0].replace(BOM, '')).toBe('question_id,test_id,question_number,test_level,difficulty,topic,skill,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,common_mistake,learning_tip,bank_id,bank_version,verify_expr,validation_status,question_type,answer_data');
  });
  it('neutralises spreadsheet formulas and reverses it', () => {
    expect(sanitizeCell('=1+1')).toBe("'=1+1");
    expect(sanitizeCell('+5')).toBe("'+5");
    expect(sanitizeCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(sanitizeCell('-cmd')).toBe("'-cmd");
    expect(sanitizeCell('-5')).toBe('-5');
    expect(sanitizeCell('normal')).toBe('normal');
    for (const s of ['=1+1', '+5', '@x', '-cmd']) expect(unsanitizeCell(sanitizeCell(s))).toBe(s);
  });
  it('parses test ranges', () => {
    expect(parseTests('1-3,7,9-10')).toEqual([1, 2, 3, 7, 9, 10]);
    expect(parseTests('5')).toEqual([5]);
    expect(() => parseTests('x')).toThrow();
    expect(() => parseTests('1,wrong')).toThrow();
    expect(() => parseTests('31')).toThrow();
    expect(parseTests('  ')).toBeUndefined();
    expect(parseTests('5-3,3,1')).toEqual([1, 3, 4, 5]);
    expect(parseTests(null)).toBeUndefined();
  });
});

describe('CSV round trip', () => {
  it('preserves commas, quotes, newlines, unicode and formulas', () => {
    const rows = [q(), q({ questionId: 'T01-Q02', position: 2, questionText: '=SUM(1,2) danger', optionA: '+5', optionB: '-cmd|x', verifyExpr: null })];
    const csv = questionsToCsv(rows, 'b', 1);
    const parsed = parseCsvBytes(new TextEncoder().encode(csv));
    expect(parsed.parseErrors).toEqual([]);
    const mapped = mapCsvRows(parsed);
    expect(mapped.problems).toEqual([]);
    expect(mapped.rows).toHaveLength(2);
    const [a, b] = mapped.rows.map((r) => r.data);
    expect(a.questionText).toBe(rows[0].questionText);
    expect(a.options[3]).toBe('Tiếng Việt – ½');
    expect(a.explanation).toBe(rows[0].explanation);
    expect(a.verifyExpr).toBe('1/4+2/4');
    expect(b.questionText).toBe('=SUM(1,2) danger');
    expect(b.options[0]).toBe('+5');
    expect(b.options[1]).toBe('-cmd|x');
  });
  it('handles semicolon delimiters and Windows-1252 files', () => {
    const csv = 'question_id;test_id;question_number;test_level;difficulty;topic;skill;question_text;option_a;option_b;option_c;option_d;correct_answer;explanation;common_mistake;learning_tip\nX1;1;1;Beginner;1;T;s;Qtext;1;2;3;4;a;Answer: 2;m;t\n';
    const p = parseCsvText(csv);
    expect(p.rows).toHaveLength(1);
    expect(mapCsvRows(p).rows[0].data.correctAnswer).toBe('A');
    const bytes = Uint8Array.from([0x63, 0x61, 0x66, 0xe9]); // "café" in Windows-1252
    const d = decodeCsvBytes(bytes);
    expect(d.text).toBe('café');
    expect(d.encoding).toMatch(/1252/);
  });
  it('reports missing columns and bad rows', () => {
    const m = mapCsvRows(parseCsvText('question_id,test_id\nA,1\n'));
    expect(m.missingColumns).toContain('option_a');
    const bad = mapCsvRows(parseCsvText(buildHeader() + 'Q1,abc,1,Beginner,1,T,s,text,1,2,3,4,B,expl,m,t\nQ2,1,2,Beginner,1,T,s,text,1,2,3,4,Z,expl,m,t\nQ3,1,3,Beginner,1,T,s,,1,2,3,4,B,expl,m,t\n'));
    expect(bad.problems.length).toBeGreaterThanOrEqual(3);
    expect(bad.problems.map((p) => p.row)).toEqual(expect.arrayContaining([1, 2, 3]));
  });
  it('rejects binary content', () => {
    expect(parseCsvBytes(Uint8Array.from([0x50, 0x4b, 0x03, 0x00, 0x00])).parseErrors[0]).toMatch(/binary/);
  });
});

function buildHeader() {
  return 'question_id,test_id,question_number,test_level,difficulty,topic,skill,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,common_mistake,learning_tip\n';
}

describe('template', () => {
  it('has descriptions, valid example rows that are skipped by default', () => {
    const t = buildTemplateCsv();
    expect(t.startsWith(BOM)).toBe(true);
    expect(t).toContain('# question_id:');
    const parsed = parseCsvText(t);
    expect(mapCsvRows(parsed).rows).toHaveLength(0);
    expect(mapCsvRows(parsed).skippedExamples).toBe(9);
    const withEx = mapCsvRows(parsed, { includeExamples: true });
    expect(withEx.problems).toEqual([]);
    const rep = validateBank(withEx.rows.map((r) => r.data), { requireComplete: false });
    expect(rep.invalidRows).toBe(0);
  });
});

describe('typed questions in CSV', () => {
  const typedRow = (over: Record<string, string>) =>
    ['question_id,test_id,question_number,test_level,difficulty,topic,skill,question_text,option_a,option_b,option_c,option_d,correct_answer,explanation,common_mistake,learning_tip,question_type,answer_data',
      Object.values({ question_id: 'T-1', test_id: '1', question_number: '1', test_level: 'Beginner', difficulty: '1', topic: 'Fractions', skill: 'fr.addsub', question_text: 'Type it', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: '', explanation: 'Answer 3/4', common_mistake: 'm', learning_tip: 't', question_type: 'NUMERIC_INPUT', answer_data: '"{""accepted"":[""3/4""]}"', ...over }).join(',')].join('\n');

  it('reads a typed row and keeps its JSON', () => {
    const m = mapCsvRows(parseCsvText(typedRow({})));
    expect(m.problems).toEqual([]);
    expect(m.rows[0].data.questionType).toBe('NUMERIC_INPUT');
    expect(JSON.parse(m.rows[0].data.answerData!)).toEqual({ accepted: ['3/4'] });
  });
  it('treats old files without the new columns as multiple choice', () => {
    const m = mapCsvRows(parseCsvText(questionsToCsv([q()], 'b', 1).replace(/,question_type,answer_data/, '').replace(/,MCQ,\r?\n?$/m, '')));
    expect(m.problems).toEqual([]);
    expect(m.rows[0].data.questionType ?? 'MCQ').toBe('MCQ');
  });
  it('rejects a typed row without answer_data and an unknown type', () => {
    expect(mapCsvRows(parseCsvText(typedRow({ answer_data: '' }))).problems.map((p) => p.message).join()).toContain('answer_data is required');
    expect(mapCsvRows(parseCsvText(typedRow({ question_type: 'DRAWING' }))).problems.map((p) => p.message).join()).toContain('question_type must be one of');
  });
  it('still requires options for multiple choice', () => {
    const m = mapCsvRows(parseCsvText(typedRow({ question_type: 'MCQ', answer_data: '' })));
    expect(m.problems.map((p) => p.message).join()).toContain('option_a is required');
  });
  it('round trips every type through export and import', () => {
    const rows = [
      { type: 'NUMERIC_INPUT', data: '{"accepted":["3/4"]}' },
      { type: 'TRUE_FALSE', data: '{"statements":[{"text":"a, \\"quoted\\"","truth":true}]}' },
      { type: 'ORDERING', data: '{"items":["1","2","3"]}' },
    ].map((x, i) => ({ ...q(), questionId: `R-${i}`, position: i + 1, questionType: x.type, answerData: x.data, optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: '' }));
    const back = mapCsvRows(parseCsvText(questionsToCsv(rows, 'b', 1)));
    expect(back.problems).toEqual([]);
    expect(back.rows.map((r) => [r.data.questionType, r.data.answerData])).toEqual(rows.map((r) => [r.questionType, r.answerData]));
  });
});
