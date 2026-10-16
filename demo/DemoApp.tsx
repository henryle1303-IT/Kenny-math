import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RichText } from '../src/components/RichText';
import { Explanation } from '../src/components/Explanation';
import { formatDuration } from '../src/lib/grading';
import { levelOf } from '../src/lib/gen/curriculum';
import { buildTemplateCsv, parseTests } from '../src/lib/csv/export';
import { validateBank } from '../src/lib/validate/bank';
import { STORAGE_KEY, initialState, readState, newBank, id, grade, exportCsv, importCsv, type DemoState, type Attempt, type Bank } from './model';

type Update = (fn: (state: DemoState) => DemoState) => void;
type Go = (url: string) => void;
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Link({ to, go, children, className = 'btn-secondary' }: { to: string; go: Go; children: ReactNode; className?: string }) {
  return <a href={to} className={className} onClick={(e) => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); go(to); } }}>{children}</a>;
}

export function DemoApp() {
  const [state, setState] = useState<DemoState | null>(null);
  const current = useRef<DemoState | null>(null);
  const [route, setRoute] = useState(window.location.pathname);
  const [message, setMessage] = useState('');
  const [clock, setClock] = useState(Date.now());
  const go: Go = (url) => { window.history.pushState({}, '', url); setRoute(url); window.scrollTo(0, 0); };
  const update: Update = (fn) => {
    if (!current.current) return;
    const next = fn(current.current);
    current.current = next; setState(next);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { setMessage('Browser storage is unavailable or full. Changes in this session may be lost after refresh. Export your bank to keep a copy.'); }
  };
  useEffect(() => {
    let saved: DemoState;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      saved = raw ? readState(raw) : initialState();
    } catch { saved = initialState(); setMessage('Saved demo data could not be loaded. A fresh demo has been opened.'); }
    current.current = saved; setState(saved);
    const pop = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', pop);
    const timer = setInterval(() => {
      if (current.current?.attempts.some((a) => !a.submittedAt && a.expiresAt !== null)) setClock(Date.now());
    }, 500);
    return () => { clearInterval(timer); window.removeEventListener('popstate', pop); };
  }, []);
  useEffect(() => {
    if (!state) return;
    const expired = state.attempts.filter((a) => !a.submittedAt && a.expiresAt !== null && a.expiresAt <= clock);
    if (!expired.length) return;
    update((s) => ({ ...s, attempts: s.attempts.map((a) => expired.some((e) => e.id === a.id) ? { ...a, submittedAt: a.expiresAt } : a) }));
    const active = expired.find((a) => route === `/attempt/${a.id}`);
    if (active) go(`/results/${active.id}`);
    // Only the ticking clock initiates expiry checks; writes are read from the current ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock]);

  if (!state) return <main className="mx-auto max-w-4xl p-8"><h1 className="text-3xl font-extrabold text-brand-800">Kenny Math Challenge</h1><p className="mt-4" role="status">Preparing 900 maths questions…</p></main>;
  const bank = state.banks.find((b) => b.id === state.activeBankId)!;
  const completed = state.attempts.filter((a) => a.submittedAt && !a.practice);
  const start = (testNumber: number) => {
    const open = state.attempts.find((a) => !a.submittedAt && !a.practice && a.testNumber === testNumber && (a.expiresAt ?? 0) > Date.now());
    if (open) { go(`/attempt/${open.id}`); return; }
    const now = Date.now();
    const attempt: Attempt = { id: id(), bankId: bank.id, testNumber, practice: false,
      questions: bank.questions.filter((q) => q.testNumber === testNumber), answers: {}, startedAt: now, expiresAt: now + 1800_000, submittedAt: null };
    update((s) => ({ ...s, attempts: [...s.attempts, attempt] })); go(`/attempt/${attempt.id}`);
  };
  const practice = (skill?: string, excludeId?: string) => {
    const weak = new Set(state.attempts.filter((a) => a.submittedAt).flatMap((a) => a.questions.filter((q) => a.answers[q.questionId] !== q.correctAnswer).map((q) => q.skill)));
    let pool = bank.questions.filter((q) => q.questionId !== excludeId && (skill ? q.skill === skill : weak.has(q.skill)));
    if (!pool.length) pool = bank.questions.filter((q) => q.questionId !== excludeId);
    const shuffled = pool.map((q) => ({ q, sort: Math.random() })).sort((a, b) => a.sort - b.sort);
    const questions = shuffled.slice(0, skill ? 1 : 10).map((v) => v.q);
    const attempt: Attempt = { id: id(), bankId: bank.id, testNumber: 0, practice: true, questions, answers: {}, startedAt: Date.now(), expiresAt: null, submittedAt: null };
    update((s) => ({ ...s, attempts: [...s.attempts, attempt] })); go(`/review/${attempt.id}`);
  };
  let page: ReactNode;
  const parts = route.split('/').filter(Boolean);
  if (parts[0] === 'admin') page = <Admin state={state} update={update} />;
  else if (parts[0] === 'attempt' || (parts[0] === 'review' && parts[1])) {
    const attempt = state.attempts.find((a) => a.id === parts[1]);
    page = attempt ? attempt.submittedAt ? <Results attempt={attempt} go={go} practice={practice} /> :
      <Quiz key={attempt.id} attempt={attempt} clock={clock} update={update} go={go} /> : <p className="card p-6">This session is no longer available. Start a new test.</p>;
  } else if (parts[0] === 'results') {
    const attempt = state.attempts.find((a) => a.id === parts[1]);
    page = attempt?.submittedAt ? <Results attempt={attempt} go={go} practice={practice} /> : <p className="card p-6">No result yet. Complete a test to see your score.</p>;
  } else if (route === '/tests') page = <div><h1 className="text-3xl font-extrabold">Math Tests</h1><p className="my-3 text-slate-600">30 tests · 30 questions each · 30 minutes · Easy to advanced</p><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 30 }, (_, i) => {
    const n = i + 1; const done = completed.filter((a) => a.testNumber === n); const open = state.attempts.some((a) => !a.submittedAt && a.testNumber === n);
    return <section key={n} className="card space-y-3 p-5" data-testid={`test-card-${n}`}><span className="badge bg-brand-100 text-brand-800">{levelOf(n)}</span><h2 className="text-xl font-bold">Math Test {n}</h2><p className="text-sm text-slate-600">30 questions · 30 minutes</p>{done.length > 0 && <p>Best: {Math.max(...done.map((a) => grade(a).score))}/30 · {done.length} attempt(s)</p>}<button className="btn-primary" onClick={() => start(n)}>{open ? 'Resume' : 'Start'}</button></section>;
  })}</div></div>;
  else if (route === '/review') page = <section className="card space-y-4 p-6"><h1 className="text-3xl font-extrabold">Smart Review</h1><p>Practise ten questions on skills from your mistakes. No timer — take your time and learn from the explanations.</p><button className="btn-primary" data-testid="practice-mistakes" onClick={() => practice()}>Practice My Mistakes</button><p className="text-sm text-slate-500">The demo selects practice from the question bank stored in this browser.</p></section>;
  else if (route === '/progress') page = <Progress state={state} go={go} />;
  else page = <div className="space-y-6"><section className="card bg-gradient-to-br from-brand-700 to-brand-900 p-7 text-white"><div className="text-lg">Hi {state.studentName}! 👋</div><h1 className="mt-2 text-4xl font-extrabold">Kenny Math Challenge</h1><p className="mt-3 max-w-xl text-lg">A little practice every day makes a big difference. Explore 30 maths tests, learn from mistakes and watch your progress grow.</p><div className="mt-6 flex flex-wrap gap-3"><Link go={go} to="/tests" className="btn bg-white text-brand-800">Math Tests</Link><Link go={go} to="/review" className="btn bg-brand-600 text-white">Smart Review</Link></div></section><Stats state={state} /><section className="card p-6"><h2 className="text-xl font-bold">Ready for a maths adventure?</h2><p className="mt-2 text-slate-600">Fractions, decimals, geometry, ratios and word problems — 900 questions with step-by-step explanations.</p></section></div>;
  return <><div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">Demo · Bài làm và ngân hàng câu hỏi lưu trên trình duyệt này · Không cần đăng nhập</div><header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5"><Link go={go} to="/" className="text-xl font-extrabold text-brand-800">🧮 Kenny Math</Link><nav aria-label="Main" className="flex flex-wrap gap-1">{[['/', 'Home'], ['/tests', 'Math Tests'], ['/review', 'Smart Review'], ['/progress', 'My Progress'], ['/admin', 'Admin demo']].map(([to, label]) => <Link key={to} to={to} go={go} className={route === to ? 'btn-primary' : 'btn-ghost'}>{label}</Link>)}</nav></header><main className="mx-auto max-w-6xl px-4 pb-12">{message && <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-amber-900">{message}</p>}{page}</main><footer className="border-t px-4 py-5 text-center text-sm text-slate-500">Kenny Math Challenge · Grade 5 · Demo data stays on this device</footer></>;
}

