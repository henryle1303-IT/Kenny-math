import { beforeAll, describe, expect, it } from 'vitest';
import type { Question } from '@prisma/client';
import { prisma } from '@/lib/db';
import { seedDemo } from '@/lib/services/demo';
import { DEMO_BANK_NAME, DEMO_PASSWORD, DEMO_USERNAME } from '@/lib/demo/demo-bank';
import { finalizeAttempt, getAttemptForTaking, getAttemptResult, listTestSummaries, saveAnswer, startAttempt } from '@/lib/services/attempts';
import { studentLogin } from '@/lib/services/student-auth';
import { analyzeImport, commitImport } from '@/lib/services/importer';
import { cloneBank, exportBankCsv, regenerateQuestion, updateQuestion } from '@/lib/services/banks';
import { exportProgress, importProgress } from '@/lib/services/progress-backup';
import { clearStudentProgress } from '@/lib/services/progress';
import { typeOf, parseDefinition, type TypedRow } from '@/lib/question-types';

const enc = (s: string) => new TextEncoder().encode(s);
let bankId = '';

/** The answer a perfect student would give, built from the stored definition. */
function right(q: Question): string {
  const d = q.answerData ? JSON.parse(q.answerData) : null;
  switch (typeOf(q.questionType)) {
    case 'MCQ': return q.correctAnswer;
    case 'NUMERIC_INPUT': case 'SHORT_TEXT': return d.accepted[0];
    case 'TRUE_FALSE': return JSON.stringify(d.statements.map((s: { truth: boolean }) => s.truth));
    case 'MULTI_SELECT': return JSON.stringify([...d.correct].sort((a: number, b: number) => a - b));
    case 'FILL_BLANK': return JSON.stringify(d.blanks.map((b: { accepted: string[] }) => b.accepted[0]));
    case 'ORDERING': return JSON.stringify(d.items.map((_: unknown, i: number) => i));
  }
}
function wrong(q: Question): string {
  const d = q.answerData ? JSON.parse(q.answerData) : null;
  switch (typeOf(q.questionType)) {
    case 'MCQ': return q.correctAnswer === 'A' ? 'B' : 'A';
    case 'NUMERIC_INPUT': return '99999';
    case 'SHORT_TEXT': return 'banana';
    case 'TRUE_FALSE': return JSON.stringify(d.statements.map((s: { truth: boolean }) => !s.truth));
    case 'MULTI_SELECT': return JSON.stringify([d.options.map((_: unknown, i: number) => i).find((i: number) => !d.correct.includes(i)) ?? 0]);
    case 'FILL_BLANK': return JSON.stringify(d.blanks.map(() => '12345'));
    case 'ORDERING': return JSON.stringify(d.items.map((_: unknown, i: number) => d.items.length - 1 - i));
  }
}

beforeAll(async () => {
  const r = await seedDemo();
  bankId = r.bankId;
});

describe('demo user and demo bank', () => {
  it('is idempotent and covers every type', async () => {
    const before = await prisma.question.count({ where: { bankId } });
    const again = await seedDemo();
    expect(again.created).toBe(false);
    expect(again.bankId).toBe(bankId);
    expect(await prisma.question.count({ where: { bankId } })).toBe(before);
    expect(await prisma.student.count({ where: { username: DEMO_USERNAME } })).toBe(1);
    expect(await prisma.questionBank.count({ where: { name: DEMO_BANK_NAME } })).toBe(1);
    const qs = await prisma.question.findMany({ where: { bankId } });
    expect(new Set(qs.map((q) => q.questionType))).toEqual(new Set(['MCQ', 'NUMERIC_INPUT', 'TRUE_FALSE', 'MULTI_SELECT', 'FILL_BLANK', 'ORDERING', 'SHORT_TEXT']));
    for (const t of ['MCQ', 'NUMERIC_INPUT', 'TRUE_FALSE', 'MULTI_SELECT', 'FILL_BLANK', 'ORDERING', 'SHORT_TEXT']) expect(qs.filter((q) => q.questionType === t).length).toBeGreaterThanOrEqual(2);
    expect(qs.every((q) => ['VERIFIED', 'MANUAL_OK'].includes(q.validationStatus))).toBe(true);
    for (const q of qs) expect(parseDefinition(typeOf(q.questionType), q.answerData).ok).toBe(true);
  });
  it('lets the demo user log in with password 123 and shows only its own three tests', async () => {
    const { token } = await studentLogin(DEMO_USERNAME, DEMO_PASSWORD, 'demo-ip');
    expect(token.length).toBeGreaterThan(10);
    await expect(studentLogin(DEMO_USERNAME, 'wrong', 'demo-ip')).rejects.toThrow();
    const tests = await listTestSummaries('demo');
    expect(tests.map((t) => t.testNumber)).toEqual([1, 11, 21]);
  });
  it('does not change an existing demo password and does not touch other users', async () => {
    const kenny = await prisma.student.findUnique({ where: { id: 'kenny' } });
    await prisma.student.update({ where: { id: 'demo' }, data: { passwordHash: 'custom-hash' } });
    await seedDemo();
    expect((await prisma.student.findUniqueOrThrow({ where: { id: 'demo' } })).passwordHash).toBe('custom-hash');
    expect(await prisma.student.findUnique({ where: { id: 'kenny' } })).toEqual(kenny);
    const { hashPassword } = await import('@/lib/services/admin-auth');
    await prisma.student.update({ where: { id: 'demo' }, data: { passwordHash: await hashPassword(DEMO_PASSWORD) } });
  });
});

