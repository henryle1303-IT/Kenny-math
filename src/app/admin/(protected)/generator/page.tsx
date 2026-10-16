import { prisma } from '@/lib/db';
import { Generator } from '@/components/admin/Generator';
import { TOPICS } from '@/lib/gen/types';
import { TEMPLATES } from '@/lib/gen/registry';

export default async function GeneratorPage() {
  const drafts = await prisma.questionBank.findMany({ where: { status: { in: ['DRAFT', 'READY_FOR_REVIEW'] } }, orderBy: { version: 'desc' } });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Question Generator</h1>
      <p className="text-slate-600">
        Questions come from {TEMPLATES.length} validated Grade 5 templates. Every answer is calculated by code and then re-checked by an independent evaluator; duplicate questions are rejected.
      </p>
      <Generator drafts={drafts.map((d) => ({ id: d.id, label: `Bank ${d.version} – ${d.name} (${d.status.toLowerCase()})` }))} topics={[...TOPICS]} />
    </div>
  );
}