function Stats({ state }: { state: DemoState }) {
  const done = state.attempts.filter((a) => a.submittedAt && !a.practice);
  const average = done.length ? (done.reduce((n, a) => n + grade(a).score, 0) / done.length).toFixed(1) : '–';
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
    ['Tests completed', `${new Set(done.map((a) => a.testNumber)).size}/30`], ['Attempts', done.length], ['Average score', `${average}/30`], ['Practice sessions', state.attempts.filter((a) => a.submittedAt && a.practice).length],
  ].map(([label, value]) => <div key={label} className="card p-4"><div className="text-3xl font-extrabold text-brand-800">{value}</div><div className="mt-1 text-sm text-slate-500">{label}</div></div>)}</div>;
}

function Quiz({ attempt, clock, update, go }: { attempt: Attempt; clock: number; update: Update; go: Go }) {
  const [index, setIndex] = useState(0);
  const q = attempt.questions[index];
  const selected = attempt.answers[q.questionId];
  const answered = Object.keys(attempt.answers).length;
  const submit = () => { update((s) => ({ ...s, attempts: s.attempts.map((a) => a.id === attempt.id ? { ...a, submittedAt: Date.now() } : a) })); go(`/results/${attempt.id}`); };
  return <div className="mx-auto max-w-3xl space-y-4"><div className="card sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 p-4"><h1 className="text-lg font-bold">{attempt.practice ? 'Smart Review' : `Math Test ${attempt.testNumber}`}</h1>{attempt.expiresAt && <div className="rounded-full bg-brand-50 px-3 py-1 font-mono text-xl font-bold text-brand-800" data-testid="timer">{formatDuration(Math.max(0, Math.ceil((attempt.expiresAt - clock) / 1000)))}</div>}<div className="w-full text-sm text-slate-600" data-testid="progress-text">Question {index + 1} of {attempt.questions.length} · {answered} answered</div></div><section className="card p-5"><div className="text-sm font-bold text-brand-700">{q.topic}</div><h2 className="mt-2 text-xl leading-relaxed" data-testid="question-text"><RichText text={q.questionText} /></h2><div className="mt-5 grid gap-3" role="radiogroup" aria-label="Answer choices">{q.options.map((option, i) => {
    const letter = 'ABCD'[i]; return <button key={letter} className={`flex min-h-14 items-center gap-3 rounded-xl border-2 p-4 text-left text-lg ${selected === letter ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-brand-300'}`} role="radio" aria-checked={selected === letter} disabled={attempt.practice && !!selected} data-testid={`option-${letter}`} onClick={() => update((s) => ({ ...s, attempts: s.attempts.map((a) => a.id === attempt.id ? { ...a, answers: { ...a.answers, [q.questionId]: letter } } : a) }))}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-800">{letter}</span><span className="min-w-0 overflow-x-auto"><RichText text={option} /></span></button>;
  })}</div>{attempt.practice && selected && <div data-testid="review-feedback"><p className="mt-4 font-bold">{selected === q.correctAnswer ? 'Correct! Well done.' : 'Good try! Read the explanation below.'}</p><Explanation explanation={q.explanation} commonMistake={q.commonMistake} learningTip={q.learningTip} /></div>}<div className="mt-5 flex flex-wrap justify-between gap-2"><button className="btn-secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</button>{index < attempt.questions.length - 1 ? <button className="btn-primary" data-testid="next" disabled={attempt.practice && !selected} onClick={() => setIndex(index + 1)}>Next</button> : <button className="btn-primary" onClick={() => { if (confirm('Submit this session and see your result?')) submit(); }}>Finish</button>}</div></section><section className="card p-4"><div className="grid grid-cols-6 gap-2 sm:grid-cols-10">{attempt.questions.map((item, i) => <button key={item.questionId} aria-label={`Question ${i + 1}, ${attempt.answers[item.questionId] ? 'answered' : 'not answered'}`} className={`h-10 rounded-lg border font-bold ${attempt.answers[item.questionId] ? 'bg-brand-600 text-white' : 'bg-white text-slate-600'} ${index === i ? 'ring-2 ring-brand-400' : ''}`} onClick={() => setIndex(i)}>{i + 1}</button>)}</div><button className="btn-primary mt-4 w-full" data-testid="submit-open" onClick={() => { if (confirm(`Submit? You have answered ${answered} of ${attempt.questions.length} questions.`)) submit(); }}>Submit {attempt.practice ? 'practice' : 'test'}</button></section></div>;
}

