'use client';
import { useState } from 'react';
import { api } from './api';
import { ProgressBar } from '../ui';

interface BankOpt { id: string; label: string }
export function Generator({ drafts, topics }: { drafts: BankOpt[]; topics: string[] }) {
  const [name, setName] = useState('New Mathematics Tests');
  const [target, setTarget] = useState('new');
  const [scope, setScope] = useState<'all' | 'one' | 'level'>('all');
  const [testNo, setTestNo] = useState(1);
  const [level, setLevel] = useState('Beginner');
  const [topic, setTopic] = useState('');
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [bankId, setBankId] = useState('');
  const [err, setErr] = useState('');

  async function run() {
    setBusy(true);
    setErr('');
    setLog([]);
    setProgress(0);
    try {
      let id = target;
      if (target === 'new') {
        if (scope !== 'all') throw new Error('A new bank must be generated in full. Choose “All 900 questions”, or pick an existing draft.');
        const r = await api('/api/admin/banks', 'POST', { name });
        id = r.bank.id;
        setLog((l) => [...l, `Created draft bank “${r.bank.name}” (version ${r.bank.version}).`]);
      }
      setBankId(id);
      const tests = scope === 'all' ? Array.from({ length: 30 }, (_, i) => i + 1) : scope === 'one' ? [testNo] : level === 'Beginner' ? range(1, 10) : level === 'Intermediate' ? range(11, 20) : range(21, 30);
      const batch = 3;
      let done = 0;
      for (let i = 0; i < tests.length; i += batch) {
        const chunk = tests.slice(i, i + batch);
        const r = await api('/api/admin/banks/' + id + '/generate', 'POST', { tests: chunk, onlyTopic: target === 'new' ? undefined : topic || undefined });
        done += chunk.length;
        setProgress(Math.round((done / tests.length) * 100));
        setLog((l) => [...l, `Generated ${r.generated} questions for test${chunk.length > 1 ? 's' : ''} ${chunk.join(', ')}.`]);
      }
      const v = await api('/api/admin/banks/' + id + '/validate', 'POST');
      setLog((l) => [...l, `Validation: ${v.validRows}/${v.totalRows} valid · ${v.verifiedRows} verified automatically · ${v.reviewRows + v.warningRows} need manual review${v.bankErrors.length ? ' · ' + v.bankErrors.length + ' bank-level problem(s)' : ''}.`]);
      if (scope !== 'all' || target !== 'new') setLog((l) => [...l, 'Tip: full validation needs all 30 tests present.']);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="target">Where to put the questions</label>
          <select id="target" className="input" value={target} onChange={(e) => { setTarget(e.target.value); if (e.target.value === 'new') setTopic(''); }}>
            <option value="new">A new draft bank</option>
            {drafts.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>
        {target === 'new' && (
          <div>
            <label className="label" htmlFor="bname">Bank name</label>
            <input id="bname" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div>
          <label className="label" htmlFor="scope">What to generate</label>
          <select id="scope" className="input" value={scope} onChange={(e) => setScope(e.target.value as 'all')}>
            <option value="all">All 900 questions (30 tests)</option>
            <option value="one">One selected test</option>
            <option value="level">All tests of one level</option>
          </select>
        </div>
        {scope === 'one' && (
          <div>
            <label className="label" htmlFor="testNo">Test number</label>
            <input id="testNo" type="number" min={1} max={30} className="input" value={testNo} onChange={(e) => setTestNo(Number(e.target.value))} />
          </div>
        )}
        {scope === 'level' && (
          <div>
            <label className="label" htmlFor="lv">Level</label>
            <select id="lv" className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="topic">Only regenerate one topic (existing drafts)</label>
          <select id="topic" className="input" value={topic} onChange={(e) => setTopic(e.target.value)} disabled={target === 'new'}>
            <option value="">All topics</option>
            {topics.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <button className="btn-primary" disabled={busy} onClick={run} data-testid="generate-900">
        {busy ? 'Generating…' : scope === 'all' && target === 'new' ? 'Generate 900 Questions' : 'Generate'}
      </button>
      {(busy || progress > 0) && (
        <div aria-live="polite">
          <ProgressBar value={progress} label="Generation progress" />
          <div className="mt-1 text-sm text-slate-600">{progress}%</div>
        </div>
      )}
      {err && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{err}</p>}
      {log.length > 0 && <ul className="space-y-1 text-sm text-slate-700" data-testid="gen-log">{log.map((l, i) => <li key={i}>• {l}</li>)}</ul>}
      {bankId && !busy && !err && <a className="btn-secondary" href={`/admin/questions?bank=${bankId}`}>Preview questions</a>}
      <p className="text-xs text-slate-500">Generated banks stay as drafts. Nothing is published until you validate and publish it on the Bank Versions page.</p>
    </div>
  );
}
function range(a: number, b: number) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
