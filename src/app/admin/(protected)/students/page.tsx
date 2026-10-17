import { prisma } from '@/lib/db';
import { getProgress } from '@/lib/services/progress';
import { formatDuration } from '@/lib/grading';
import { pct, MasteryBadge } from '@/components/ui';
import { ScoreLine } from '@/components/charts';
import { ClearProgress } from '@/components/admin/ClearProgress';
import { findUser } from '@/lib/services/users';
import { getLearningConfig } from '@/lib/services/core';
import { UserProfile, CreateUser } from '@/components/admin/UserProfile';
import { ImportExport } from '@/components/admin/ImportExport';
import { ProgressBackup } from '@/components/admin/ProgressBackup';

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ userId?: string }> }) {
  const users = await prisma.student.findMany({ select: { id: true, name: true, username: true, isActive: true, bankAssignment: { include: { bank: { select: { name: true } } } }, attempts: { orderBy: { startedAt: 'desc' }, take: 1, select: { startedAt: true } }, reviewSessions: { orderBy: { startedAt: 'desc' }, take: 1, select: { startedAt: true } } }, orderBy: { createdAt: 'asc' } });
  const selected = (await searchParams).userId ?? users[0]?.id;
  if (!selected) return <div><h1>User Profiles</h1><CreateUser /></div>;
  const student = await findUser(selected);
  const config = await getLearningConfig(prisma, student.id);
  const banks = await prisma.questionBank.findMany({ where: { OR: [{ ownerId: null }, { ownerId: student.id }] }, orderBy: { version: 'desc' } });
  const assigned = await prisma.studentBankAssignment.findUnique({ where: { studentId: student.id } });
  const bankOptions = banks.map((b) => ({ id: b.id, label: `v${b.version} — ${b.name} (${b.ownerId ? 'private' : 'shared'}, ${b.status})` }));
  const saved = await prisma.setting.findUnique({ where: { key: `progressBackup:${student.id}` } });
  const savedAt = saved ? (JSON.parse(saved.value) as { exportedAt: string }).exportedAt : null;
  const [p, attempts, sessions] = await Promise.all([
    getProgress(student.id),
    prisma.testAttempt.findMany({ where: { studentId: student.id, status: { not: 'IN_PROGRESS' } }, orderBy: { startedAt: 'desc' }, take: 25, include: { bank: { select: { version: true } } } }),
    prisma.reviewSession.findMany({ where: { studentId: student.id }, orderBy: { startedAt: 'desc' }, take: 10 }),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">User Profiles</h1>
      <CreateUser />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{users.map((u) => {
        const last = [u.attempts[0]?.startedAt, u.reviewSessions[0]?.startedAt].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0];
        // A full navigation discards the previous user's keyed client forms.
        return <a key={u.id} href={`/admin/students?userId=${encodeURIComponent(u.id)}`} className={`card p-4 ${u.id === student.id ? 'ring-2 ring-brand-500' : ''}`}><b>{u.name}</b><div>{u.username ?? 'No login yet'} · {u.isActive ? 'Active' : 'Disabled'}</div><div className="text-sm">{u.bankAssignment?.bank.name ?? 'Default bank'}</div><div className="text-xs text-slate-500">{last ? `Last study: ${last.toLocaleString()}` : 'No study activity yet'}</div></a>;
      })}</div>
      <UserProfile key={student.id} student={student} intervals={config.intervals} banks={banks.filter((b) => b.status === 'PUBLISHED').map((b) => ({ id: b.id, label: `v${b.version} — ${b.name} (${b.ownerId ? 'private' : 'shared'})` }))} assignedBankId={assigned?.bankId ?? ''} />
      <details className="card p-4"><summary className="cursor-pointer font-bold">Import / export question banks — {student.name}</summary><p className="my-3">Imports create a private bank for {student.name}. Publish it in Bank Versions to assign it only to this user.</p><ImportExport key={student.id} banks={bankOptions} drafts={bankOptions} targetStudentId={student.id} targetStudentName={student.name} /></details>
      <h2 id="progress" className="text-xl font-bold">Student progress – {student.name}</h2>
      <ProgressBackup key={student.id} savedAt={savedAt} studentId={student.id} studentName={student.name} />
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
      <ClearProgress key={student.id} studentName={student.name} studentId={student.id} />
    </div>
  );
}
