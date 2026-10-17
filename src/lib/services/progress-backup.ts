import { Prisma, type TestAttempt, type StudentAnswer, type ReviewSession, type ReviewQuestion, type SkillEvent, type SkillProgress } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../db';
import { AppError } from './attempts';
import { STUDENT_ID } from './core';
import { wipeXp } from './xp';

export const MAX_PROGRESS_BYTES = 4 * 1024 * 1024;
const backupKey = (studentId: string) => `progressBackup:${studentId}`;

// Validate every scalar, reject unknown fields, and hydrate dates before writing.
function rows<T>(modelName: string) {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === modelName)!;
  const shape: Record<string, z.ZodType> = {};
  for (const f of model.fields.filter((field) => field.kind === 'scalar')) {
    let field: z.ZodType = f.type === 'DateTime' ? z.iso.datetime().transform((s) => new Date(s))
      : f.type === 'Int' ? z.number().int() : f.type === 'Float' ? z.number().finite()
      : f.type === 'Boolean' ? z.boolean() : z.string().max(1_000_000);
    if (!f.isRequired) field = field.nullable();
    shape[f.name] = field;
  }
  return z.array(z.strictObject(shape)).max(100_000).transform((data) => data as unknown as T[]);
}

const schema = z.strictObject({
  format: z.literal('kenny-math-progress'), version: z.literal(1), exportedAt: z.iso.datetime(),
  student: z.strictObject({ id: z.string(), name: z.string() }),
  banks: z.array(z.strictObject({ id: z.string(), signature: z.string().length(64) })),
  attempts: rows<TestAttempt>('TestAttempt'), answers: rows<StudentAnswer>('StudentAnswer'),
  sessions: rows<ReviewSession>('ReviewSession'), reviewQuestions: rows<ReviewQuestion>('ReviewQuestion'),
  events: rows<SkillEvent>('SkillEvent'), skills: rows<SkillProgress>('SkillProgress'),
});
type Backup = z.infer<typeof schema>;
type Tx = Prisma.TransactionClient;

async function bankSignature(tx: Tx, bankId: string) {
  const [questions, tests] = await Promise.all([
    tx.question.findMany({ where: { bankId }, orderBy: { questionId: 'asc' } }),
    tx.test.findMany({ where: { bankId }, orderBy: { testNumber: 'asc' } }),
  ]);
  // Include IDs: attempts refer to these exact immutable questions.
  return createHash('sha256').update(JSON.stringify({ questions, tests })).digest('hex');
}

async function capture(tx: Tx, studentId: string) {
  const student = await tx.student.findUniqueOrThrow({ where: { id: studentId }, select: { id: true, name: true } });
  const [attempts, answers, sessions, reviewQuestions, events, skills] = await Promise.all([
    tx.testAttempt.findMany({ where: { studentId } }),
    tx.studentAnswer.findMany({ where: { attempt: { studentId } } }),
    tx.reviewSession.findMany({ where: { studentId } }),
    tx.reviewQuestion.findMany({ where: { session: { studentId } } }),
    tx.skillEvent.findMany({ where: { studentId } }),
    tx.skillProgress.findMany({ where: { studentId } }),
  ]);
  const sources = await tx.question.findMany({ where: { id: { in: sessions.flatMap((s) => s.sourceQuestionId ? [s.sourceQuestionId] : []) } }, select: { bankId: true } });
  const banks = await Promise.all([...new Set([...attempts.map((a) => a.bankId), ...sources.map((q) => q.bankId)])].map(async (id) => ({ id, signature: await bankSignature(tx, id) })));
  const result = { format: 'kenny-math-progress', version: 1, exportedAt: new Date().toISOString(), student, banks, attempts, answers, sessions, reviewQuestions, events, skills };
  if (Buffer.byteLength(JSON.stringify(result)) > MAX_PROGRESS_BYTES) throw new AppError('Progress backup exceeds the 4 MB limit.');
  return result;
}

export function progressSummary(b: Pick<Backup, 'exportedAt' | 'student' | 'attempts' | 'answers' | 'sessions' | 'skills'>) {
  return { exportedAt: b.exportedAt, studentName: b.student.name, attempts: b.attempts.length, answers: b.answers.length, reviewSessions: b.sessions.length, skills: b.skills.length };
}

