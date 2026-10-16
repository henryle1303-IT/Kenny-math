'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Clock, Send } from 'lucide-react';
import { ProgressBar } from './ui';

interface Props {
  attemptId: string;
  title: string;
  expiresAt: string;
  serverNow: string;
  /** Text and options are pre-rendered (KaTeX) on the server. */
  questions: { id: string; number: number; textHtml: string; optionsHtml: string[] }[];
  initialAnswers: Record<string, string>;
}

const LETTERS = ['A', 'B', 'C', 'D'];

export function TestRunner({ attemptId, title, expiresAt, serverNow, questions, initialAnswers }: Props) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // The countdown follows the expiry time stored on the server, corrected for clock differences,
  // so refreshing or navigating away can never reset it.
  const offset = useMemo(() => new Date(serverNow).getTime() - Date.now(), [serverNow]);
  const expiry = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  const [left, setLeft] = useState(() => Math.max(0, expiry - (Date.now() + offset)));
  const submittedRef = useRef(false);

  const submit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/attempts/${attemptId}/submit`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not submit.');
      router.replace(`/results/${attemptId}`);
    } catch (e) {
      submittedRef.current = false;
      setSubmitting(false);
      setError(`${(e as Error).message} Please try again.`);
    }
  }, [attemptId, router]);

  useEffect(() => {
    const t = setInterval(() => {
      const l = Math.max(0, expiry - (Date.now() + offset));
      setLeft(l);
      if (l <= 0) void submit();
    }, 500);
    return () => clearInterval(t);
  }, [expiry, offset, submit]);

  async function choose(qid: string, letter: string) {
    if (submitting) return;
    const prev = answers[qid];
    setAnswers((a) => ({ ...a, [qid]: letter }));
    try {
      const res = await fetch(`/api/attempts/${attemptId}/answer`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ questionId: qid, selected: letter }) });
      if (!res.ok) {
        const d = await res.json();
        if (d.code === 'EXPIRED' || d.code === 'SUBMITTED') {
          router.replace(`/results/${attemptId}`);
          return;
        }
        throw new Error(d.error);
      }
      setError('');
    } catch (e) {
      setAnswers((a) => {
        const n = { ...a };
        if (prev) n[qid] = prev;
        else delete n[qid];
        return n;
      });
      setError(`Your answer could not be saved (${(e as Error).message}). Please try again.`);
    }
  }

  const q = questions[idx];
  const answered = questions.filter((x) => answers[x.id]).length;
  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000);
  const low = left < 5 * 60000;

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="font-bold text-brand-800">{title}</div>
          <div data-testid="timer" className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-mono text-lg font-bold ${low ? 'bg-rose-100 text-rose-700' : 'bg-brand-50 text-brand-700'}`}>
            <Clock size={18} aria-hidden /> {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
          <span data-testid="progress-text">Question {idx + 1} of {questions.length}</span>
          <div className="flex-1">
            <ProgressBar value={answered} max={questions.length} label="Answered questions" />
          </div>
          <span>{Math.round((answered / questions.length) * 100)}%</span>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-1 text-sm font-semibold text-brand-700">Question {q.number}</div>
        <div className="text-xl leading-relaxed" data-testid="question-text" dangerouslySetInnerHTML={{ __html: q.textHtml }} />
        <div role="radiogroup" aria-label="Answer choices" className="mt-5 grid gap-3">
          {q.optionsHtml.map((html, i) => {
            const letter = LETTERS[i];
            const selected = answers[q.id] === letter;
            return (
              <button
                key={letter}
                role="radio"
                aria-checked={selected}
                data-testid={`option-${letter}`}
                onClick={() => choose(q.id, letter)}
                className={`flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-lg transition focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 ${selected ? 'border-brand-600 bg-brand-50 font-semibold' : 'border-slate-200 bg-white hover:border-brand-300'}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${selected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{letter}</span>
                <span className="min-w-0 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
              </button>
            );
          })}
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        <div className="mt-5 flex items-center justify-between gap-2">
          <button className="btn-secondary" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} data-testid="prev">
            <ChevronLeft size={18} /> Previous
          </button>
          {idx < questions.length - 1 ? (
            <button className="btn-primary" onClick={() => setIdx((i) => i + 1)} data-testid="next">
              Next <ChevronRight size={18} />
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setConfirm(true)}>
              <Send size={18} /> Submit
            </button>
          )}
        </div>
      </div>

      <nav aria-label="Question navigator" className="card mt-4 p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold">Jump to a question</span>
          <span className="text-slate-500">
            {answered} answered · {questions.length - answered} left
          </span>
        </div>
        <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
          {questions.map((x, i) => (
            <button
              key={x.id}
              onClick={() => setIdx(i)}
              aria-label={`Question ${x.number}${answers[x.id] ? ', answered' : ', not answered'}`}
              aria-current={i === idx}
              className={`h-10 rounded-lg text-sm font-bold ring-1 ${i === idx ? 'ring-2 ring-brand-600' : 'ring-slate-200'} ${answers[x.id] ? 'bg-brand-600 text-white' : 'bg-white text-slate-600'}`}
            >
              {x.number}
            </button>
          ))}
        </div>
        <button className="btn-primary mt-4 w-full" onClick={() => setConfirm(true)} data-testid="submit-open">
          <Send size={18} /> Submit test
        </button>
      </nav>

      {confirm && (
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card w-full max-w-sm p-5">
            <h2 id="confirm-title" className="text-xl font-bold">
              Submit your test?
            </h2>
            <p className="mt-2 text-slate-600">
              You have answered <b>{answered}</b> of <b>{questions.length}</b> questions.
              {answered < questions.length && <> {questions.length - answered} question(s) are still blank and will score 0.</>}
            </p>
            <div className="mt-4 flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setConfirm(false)} disabled={submitting}>
                Keep working
              </button>
              <button className="btn-primary flex-1" onClick={submit} disabled={submitting} data-testid="submit-confirm">
                {submitting ? 'Submitting…' : 'Yes, submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