describe('taking a test with mixed question types', () => {
  it('never leaks answers to the student while the test is open', async () => {
    const { attemptId } = await startAttempt(11, 'demo');
    const view = await getAttemptForTaking(attemptId, 'demo');
    if (view.finished) throw new Error('open');
    const json = JSON.stringify(view);
    expect(json).not.toMatch(/truth|accepted|correctAnswer|explanation|"correct"/);
    expect(view.questions.map((q) => q.view.type)).toEqual(['NUMERIC_INPUT', 'MCQ', 'FILL_BLANK', 'TRUE_FALSE', 'MULTI_SELECT', 'ORDERING']);
    const ordering = view.questions[5].view;
    if (ordering.type !== 'ORDERING') throw new Error('ordering');
    expect(ordering.items.map((i) => i.index)).not.toEqual([0, 1, 2, 3]);
    const again = await getAttemptForTaking(attemptId, 'demo');
    if (again.finished) throw new Error('open');
    const o2 = again.questions[5].view;
    if (o2.type !== 'ORDERING') throw new Error('ordering');
    expect(o2.items.map((i) => i.index)).toEqual(ordering.items.map((i) => i.index));
    await finalizeAttempt(attemptId);
  });

  it('rejects malformed answers for each type', async () => {
    const { attemptId } = await startAttempt(1, 'demo');
    const a = await prisma.testAttempt.findUniqueOrThrow({ where: { id: attemptId } });
    const order: string[] = JSON.parse(a.questionOrder);
    const qs = await prisma.question.findMany({ where: { id: { in: order } } });
    const of = (t: string) => qs.find((q) => q.questionType === t)!;
    await expect(saveAnswer(attemptId, of('MCQ').id, 'Z', 'demo')).rejects.toThrow(/A, B, C or D/);
    await expect(saveAnswer(attemptId, of('MCQ').id, '["A"]', 'demo')).rejects.toThrow();
    await expect(saveAnswer(attemptId, of('TRUE_FALSE').id, '[true]', 'demo')).rejects.toThrow();
    await expect(saveAnswer(attemptId, of('TRUE_FALSE').id, 'not json', 'demo')).rejects.toThrow();
    await expect(saveAnswer(attemptId, of('MULTI_SELECT').id, '[99]', 'demo')).rejects.toThrow();
    await expect(saveAnswer(attemptId, of('MULTI_SELECT').id, '[1,1]', 'demo')).rejects.toThrow();
    await expect(saveAnswer(attemptId, of('ORDERING').id, '[0,1]', 'demo')).rejects.toThrow();
    await expect(saveAnswer(attemptId, of('ORDERING').id, '[0,0,1,2]', 'demo')).rejects.toThrow();
    await expect(saveAnswer(attemptId, of('NUMERIC_INPUT').id, 'x'.repeat(100), 'demo')).rejects.toThrow();
    await expect(saveAnswer(attemptId, of('SHORT_TEXT').id, 'y'.repeat(500), 'demo')).rejects.toThrow();
    // a clean save, a change of mind, and clearing an answer
    await saveAnswer(attemptId, of('NUMERIC_INPUT').id, ' 1/2 ', 'demo');
    expect((await prisma.studentAnswer.findFirstOrThrow({ where: { attemptId, questionId: of('NUMERIC_INPUT').id } })).selectedAnswer).toBe('1/2');
    await saveAnswer(attemptId, of('NUMERIC_INPUT').id, '   ', 'demo');
    expect((await prisma.studentAnswer.findFirstOrThrow({ where: { attemptId, questionId: of('NUMERIC_INPUT').id } })).selectedAnswer).toBeNull();
    await finalizeAttempt(attemptId);
  });

  it('scores a perfect run and a bad run on every type, and shows the right answers on review', async () => {
    await clearStudentProgress('CLEAR', 'demo');
    const run = async (testNumber: number, pick: (q: Question) => string | null) => {
      const { attemptId } = await startAttempt(testNumber, 'demo');
      const a = await prisma.testAttempt.findUniqueOrThrow({ where: { id: attemptId } });
      const order: string[] = JSON.parse(a.questionOrder);
      const qs = new Map((await prisma.question.findMany({ where: { id: { in: order } } })).map((q) => [q.id, q]));
      for (const id of order) {
        const v = pick(qs.get(id)!);
        if (v !== null) await saveAnswer(attemptId, id, v, 'demo');
      }
      await finalizeAttempt(attemptId);
      return getAttemptResult(attemptId, 'demo');
    };
    const perfect = await run(1, right);
    expect(perfect.grade.correct).toBe(6);
    expect(perfect.items.every((i) => i.status === 'correct')).toBe(true);
    const bad = await run(21, wrong);
    expect(bad.grade.correct).toBe(0);
    expect(bad.grade.incorrect).toBe(6);
    expect(bad.items.every((i) => i.status === 'incorrect')).toBe(true);
    // equivalent spellings are accepted
    const alt = await run(11, (q) => (q.questionType === 'NUMERIC_INPUT' ? '0.75' : q.questionType === 'FILL_BLANK' ? '["1.0","10"]' : right(q)));
    expect(alt.grade.correct).toBe(6);
    // half answered: blanks count as unanswered
    const partial = await run(1, (q) => (['NUMERIC_INPUT', 'MCQ', 'TRUE_FALSE'].includes(q.questionType) ? right(q) : null));
    expect(partial.grade.correct).toBe(3);
    expect(partial.grade.unanswered).toBe(3);
    const xp = await prisma.studentXp.findUnique({ where: { studentId: 'demo' } });
    expect(xp?.totalXp ?? 0).toBeGreaterThan(0);
  });

  it('keeps typed answers through a progress backup and restore', async () => {
    const original = JSON.parse(JSON.stringify(await exportProgress('demo')));
    expect(original.answers.some((a: { selectedAnswer: string | null }) => a.selectedAnswer?.startsWith('['))).toBe(true);
    await clearStudentProgress('CLEAR', 'demo');
    await importProgress(original, 'RESTORE', 'demo');
    const restored = await exportProgress('demo');
    expect(restored.answers.map((a) => a.selectedAnswer).sort()).toEqual(original.answers.map((a: { selectedAnswer: string | null }) => a.selectedAnswer).sort());
  });
});