export async function exportProgress(studentId = STUDENT_ID) {
  return prisma.$transaction((tx) => capture(tx, studentId), { isolationLevel: 'Serializable', timeout: 30000, maxWait: 10000 });
}

export async function saveProgress(studentId = STUDENT_ID) {
  return prisma.$transaction(async (tx) => {
    const backup = await capture(tx, studentId);
    await tx.setting.upsert({ where: { key: backupKey(studentId) }, create: { key: backupKey(studentId), value: JSON.stringify(backup) }, update: { value: JSON.stringify(backup) } });
    return progressSummary(backup);
  }, { isolationLevel: 'Serializable', timeout: 30000, maxWait: 10000 });
}

export async function savedProgress(studentId = STUDENT_ID) {
  const saved = await prisma.setting.findUnique({ where: { key: backupKey(studentId) } });
  return saved ? JSON.parse(saved.value) as unknown : null;
}

export function parseProgress(value: unknown): Backup {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError('Invalid progress backup. Use a JSON file exported by Kenny Math (version 1).');
  const b = parsed.data;
  const invalid = () => { throw new AppError('The backup contains inconsistent progress records.'); };
  for (const list of [b.attempts, b.answers, b.sessions, b.reviewQuestions, b.events, b.skills, b.banks]) {
    if (new Set(list.map((r) => r.id)).size !== list.length) invalid();
  }
  uniqueAcrossSessions(b);
  if ([...b.attempts, ...b.sessions, ...b.events, ...b.skills].some((r) => r.studentId !== b.student.id)) invalid();
  const attempts = new Map(b.attempts.map((a) => [a.id, a]));
  const sessions = new Set(b.sessions.map((s) => s.id));
  const orders = new Map<string, string[]>();
  const unique = (keys: string[]) => { if (new Set(keys).size !== keys.length) invalid(); };
  unique(b.answers.map((a) => `${a.attemptId}:${a.questionId}`));
  unique(b.reviewQuestions.map((q) => `${q.sessionId}:${q.position}`));
  unique(b.skills.map((s) => s.skillId));
  unique(b.attempts.filter((a) => a.status === 'IN_PROGRESS').map((a) => String(a.testNumber)));
  for (const a of b.attempts) {
    let order: unknown;
    try { order = JSON.parse(a.questionOrder); } catch { invalid(); }
    if (!Array.isArray(order) || order.length !== 30 || order.some((id) => typeof id !== 'string') || new Set(order).size !== order.length) invalid();
    orders.set(a.id, order as string[]);
    if (!b.banks.some((bank) => bank.id === a.bankId) || !['IN_PROGRESS', 'SUBMITTED', 'TIMED_OUT'].includes(a.status) || a.testNumber < 1 || a.testNumber > 30 || a.expiresAt < a.startedAt || (a.status === 'IN_PROGRESS' ? a.submittedAt !== null : a.submittedAt === null)) invalid();
    for (const n of [a.score, a.correctCount, a.incorrectCount, a.unansweredCount]) if (n !== null && (n < 0 || n > 30)) invalid();
  }
  for (const a of b.answers) if (!attempts.has(a.attemptId) || !orders.get(a.attemptId)?.includes(a.questionId) || (a.selectedAnswer !== null && !['A', 'B', 'C', 'D'].includes(a.selectedAnswer))) invalid();
  for (const q of b.reviewQuestions) {
    if (!sessions.has(q.sessionId) || q.position < 1 || !['A', 'B', 'C', 'D'].includes(q.correctAnswer) || (q.selectedAnswer !== null && !['A', 'B', 'C', 'D'].includes(q.selectedAnswer))) invalid();
    try { JSON.parse(q.generatedQuestionData); } catch { invalid(); }
  }
  for (const s of b.sessions) if (!['SMART', 'SIMILAR'].includes(s.kind) || s.total < 0 || (s.score !== null && (s.score < 0 || s.score > s.total))) invalid();
  for (const e of b.events) if (!['TEST', 'REVIEW'].includes(e.source) || !(e.source === 'TEST' ? attempts.has(e.sessionKey) : sessions.has(e.sessionKey))) invalid();
  for (const s of b.skills) if (s.totalCorrect < 0 || s.totalAttempts < s.totalCorrect || [s.recentCount, s.sessionCount, s.streakSessions].some((n) => n < 0) || [s.recentAccuracy, s.previousAccuracy].some((n) => n !== null && (n < 0 || n > 1))) invalid();
  return b;
}

