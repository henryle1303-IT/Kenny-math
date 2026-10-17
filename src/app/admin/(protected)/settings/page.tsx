import { Settings } from '@/components/admin/Settings';
import { getLearningConfig } from '@/lib/services/core';
import { prisma } from '@/lib/db';

export default async function SettingsPage() {
  const [cfg, logs] = await Promise.all([getLearningConfig(), prisma.adminAuditLog.findMany({ orderBy: { timestamp: 'desc' }, take: 30 })]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Settings</h1>
      <Settings intervals={cfg.intervals} />
      <section className="card p-4">
        <h2 className="mb-2 font-bold">Activity log</h2>
        <ul className="divide-y text-sm">{logs.map((l) => <li key={l.id} className="flex flex-wrap justify-between gap-x-2 py-1"><span className="font-mono">{l.operation}</span><span className="truncate text-slate-500">{l.details.slice(0, 70)}</span><time className="shrink-0 text-slate-400">{l.timestamp.toLocaleString()}</time></li>)}</ul>
      </section>
    </div>
  );
}
