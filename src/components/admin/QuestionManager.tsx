'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { RichText } from '../RichText';

interface Bank { id: string; label: string; editable: boolean }
interface Q {
  id: string; questionId: string; testNumber: number; position: number; topic: string; skill: string; difficulty: number;
  questionText: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string;
  explanation: string; commonMistake: string; learningTip: string; validationStatus: string; validationNotes: string; verifyExpr: string | null;
}

const STATUS_CLS: Record<string, string> = {
  VERIFIED: 'bg-emerald-100 text-emerald-700', MANUAL_OK: 'bg-teal-100 text-teal-700', NEEDS_REVIEW: 'bg-amber-100 text-amber-700', INVALID: 'bg-rose-100 text-rose-700', PENDING: 'bg-slate-100 text-slate-600',
};

export function QuestionManager({ banks, topics, initialBank }: { banks: Bank[]; topics: string[]; initialBank: string }) {
  const [bank, setBank] = useState(initialBank);
  const [filters, setFilters] = useState({ q: '', test: '', topic: '', difficulty: '', status: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; pageSize: number; items: Q[] }>({ total: 0, pageSize: 30, items: [] });
  const [edit, setEdit] = useState<Q | null>(null);
  const [preview, setPreview] = useState<Q | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const loadVersion = useRef(0);
  const cur = banks.find((b) => b.id === bank);
  const editable = !!cur?.editable;

  const load = useCallback(async () => {
    if (!bank) return;
    const version = ++loadVersion.current;
    const p = new URLSearchParams({ page: String(page) });
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    try {
      const result = await api<{ total: number; pageSize: number; items: Q[] }>(`/api/admin/banks/${bank}/questions?${p}`, 'GET');
      if (version === loadVersion.current) setData(result);
    } catch (e) {
      if (version === loadVersion.current) setMsg({ ok: false, t: (e as Error).message });
    }
  }, [bank, filters, page]);
  useEffect(() => { void load(); }, [load]);

  async function act(label: string, fn: () => Promise<unknown>, rethrow = false) {
    try {
      await fn();
      setMsg({ ok: true, t: `${label} done.` });
      await load();
    } catch (e) {
      setMsg({ ok: false, t: `${label}: ${(e as Error).message}` });
      if (rethrow) throw e;
    }
  }

  async function copyToDraft() {
    try {
      const r = await api('/api/admin/banks/' + bank + '/clone', 'POST', {});
      window.location.href = `/admin/questions?bank=${r.bank.id}`;
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message });
    }
  }

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <div className="space-y-4">
      <div className="card grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="sm:col-span-3 lg:col-span-2">
          <label className="label" htmlFor="qb">Bank</label>
          <select id="qb" className="input" value={bank} onChange={(e) => { loadVersion.current++; setBank(e.target.value); setPage(1); setEdit(null); setPreview(null); setMsg(null); setData({ total: 0, pageSize: 30, items: [] }); }}>{banks.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select>
        </div>
        <div className="lg:col-span-2"><label className="label" htmlFor="qs">Search</label><input id="qs" className="input" placeholder="text, id, skill…" value={filters.q} onChange={(e) => { setFilters({ ...filters, q: e.target.value }); setPage(1); }} /></div>
        <div><label className="label" htmlFor="qt">Test</label><input id="qt" type="number" min={1} max={30} className="input" value={filters.test} onChange={(e) => { setFilters({ ...filters, test: e.target.value }); setPage(1); }} /></div>
        <div><label className="label" htmlFor="qd">Difficulty</label>
          <select id="qd" className="input" value={filters.difficulty} onChange={(e) => { setFilters({ ...filters, difficulty: e.target.value }); setPage(1); }}><option value="">Any</option>{[1, 2, 3, 4, 5].map((d) => <option key={d}>{d}</option>)}</select></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="qtp">Topic</label>
          <select id="qtp" className="input" value={filters.topic} onChange={(e) => { setFilters({ ...filters, topic: e.target.value }); setPage(1); }}><option value="">All topics</option>{topics.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div className="sm:col-span-2"><label className="label" htmlFor="qst">Validation</label>
          <select id="qst" className="input" value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1); }}><option value="">Any</option>{Object.keys(STATUS_CLS).map((s) => <option key={s}>{s}</option>)}</select></div>
      </div>

      {!editable && cur && (
        <div className="card flex flex-wrap items-center justify-between gap-2 border-l-4 border-amber-400 p-3 text-sm">
          <span>This bank is published, so it is read-only. To change questions, edit a draft copy.</span>
          <button className="btn-primary !min-h-9" onClick={copyToDraft}>Create draft copy</button>
        </div>
      )}
      {msg && <p role="status" className={`rounded-lg p-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{msg.t}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm" data-testid="question-table">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="p-2">ID</th><th>Test</th><th>#</th><th>Topic</th><th>Diff</th><th>Preview</th><th>Key</th><th>Validation</th><th /></tr></thead>
          <tbody>
            {data.items.map((q) => (
              <tr key={q.id} className="border-t align-top">
                <td className="p-2 font-mono text-xs">{q.questionId}</td><td>{q.testNumber}</td><td>{q.position}</td><td>{q.topic}</td><td>{q.difficulty}</td>
                <td className="max-w-xs"><div className="line-clamp-2"><RichText text={q.questionText} /></div></td>
                <td>{q.correctAnswer}</td>
                <td><span title={q.validationNotes} className={`badge ${STATUS_CLS[q.validationStatus] ?? ''}`}>{q.validationStatus.replace('_', ' ')}</span></td>
                <td className="whitespace-nowrap p-2">
                  <button className="btn-ghost !min-h-8 !px-2 text-xs" onClick={() => setPreview(q)}>Preview</button>
                  {editable && <>
                    <button className="btn-ghost !min-h-8 !px-2 text-xs" onClick={() => setEdit(q)}>Edit</button>
                    <button className="btn-ghost !min-h-8 !px-2 text-xs" onClick={() => act('Regenerate', () => api(`/api/admin/banks/${bank}/questions/${q.id}/regenerate`, 'POST'))}>Regenerate</button>
                    <button className="btn-ghost !min-h-8 !px-2 text-xs" onClick={() => act('Duplicate', () => api(`/api/admin/banks/${bank}/questions/${q.id}/duplicate`, 'POST'))}>Duplicate</button>
                    {(q.validationStatus === 'NEEDS_REVIEW' || q.validationStatus === 'PENDING') && <button className="btn-ghost !min-h-8 !px-2 text-xs text-teal-700" onClick={() => act('Mark reviewed', () => api(`/api/admin/banks/${bank}/questions/${q.id}/reviewed`, 'POST'))}>Mark reviewed</button>}
                    <button className="btn-ghost !min-h-8 !px-2 text-xs text-rose-700" onClick={() => { if (confirm(`Delete ${q.questionId}?`)) void act('Delete', () => api(`/api/admin/banks/${bank}/questions/${q.id}`, 'DELETE')); }}>Delete</button>
                  </>}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-slate-500">No questions match.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span>{data.total} questions</span>
        <div className="flex items-center gap-2">
          <button className="btn-secondary !min-h-9" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
          <span>Page {page} of {pages}</span>
          <button className="btn-secondary !min-h-9" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>

      {preview && <Modal onClose={() => setPreview(null)} title={`Student view – ${preview.questionId}`}><Preview q={preview} /></Modal>}
      {edit && <EditModal q={edit} onClose={() => setEdit(null)} onSave={async (body) => { await act('Save', () => api(`/api/admin/banks/${bank}/questions/${edit.id}`, 'PUT', body), true); setEdit(null); }} />}
    </div>
  );
}

function Preview({ q }: { q: Q }) {
  const opts = [q.optionA, q.optionB, q.optionC, q.optionD];
  return (
    <div>
      <p className="text-lg"><RichText text={q.questionText} /></p>
      <ul className="mt-3 grid gap-2">{opts.map((o, i) => <li key={i} className={`rounded-xl border-2 px-3 py-2 ${'ABCD'[i] === q.correctAnswer ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}><b>{'ABCD'[i]}</b> <RichText text={o} /></li>)}</ul>
      <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm"><RichText text={q.explanation} /></pre>
      <p className="mt-2 text-sm"><b>Common mistake:</b> {q.commonMistake}</p>
      <p className="text-sm"><b>Tip:</b> {q.learningTip}</p>
      {q.validationNotes && <p className="mt-2 rounded bg-amber-50 p-2 text-sm text-amber-800">{q.validationNotes}</p>}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4">
      <div className="card my-8 w-full max-w-2xl p-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button className="btn-ghost !min-h-8" onClick={onClose}>Close</button></div>
        {children}
      </div>
    </div>
  );
}