function uniqueAcrossSessions(b: Backup) {
  const ids = [...b.attempts, ...b.sessions].map((r) => r.id);
  if (new Set(ids).size !== ids.length) throw new AppError('Duplicate session IDs in backup.');
}

async function batches<T>(data: T[], write: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < data.length; i += 100) await write(data.slice(i, i + 100));
}

export async function importProgress(value: unknown, confirmation: unknown, studentId = STUDENT_ID) {
  if (confirmation !== 'RESTORE') throw new AppError('Type RESTORE to replace current progress.');
  const b = parseProgress(value);
  if (b.student.id !== studentId) throw new AppError('This backup belongs to another user. Select the matching user before restoring.', 409);
  return prisma.$transaction(async (tx) => {
    for (const bank of b.banks) {
      const allowed = await tx.questionBank.findUnique({ where: { id: bank.id } });
      if (!allowed || (allowed.ownerId && allowed.ownerId !== studentId)) throw new AppError('A backup bank belongs to another user.', 403);
      if (await bankSignature(tx, bank.id) !== bank.signature) throw new AppError('A question bank is missing or has changed. Restore into the same question banks as the export.');
    }
    for (const a of b.attempts) {
      const questions = await tx.question.findMany({ where: { id: { in: JSON.parse(a.questionOrder) }, bankId: a.bankId, testNumber: a.testNumber }, select: { id: true } });
      if (questions.length !== 30) throw new AppError('The backup refers to missing or mismatched questions.');
    }
    const sourceIds = [...new Set(b.sessions.flatMap((s) => s.sourceQuestionId ? [s.sourceQuestionId] : []))];
    if (await tx.question.count({ where: { id: { in: sourceIds }, bankId: { in: b.banks.map((bank) => bank.id) } } }) !== sourceIds.length) throw new AppError('The backup refers to missing practice source questions.');
    // Preserve a rollback copy in the same transaction before replacing anything.
    const previous = await capture(tx, studentId);
    await tx.setting.upsert({ where: { key: backupKey(studentId) }, create: { key: backupKey(studentId), value: JSON.stringify(previous) }, update: { value: JSON.stringify(previous) } });
    await tx.testAttempt.deleteMany({ where: { studentId } });
    await tx.reviewSession.deleteMany({ where: { studentId } });
    await tx.skillEvent.deleteMany({ where: { studentId } });
    await tx.skillProgress.deleteMany({ where: { studentId } });
    await wipeXp(tx, studentId); // XP is rebuilt from the restored history on the next visit
    const ids = new Map([...b.attempts, ...b.sessions].map((r) => [r.id, randomUUID()]));
    await batches(b.attempts.map((a) => ({ ...a, id: ids.get(a.id)!, studentId, inProgressKey: a.status === 'IN_PROGRESS' ? `${studentId}:${a.testNumber}` : null })), (data) => tx.testAttempt.createMany({ data }));
    await batches(b.answers.map((a) => ({ ...a, id: randomUUID(), attemptId: ids.get(a.attemptId)! })), (data) => tx.studentAnswer.createMany({ data }));
    await batches(b.sessions.map((s) => ({ ...s, id: ids.get(s.id)!, studentId })), (data) => tx.reviewSession.createMany({ data }));
    await batches(b.reviewQuestions.map((q) => ({ ...q, id: randomUUID(), sessionId: ids.get(q.sessionId)! })), (data) => tx.reviewQuestion.createMany({ data }));
    await batches(b.events.map((e) => ({ ...e, id: randomUUID(), studentId, sessionKey: ids.get(e.sessionKey)! })), (data) => tx.skillEvent.createMany({ data }));
    await batches(b.skills.map((s) => ({ ...s, id: randomUUID(), studentId })), (data) => tx.skillProgress.createMany({ data }));
    return progressSummary(b);
  }, { isolationLevel: 'Serializable', timeout: 60000, maxWait: 10000 });
}
