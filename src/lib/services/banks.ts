import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { AppError } from './attempts';
import { DEFAULT_BANK_SEED, generateForSlot, planBank, type Slot } from '../gen/bank';
import { fingerprintOf } from '../gen/engine';
import { TEST_COUNT, TEST_TIME_LIMIT_SEC, levelOf, testTitle, ratingFor } from '../gen/curriculum';
import { validateBank, type BankValidationReport } from '../validate/bank';
import { validateQuestion, type QuestionData } from '../validate/question';
import { questionsToCsv, type ExportQuestion } from '../csv/export';
import type { Question } from '@prisma/client';

export const EDITABLE = ['DRAFT', 'READY_FOR_REVIEW'];

export function toQuestionData(q: Question): QuestionData {
  return {
    questionId: q.questionId,
    testNumber: q.testNumber,
    position: q.position,
    level: q.level,
    difficulty: q.difficulty,
    topic: q.topic,
    skill: q.skill,
    questionText: q.questionText,
    options: [q.optionA, q.optionB, q.optionC, q.optionD],
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    commonMistake: q.commonMistake,
    learningTip: q.learningTip,
    verifyExpr: q.verifyExpr,
  };
}

export async function nextVersion(): Promise<number> {
  const max = await prisma.questionBank.aggregate({ _max: { version: true } });
  return (max._max.version ?? 0) + 1;
}

