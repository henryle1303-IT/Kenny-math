import { getProgress } from '@/lib/services/progress';
import { MasteryBars, PercentBars, ScoreLine, TrendLine } from '@/components/charts';
import { MasteryBadge, pct } from '@/components/ui';
import { MASTERY_LABELS } from '@/lib/learning/mastery';

export default async function ProgressPage() {
  const p = await getProgress();
  const colors: Record<string, string> = { NOT_ENOUGH_DATA: '#cbd5e1', NEEDS_PRACTICE: '#f43f5e', DEVELOPING: '#f59e0b', IMPROVING: '#38bdf8', MASTERED: '#10b981' };
  const mastery = Object.entries(MASTERY_LABELS).map(([k, v]) => ({ name: v, value: p.masteryCounts[k] ?? 0, fill: colors[k] }));
  const stats: [string, string | number][] = [
    ['Official tests completed', p.testsCompleted],
    ['Smart Review sessions', p.smartSessions],
    ['Questions attempted', p.questionsAttempted],
    ['Average test score', p.averageScore === null ? '–' : `${p.averageScore}/30`],
    ['Best score', p.bestScore === null ? '–' : `${p.bestScore}/30`],
    ['Practice time', `${p.practiceMinutes} min`],
  ];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold text-brand-800">My Learning Progress</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map(([l, v]) => (
          <div key={l} className="card p-4">
            <div className="text-2xl font-extrabold text-brand-700" data-testid={`stat-${l}`}>{v}</div>
            <div className="text-sm text-slate-500">{l}</div>
          </div>
        ))}
      </div>
      <section className="card p-4">
        <h2 className="mb-2 text-lg font-bold">Test scores over time</h2>
        <ScoreLine data={p.recent.map((r) => ({ label: `${r.label}`, score: r.score }))} />
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-2 text-lg font-bold">Performance by topic</h2>
          <PercentBars data={p.topics.map((t) => ({ name: t.topic, value: t.accuracy }))} />
        </section>
        <section className="card p-4">
          <h2 className="mb-2 text-lg font-bold">Smart Review improvement</h2>
          <TrendLine data={p.reviewTrend} />
        </section>
      </div>
      <section className="card p-4">
        <h2 className="mb-2 text-lg font-bold">Skill mastery</h2>
        <MasteryBars data={mastery} />
        {p.skills.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b text-slate-500"><th className="py-2">Skill</th><th>Topic</th><th>Recent accuracy</th><th>Status</th></tr></thead>
              <tbody>
                {p.skills.slice().sort((a, b) => (a.accuracy ?? 2) - (b.accuracy ?? 2)).map((s) => (
                  <tr key={s.skillId} className="border-b last:border-0">
                    <td className="py-2 font-medium">{s.label}</td><td>{s.topic}</td><td>{pct(s.accuracy)}</td>
                    <td><MasteryBadge status={s.mastery} label={s.masteryLabel} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-2 text-lg font-bold">Strengths 💪</h2>
          {p.strongest.length ? <ul className="space-y-1">{p.strongest.map((s) => <li key={s.skillId}>{s.label} – <b>{pct(s.accuracy)}</b></li>)}</ul> : <p className="text-slate-500">Keep practising to discover your strengths.</p>}
        </section>
        <section className="card p-4">
          <h2 className="mb-2 text-lg font-bold">Keep practising 🌱</h2>
          {p.weakest.length ? <ul className="space-y-1">{p.weakest.map((s) => <li key={s.skillId}>{s.label} – <b>{pct(s.accuracy)}</b></li>)}</ul> : <p className="text-slate-500">No weak skills right now – great!</p>}
        </section>
      </div>
    </div>
  );
}
