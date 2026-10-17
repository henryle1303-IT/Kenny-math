'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { qt, type Lang } from '@/lib/i18n';

export type ClientView =
  | { type: 'MCQ'; optionsHtml: string[] }
  | { type: 'NUMERIC_INPUT'; unit: string | null }
  | { type: 'TRUE_FALSE'; statementsHtml: string[] }
  | { type: 'MULTI_SELECT'; optionsHtml: string[] }
  | { type: 'FILL_BLANK'; blanks: number }
  | { type: 'ORDERING'; items: { index: number; html: string }[] }
  | { type: 'SHORT_TEXT' };

const LETTERS = ['A', 'B', 'C', 'D'];

function parse<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

interface Props {
  qid: string;
  view: ClientView;
  /** The stored answer for this question, if any. */
  value: string | undefined;
  lang: Lang;
  /** True while a choice is being saved (only multiple choice blocks input during saves). */
  busy: boolean;
  onCommit: (value: string | null) => void;
}

/** Debounced text commit: saves shortly after typing stops, and immediately on blur. */
function useDraft(value: string | undefined, onCommit: (v: string | null) => void) {
  const [draft, setDraft] = useState(value ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(value ?? '');
  const commit = useRef(onCommit);
  commit.current = onCommit;
  function flush(v: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (v === last.current) return;
    last.current = v;
    commit.current(v.trim() ? v : null);
  }
  function change(v: string) {
    setDraft(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(v), 700);
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return { draft, change, flush };
}

function TextAnswer({ value, onCommit, placeholder, hint, testId, maxLength }: { value: string | undefined; onCommit: (v: string | null) => void; placeholder: string; hint: string; testId: string; maxLength: number }) {
  const d = useDraft(value, onCommit);
  return (
    <div className="mt-5">
      <p className="mb-2 text-sm text-slate-600">{hint}</p>
      <input
        data-testid={testId}
        className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-lg focus:border-brand-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300"
        value={d.draft}
        maxLength={maxLength}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="text"
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => d.change(e.target.value)}
        onBlur={() => d.flush(d.draft)}
      />
    </div>
  );
}

function FillBlanks({ blanks, value, onCommit, lang }: { blanks: number; value: string | undefined; onCommit: (v: string | null) => void; lang: Lang }) {
  const [vals, setVals] = useState<string[]>(() => {
    const v = parse<string[]>(value, []);
    return Array.from({ length: blanks }, (_, i) => (typeof v[i] === 'string' ? v[i] : ''));
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(JSON.stringify(vals));
  const commit = useRef(onCommit);
  commit.current = onCommit;
  function flush(next: string[]) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const j = JSON.stringify(next);
    if (j === last.current) return;
    last.current = j;
    commit.current(next.every((x) => !x.trim()) ? null : j);
  }
  function change(i: number, v: string) {
    const next = vals.map((x, k) => (k === i ? v : x));
    setVals(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(next), 700);
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <div className="mt-5">
      <p className="mb-2 text-sm text-slate-600">{qt(lang, 'fill')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {vals.map((v, i) => (
          <label key={i} className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-600">{i + 1}</span>
            <input
              data-testid={`blank-${i + 1}`}
              className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 px-3 py-2 text-lg focus:border-brand-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300"
              value={v}
              maxLength={40}
              autoComplete="off"
              spellCheck={false}
              aria-label={qt(lang, 'blank', { n: i + 1 })}
              onChange={(e) => change(i, e.target.value)}
              onBlur={() => flush(vals)}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export function QuestionInput({ qid, view, value, lang, busy, onCommit }: Props) {
  switch (view.type) {
    case 'MCQ':
      return (
        <div role="radiogroup" aria-label="Answer choices" className="mt-5 grid gap-3">
          {view.optionsHtml.map((html, i) => {
            const letter = LETTERS[i];
            const selected = value === letter;
            return (
              <button
                key={letter}
                role="radio"
                aria-checked={selected}
                data-testid={`option-${letter}`}
                onClick={() => onCommit(letter)}
                disabled={busy}
                className={`flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-lg transition focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 ${selected ? 'border-brand-600 bg-brand-50 font-semibold' : 'border-slate-200 bg-white hover:border-brand-300'}`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${selected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{letter}</span>
                <span className="min-w-0 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
              </button>
            );
          })}
        </div>
      );
    case 'NUMERIC_INPUT':
      return <TextAnswer key={qid} value={value} onCommit={onCommit} placeholder={view.unit ? `${qt(lang, 'numericPlaceholder')} (${view.unit})` : qt(lang, 'numericPlaceholder')} hint={qt(lang, 'numeric') + (view.unit ? ' ' + qt(lang, 'unit', { u: view.unit }) : '')} testId="answer-input" maxLength={40} />;
    case 'SHORT_TEXT':
      return <TextAnswer key={qid} value={value} onCommit={onCommit} placeholder={qt(lang, 'numericPlaceholder')} hint={qt(lang, 'short')} testId="answer-input" maxLength={80} />;
    case 'FILL_BLANK':
      return <FillBlanks key={qid} blanks={view.blanks} value={value} onCommit={onCommit} lang={lang} />;
    case 'TRUE_FALSE': {
      const cur = parse<(boolean | null)[]>(value, []);
      const set = (i: number, v: boolean) => {
        const next = view.statementsHtml.map((_, k) => (k === i ? v : (cur[k] ?? null)));
        onCommit(JSON.stringify(next));
      };
      return (
        <div className="mt-5">
          <p className="mb-2 text-sm text-slate-600">{qt(lang, 'trueFalse')}</p>
          <ul className="grid gap-3">
            {view.statementsHtml.map((html, i) => (
              <li key={i} className="rounded-xl border-2 border-slate-200 p-3">
                <div className="mb-2 text-lg" dangerouslySetInnerHTML={{ __html: `${i + 1}. ${html}` }} />
                <div role="radiogroup" aria-label={`${i + 1}`} className="flex gap-2">
                  {[true, false].map((b) => {
                    const selected = cur[i] === b;
                    return (
                      <button key={String(b)} role="radio" aria-checked={selected} data-testid={`tf-${i + 1}-${b ? 'true' : 'false'}`} onClick={() => set(i, b)} className={`min-h-12 flex-1 rounded-xl border-2 px-4 text-lg font-semibold focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 ${selected ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-300'}`}>
                        {qt(lang, b ? 'true' : 'false')}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case 'MULTI_SELECT': {
      const cur = parse<number[]>(value, []);
      const toggle = (i: number) => {
        const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i];
        onCommit(next.length ? JSON.stringify(next.sort((a, b) => a - b)) : null);
      };
      return (
        <div className="mt-5">
          <p className="mb-2 text-sm text-slate-600">{qt(lang, 'multi')}</p>
          <div role="group" aria-label={qt(lang, 'multi')} className="grid gap-3">
            {view.optionsHtml.map((html, i) => {
              const selected = cur.includes(i);
              return (
                <button key={i} role="checkbox" aria-checked={selected} data-testid={`multi-${i}`} onClick={() => toggle(i)} className={`flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-lg transition focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 ${selected ? 'border-brand-600 bg-brand-50 font-semibold' : 'border-slate-200 bg-white hover:border-brand-300'}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 text-base font-bold ${selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-transparent'}`}>✓</span>
                  <span className="min-w-0 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
                </button>
              );
            })}
          </div>
        </div>
      );
    }
    case 'ORDERING': {
      const saved = parse<number[]>(value, []);
      const valid = saved.length === view.items.length;
      const order = valid ? saved : view.items.map((x) => x.index);
      const byIndex = new Map(view.items.map((x) => [x.index, x.html]));
      const move = (pos: number, dir: -1 | 1) => {
        const to = pos + dir;
        if (to < 0 || to >= order.length) return;
        const next = [...order];
        [next[pos], next[to]] = [next[to], next[pos]];
        onCommit(JSON.stringify(next));
      };
      return (
        <div className="mt-5">
          <p className="mb-2 text-sm text-slate-600">{qt(lang, 'ordering')}</p>
          <ol className="grid gap-2">
            {order.map((idx, pos) => (
              <li key={idx} data-testid={`order-item-${pos + 1}`} data-index={idx} className="flex items-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-lg">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-600">{pos + 1}</span>
                <span className="min-w-0 flex-1 overflow-x-auto" dangerouslySetInnerHTML={{ __html: byIndex.get(idx) ?? '' }} />
                <button type="button" data-testid={`order-up-${pos + 1}`} aria-label={qt(lang, 'moveUp')} disabled={pos === 0} onClick={() => move(pos, -1)} className="btn-secondary !px-3 disabled:opacity-40"><ArrowUp size={18} /></button>
                <button type="button" data-testid={`order-down-${pos + 1}`} aria-label={qt(lang, 'moveDown')} disabled={pos === order.length - 1} onClick={() => move(pos, 1)} className="btn-secondary !px-3 disabled:opacity-40"><ArrowDown size={18} /></button>
              </li>
            ))}
          </ol>
          {!valid && <p className="mt-2 text-sm text-slate-500">{qt(lang, 'orderNotMoved')}</p>}
        </div>
      );
    }
  }
}