export async function createBank(opts: { name: string; source: 'GENERATED' | 'IMPORTED' | 'CLONED' | 'MANUAL'; parentBankId?: string | null; seed?: string; notes?: string }) {
  const name = opts.name.trim().slice(0, 120);
  if (!name) throw new AppError('Please give the bank a name.');
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const version = await nextVersion();
      return await prisma.questionBank.create({
        data: {
          name,
          version,
          source: opts.source,
          parentBankId: opts.parentBankId ?? null,
          seed: opts.seed ?? '',
          notes: opts.notes ?? '',
          tests: {
            create: Array.from({ length: TEST_COUNT }, (_, i) => ({
              testNumber: i + 1,
              level: levelOf(i + 1),
              title: testTitle(i + 1),
              timeLimitSec: TEST_TIME_LIMIT_SEC,
            })),
          },
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
      throw e;
    }
  }
  throw new AppError('Could not allocate a version number. Please try again.', 500);
}

export async function getBankOrThrow(bankId: string) {
  const b = await prisma.questionBank.findUnique({ where: { id: bankId } });
  if (!b) throw new AppError('Question bank not found.', 404, 'NOT_FOUND');
  return b;
}

export async function assertEditable(bankId: string) {
  const b = await getBankOrThrow(bankId);
  if (!EDITABLE.includes(b.status)) {
    throw new AppError('Published banks cannot be changed. Create a draft copy of this bank and edit the copy.', 409, 'NOT_EDITABLE');
  }
  return b;
}

function statusAfterEdit() {
  return { status: 'DRAFT', validatedAt: null, validationJson: null } as const;
}

export interface GenerateOptions {
  tests: number[];
  onlyTopic?: string;
  onlyPositions?: number[];
  variant?: number;
}

/** Generate (or regenerate) questions for some tests of a draft bank. Safe to call in small batches. */
export async function generateTests(bankId: string, opts: GenerateOptions) {
  const bank = await assertEditable(bankId);
  const seed = bank.seed || DEFAULT_BANK_SEED;
  const tests = [...new Set(opts.tests)].filter((t) => Number.isInteger(t) && t >= 1 && t <= TEST_COUNT);
  if (!tests.length) throw new AppError('Choose at least one test (1–30).');
  const plan = planBank(seed);
  const existing = await prisma.question.findMany({ where: { bankId } });
  const slotsToDo: Slot[] = plan.filter((s) => tests.includes(s.testNumber) && (!opts.onlyTopic || s.topic === opts.onlyTopic) && (!opts.onlyPositions || opts.onlyPositions.includes(s.position)));
  const redo = new Set(slotsToDo.map((s) => `${s.testNumber}:${s.position}`));
  const taken = new Set<string>();
  for (const q of existing) if (!redo.has(`${q.testNumber}:${q.position}`)) taken.add(fingerprintOf(q.questionText, [q.optionA, q.optionB, q.optionC, q.optionD]['ABCD'.indexOf(q.correctAnswer)] ?? ''));
  const rows: Prisma.QuestionCreateManyInput[] = [];
  for (const slot of slotsToDo) {
    const g = generateForSlot(seed, slot, taken, opts.variant ?? 0);
    taken.add(g.fingerprint);
    const data: QuestionData = {
      questionId: g.questionId, testNumber: g.testNumber, position: g.position, level: g.level, difficulty: g.difficulty, topic: g.topic, skill: g.skill,
      questionText: g.text, options: g.options, correctAnswer: g.correct, explanation: g.explanation, commonMistake: g.commonMistake, learningTip: g.learningTip, verifyExpr: g.verifyExpr,
    };
    const v = validateQuestion(data);
    rows.push({
      questionId: g.questionId, bankId, testNumber: g.testNumber, position: g.position, level: g.level, difficulty: g.difficulty, topic: g.topic, skill: g.skill,
      questionText: g.text, optionA: g.options[0], optionB: g.options[1], optionC: g.options[2], optionD: g.options[3], correctAnswer: g.correct,
      explanation: g.explanation, commonMistake: g.commonMistake, learningTip: g.learningTip, validationStatus: v.status, validationNotes: v.issues.map((i) => i.message).join(' | '),
      verifyExpr: g.verifyExpr, templateId: g.templateId,
    });
  }
  await prisma.$transaction(async (tx) => {
    await tx.question.deleteMany({ where: { bankId, OR: slotsToDo.map((s) => ({ testNumber: s.testNumber, position: s.position })) } });
    for (let i = 0; i < rows.length; i += 100) await tx.question.createMany({ data: rows.slice(i, i + 100) });
    await tx.questionBank.update({ where: { id: bankId }, data: statusAfterEdit() });
  }, { timeout: 30000, maxWait: 10000 });
  return { generated: rows.length, tests };
}

export async function validateBankById(bankId: string): Promise<BankValidationReport> {
  const bank = await getBankOrThrow(bankId);
  const questions = await prisma.question.findMany({ where: { bankId }, orderBy: [{ testNumber: 'asc' }, { position: 'asc' }] });
  const manual = new Set(questions.filter((q) => q.validationStatus === 'MANUAL_OK').map((q) => q.questionId));
  const report = validateBank(questions.map(toQuestionData), { requireComplete: true, manuallyReviewed: manual });
  const byRow = new Map<number, string[]>();
  for (const i of report.issues) {
    if (!byRow.has(i.row)) byRow.set(i.row, []);
    byRow.get(i.row)!.push(i.message);
  }
  const editable = EDITABLE.includes(bank.status);
  await prisma.$transaction(async (tx) => {
    if (editable) {
      const updates = new Map<string, { ids: string[]; status: string; notes: string }>();
      for (const [idx, q] of questions.entries()) {
        const pq = report.perQuestion[idx];
        const status = manual.has(q.questionId) && pq.status !== 'INVALID' ? 'MANUAL_OK' : pq.status;
        const notes = (byRow.get(idx + 1) ?? []).join(' | ');
        if (q.validationStatus !== status || q.validationNotes !== notes) {
          const key = JSON.stringify([status, notes]);
          const group = updates.get(key) ?? { ids: [], status, notes };
          group.ids.push(q.id);
          updates.set(key, group);
        }
      }
      // A newly imported bank normally shares one result across 900 questions.
      // Batch identical results to avoid 900 database round trips on Neon.
      for (const { ids, status, notes } of updates.values()) {
        for (let i = 0; i < ids.length; i += 200) {
          await tx.question.updateMany({ where: { bankId, id: { in: ids.slice(i, i + 200) } }, data: { validationStatus: status, validationNotes: notes } });
        }
      }
    }
    await tx.questionBank.update({
      where: { id: bankId },
      data: {
        validationJson: JSON.stringify({ ...report, issues: report.issues.slice(0, 500), perQuestion: undefined }),
        validatedAt: new Date(),
        ...(editable ? { status: report.ok ? 'READY_FOR_REVIEW' : 'DRAFT' } : {}),
      },
    });
  }, { timeout: 60000, maxWait: 10000 });
  return report;
}

export async function publishBank(bankId: string, opts: { acknowledgeReview?: boolean }) {
  const bank = await getBankOrThrow(bankId);
  if (!EDITABLE.includes(bank.status)) throw new AppError('Only draft banks can be published. Use “Activate” for banks that were published before.', 409);
  const report = await validateBankById(bankId);
  if (!report.ok) throw new AppError(`This bank still has ${report.invalidRows + report.bankErrors.length} validation problem(s). Fix them before publishing.`, 422, 'VALIDATION_FAILED');
  if (report.reviewRows + report.warningRows > 0 && !opts.acknowledgeReview) {
    throw new AppError(`${report.reviewRows + report.warningRows} question(s) are flagged for manual review. Review them, or confirm that you accept them as they are.`, 422, 'REVIEW_REQUIRED');
  }
  await prisma.$transaction(async (tx) => {
    await tx.questionBank.updateMany({ where: { isActive: true }, data: { isActive: false } });
    await tx.questionBank.update({ where: { id: bankId }, data: { status: 'PUBLISHED', publishedAt: new Date(), activatedAt: new Date(), isActive: true } });
  });
  return { published: true };
}

/** Make a previously published bank the one used for new tests (also used for rollback). */
export async function activateBank(bankId: string) {
  const bank = await getBankOrThrow(bankId);
  if (!bank.publishedAt) throw new AppError('Only published banks can be activated.', 409);
  await prisma.$transaction(async (tx) => {
    await tx.questionBank.updateMany({ where: { isActive: true, NOT: { id: bankId } }, data: { isActive: false } });
    await tx.questionBank.update({ where: { id: bankId }, data: { status: 'PUBLISHED', isActive: true, activatedAt: new Date() } });
  });
  return { activated: true };
}

export async function archiveBank(bankId: string) {
  const bank = await getBankOrThrow(bankId);
  if (bank.isActive) throw new AppError('The active bank cannot be archived. Activate another bank first.', 409);
  if (bank.status === 'DRAFT' || bank.status === 'READY_FOR_REVIEW') throw new AppError('Drafts can be deleted instead of archived.', 409);
  await prisma.questionBank.update({ where: { id: bankId }, data: { status: 'ARCHIVED' } });
}

export async function deleteBank(bankId: string, confirmName: string) {
  const bank = await getBankOrThrow(bankId);
  if (bank.isActive) throw new AppError('The active bank cannot be deleted.', 409);
  if (!EDITABLE.includes(bank.status)) throw new AppError('Only draft banks can be deleted. Published banks are kept for the history.', 409);
  const used = await prisma.testAttempt.count({ where: { bankId } });
  if (used > 0) throw new AppError('This bank is referenced by student attempts and cannot be deleted.', 409);
  if (confirmName.trim() !== bank.name) throw new AppError('Type the exact bank name to confirm deletion.', 400, 'CONFIRM_MISMATCH');
  await prisma.questionBank.delete({ where: { id: bankId } });
}

/** New draft copy of any bank (the way to “edit” a published bank). */
export async function cloneBank(bankId: string, name?: string) {
  const src = await getBankOrThrow(bankId);
  const copy = await createBank({ name: name?.trim() || `${src.name} (draft copy)`, source: 'CLONED', parentBankId: src.id, seed: src.seed });
  const qs = await prisma.question.findMany({ where: { bankId } });
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < qs.length; i += 100) {
      await tx.question.createMany({
        data: qs.slice(i, i + 100).map(({ id: _id, bankId: _b, ...rest }) => ({ ...rest, bankId: copy.id })),
      });
    }
  }, { timeout: 60000, maxWait: 10000 });
  return copy;
}

