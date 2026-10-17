import { getStudent } from '@/lib/services/core';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Award, CheckCircle2, CircleHelp, Clock, TrendingUp, XCircle } from 'lucide-react';
import { AppError, getAttemptResult } from '@/lib/services/attempts';
import { formatDuration, starsFor } from '@/lib/grading';
import { PercentBars, ScoreLine } from '@/components/charts';
import { ProgressBar, Stars } from '@/components/ui';
import { PracticeButton } from '@/components/PracticeButton';
import { StartTestButton } from '@/components/StartTestButton';
import { getLang } from '@/lib/services/core';
import { attemptXp } from '@/lib/services/xp';
import { XpResult } from '@/components/xp/XpResult';

function feedback(pct: number, improvement: number | null, pb: boolean, name: string): string {
  if (pb) return `New personal best! Amazing work, ${name}! 🎉`;
  if (improvement !== null && improvement > 0) return `You improved by ${improvement} point${improvement === 1 ? '' : 's'} since last time. Keep it up! 🚀`;
  if (pct >= 90) return `Fantastic, ${name}! You are a maths star! ⭐`;
  if (pct >= 75) return `Great job, ${name}! You really understand this. 👏`;
  if (pct >= 50) return `Good effort, ${name}! Look at the explanations and try Smart Review to get even better. 💪`;
  return 'Every mistake is a chance to learn. Read the explanations, then practise – you can do it! 🌱';
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const student = await getStudent();
  const { id } = await params;
  let r;
  try {
    r = await getAttemptResult(id, student.id);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    if (e instanceof AppError && e.code === 'IN_PROGRESS') return <div className="card p-6">This test is still in progress. <Link className="underline" href={`/attempt/${id}`}>Go back to the test</Link></div>;
    throw e;
  }
  const { attempt, grade } = r;
  const [lang, xpResult] = await Promise.all([getLang(), attemptXp(student.id, id).catch(() => null)]);
  const pctScore = grade.percentage;
  return (
    <div className="space-y-6">
      <div className="card bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white">
        <div className="text-sm opacity-80">Test {attempt.testNumber} · {attempt.status === 'TIMED_OUT' ? 'Time ran out – submitted automatically' : 'Submitted'}</div>
        <div className="mt-1 flex flex-wrap items-end gap-x-6 gap-y-2">
          <div data-testid="score" className="text-6xl font-black">{grade.score}<span className="text-3xl font-bold opacity-80">/30</span></div>
          <div className="pb-2 text-2xl font-bold">{pctScore}%</div>
          <div className="pb-2"><Stars count={starsFor(pctScore)} size={26} /></div>
        </div>
        <p className="mt-3 text-lg font-semibold" data-testid="feedback">{feedback(pctScore, r.improvement, r.isPersonalBest, student.name)}</p>
      </div>

      <XpResult r={xpResult} lang={lang} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={<CheckCircle2 className="text-emerald-600" />} label="Correct" value={grade.correct} />
        <Stat icon={<XCircle className="text-rose-600" />} label="Incorrect" value={grade.incorrect} />
        <Stat icon={<CircleHelp className="text-slate-500" />} label="Unanswered" value={grade.unanswered} />
        <Stat icon={<Clock className="text-brand-600" />} label="Time used" value={formatDuration(attempt.timeUsedSec ?? 0)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-2 text-lg font-bold">How you did by topic</h2>
          <PercentBars data={grade.byTopic.map((t) => ({ name: t.key, value: Math.round(t.accuracy * 100) }))} />
        </section>
        <section className="card p-4">
          <h2 className="mb-2 text-lg font-bold">By question difficulty</h2>
          <div className="space-y-3">
            {grade.byDifficulty.map((d) => (
              <div key={d.key}>
                <div className="mb-1 flex justify-between text-sm"><span>Level {d.key}</span><span>{d.correct}/{d.total}</span></div>
                <ProgressBar value={d.correct} max={d.total} color={d.accuracy >= 0.7 ? 'bg-emerald-500' : d.accuracy >= 0.5 ? 'bg-amber-500' : 'bg-rose-500'} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card p-4">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold"><TrendingUp size={20} /> Your attempts on this test</h2>
        {r.history.length > 1 ? (
          <>
            <ScoreLine data={r.history.map((h) => ({ label: `#${h.n}`, score: h.score }))} />
            <ul className="mt-2 divide-y text-sm">
              {r.history.map((h) => (
                <li key={h.id} className="flex items-center justify-between py-1.5">
                  <span>Attempt {h.n} · {new Date(h.date).toLocaleDateString()}</span>
                  <span>{h.score}/30 · {formatDuration(h.timeUsedSec)}</span>
                </li>
              ))}
            </ul>
            {r.improvement !== null && <p className="mt-2 font-semibold">{r.improvement > 0 ? `+${r.improvement} compared with your previous attempt` : r.improvement < 0 ? `${r.improvement} compared with your previous attempt – you can beat it!` : 'Same score as last time.'}</p>}
          </>
        ) : (
          <p className="text-slate-600">This was your first attempt. Retake the test later to see how much you improve!</p>
        )}
        {r.isPersonalBest && <p className="mt-2 inline-flex items-center gap-1 font-bold text-amber-600"><Award size={18} /> Personal best!</p>}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href={`/results/${id}/review`} className="btn-primary" data-testid="review-answers">Review my answers</Link>
        <PracticeButton />
        <div className="sm:w-44"><StartTestButton testNumber={attempt.testNumber} label="Retake this test" secondary /></div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      {icon}
      <div>
        <div className="text-2xl font-extrabold">{value}</div>
        <div className="text-sm text-slate-500">{label}</div>
      </div>
    </div>
  );
}