function Results({ attempt, go, practice }: { attempt: Attempt; go: Go; practice: (skill?: string, excludeId?: string) => void }) {
  const result = grade(attempt);
  const [filter, setFilter] = useState('all');
  return <div className="space-y-5"><section className="card bg-gradient-to-br from-emerald-500 to-teal-700 p-7 text-white"><h1 className="text-2xl font-bold">{attempt.practice ? 'Practice' : `Math Test ${attempt.testNumber}`} results</h1><div className="my-3 text-6xl font-extrabold" data-testid="score">{result.score}/{result.total}</div><p>{result.correct} correct · {result.incorrect} incorrect · {result.unanswered} unanswered</p><p className="mt-3">Every question you practise makes you stronger. Keep going!</p></section><div className="flex flex-wrap gap-2"><Link go={go} to="/tests">Math Tests</Link><Link go={go} to="/progress">My Progress</Link><button className="btn-primary" onClick={() => practice()}>Practice My Mistakes</button></div><section className="card p-5"><h2 className="text-xl font-bold">Review your answers</h2><label className="label mt-3" htmlFor="result-filter">Show questions</label><select id="result-filter" className="input max-w-xs" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All questions</option><option value="wrong">Incorrect and unanswered</option></select></section>{attempt.questions.filter((q) => filter === 'all' || attempt.answers[q.questionId] !== q.correctAnswer).map((q) => <section key={q.questionId} className="card p-5"><div className="mb-2 text-sm font-bold text-brand-700">Question {attempt.questions.indexOf(q) + 1} · {q.topic}</div><RichText text={q.questionText} /><p className="mt-3 text-sm">Your answer: {attempt.answers[q.questionId] || 'Unanswered'} · Correct answer: {q.correctAnswer}</p><Explanation explanation={q.explanation} commonMistake={q.commonMistake} learningTip={q.learningTip} /><button className="btn-secondary mt-4" onClick={() => practice(q.skill, q.questionId)}>Try a Similar Question</button></section>)}</div>;
}