export interface QuestionEdit {
  topic?: string;
  skill?: string;
  difficulty?: number;
  questionText?: string;
  options?: [string, string, string, string];
  correctAnswer?: string;
  explanation?: string;
  commonMistake?: string;
  learningTip?: string;
  verifyExpr?: string | null;
}

export async function updateQuestion(bankId: string, questionDbId: string, edit: QuestionEdit) {
  await assertEditable(bankId);
  const q = await prisma.question.findFirst({ where: { id: questionDbId, bankId } });
  if (!q) throw new AppError('Question not found.', 404, 'NOT_FOUND');
  const next = {
    topic: edit.topic ?? q.topic,
    skill: edit.skill ?? q.skill,
    difficulty: edit.difficulty ?? q.difficulty,
    questionText: edit.questionText ?? q.questionText,
    optionA: edit.options?.[0] ?? q.optionA,
    optionB: edit.options?.[1] ?? q.optionB,
    optionC: edit.options?.[2] ?? q.optionC,
    optionD: edit.options?.[3] ?? q.optionD,
    correctAnswer: edit.correctAnswer ?? q.correctAnswer,
    explanation: edit.explanation ?? q.explanation,
    commonMistake: edit.commonMistake ?? q.commonMistake,
    learningTip: edit.learningTip ?? q.learningTip,
    verifyExpr: edit.verifyExpr === undefined ? q.verifyExpr : edit.verifyExpr || null,
  };
  const data = toQuestionData({ ...q, ...next });
  const v = validateQuestion(data);
  await prisma.$transaction([
    prisma.question.update({ where: { id: q.id }, data: { ...next, validationStatus: v.status, validationNotes: v.issues.map((i) => i.message).join(' | ') } }),
    prisma.questionBank.update({ where: { id: bankId }, data: statusAfterEdit() }),
  ]);
  return v;
}

