'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Explanation } from './Explanation';
import { ProgressBar } from './ui';
import { SimilarButton } from './SimilarButton';

export interface RQ {
  id: string;
  position: number;
  skillLabel: string;
  tier: number;
  textHtml: string;
  optionsHtml: string[];
  optionsText: string[];
  selected: string | null;
  correct: string | null;
  isCorrect: boolean | null;
  explanation: string | null;
  commonMistake: string | null;
  learningTip: string | null;
  topic: string;
}
interface Props {
  sessionId: string;
  kind: string;
  sourceQuestionId: string | null;
  questions: RQ[];
}

export function ReviewRunner({ sessionId, kind, sourceQuestionId, questions: initial }: Props) {
  const [qs, setQs] = useState(initial);
  const firstOpen = initial.findIndex((q) => q.selected === null);
  const [idx, setIdx] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(firstOpen === -1);

  const q = qs[idx];
  const answered = qs.filter((x) => x.selected !== null).length;

  async function choose(letter: string) {
    if (busy || q.selected !== null) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/review/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reviewQuestionId: q.id, selected: letter }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setQs((all) => all.map((x) => (x.id === q.id ? { ...x, selected: d.selected, isCorrect: d.isCorrect, correct: d.correct, explanation: d.explanation, commonMistake: d.commonMistake, learningTip: d.learningTip } : x)));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    const right = qs.filter((x) => x.isCorrect).length;
    const wrongOnes = qs.filter((x) => x.isCorrect === false);
    return (
      <div className="space-y-4">
        <div className="card bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white">
          <div className="text-sm opacity-90">{kind === 'SIMILAR' ? 'Practice question' : 'Smart Review'} finished</div>
          <div className="text-5xl font-black" data-testid="review-score">{right}/{qs.length}</div>
          <p className="mt-2 text-lg font-semibold">{right === qs.length ? 'Perfect! You really understand this. 🌟' : right >= qs.length / 2 ? 'Nice work, Kenny! Every question you practise makes you stronger. 💪' : 'Good try! Read the explanations and have another go – you will get there. 🌱'}</p>
        </div>
        {wrongOnes.length > 0 && (
          <div className="card p-4">
            <h2 className="mb-2 font-bold">Questions to look at again</h2>
            {wrongOnes.map((w) => (
              <div key={w.id} className="mb-3 border-b pb-3 last:border-0">
                <div className="text-sm font-semibold text-slate-500">{w.skillLabel}</div>
                <div className="text-lg" dangerouslySetInnerHTML={{ __html: w.textHtml }} />
                <Explanation explanation={w.explanation ?? ''} commonMistake={w.commonMistake} learningTip={w.learningTip} />
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {kind === 'SIMILAR' && sourceQuestionId && <SimilarAgain questionId={sourceQuestionId} tier={qs[0].isCorrect ? qs[0].tier : Math.max(1, qs[0].tier - 1)} />}
          <Link href="/review" className="btn-primary">Back to Smart Review</Link>
          <Link href="/progress" className="btn-secondary">See my progress</Link>
        </div>
      </div>
    );
  }

  const revealed = q.selected !== null;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3 text-sm text-slate-600">
        <span>{kind === 'SIMILAR' ? 'Practice question' : `Question ${idx + 1} of ${qs.length}`}</span>
        <div className="flex-1"><ProgressBar value={answered} max={qs.length} color="bg-emerald-500" label="Progress" /></div>
        <span className="badge bg-slate-100 text-slate-600">{q.skillLabel}</span>
      </div>
      <div className="card p-5">
        <div className="text-xl leading-relaxed" data-testid="review-question" dangerouslySetInnerHTML={{ __html: q.textHtml }} />
        <div className="mt-4 grid gap-3">
          {q.optionsHtml.map((h, i) => {
            const L = 'ABCD'[i];
            const isCorrect = revealed && L === q.correct;
            const isMine = q.selected === L;
            return (
              <button
                key={L}
                disabled={revealed || busy}
                data-testid={`rv-option-${L}`}
                onClick={() => choose(L)}
                className={`flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-lg ${isCorrect ? 'border-emerald-500 bg-emerald-50' : isMine ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-white hover:border-brand-300'}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold">{L}</span>
                <span className="min-w-0 flex-1 overflow-x-auto" dangerouslySetInnerHTML={{ __html: h }} />
                {isCorrect && <CheckCircle2 className="text-emerald-600" />}
                {isMine && !isCorrect && <XCircle className="text-rose-600" />}
              </button>
            );
          })}
        </div>
        {err && <p role="alert" className="mt-2 text-sm text-rose-600">{err}</p>}
        {revealed && (
          <div data-testid="review-feedback">
            <p className={`mt-4 text-lg font-bold ${q.isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>{q.isCorrect ? 'Correct! Well done! 🎉' : 'Not quite – let’s learn from it.'}</p>
            {!q.isCorrect && <Explanation explanation={q.explanation ?? ''} commonMistake={q.commonMistake} learningTip={q.learningTip} />}
            <div className="mt-4 flex justify-end">
              {idx < qs.length - 1 ? (
                <button className="btn-primary" onClick={() => setIdx(idx + 1)} data-testid="review-next">Next question</button>
              ) : (
                <button className="btn-primary" onClick={() => setDone(true)} data-testid="review-finish">Finish</button>
              )}
            </div>
          </div>
        )}
      </div>
      <input type="hidden" value={sessionId} readOnly />
    </div>
  );
}

function SimilarAgain({ questionId, tier }: { questionId: string; tier: number }) {
  return <SimilarButton questionId={questionId} tier={tier} label="Try another similar question" />;
}
