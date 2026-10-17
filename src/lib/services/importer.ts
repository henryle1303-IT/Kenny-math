import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { AppError } from './attempts';
import { createBank, getBankOrThrow, insertQuestions, toQuestionData, validateBankById, activateBank, EDITABLE } from './banks';
import { MAX_UPLOAD_BYTES, mapCsvRows, parseCsvBytes } from '../csv/import';
import { validateBank, type BankValidationReport, type RowIssue } from '../validate/bank';
import type { QuestionData } from '../validate/question';
import { rowsToCsv } from '../csv/export';
import { answerKeyText, typeOf } from '../question-types';

export type ImportMode = 'NEW_BANK' | 'REPLACE_ACTIVE' | 'UPDATE_SELECTED';

export interface ImportReport extends BankValidationReport {
  mode: ImportMode;
  encoding: string;
  filename: string;
  headerProblems: string[];
  rowProblems: { row: number; questionId: string; message: string; code: string }[];
  skippedExamples: number;
  unknownIds: string[];
  canCommit: boolean;
  previewRows: { row: number; questionId: string; testNumber: number; position: number; topic: string; difficulty: number; text: string; correct: string; status: string }[];
}

export async function analyzeImport(file: { name: string; bytes: Uint8Array }, mode: ImportMode, opts: { baseBankId?: string | null; includeExamples?: boolean; targetStudentId?: string | null }) {
  if (file.bytes.byteLength === 0) throw new AppError('The file is empty.');
  if (file.bytes.byteLength > MAX_UPLOAD_BYTES) throw new AppError(`The file is too large (limit ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).`, 413);
  if (!/\.csv$/i.test(file.name)) throw new AppError('Please upload a .csv file.');
  const target = opts.targetStudentId ?? null;
  if (target && !await prisma.student.findUnique({ where: { id: target } })) throw new AppError('User not found.', 404);
  const baseBankId = mode === 'UPDATE_SELECTED' ? opts.baseBankId : null;
  if (baseBankId) {
    const base = await getBankOrThrow(baseBankId);
    if (base.ownerId && base.ownerId !== target) throw new AppError('The source bank belongs to another user.', 403);
  }
  const parsed = parseCsvBytes(file.bytes);
  const mapped = mapCsvRows(parsed, { includeExamples: opts.includeExamples });
  const headerProblems: string[] = [...parsed.parseErrors.slice(0, 5)];
  if (mapped.missingColumns.length) headerProblems.push(`Missing required column(s): ${mapped.missingColumns.join(', ')}`);

  const rows: QuestionData[] = mapped.rows.map((r) => r.data);
  const rowNumbers = mapped.rows.map((r) => r.row);
  const full = mode !== 'UPDATE_SELECTED';
  const base = validateBank(rows, { requireComplete: full });
  // Map validator row indices (1..n) back to the original data-row numbers.
  const remap = (r: number) => rowNumbers[r - 1] ?? r;
  const issues: RowIssue[] = base.issues.map((i) => ({ ...i, row: remap(i.row) }));
  const perQuestion = base.perQuestion.map((p) => ({ ...p, row: remap(p.row) }));
  const unknownIds: string[] = [];

  if (mode === 'UPDATE_SELECTED') {
    if (!opts.baseBankId) throw new AppError('Choose the bank to update.');
    const baseQs = await prisma.question.findMany({ where: { bankId: opts.baseBankId } });
    const byId = new Map(baseQs.map((q) => [q.questionId, q]));
    mapped.rows.forEach((r) => {
      const b = byId.get(r.data.questionId);
      if (!b) {
        unknownIds.push(r.data.questionId);
        issues.push({ severity: 'error', code: 'UNKNOWN_ID', message: `question_id “${r.data.questionId}” does not exist in the selected bank`, row: r.row, questionId: r.data.questionId });
      } else if (b.testNumber !== r.data.testNumber || b.position !== r.data.position) {
        issues.push({ severity: 'error', code: 'POSITION_CHANGED', message: `test_id/question_number differ from the stored question (${b.testNumber}/${b.position}). Updates cannot move questions.`, row: r.row, questionId: r.data.questionId });
      }
    });
  }
  for (const p of mapped.problems) {
    issues.push({ severity: 'error', code: p.code, message: p.message, row: p.row, questionId: p.questionId });
  }

  const errorRows = new Set(issues.filter((i) => i.severity === 'error').map((i) => i.row));
  const missingRows = new Set(issues.filter((i) => i.code === 'MISSING_FIELD').map((i) => i.row));
  const dupRows = new Set(issues.filter((i) => i.code.startsWith('DUPLICATE')).map((i) => i.row));
  const totalRows = mapped.rows.length + new Set(mapped.problems.map((p) => p.row)).size;
  const report: ImportReport = {
    ...base,
    issues,
    perQuestion,
    totalRows,
    validRows: Math.max(0, totalRows - errorRows.size),
    invalidRows: errorRows.size,
    missingFieldRows: missingRows.size,
    duplicateRows: dupRows.size,
    mode,
    encoding: parsed.encoding,
    filename: file.name,
    headerProblems,
    rowProblems: mapped.problems,
    skippedExamples: mapped.skippedExamples,
    unknownIds,
    ok: errorRows.size === 0 && base.bankErrors.length === 0 && headerProblems.length === 0 && rows.length > 0,
    canCommit: false,
    previewRows: mapped.rows.slice(0, 40).map((r) => ({
      row: r.row, questionId: r.data.questionId, testNumber: r.data.testNumber, position: r.data.position, topic: r.data.topic, difficulty: r.data.difficulty,
      text: r.data.questionText.slice(0, 160), correct: (typeOf(r.data.questionType) === 'MCQ' ? r.data.options['ABCD'.indexOf(r.data.correctAnswer)] : answerKeyText({ questionType: r.data.questionType, answerData: r.data.answerData, correctAnswer: '' })) ?? '', status: perQuestion.find((p) => p.row === r.row)?.status ?? '',
    })),
  };
  report.canCommit = report.ok;
  const job = await prisma.importJob.create({
    data: {
      targetStudentId: target,
      filename: file.name.slice(0, 200),
      mode,
      baseBankId: baseBankId ?? null,
      status: report.ok ? 'VALIDATED' : 'REJECTED',
      reportJson: JSON.stringify({ ...report, issues: report.issues.slice(0, 2000), perQuestion: undefined }),
      rowsJson: JSON.stringify(rows),
    },
  });
  return { jobId: job.id, report };
}