export async function markReviewed(bankId: string, questionDbId: string) {
  await assertEditable(bankId);
  const q = await prisma.question.findFirst({ where: { id: questionDbId, bankId } });
  if (!q) throw new AppError('Question not found.', 404, 'NOT_FOUND');
  const v = validateQuestion(toQuestionData(q));
  if (v.status === 'INVALID') throw new AppError('This question has errors that must be fixed first.', 422);
  await prisma.question.update({ where: { id: q.id }, data: { validationStatus: 'MANUAL_OK' } });
  await prisma.questionBank.update({ where: { id: bankId }, data: statusAfterEdit() });
}

export async function createQuestion(bankId: string, input: QuestionData) {
  await assertEditable(bankId);
  const clash = await prisma.question.findFirst({ where: { bankId, OR: [{ questionId: input.questionId }, { testNumber: input.testNumber, position: input.position }] } });
  if (clash) throw new AppError('That question ID or test position is already used in this bank.', 409);
  const v = validateQuestion(input);
  const q = await prisma.question.create({
    data: {
      questionId: input.questionId, bankId, testNumber: input.testNumber, position: input.position, level: levelOf(input.testNumber), difficulty: input.difficulty,
      topic: input.topic, skill: input.skill, questionText: input.questionText, optionA: input.options[0], optionB: input.options[1], optionC: input.options[2], optionD: input.options[3],
      correctAnswer: input.correctAnswer, explanation: input.explanation, commonMistake: input.commonMistake, learningTip: input.learningTip, verifyExpr: input.verifyExpr ?? null,
      validationStatus: v.status, validationNotes: v.issues.map((i) => i.message).join(' | '),
    },
  });
  await prisma.questionBank.update({ where: { id: bankId }, data: statusAfterEdit() });
  return q;
}

export async function duplicateQuestion(bankId: string, questionDbId: string) {
  await assertEditable(bankId);
  const q = await prisma.question.findFirst({ where: { id: questionDbId, bankId } });
  if (!q) throw new AppError('Question not found.', 404, 'NOT_FOUND');
  const used = new Set((await prisma.question.findMany({ where: { bankId, testNumber: q.testNumber }, select: { position: true } })).map((x) => x.position));
  let pos = 0;
  for (let p = 1; p <= 30; p++) if (!used.has(p)) { pos = p; break; }
  if (!pos) throw new AppError('This test already has 30 questions. Delete one first, then duplicate.', 409);
  const qid = `${q.questionId}-COPY${Date.now().toString(36).slice(-3).toUpperCase()}`;
  const { id: _id, ...rest } = q;
  const copy = await prisma.question.create({ data: { ...rest, questionId: qid, position: pos, validationStatus: 'PENDING', validationNotes: 'Duplicate – change the content before publishing.' } });
  await prisma.questionBank.update({ where: { id: bankId }, data: statusAfterEdit() });
  return copy;
}

