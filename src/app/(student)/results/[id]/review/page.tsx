import { getStudent, getLang } from '@/lib/services/core';
import { displayCorrect, displayResponse, typeOf } from '@/lib/question-types';
import { qt } from '@/lib/i18n';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppError, getAttemptResult } from '@/lib/services/attempts';
import { RichText } from '@/components/RichText';
import { Explanation } from '@/components/Explanation';
import { SimilarButton } from '@/components/SimilarButton';

const STATUS = {
  correct: { label: 'Correct', cls: 'bg-emerald-100 text-emerald-700' },
  incorrect: { label: 'Incorrect', cls: 'bg-rose-100 text-rose-700' },
  unanswered: { label: 'Unanswered', cls: 'bg-slate-200 text-slate-700' },
} as const;

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ filter?: string }> }) {
  const student = await getStudent();
  const lang = await getLang();
  const { id } = await params;
  const { filter } = await searchParams;
  let r;
  try {
    r = await getAttemptResult(id, student.id);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const items = r.items.filter((it) => (filter === 'wrong' ? it.status !== 'correct' : true));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">Test {r.attempt.testNumber}: review</h1>
        <div className="flex gap-2 text-sm">
          <Link className={filter === 'wrong' ? 'btn-secondary' : 'btn-primary'} href={`/results/${id}/review`}>All questions</Link>
          <Link className={filter === 'wrong' ? 'btn-primary' : 'btn-secondary'} href={`/results/${id}/review?filter=wrong`}>Only mistakes</Link>
          <Link className="btn-ghost" href={`/results/${id}`}>Back to score</Link>
        </div>
      </div>
      {items.length === 0 && <div className="card p-6 text-center text-lg">Perfect – no mistakes to review! 🌟</div>}
      {items.map(({ number, q, selected, status }) => {
        const opts = [q.optionA, q.optionB, q.optionC, q.optionD];
        return (
          <article key={q.id} data-testid={`review-q-${number}`} className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-bold text-brand-700">Question {number}</span>
              <span className={`badge ${STATUS[status].cls}`}>{STATUS[status].label}</span>
            </div>
            <p className="text-lg"><RichText text={q.questionText} /></p>
            {typeOf(q.questionType) !== 'MCQ' ? (
              <div className="mt-3 grid gap-2" data-testid={`review-typed-${number}`}>
                <div className={`rounded-xl border-2 px-3 py-2 ${status === 'correct' ? 'border-emerald-500 bg-emerald-50' : 'border-rose-400 bg-rose-50'}`}>
                  <div className="text-xs font-bold uppercase text-slate-600">{qt(lang, 'yourAnswer')}</div>
                  <div className="text-lg">{selected ? <RichText text={displayResponse(q, selected)} /> : '–'}</div>
                </div>
                {status !== 'correct' && (
                  <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 px-3 py-2">
                    <div className="text-xs font-bold uppercase text-emerald-700">{qt(lang, 'correctAnswer')}</div>
                    <div className="text-lg"><RichText text={displayCorrect(q)} /></div>
                  </div>
                )}
              </div>
            ) : (
            <ul className="mt-3 grid gap-2">
              {opts.map((o, i) => {
                const L = 'ABCD'[i];
                const isCorrect = L === q.correctAnswer;
                const isMine = L === selected;
                return (
                  <li key={L} className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 ${isCorrect ? 'border-emerald-500 bg-emerald-50' : isMine ? 'border-rose-400 bg-rose-50' : 'border-slate-200'}`}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold ring-1 ring-slate-300">{L}</span>
                    <span className="flex-1"><RichText text={o} /></span>
                    {isCorrect && <span className="text-xs font-bold text-emerald-700">Correct answer</span>}
                    {isMine && !isCorrect && <span className="text-xs font-bold text-rose-700">Your answer</span>}
                  </li>
                );
              })}
            </ul>
            )}
            {status === 'unanswered' && <p className="mt-2 text-sm text-slate-500">You did not answer this question.</p>}
            <Explanation explanation={q.explanation} commonMistake={q.commonMistake} learningTip={q.learningTip} />
            {status !== 'correct' && <div className="mt-3"><SimilarButton questionId={q.id} /></div>}
          </article>
        );
      })}
    </div>
  );
}