export async function getImportJob(jobId: string) {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job) throw new AppError('Import not found.', 404, 'NOT_FOUND');
  return { job, report: JSON.parse(job.reportJson) as ImportReport };
}

/** CSV of errors and warnings with row numbers. */
export async function errorReportCsv(jobId: string) {
  const { report } = await getImportJob(jobId);
  const rows = [
    ...report.headerProblems.map((m) => ({ row: '', question_id: '', severity: 'error', code: 'FILE', message: m })),
    ...report.bankErrors.map((m) => ({ row: '', question_id: '', severity: 'error', code: 'BANK', message: m })),
    ...report.issues.map((i) => ({ row: String(i.row), question_id: i.questionId, severity: i.severity, code: i.code, message: i.message })),
  ];
  return rowsToCsv(rows as never, ['row', 'question_id', 'severity', 'code', 'message']);
}

export async function commitImport(jobId: string, opts: { name?: string; activate?: boolean; confirmText?: string; acknowledgeReview?: boolean }) {
  for (let retry = 0; ; retry++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const job = await tx.importJob.findUnique({ where: { id: jobId } });
        if (!job) throw new AppError('Import not found.', 404, 'NOT_FOUND');
        const report = JSON.parse(job.reportJson) as ImportReport;
        if (job.status === 'COMMITTED') throw new AppError('This import has already been saved.', 409);
        if (!report.ok) throw new AppError('This file has validation errors, so nothing was saved. Fix the file and upload it again.', 422, 'VALIDATION_FAILED');
        if (job.status !== 'VALIDATED') throw new AppError('This import cannot be committed.', 409);
        const claim = await tx.importJob.updateMany({ where: { id: jobId, status: 'VALIDATED' }, data: { status: 'COMMITTING' } });
        if (claim.count !== 1) throw new AppError('This import is already being saved.', 409);
        const rows = JSON.parse(job.rowsJson) as QuestionData[];
        const mode = job.mode as ImportMode;
        if (mode === 'REPLACE_ACTIVE' && opts.activate && opts.confirmText !== 'REPLACE') {
          throw new AppError('Type REPLACE to confirm replacing the active bank.', 400, 'CONFIRM_REQUIRED');
        }
        const stamp = new Date().toISOString().slice(0, 10);
        let bankId: string;
        if (mode === 'UPDATE_SELECTED') {
          if (!job.baseBankId) throw new AppError('The base bank is missing.');
          const base = await getBankOrThrow(job.baseBankId, tx);
          const copy = await createBank({ name: opts.name?.trim() || `${base.name} (updated ${stamp})`, source: 'IMPORTED', ownerId: job.targetStudentId, parentBankId: base.id, seed: base.seed, notes: `Updated ${rows.length} question(s) from ${job.filename}` }, tx);
          const baseQs = await tx.question.findMany({ where: { bankId: base.id } });
          const updates = new Map(rows.map((r) => [r.questionId, r]));
          const merged = baseQs.map((q) => {
            const u = updates.get(q.questionId);
            return { data: u ? { ...toQuestionData(q), ...u, level: q.level } : toQuestionData(q), status: u ? 'PENDING' : q.validationStatus, notes: u ? '' : q.validationNotes, templateId: q.templateId };
          });
          await insertQuestions(copy.id, merged, tx);
          bankId = copy.id;
        } else {
          const bank = await createBank({ name: opts.name?.trim() || `Imported ${stamp} (${job.filename})`.slice(0, 120), source: 'IMPORTED', ownerId: job.targetStudentId, notes: `Imported from ${job.filename}` }, tx);
          await insertQuestions(bank.id, rows.map((data) => ({ data, status: 'PENDING', notes: '' })), tx);
          bankId = bank.id;
        }
        const finalReport = await validateBankById(bankId, tx);
        await tx.importJob.update({ where: { id: jobId }, data: { status: 'COMMITTED', resultBankId: bankId } });
        let activated = false;
        if (mode === 'REPLACE_ACTIVE' && opts.activate) {
          const { publishBank } = await import('./banks');
          await publishBank(bankId, { acknowledgeReview: !!opts.acknowledgeReview }, tx);
          await activateBank(bankId, tx);
          activated = true;
        }
        return { bankId, activated, report: finalReport };
      }, { isolationLevel: 'Serializable', timeout: 60000, maxWait: 10000 });
    } catch (error) {
      if (retry < 2 && error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code)) continue;
      throw error;
    }
  }
}

export { EDITABLE };