function EditModal({ q, onClose, onSave }: { q: Q; onClose: () => void; onSave: (b: unknown) => Promise<void> }) {
  const [f, setF] = useState({ ...q });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof Q, v: string | number) => setF({ ...f, [k]: v });
  return (
    <Modal title={`Edit ${q.questionId}`} onClose={onClose}>
      <div className="space-y-3">
        <div><label className="label" htmlFor="e-text">Question (maths in \( … \))</label><textarea id="e-text" className="input" rows={3} value={f.questionText} onChange={(e) => set('questionText', e.target.value)} /></div>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['optionA', 'optionB', 'optionC', 'optionD'] as const).map((k, i) => <div key={k}><label className="label" htmlFor={`e-${k}`}>Option {'ABCD'[i]}</label><input id={`e-${k}`} className="input" value={f[k]} onChange={(e) => set(k, e.target.value)} /></div>)}
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <div><label className="label" htmlFor="e-c">Correct</label><select id="e-c" className="input" value={f.correctAnswer} onChange={(e) => set('correctAnswer', e.target.value)}>{'ABCD'.split('').map((l) => <option key={l}>{l}</option>)}</select></div>
          <div><label className="label" htmlFor="e-d">Difficulty</label><select id="e-d" className="input" value={f.difficulty} onChange={(e) => set('difficulty', Number(e.target.value))}>{[1, 2, 3, 4, 5].map((l) => <option key={l}>{l}</option>)}</select></div>
          <div><label className="label" htmlFor="e-t">Topic</label><input id="e-t" className="input" value={f.topic} onChange={(e) => set('topic', e.target.value)} /></div>
          <div><label className="label" htmlFor="e-s">Skill</label><input id="e-s" className="input" value={f.skill} onChange={(e) => set('skill', e.target.value)} /></div>
        </div>
        <div><label className="label" htmlFor="e-x">Explanation</label><textarea id="e-x" className="input font-mono text-sm" rows={7} value={f.explanation} onChange={(e) => set('explanation', e.target.value)} /></div>
        <div><label className="label" htmlFor="e-m">Common mistake</label><input id="e-m" className="input" value={f.commonMistake} onChange={(e) => set('commonMistake', e.target.value)} /></div>
        <div><label className="label" htmlFor="e-l">Learning tip</label><input id="e-l" className="input" value={f.learningTip} onChange={(e) => set('learningTip', e.target.value)} /></div>
        <div><label className="label" htmlFor="e-v">Verification expression (optional, e.g. 3/4+1/8)</label><input id="e-v" className="input font-mono" value={f.verifyExpr ?? ''} onChange={(e) => set('verifyExpr', e.target.value)} /></div>
        {error && <p role="alert" className="text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await onSave({ questionText: f.questionText, options: [f.optionA, f.optionB, f.optionC, f.optionD], correctAnswer: f.correctAnswer, difficulty: f.difficulty, topic: f.topic, skill: f.skill, explanation: f.explanation, commonMistake: f.commonMistake, learningTip: f.learningTip, verifyExpr: f.verifyExpr ?? '' }); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>Save and re-check</button>
        </div>
      </div>
    </Modal>
  );
}
