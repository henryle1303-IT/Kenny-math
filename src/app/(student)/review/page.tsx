import Link from 'next/link';
import { getProgress } from '@/lib/services/progress';
import { PracticeButton } from '@/components/PracticeButton';
import { MasteryBadge, pct, ProgressBar } from '@/components/ui';
import { prisma } from '@/lib/db';
import { STUDENT_ID } from '@/lib/services/core';
import { PercentBars, TrendLine } from '@/components/charts';

export default async function ReviewHome() {
  const [p, sessions] = await Promise.all([
    getProgress(),
    prisma.reviewSession.findMany({ where: { studentId: STUDENT_ID, kind: 'SMART' }, orderBy: { startedAt: 'desc' }, take: 8 }),
  ]);
  const noData = p.skills.length === 0;
  const improvedMsg = p.improved[0];
  return (
    <div className="space-y-6">
      <div className="card bg-gradient-to-br from-violet-600 to-brand-700 p-6 text-white">
        <h1 className="text-3xl font-extrabold">Kenny Smart Review</h1>
        <p className="mt-2 max-w-xl text-lg opacity-95">
          {noData ? 'Take a maths test first and I will find the skills to practise. You can also try a warm-up mix now!' : 'Ten fresh questions, chosen from the things you find tricky. No timer – take your time and learn!'}
        </p>
        <div className="mt-4"><PracticeButton label={noData ? 'Start a warm-up' : 'Practice My Mistakes'} /></div>
      </div>

      {improvedMsg && (
        <div className="card border-l-4 border-emerald-500 p-4 text-lg" data-testid="improved-message">
          🎉 Great job, Kenny! Your <b>{improvedMsg.label}</b> accuracy improved from <b>{pct(improvedMsg.previousAccuracy)}</b> to <b>{pct(improvedMsg.accuracy)}</b>. Keep practising!
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-2 text-lg font-bold">Ready for Review</h2>
          {p.readyForReview.length === 0 ? <p className="text-slate-500">Nothing is due right now. 👍</p> : (
            <ul className="space-y-2">
              {p.readyForReview.map((s) => (
                <li key={s.skillId} className="flex items-center justify-between gap-2">
                  <span>{s.label}</span>
                  <MasteryBadge status={s.mastery} label={s.masteryLabel} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-4">
          <h2 className="mb-2 text-lg font-bold">Skills to practise</h2>
          {p.weakest.length === 0 ? <p className="text-slate-500">No weak skills found yet.</p> : (
            <ul className="space-y-3">
              {p.weakest.map((s) => (
                <li key={s.skillId}>
                  <div className="mb-1 flex justify-between text-sm"><span>{s.label}</span><span>{pct(s.accuracy)}</span></div>
                  <ProgressBar value={(s.accuracy ?? 0) * 100} color="bg-rose-400" />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-4">
          <h2 className="mb-2 text-lg font-bold">Strongest skills</h2>
          {p.strongest.length === 0 ? <p className="text-slate-500">Complete more questions to find your strengths.</p> : (
            <ul className="space-y-2">{p.strongest.map((s) => <li key={s.skillId} className="flex justify-between"><span>{s.label}</span><b>{pct(s.accuracy)}</b></li>)}</ul>
          )}
        </section>
        <section className="card p-4">
          <h2 className="mb-2 text-lg font-bold">Review summary</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-slate-500">Sessions completed</dt><dd className="font-bold">{p.smartSessions}</dd>
            <dt className="text-slate-500">Questions practised</dt><dd className="font-bold">{p.reviewQuestionsDone}</dd>
            <dt className="text-slate-500">Review accuracy</dt><dd className="font-bold">{p.reviewAccuracy === null ? '–' : `${p.reviewAccuracy}%`}</dd>
            <dt className="text-slate-500">Skills mastered</dt><dd className="font-bold">{p.masteryCounts.MASTERED ?? 0}</dd>
          </dl>
        </section>
      </div>
      <section className="card p-4">
        <h2 className="mb-2 text-lg font-bold">Improvement over time</h2>
        <TrendLine data={p.reviewTrend} />
      </section>
      <section className="card p-4">
        <h2 className="mb-2 text-lg font-bold">Accuracy by topic</h2>
        <PercentBars data={p.topics.map((t) => ({ name: t.topic, value: t.accuracy }))} />
      </section>
      {sessions.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 text-lg font-bold">Recent sessions</h2>
          <ul className="divide-y text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <span>{s.startedAt.toLocaleString()}</span>
                {s.completedAt ? <span className="font-semibold">{s.score}/{s.total}</span> : <Link className="font-semibold text-brand-700 underline" href={`/review/${s.id}`}>Continue</Link>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
