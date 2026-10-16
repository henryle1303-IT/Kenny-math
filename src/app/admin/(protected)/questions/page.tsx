import { prisma } from '@/lib/db';
import { QuestionManager } from '@/components/admin/QuestionManager';
import { TOPICS } from '@/lib/gen/types';

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ bank?: string }> }) {
  const { bank } = await searchParams;
  const banks = await prisma.questionBank.findMany({ orderBy: { version: 'desc' } });
  const initial = banks.find((b) => b.id === bank) ?? banks.find((b) => b.isActive) ?? banks[0];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Question Manager</h1>
      {initial ? (
        <QuestionManager
          banks={banks.map((b) => ({ id: b.id, label: `Bank ${b.version} – ${b.name} (${b.status.toLowerCase().replace(/_/g, ' ')}${b.isActive ? ', active' : ''})`, editable: b.status === 'DRAFT' || b.status === 'READY_FOR_REVIEW' }))}
          topics={[...TOPICS]}
          initialBank={initial.id}
        />
      ) : (
        <p>No banks yet. Use the Question Generator to create one.</p>
      )}
    </div>
  );
}
