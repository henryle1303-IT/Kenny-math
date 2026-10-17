import { prisma } from '@/lib/db';
import { createBank, generateTests, publishBank, validateBankById } from '@/lib/services/banks';
import { hashPassword } from '@/lib/services/admin-auth';

export async function ensureStudent() {
  await prisma.student.upsert({ where: { id: 'kenny' }, update: {}, create: { id: 'kenny', name: 'Kenny' } });
}

export async function ensureActiveBank() {
  await ensureStudent();
  const active = await prisma.questionBank.findFirst({ where: { isActive: true } });
  if (active) return active;
  const bank = await createBank({ name: 'Test Bank', source: 'GENERATED', seed: 'integration-seed' });
  for (let t = 1; t <= 30; t += 6) await generateTests(bank.id, { tests: [t, t + 1, t + 2, t + 3, t + 4, t + 5] });
  const rep = await validateBankById(bank.id);
  if (!rep.ok) throw new Error('bank invalid: ' + JSON.stringify(rep.bankErrors));
  await publishBank(bank.id, { acknowledgeReview: true });
  return (await prisma.questionBank.findUnique({ where: { id: bank.id } }))!;
}

export async function ensureAdmin(email = 'admin@test.local', password = 'correct-horse-battery') {
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) return { email, password };
  await prisma.adminUser.create({ data: { email, passwordHash: await hashPassword(password) } });
  return { email, password };
}

/** Answer every question of an attempt: first `n` correctly, the rest wrongly. */
export async function answerAttempt(attemptId: string, correctCount: number, totalToAnswer = 30) {
  const { saveAnswer } = await import('@/lib/services/attempts');
  const a = await prisma.testAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  const order: string[] = JSON.parse(a.questionOrder);
  const qs = await prisma.question.findMany({ where: { id: { in: order } } });
  const byId = new Map(qs.map((q) => [q.id, q]));
  for (let i = 0; i < Math.min(order.length, totalToAnswer); i++) {
    const q = byId.get(order[i])!;
    const right = q.correctAnswer;
    const wrong = right === 'A' ? 'B' : 'A';
    await saveAnswer(attemptId, q.id, i < correctCount ? right : wrong, a.studentId);
  }
}
