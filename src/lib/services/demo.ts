import { prisma } from '../db';
import { AppError } from './attempts';
import { hashPassword } from './admin-auth';
import { createBank } from './banks';
import { getLearningConfig } from './core';
import { validateQuestion } from '../validate/question';
import { DEMO_BANK_NAME, DEMO_PASSWORD, DEMO_TESTS, DEMO_USERNAME, demoQuestions } from '../demo/demo-bank';

/**
 * Create (or refresh) the demo user and the demo bank with one question of every type.
 * Idempotent. Never overwrites a changed demo password. Run by hand only: the password is deliberately weak.
 */
export async function seedDemo() {
  const questions = demoQuestions();
  const checked = questions.map((q) => ({ q, v: validateQuestion(q) }));
  const bad = checked.filter((c) => c.v.status === 'INVALID');
  if (bad.length) throw new AppError(`Demo bank has invalid questions: ${bad.map((b) => `${b.q.questionId}: ${b.v.issues.map((i) => i.message).join('; ')}`).join(' | ')}`, 500);

  const config = JSON.stringify(await getLearningConfig());
  const existing = await prisma.student.findUnique({ where: { username: DEMO_USERNAME } });
  const student = existing
    ? await prisma.student.update({ where: { id: existing.id }, data: existing.passwordHash ? {} : { passwordHash: await hashPassword(DEMO_PASSWORD) } })
    : await prisma.student.create({ data: { id: DEMO_USERNAME, username: DEMO_USERNAME, name: 'Demo', passwordHash: await hashPassword(DEMO_PASSWORD), preferences: JSON.stringify({ lang: 'vi' }), learningConfig: config } });

  let bank = await prisma.questionBank.findFirst({ where: { name: DEMO_BANK_NAME, ownerId: student.id } });
  const created = !bank;
  if (!bank) {
    bank = await createBank({ name: DEMO_BANK_NAME, source: 'MANUAL', ownerId: student.id, notes: 'Hand-written demo bank with every question type. Not a complete bank.' });
    await prisma.test.deleteMany({ where: { bankId: bank.id, testNumber: { notIn: [...DEMO_TESTS] } } });
  }
  const bankId = bank.id;
  for (const { q, v } of checked) {
    const data = {
      testNumber: q.testNumber, position: q.position, level: q.level, difficulty: q.difficulty, topic: q.topic, skill: q.skill, questionText: q.questionText,
      optionA: q.options[0], optionB: q.options[1], optionC: q.options[2], optionD: q.options[3], correctAnswer: q.correctAnswer, explanation: q.explanation,
      commonMistake: q.commonMistake, learningTip: q.learningTip, verifyExpr: q.verifyExpr ?? null, questionType: q.questionType ?? 'MCQ', answerData: q.answerData ?? null,
      validationStatus: v.status === 'NEEDS_REVIEW' ? 'MANUAL_OK' : v.status, validationNotes: '',
    };
    await prisma.question.upsert({ where: { bankId_questionId: { bankId, questionId: q.questionId } }, create: { questionId: q.questionId, bankId, ...data }, update: data });
  }
  await prisma.questionBank.update({ where: { id: bankId }, data: { status: 'PUBLISHED', isActive: false, publishedAt: bank.publishedAt ?? new Date(), activatedAt: bank.activatedAt ?? new Date() } });
  await prisma.studentBankAssignment.upsert({ where: { studentId: student.id }, create: { studentId: student.id, bankId }, update: { bankId } });
  return { studentId: student.id, bankId, created, questions: questions.length };
}
