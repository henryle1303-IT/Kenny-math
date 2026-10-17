import Link from 'next/link';
import { prisma } from '@/lib/db';

export default async function AdminDashboard() {
  const [active, banks, attempts, sessions, logs] = await Promise.all([
    prisma.questionBank.findFirst({ where: { isActive: true } }),
    prisma.questionBank.groupBy({ by: ['status'], _count: true }),
    prisma.testAttempt.count({ where: { status: { not: 'IN_PROGRESS' } } }),
    prisma.reviewSession.count({ where: { kind: 'SMART' } }),
    prisma.adminAuditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 12 }),
  ]);
  const report = active?.validationJson ? JSON.parse(active.validationJson) : null;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Dashboard</h1>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card p-4"><div className="text-sm text-slate-500">Active bank</div><div className="text-lg font-bold">{active ? `v${active.version} – ${active.name}` : 'None'}</div></div>
        <div className="card p-4"><div className="text-sm text-slate-500">Banks</div><div className="text-lg font-bold">{banks.map((b) => `${b._count} ${b.status.toLowerCase()}`).join(', ') || '0'}</div></div>
        <div className="card p-4"><div className="text-sm text-slate-500">Test attempts</div><div className="text-2xl font-bold">{attempts}</div></div>
        <div className="card p-4"><div className="text-sm text-slate-500">Smart Review sessions</div><div className="text-2xl font-bold">{sessions}</div></div>
      </div>
      {report && (
        <div className="card p-4">
          <h2 className="mb-1 font-bold">Last validation of the active bank</h2>
          <p className="text-sm text-slate-600">{report.validRows}/{report.totalRows} valid · {report.verifiedRows} verified automatically · {report.reviewRows + report.warningRows} flagged for review</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Link className="btn-primary" href="/admin/generator">Generate questions</Link>
        <Link className="btn-secondary" href="/admin/import">Import / Export</Link>
        <Link className="btn-secondary" href="/admin/banks">Bank versions</Link>
      </div>
      <section className="card p-4">
        <h2 className="mb-2 font-bold">Recent admin activity</h2>
        <ul className="divide-y text-sm">
          {logs.map((l) => (
            <li key={l.id} className="flex flex-wrap justify-between gap-x-2 py-1.5"><span className="font-mono">{l.operation}</span><span className="truncate text-slate-500">{l.details.slice(0, 80)}</span><time className="shrink-0 text-slate-400">{l.timestamp.toLocaleString()}</time></li>
          ))}
          {logs.length === 0 && <li className="py-2 text-slate-500">No activity yet.</li>}
        </ul>
      </section>
    </div>
  );
}
