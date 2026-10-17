import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { AU_SEED, buildAuBank, toQuestionData, type AuBankRow } from '@/lib/gen/au/plan';
import { auRowsToCsv } from '@/lib/gen/au/csv';
import { TYPE_MIX, SECTIONS } from '@/lib/gen/au/sections';
import { isResponseCorrect, normalizeResponse, typeOf, type TypedRow } from '@/lib/question-types';
import { validateBank } from '@/lib/validate/bank';
import { mapCsvRows, parseCsvText } from '@/lib/csv/import';
import { levelOf } from '@/lib/gen/curriculum';

let rows: AuBankRow[] = [];
beforeAll(() => {
  rows = buildAuBank();
});

const row = (r: AuBankRow): TypedRow => ({ questionType: r.question.questionType, answerData: r.question.answerData, correctAnswer: r.question.correctAnswer });

/** The answer a perfect student would give. */
function right(r: AuBankRow): string {
  const q = r.question;
  const d = q.answerData ? JSON.parse(q.answerData) : null;
  switch (q.questionType) {
    case 'MCQ': return q.correctAnswer;
    case 'NUMERIC_INPUT': case 'SHORT_TEXT': return d.accepted[0];
    case 'TRUE_FALSE': return JSON.stringify(d.statements.map((s: { truth: boolean }) => s.truth));
    case 'MULTI_SELECT': return JSON.stringify([...d.correct].sort((a: number, b: number) => a - b));
    case 'FILL_BLANK': return JSON.stringify(d.blanks.map((b: { accepted: string[] }) => b.accepted[0]));
    case 'ORDERING': return JSON.stringify(d.items.map((_: unknown, i: number) => i));
    default: throw new Error('unknown type');
  }
}

describe('Australian Year 5 bank', () => {
  it('has 30 tests of 30 questions and passes the full bank validation with every question verified', () => {
    expect(rows).toHaveLength(900);
    const report = validateBank(rows.map(toQuestionData), { requireComplete: true });
    expect(report.bankErrors).toEqual([]);
    expect(report.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.verifiedRows).toBe(900);
    expect(report.reviewRows + report.warningRows).toBe(0);
    for (let t = 1; t <= 30; t++) expect(rows.filter((r) => r.testNumber === t)).toHaveLength(30);
  });

  it('uses the planned mix of question types in every test', () => {
    for (let t = 1; t <= 30; t++) {
      const mix = TYPE_MIX[levelOf(t)];
      const counts = new Map<string, number>();
      for (const r of rows.filter((x) => x.testNumber === t)) counts.set(r.question.questionType, (counts.get(r.question.questionType) ?? 0) + 1);
      const typed = Object.values(mix).reduce((a, b) => a + (b ?? 0), 0);
      expect(counts.get('MCQ')).toBe(30 - typed);
      for (const [k, n] of Object.entries(mix)) expect(counts.get(k)).toBe(n);
    }
  });

  it('covers every section in every test, in roughly the planned amounts', () => {
    for (let t = 1; t <= 30; t++) {
      const topics = new Set(rows.filter((r) => r.testNumber === t).map((r) => r.topic));
      expect(topics.size).toBeGreaterThanOrEqual(13);
    }
    const labels = new Set(rows.map((r) => r.topic));
    expect(labels.size).toBe(SECTIONS.length);
  });

  it('has no repeated questions and 30 different short answer questions', () => {
    const keys = new Set(rows.map((r) => `${r.question.text}|${r.question.answerData}|${r.question.options.join('|')}`));
    expect(keys.size).toBe(900);
    const shorts = rows.filter((r) => r.question.questionType === 'SHORT_TEXT').map((r) => r.question.text);
    expect(new Set(shorts).size).toBe(30);
  });

  it('marks the stored answer right and the opposite answer wrong for every question', () => {
    for (const r of rows) {
      const good = right(r);
      const norm = normalizeResponse(row(r), good);
      expect(norm.ok, `${r.testNumber}/${r.position} ${r.question.templateId}`).toBe(true);
      expect(isResponseCorrect(row(r), good), `${r.testNumber}/${r.position} ${r.question.templateId}`).toBe(true);
      const t = typeOf(r.question.questionType);
      if (t === 'MCQ') expect(isResponseCorrect(row(r), r.question.correctAnswer === 'A' ? 'B' : 'A')).toBe(false);
      if (t === 'NUMERIC_INPUT') expect(isResponseCorrect(row(r), '987654')).toBe(false);
      if (t === 'ORDERING') expect(isResponseCorrect(row(r), JSON.stringify([...JSON.parse(good)].reverse()))).toBe(false);
    }
  });

  it('keeps the explanation, common mistake and tip filled in, with Australian spelling and no ratio or speed questions', () => {
    for (const r of rows) {
      expect(r.question.explanation.length).toBeGreaterThan(20);
      expect(r.question.commonMistake.length).toBeGreaterThan(5);
      expect(r.question.learningTip.length).toBeGreaterThan(5);
      expect(`${r.question.text} ${r.question.options.join(' ')}`).not.toMatch(/\b(meter|liter|color)s?\b/i);
      expect(r.question.skill).not.toMatch(/^(ra|pc|ts\.(speed|advanced))\./);
    }
  });

  it('is deterministic and the committed CSV matches what the generator makes', () => {
    const again = buildAuBank(AU_SEED);
    expect(auRowsToCsv(again)).toBe(auRowsToCsv(rows));
    const committed = fs.readFileSync(path.resolve('exports/kenny-math-v2.csv'), 'utf8');
    expect(committed).toBe(auRowsToCsv(rows));
  });

  it('produces a CSV the importer reads back without problems or loss', () => {
    const parsed = parseCsvText(auRowsToCsv(rows));
    const mapped = mapCsvRows(parsed);
    expect(mapped.missingColumns).toEqual([]);
    expect(mapped.problems).toEqual([]);
    expect(mapped.rows).toHaveLength(900);
    mapped.rows.forEach((m, i) => {
      expect(m.data.questionType).toBe(rows[i].question.questionType);
      expect(m.data.answerData ?? null).toBe(rows[i].question.answerData);
      expect(m.data.questionText).toBe(rows[i].question.text);
    });
    expect(validateBank(mapped.rows.map((x) => x.data), { requireComplete: true }).ok).toBe(true);
  });

  it('writes one reading file per test', () => {
    for (let t = 1; t <= 30; t++) {
      const f = path.resolve(`exports/kenny-math-v2-sets/set-${String(t).padStart(2, '0')}.csv`);
      expect(fs.existsSync(f)).toBe(true);
      expect(fs.readFileSync(f, 'utf8')).toBe(auRowsToCsv(rows.filter((r) => r.testNumber === t)));
    }
  });
});