function Progress({ state, go }: { state: DemoState; go: Go }) {
  const done = state.attempts.filter((a) => a.submittedAt);
  const topics = new Map<string, { total: number; correct: number }>();
  for (const a of done) for (const q of a.questions) { const t = topics.get(q.topic) ?? { total: 0, correct: 0 }; t.total++; if (a.answers[q.questionId] === q.correctAnswer) t.correct++; topics.set(q.topic, t); }
  return <div className="space-y-5"><h1 className="text-3xl font-extrabold">My Learning Progress</h1><Stats state={state} /><section className="card p-5"><h2 className="text-xl font-bold">Topic accuracy</h2>{!topics.size && <p className="mt-3 text-slate-600">Complete your first test to see your progress.</p>}{[...topics].map(([topic, t]) => <div key={topic} className="mt-4"><div className="flex justify-between text-sm"><span>{topic}</span><span>{Math.round(t.correct / t.total * 100)}%</span></div><progress className="mt-1 h-3 w-full accent-blue-600" max={t.total} value={t.correct} aria-label={topic} /></div>)}</section><section className="card p-5"><h2 className="mb-3 text-xl font-bold">Attempt history</h2><div className="space-y-2">{done.slice().reverse().map((a) => <Link key={a.id} to={`/results/${a.id}`} go={go} className="flex flex-wrap justify-between gap-2 rounded-xl bg-slate-50 p-3"><span>{a.practice ? 'Smart Review' : `Math Test ${a.testNumber}`} · {new Date(a.startedAt).toLocaleString()}</span><b>{grade(a).score}/{a.questions.length}</b></Link>)}</div></section></div>;
}

