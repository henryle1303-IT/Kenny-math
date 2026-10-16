import { prisma } from '@/lib/db';
import { ImportExport } from '@/components/admin/ImportExport';

export default async function ImportPage() {
  const banks = await prisma.questionBank.findMany({ orderBy: { version: 'desc' } });
  const opt = (b: (typeof banks)[number]) => ({ id: b.id, label: `Bank ${b.version} – ${b.name} (${b.status.toLowerCase().replace(/_/g, ' ')}${b.isActive ? ', active' : ''})` });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Import / Export</h1>
      <ImportExport banks={banks.map(opt)} drafts={banks.filter((b) => b.status === 'DRAFT' || b.status === 'READY_FOR_REVIEW').map(opt)} />
    </div>
  );
}
