import { CheckCircle2, Clock, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { listTestSummaries } from '@/lib/services/attempts';
import { getLang } from '@/lib/services/core';
import { tr } from '@/lib/i18n';
import { StartTestButton } from '@/components/StartTestButton';
import { LEVEL_STYLE, Stars } from '@/components/ui';
import { starsFor } from '@/lib/grading';

export default async function TestsPage() {
  const [tests, lang] = await Promise.all([listTestSummaries(), getLang()]);
  if (!tests.length) {
    return <div className="card p-6">No tests are available yet. Please ask a grown-up to publish a question bank.</div>;
  }
  const levels = ['Beginner', 'Intermediate', 'Advanced'];
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-extrabold text-brand-800">{tr(lang, 'Math Tests')}</h1>
      {levels.map((lv) => (
        <section key={lv} aria-labelledby={`lv-${lv}`}>
          <h2 id={`lv-${lv}`} className="mb-3 flex items-center gap-2 text-xl font-bold">
            <span className={`badge ${LEVEL_STYLE[lv]}`}>{tr(lang, lv)}</span>
            <span className="text-sm font-normal text-slate-500">Tests {lv === 'Beginner' ? '1–10' : lv === 'Intermediate' ? '11–20' : '21–30'}</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tests.filter((t) => t.level === lv).map((t) => {
              const done = t.attempts > 0;
              return (
                <div key={t.testNumber} data-testid={`test-card-${t.testNumber}`} className={`card flex flex-col gap-3 p-4 ${done ? 'ring-2 ring-emerald-300' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg font-extrabold">Test {t.testNumber}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1"><ListChecks size={14} />30 {tr(lang, 'questions')}</span>
                        <span className="inline-flex items-center gap-1"><Clock size={14} />{t.timeLimitSec / 60} {tr(lang, 'minutes')}</span>
                      </div>
                    </div>
                    {done ? <span className="badge bg-emerald-100 text-emerald-700"><CheckCircle2 size={14} className="mr-1" />{tr(lang, 'Completed')}</span> : <span className="badge bg-slate-100 text-slate-500">{tr(lang, 'Not started')}</span>}
                  </div>
                  {done ? (
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                      <span>{tr(lang, 'Latest score')}: <b>{t.latestScore}/30</b></span>
                      <span>{tr(lang, 'Best score')}: <b>{t.bestScore}/30</b></span>
                      <Stars count={starsFor(((t.bestScore ?? 0) / 30) * 100)} />
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400">&nbsp;</div>
                  )}
                  <div className="mt-auto flex flex-col gap-2">
                    <StartTestButton testNumber={t.testNumber} label={t.inProgressId ? tr(lang, 'Resume') : done ? tr(lang, 'Retry') : tr(lang, 'Start')} secondary={done && !t.inProgressId} />
                    {t.latestAttemptId && <Link href={`/results/${t.latestAttemptId}`} className="text-center text-sm font-semibold text-brand-700 underline">Latest result</Link>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
