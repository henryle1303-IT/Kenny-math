// Gives every student XP for the work already in their history.
//   npm run xp:backfill            dry run: shows what each student's history is worth
//   npm run xp:backfill -- --apply create the XP profiles (skips students who already have one)
import { prisma } from '../src/lib/db';
import { backfillXp, previewBackfill } from '../src/lib/services/xp';

async function main() {
  const apply = process.argv.includes('--apply');
  const students = await prisma.student.findMany({ select: { id: true, name: true, xp: { select: { studentId: true } } }, orderBy: { createdAt: 'asc' } });
  for (const s of students) {
    if (s.xp) { console.log(`${s.name}: already has XP, skipped`); continue; }
    const plan = await previewBackfill(s.id);
    console.log(`${s.name}: ${plan.totalXp} XP (level ${plan.level}) from ${plan.attempts} tests and ${plan.reviewSessions} Smart Review sessions; best streak ${plan.bestStreak}`);
    if (apply) await prisma.$transaction((tx) => backfillXp(tx, s.id), { timeout: 60000, maxWait: 10000 });
  }
  console.log(apply ? 'Done.' : 'Dry run only. Add --apply to save.');
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); }).finally(() => prisma.$disconnect());