describe('admin tools with typed questions', () => {
  it('exports and re-imports the demo bank without losing any type or setup', async () => {
    const { csv } = await exportBankCsv(bankId);
    expect(csv).toContain('question_type,answer_data');
    const { jobId, report } = await analyzeImport({ name: 'demo.csv', bytes: enc(csv) }, 'UPDATE_SELECTED', { baseBankId: bankId, targetStudentId: 'demo' });
    expect(report.rowProblems).toEqual([]);
    expect(report.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(report.ok).toBe(true);
    const { bankId: copyId } = await commitImport(jobId, { name: 'Demo copy' });
    const a = await prisma.question.findMany({ where: { bankId }, orderBy: { questionId: 'asc' } });
    const b = await prisma.question.findMany({ where: { bankId: copyId }, orderBy: { questionId: 'asc' } });
    expect(b.map((q) => [q.questionId, q.questionType, q.answerData, q.correctAnswer])).toEqual(a.map((q) => [q.questionId, q.questionType, q.answerData, q.correctAnswer]));
  });

  it('rejects a typed question with a broken setup and does not allow regenerating it', async () => {
    const { csv } = await exportBankCsv(bankId);
    const broken = csv.replace('{""accepted"":[""84""]}', '{""accepted"":[""eighty four""]}');
    expect(broken).not.toBe(csv);
    const { report } = await analyzeImport({ name: 'bad.csv', bytes: enc(broken) }, 'UPDATE_SELECTED', { baseBankId: bankId, targetStudentId: 'demo' });
    expect(report.ok).toBe(false);
    expect(report.issues.some((i) => i.code === 'BAD_ANSWER_DATA')).toBe(true);

    const draft = await cloneBank(bankId, 'Demo draft');
    const numeric = await prisma.question.findFirstOrThrow({ where: { bankId: draft.id, questionType: 'NUMERIC_INPUT' } });
    await expect(regenerateQuestion(draft.id, numeric.id)).rejects.toThrow(/Edit this question/);
    const v = await updateQuestion(draft.id, numeric.id, { answerData: JSON.stringify({ accepted: ['not a number'] }) });
    expect(v.status).toBe('INVALID');
    const ok = await updateQuestion(draft.id, numeric.id, { answerData: numeric.answerData });
    expect(ok.status).not.toBe('INVALID');
  });
});

describe('type helpers on stored rows', () => {
  it('treats unknown stored types as multiple choice', () => {
    const r: TypedRow = { questionType: 'WHATEVER', answerData: null, correctAnswer: 'A' };
    expect(typeOf(r.questionType)).toBe('MCQ');
  });
});
