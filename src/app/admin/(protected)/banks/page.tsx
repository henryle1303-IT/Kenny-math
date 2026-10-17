import { listBanks } from '@/lib/services/banks';
import { BankActions } from '@/components/admin/BankActions';

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  VALIDATING: 'bg-amber-100 text-amber-700',
  READY_FOR_REVIEW: 'bg-sky-100 text-sky-700',
  PUBLISHED: 'bg-emerald-100 text-emerald-700',
  ARCHIVED: 'bg-zinc-200 text-zinc-600',
};

export default async function BanksPage() {
  const banks = await listBanks();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Bank versions</h1>
      <p className="text-slate-600">Published banks are never changed. To edit one, create a draft copy. One shared bank is the default. Each user can have a separate assigned bank in User Profiles. Publishing a private bank assigns it only to its owner; all historical results are kept.</p>
      {banks.map((b) => {
        const v = b.validationJson ? JSON.parse(b.validationJson) : null;
        return (
          <div key={b.id} className={`card space-y-2 p-4 ${b.isActive ? 'ring-2 ring-emerald-400' : ''}`} data-testid={`bank-${b.version}`}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold">Bank {b.version} – {b.name}</h2>
              <span className={`badge ${STATUS_STYLE[b.status]}`}>{b.status.replace(/_/g, ' ')}</span>
              {b.ownerId && <span className="badge bg-violet-100 text-violet-800">Private · {b.owner?.name ?? b.ownerId}</span>}
              {b.assignments.map((a) => <span key={a.studentId} className="badge bg-sky-100 text-sky-800">Assigned: {a.student.name}</span>)}
              {b.isActive && <span className="badge bg-emerald-600 text-white">ACTIVE</span>}
            </div>
            <div className="grid gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-4">
              <span>ID: <code className="text-xs">{b.id}</code></span>
              <span>Source: {b.source.toLowerCase()}</span>
              <span>Questions: {b._count.questions}</span>
              <span>Created: {b.createdAt.toLocaleDateString()}</span>
              <span>Published: {b.publishedAt ? b.publishedAt.toLocaleDateString() : '–'}</span>
              <span>Student attempts: {b._count.attempts}</span>
              <span className="sm:col-span-2">Validation: {v ? `${v.validRows}/${v.totalRows} valid, ${v.verifiedRows} verified, ${v.reviewRows + v.warningRows} to review${v.ok ? '' : ' – has errors'}` : 'not run yet'}</span>
            </div>
            {b.notes && <p className="text-sm text-slate-500">{b.notes}</p>}
            <BankActions id={b.id} name={b.name} status={b.status} isActive={b.isActive} everPublished={!!b.publishedAt} hasAttempts={b._count.attempts > 0} />
          </div>
        );
      })}
    </div>
  );
}
