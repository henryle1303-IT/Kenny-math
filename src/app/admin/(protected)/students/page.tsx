import { prisma } from '@/lib/db';
import { getProgress } from '@/lib/services/progress';
import { formatDuration } from '@/lib/grading';
import { pct, MasteryBadge } from '@/components/ui';
import { ScoreLine } from '@/components/charts';

export default async function StudentsPage() {
  const [p, attempts, sessions] = await Promise.all([
    getProgress(),
    prisma.testAttempt.findMany({ where: { status: { not: 'IN_PROGRESS' } }, orderBy: { startedAt: 'desc' }, take: 25, include: { bank: { select: { version: true } } } }),
    prisma.reviewSession.findMany({ orderBy: { startedAt: 'desc' }, take: 10 }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Student progress – Kenny</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([['Tests completed', `${p.testsCompleted}/30`], ['Attempts', p.attemptsCount], ['Average', p.averageScore ?? '–'], ['Smart Review sessions', p.smartSessions]] as [string, string | number][]).map(([k, v]) => (
          <div key={k} className="card p-4"><div className="text-2xl font-bold">{v}</div><div className="text-sm text-slate-500">{k}</div></div>
        ))}
      </div>
      <section className="card p-4"><h2 className="mb-2 font-bold">Scores</h2><ScoreLine data={p.recent.map((r) => ({ label: r.label, score: r.score }))} /></section>
      <section className="card overflow-x-auto p-4">
        <h2 className="mb-2 font-bold">Recent test attempts</h2>
        <table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-1">Date</th><th>Test</th><th>Bank</th><th>Score</th><th>Time</th><th>Status</th></tr></thead>
          <tbody>{attempts.map((a) => <tr key={a.id} className="border-b"><td className="py-1">{a.startedAt.toLocaleString()}</td><td>{a.testNumber}</td><td>v{a.bank.version}</td><td>{a.score}/30</td><td>{formatDuration(a.timeUsedSec ?? 0)}</td><td>{a.status.toLowerCase().replace('_', ' ')}</td></tr>)}</tbody></table>
      </section>
      <section className="card overflow-x-auto p-4">
        <h2 className="mb-2 font-bold">Skills</h2>
        <table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="py-1">Skill</th><th>Topic</th><th>Accuracy</th><th>Attempts</th><th>Status</th></tr></thead>
          <tbody>{p.skills.map((s) => <tr key={s.skillId} className="border-b"><td className="py-1">{s.label}</td><td>{s.topic}</td><td>{pct(s.accuracy)}</td><td>{s.attempts}</td><td><MasteryBadge status={s.mastery} label={s.masteryLabel} /></td></tr>)}</tbody></table>
      </section>
      <section className="card p-4"><h2 className="mb-2 font-bold">Recent Smart Review sessions</h2>
        <ul className="text-sm">{sessions.map((s) => <li key={s.id} className="flex justify-between border-b py-1"><span>{s.startedAt.toLocaleString()} ({s.kind.toLowerCase()})</span><span>{s.completedAt ? `${s.score}/${s.total}` : 'unfinished'}</span></li>)}</ul>
      </section>
    </div>
  );
}