function Admin({ state, update }: { state: DemoState; update: Update }) {
  const [selected, setSelected] = useState(state.activeBankId);
  const bank = state.banks.find((b) => b.id === selected) ?? state.banks[0];
  const [range, setRange] = useState('');
  const [mode, setMode] = useState('NEW_BANK');
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<Awaited<ReturnType<typeof importCsv>> | null>(null);
  const [bankName, setBankName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const clearDialog = useRef<HTMLDialogElement>(null);
  const invalidate = () => { setReport(null); setMessage(''); setError(''); };
  const activate = (b: Bank) => {
    const validation = validateBank(b.questions);
    if (!validation.ok) { setError('This bank has validation errors. Fix the CSV and import it again.'); return; }
    if (validation.reviewRows + validation.warningRows > 0 && !confirm(`${validation.reviewRows + validation.warningRows} question(s) need manual review. Accept these review flags for this demo?`)) return;
    if (!confirm(`Publish and activate “${b.name}”? Existing attempts keep their questions.`)) return;
    update((s) => ({ ...s, activeBankId: b.id, banks: s.banks.map((item) => item.id === b.id ? { ...item, status: 'PUBLISHED' } : item) }));
    setMessage('Bank published and activated.');
  };
  return <div className="space-y-6"><section className="card p-5"><h1 className="text-3xl font-extrabold">Admin demo</h1><p className="mt-2 text-slate-600">Try question-bank tools with sample data. Changes are saved only in this browser.</p></section>{message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-800">{message}</p>}{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-700">{error}</p>}<Stats state={state} />
    <section className="card space-y-3 p-5"><h2 className="text-xl font-bold">Export Question Bank to CSV</h2><label className="label" htmlFor="demo-bank">Bank</label><select id="demo-bank" className="input" value={bank.id} disabled={busy} onChange={(e) => { setSelected(e.target.value); invalidate(); }}>{state.banks.map((b) => <option key={b.id} value={b.id}>{b.name}{b.id === state.activeBankId ? ' (active)' : ''}</option>)}</select><label className="label" htmlFor="demo-range">Tests (blank = all 900). Example: 1-3,9</label><input id="demo-range" className="input" value={range} onChange={(e) => setRange(e.target.value)} /><div className="flex flex-wrap gap-2"><button className="btn-primary" data-testid="export-link" onClick={() => { const tests = parseTests(range.trim() || null); if (tests && !tests.length) { setError('Enter a test number from 1 to 30 or a range.'); return; } download('kenny-math-demo-bank.csv', exportCsv(bank, tests)); }}>Export Question Bank to CSV</button><button className="btn-secondary" onClick={() => download('kenny-math-template.csv', buildTemplateCsv())}>Download CSV Template</button></div></section>
    <section className="card space-y-3 p-5"><h2 className="text-xl font-bold">Import Question Bank from CSV</h2><label className="label" htmlFor="demo-mode">Import mode</label><select id="demo-mode" className="input" value={mode} disabled={busy} onChange={(e) => { setMode(e.target.value); invalidate(); }}><option value="NEW_BANK">Create a new draft bank (900 questions)</option><option value="UPDATE_SELECTED">Update selected question IDs in a new draft copy</option></select><p className="text-sm text-slate-600">New banks need 30 tests × 30 questions. Updates use the bank selected above.</p><label className="label" htmlFor="demo-file">CSV file (max 5 MB)</label><input id="demo-file" type="file" accept=".csv,text/csv" data-testid="import-file" className="input" disabled={busy} onChange={(e) => { setFile(e.target.files?.[0] ?? null); invalidate(); }} /><button className="btn-primary" data-testid="import-validate" disabled={!file || busy} onClick={async () => { if (!file) return; setBusy(true); invalidate(); try { setReport(await importCsv(file, mode === 'UPDATE_SELECTED' ? bank : undefined)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{busy ? 'Checking…' : 'Upload and validate'}</button>{report && <div data-testid="import-report" className="space-y-3 rounded-xl bg-slate-50 p-4"><p className="font-bold">{report.ok ? 'The file is valid and can be saved.' : 'This file cannot be saved.'}</p><p>{report.report.validRows}/{report.report.totalRows} valid · {report.report.verifiedRows} verified · {report.report.reviewRows + report.report.warningRows} need review</p>{report.errors.slice(0, 8).map((e, i) => <p key={i} className="text-sm text-rose-700">{e}</p>)}{report.ok && <><label className="label" htmlFor="demo-bank-name">Name for the new bank</label><input id="demo-bank-name" className="input" value={bankName} onChange={(e) => setBankName(e.target.value)} /><button className="btn-primary" data-testid="import-commit" onClick={() => { const imported: Bank = { id: id(), name: bankName.trim() || `Imported bank ${state.banks.length + 1}`, status: 'DRAFT', questions: report.questions }; update((s) => ({ ...s, banks: [...s.banks, imported] })); setSelected(imported.id); setReport(null); setMessage('Saved as a new draft bank. Publish / Activate it below to use it for new tests.'); }}>Save to draft bank</button></>}</div>}</section>
    <section className="card space-y-3 p-5"><h2 className="text-xl font-bold">Question Generator</h2><button className="btn-secondary" disabled={busy} onClick={() => { const generated = newBank(`Generated bank ${state.banks.length + 1}`, `demo-${Date.now()}`); update((s) => ({ ...s, banks: [...s.banks, generated] })); setSelected(generated.id); setMessage('Generated 900 questions as a new draft.'); }}>Generate 900 Questions</button></section>
    <section className="space-y-3"><h2 className="text-2xl font-bold">Bank Versions</h2>{state.banks.slice().reverse().map((b) => <div key={b.id} className="card flex flex-wrap items-center justify-between gap-3 p-5"><div><h3 className="font-bold">{b.name}</h3><p className="text-sm text-slate-500">{b.questions.length} questions · {b.status}{b.id === state.activeBankId ? ' · ACTIVE' : ''}</p></div>{b.id !== state.activeBankId && <button className="btn-primary" onClick={() => activate(b)}>Publish / Activate</button>}</div>)}</section>
    <section className="card space-y-3 p-5"><h2 className="text-xl font-bold">Student settings</h2><label className="label" htmlFor="demo-name">Student name</label><input id="demo-name" maxLength={40} className="input max-w-sm" value={state.studentName} onChange={(e) => update((s) => ({ ...s, studentName: e.target.value }))} /></section>
    <section className="card space-y-3 border border-rose-200 p-5"><h2 className="text-xl font-bold">Clear student progress</h2><p>Clear all test attempts and practice history on this browser. Question banks and student settings are kept.</p><button className="btn-danger" onClick={() => { setConfirmation(''); clearDialog.current?.showModal(); }}>Clear progress</button><dialog ref={clearDialog} className="w-[calc(100%_-_2rem)] max-w-md space-y-3 rounded-2xl p-5 backdrop:bg-slate-900/50" aria-labelledby="demo-clear-title"><h2 id="demo-clear-title" className="text-xl font-bold">Clear all demo progress?</h2><p>This removes saved answers and scores from this browser.</p><label className="label" htmlFor="demo-clear">Type CLEAR to confirm</label><input id="demo-clear" className="input" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /><div className="flex flex-wrap justify-end gap-2"><button className="btn-secondary" onClick={() => clearDialog.current?.close()}>Cancel</button><button className="btn-danger" disabled={confirmation !== 'CLEAR'} onClick={() => { update((s) => ({ ...s, attempts: [] })); clearDialog.current?.close(); setMessage('Progress cleared. You can start again.'); }}>Clear all progress</button></div></dialog></section>
  </div>;
}