export async function deleteQuestion(bankId: string, questionDbId: string) {
  await assertEditable(bankId);
  const used = await prisma.studentAnswer.count({ where: { questionId: questionDbId } });
  if (used) throw new AppError('This question is referenced by student answers.', 409);
  await prisma.question.deleteMany({ where: { id: questionDbId, bankId } });
  await prisma.questionBank.update({ where: { id: bankId }, data: statusAfterEdit() });
}

export async function regenerateQuestion(bankId: string, questionDbId: string) {
  const bank = await assertEditable(bankId);
  const q = await prisma.question.findFirst({ where: { id: questionDbId, bankId } });
  if (!q) throw new AppError('Question not found.', 404, 'NOT_FOUND');
  const variant = Math.floor(Math.random() * 1_000_000) + 1;
  await generateTests(bankId, { tests: [q.testNumber], onlyPositions: [q.position], variant });
  void bank;
  void ratingFor;
}

export interface QuestionFilter {
  q?: string;
  test?: number;
  topic?: string;
  difficulty?: number;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function listQuestions(bankId: string, f: QuestionFilter) {
  const where: Prisma.QuestionWhereInput = { bankId };
  if (f.test) where.testNumber = f.test;
  if (f.topic) where.topic = f.topic;
  if (f.difficulty) where.difficulty = f.difficulty;
  if (f.status) where.validationStatus = f.status;
  if (f.q?.trim()) {
    const t = f.q.trim();
    where.OR = [{ questionText: { contains: t } }, { questionId: { contains: t } }, { skill: { contains: t } }, { explanation: { contains: t } }];
  }
  const pageSize = Math.min(100, f.pageSize ?? 30);
  const page = Math.max(1, f.page ?? 1);
  const [total, items] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({ where, orderBy: [{ testNumber: 'asc' }, { position: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { total, page, pageSize, items };
}

export async function exportBankCsv(bankId: string, tests?: number[]) {
  const bank = await getBankOrThrow(bankId);
  const qs = await prisma.question.findMany({
    where: { bankId, ...(tests && tests.length ? { testNumber: { in: tests } } : {}) },
    orderBy: [{ testNumber: 'asc' }, { position: 'asc' }],
  });
  const rows: ExportQuestion[] = qs.map((q) => ({
    questionId: q.questionId, testNumber: q.testNumber, position: q.position, level: q.level, difficulty: q.difficulty, topic: q.topic, skill: q.skill,
    questionText: q.questionText, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD, correctAnswer: q.correctAnswer,
    explanation: q.explanation, commonMistake: q.commonMistake, learningTip: q.learningTip, verifyExpr: q.verifyExpr, validationStatus: q.validationStatus,
  }));
  return { csv: questionsToCsv(rows, bank.id, bank.version), bank, count: rows.length };
}

export async function listBanks() {
  const banks = await prisma.questionBank.findMany({ orderBy: { version: 'desc' }, include: { _count: { select: { questions: true, attempts: true } } } });
  return banks;
}

/** Insert a full set of validated rows as questions of a bank. */
export async function insertQuestions(bankId: string, rows: { data: QuestionData; status: string; notes: string }[]) {
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < rows.length; i += 100) {
      await tx.question.createMany({
        data: rows.slice(i, i + 100).map(({ data: d, status, notes }) => ({
          questionId: d.questionId, bankId, testNumber: d.testNumber, position: d.position, level: levelOf(d.testNumber), difficulty: d.difficulty, topic: d.topic, skill: d.skill,
          questionText: d.questionText, optionA: d.options[0], optionB: d.options[1], optionC: d.options[2], optionD: d.options[3], correctAnswer: d.correctAnswer,
          explanation: d.explanation, commonMistake: d.commonMistake, learningTip: d.learningTip, verifyExpr: d.verifyExpr ?? null, validationStatus: status, validationNotes: notes,
        })),
      });
    }
  }, { timeout: 60000, maxWait: 10000 });
}

export { fingerprintOf };
