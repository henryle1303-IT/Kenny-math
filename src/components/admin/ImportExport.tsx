'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface BankOpt { id: string; label: string }
type Report = any;

export function ImportExport({ banks, drafts }: { banks: BankOpt[]; drafts: BankOpt[] }) {
  const router = useRouter();
  const [exportBank, setExportBank] = useState(banks[0]?.id ?? '');
  const [range, setRange] = useState('');
  const [mode, setMode] = useState('NEW_BANK');
  const [base, setBase] = useState(banks[0]?.id ?? '');
  const [includeExamples, setIncludeExamples] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [job, setJob] = useState<{ jobId: string; report: Report } | null>(null);
  const [name, setName] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [activate, setActivate] = useState(false);
  const [ack, setAck] = useState(false);
  const [done, setDone] = useState<string>('');

  async function upload() {
    if (!file) return;
    setBusy(true);
    setErr('');
    setJob(null);
    setDone('');
    try {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('mode', mode);
      fd.set('baseBankId', base);
      fd.set('includeExamples', String(includeExamples));
      const res = await fetch('/api/admin/import', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setJob(d);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!job) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(`/api/admin/import/${job.jobId}/commit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: name || undefined, activate: mode === 'REPLACE_ACTIVE' && activate, confirmText, acknowledgeReview: ack }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDone(d.activated ? 'Saved, published and activated.' : 'Saved as a new draft bank. Validate and publish it on the Bank Versions page.');
      setJob(null);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const r = job?.report;
  return (
    <div className="space-y-8">
      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold">Export Question Bank to CSV</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="eb">Bank</label>
            <select id="eb" className="input" value={exportBank} onChange={(e) => setExportBank(e.target.value)}>{banks.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select>
          </div>
          <div>
            <label className="label" htmlFor="rng">Tests (blank = all 900). Examples: 5 · 1-10 · 3,7,12-14</label>
            <input id="rng" className="input" value={range} onChange={(e) => setRange(e.target.value)} placeholder="all tests" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a data-testid="export-link" className="btn-primary" href={exportBank ? `/api/admin/banks/${exportBank}/export${range.trim() ? `?tests=${encodeURIComponent(range.trim())}` : ''}` : '#'}>Export Question Bank to CSV</a>
          <a className="btn-secondary" href="/api/admin/template">Download CSV Template</a>
        </div>
        <p className="text-xs text-slate-500">UTF-8 with BOM (opens correctly in Excel). Formula characters at the start of cells are neutralised.</p>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold">Import Question Bank from CSV</h2>
        <fieldset className="space-y-2">
          <legend className="label">Import mode</legend>
          {[
            ['NEW_BANK', 'A – Create a new draft bank (900 questions)'],
            ['REPLACE_ACTIVE', 'B – Replace the active bank (validated copy, activated after confirmation)'],
            ['UPDATE_SELECTED', 'C – Update selected questions (matched by question_id, saved as a new draft)'],
          ].map(([v, l]) => (
            <label key={v} className="flex items-start gap-2"><input type="radio" name="mode" value={v} checked={mode === v} onChange={() => setMode(v)} className="mt-1.5" /> <span>{l}</span></label>
          ))}
        </fieldset>
        {mode === 'UPDATE_SELECTED' && (
          <div>
            <label className="label" htmlFor="base">Bank to update</label>
            <select id="base" className="input" value={base} onChange={(e) => setBase(e.target.value)}>{banks.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="file">CSV file (max 5 MB)</label>
          <input id="file" data-testid="import-file" type="file" accept=".csv,text/csv" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeExamples} onChange={(e) => setIncludeExamples(e.target.checked)} /> include example rows (question_id starting with EXAMPLE-)</label>
        <button className="btn-primary" disabled={!file || busy} onClick={upload} data-testid="import-validate">{busy ? 'Checking…' : 'Upload and validate'}</button>
        {err && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700" data-testid="import-error">{err}</p>}
        {done && <p role="status" className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700" data-testid="import-done">{done}</p>}

        {r && (
          <div className="space-y-3" data-testid="import-report">
            <h3 className="font-bold">Validation report – {r.filename} <span className="text-xs font-normal text-slate-500">({r.encoding})</span></h3>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {([['Total rows', r.totalRows], ['Valid rows', r.validRows], ['Invalid rows', r.invalidRows], ['Duplicate rows', r.duplicateRows], ['Missing fields', r.missingFieldRows], ['Test-count errors', r.testCountErrors], ['Math warnings', r.warningRows], ['Manual review', r.reviewRows]] as [string, number][]).map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-500">{k}</dt><dd className="text-lg font-bold" data-testid={`rep-${k}`}>{v}</dd></div>
              ))}
            </dl>
            {r.skippedExamples > 0 && <p className="text-sm text-slate-600">{r.skippedExamples} example row(s) were skipped.</p>}
            {[...r.headerProblems, ...r.bankErrors].map((m: string, i: number) => <p key={i} className="rounded bg-rose-50 p-2 text-sm text-rose-700">{m}</p>)}
            {r.issues.length > 0 && (
              <div className="max-h-60 overflow-auto rounded-lg border text-sm">
                <table className="w-full text-left"><thead className="sticky top-0 bg-slate-100"><tr><th className="p-2">Row</th><th>ID</th><th>Type</th><th>Problem</th></tr></thead>
                  <tbody>{r.issues.slice(0, 100).map((i: any, k: number) => <tr key={k} className="border-t"><td className="p-2">{i.row}</td><td>{i.questionId}</td><td className={i.severity === 'error' ? 'text-rose-700' : 'text-amber-700'}>{i.severity}</td><td>{i.message}</td></tr>)}</tbody></table>
              </div>
            )}
            <a className="btn-secondary" href={`/api/admin/import/${job!.jobId}/errors`}>Download error report (CSV)</a>
            <div className="overflow-x-auto">
              <h4 className="mb-1 font-semibold">Preview (first {r.previewRows.length} rows)</h4>
              <table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th>Row</th><th>ID</th><th>Test</th><th>Topic</th><th>Diff</th><th>Question</th><th>Answer</th></tr></thead>
                <tbody>{r.previewRows.map((p: any) => <tr key={p.row} className="border-b"><td>{p.row}</td><td>{p.questionId}</td><td>{p.testNumber}/{p.position}</td><td>{p.topic}</td><td>{p.difficulty}</td><td className="max-w-xs truncate">{p.text}</td><td>{p.correct}</td></tr>)}</tbody></table>
            </div>
            {r.ok ? (
              <div className="space-y-2 rounded-xl bg-emerald-50 p-3">
                <p className="font-semibold text-emerald-800">✔ The file is valid and can be saved.</p>
                <div><label className="label" htmlFor="nm">Name for the new bank (optional)</label><input id="nm" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
                {mode === 'REPLACE_ACTIVE' && (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={activate} onChange={(e) => setActivate(e.target.checked)} /> Publish and activate it now (the previous bank is kept)</label>
                    {activate && (<>
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I accept questions flagged for manual review</label>
                      <div><label className="label" htmlFor="ct">Type REPLACE to confirm</label><input id="ct" className="input max-w-xs" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} /></div>
                    </>)}
                  </div>
                )}
                <button className="btn-primary" disabled={busy} onClick={commit} data-testid="import-commit">Save to draft bank</button>
              </div>
            ) : (
              <p className="rounded-xl bg-rose-50 p-3 font-semibold text-rose-800">This file cannot be saved. Nothing has been changed. Fix the problems above and upload again.</p>
            )}
          </div>
        )}
      </section>
      <input type="hidden" value={drafts.length} readOnly />
    </div>
  );
}
