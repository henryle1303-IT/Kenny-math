import { prisma } from '../src/lib/db';
import { seedDemo } from '../src/lib/services/demo';
import { DEMO_PASSWORD, DEMO_USERNAME } from '../src/lib/demo/demo-bank';

async function main() {
  const r = await seedDemo();
  console.log(`Demo ready: ${r.questions} questions in bank ${r.bankId} (${r.created ? 'created' : 'refreshed'}).`);
  console.log(`Student login: username "${DEMO_USERNAME}", password "${DEMO_PASSWORD}". The password is weak on purpose: remove this user before real use.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
