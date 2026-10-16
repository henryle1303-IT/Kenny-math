import { randomBytes } from 'node:crypto';
import { prisma } from '../src/lib/db';
import { hashPassword } from '../src/lib/services/admin-auth';
import { createBank, generateTests, publishBank, validateBankById } from '../src/lib/services/banks';
import { DEFAULT_BANK_SEED } from '../src/lib/gen/bank';

async function main() {
  await prisma.student.upsert({ where: { id: 'kenny' }, update: {}, create: { id: 'kenny', name: 'Kenny' } });

  const email = (process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
  if ((await prisma.adminUser.count()) === 0) {
    const pw = process.env.ADMIN_PASSWORD || randomBytes(9).toString('base64url');
    await prisma.adminUser.create({ data: { email, passwordHash: await hashPassword(pw) } });
    console.log(`Admin account created: ${email}`);
    if (!process.env.ADMIN_PASSWORD) console.log(`Generated admin password (shown once, change it in Settings): ${pw}`);
  }

  if ((await prisma.questionBank.count()) === 0) {
    console.log('Generating the first question bank (900 questions)...');
    const bank = await createBank({ name: 'Original Questions', source: 'GENERATED', seed: DEFAULT_BANK_SEED });
    for (let t = 1; t <= 30; t += 5) await generateTests(bank.id, { tests: [t, t + 1, t + 2, t + 3, t + 4] });
    const report = await validateBankById(bank.id);
    console.log(`Validation: ${report.validRows}/${report.totalRows} valid, ${report.verifiedRows} verified automatically, ${report.reviewRows + report.warningRows} need review.`);
    if (report.ok) {
      await publishBank(bank.id, { acknowledgeReview: true });
      console.log('Bank published and activated.');
    } else {
      console.log('Bank left as draft because validation failed.');
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
