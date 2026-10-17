'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

const intervalLabels: Record<string, string> = { afterIncorrect: 'After an incorrect answer', afterCorrectOnce: 'Correct once', afterCorrectTwice: 'Correct twice', afterConsistent: 'Consistently correct' };
type Profile = { id: string; name: string; username: string | null; preferences: string; isActive: boolean };

export function UserProfile({ student, intervals, banks, assignedBankId }: { student: Profile; intervals: Record<string, number>; banks: { id: string; label: string }[]; assignedBankId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState('Profile');
  const [name, setName] = useState(student.name); const [username, setUsername] = useState(student.username ?? '');
  const [lang, setLang] = useState<'en' | 'vi'>(JSON.parse(student.preferences).lang === 'vi' ? 'vi' : 'en');
  const [active, setActive] = useState(student.isActive); const [iv, setIv] = useState(intervals);
  const [password, setPassword] = useState(''); const [bankId, setBankId] = useState(assignedBankId);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  async function save(action: string) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await api(`/api/admin/users/${encodeURIComponent(student.id)}`, 'POST', action === 'profile' ? { action, profile: { username, name, lang, isActive: active, intervals: iv } } : action === 'password' ? { action, password } : { action, bankId });
      setMessage(action === 'password' ? 'Password reset. Previous student sessions have been signed out.' : 'Saved.');
      setPassword(''); router.refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="card space-y-4 p-5" aria-label={`Profile for ${student.name}`}>
    <h2 className="text-xl font-bold">{student.name}</h2>
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="User profile sections">{['Profile', 'Learning Settings', 'Password', 'Question Banks'].map((label) => <button key={label} id={`tab-${label.replaceAll(' ', '-')}`} role="tab" aria-selected={tab === label} aria-controls="profile-panel" className={tab === label ? 'btn-primary' : 'btn-secondary'} onClick={() => { setTab(label); setMessage(''); setError(''); }}>{label}</button>)}<a className="btn-secondary" href="#progress">Progress</a></div>
    <div id="profile-panel" role="tabpanel" aria-labelledby={`tab-${tab.replaceAll(' ', '-')}`}>
      {(tab === 'Profile' || tab === 'Learning Settings') && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save('profile'); }}>
        {tab === 'Profile' ? <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="profile-name" className="label">Display name</label><input id="profile-name" className="input" maxLength={40} required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label htmlFor="profile-username" className="label">Username</label><input id="profile-username" className="input" maxLength={40} pattern="[a-zA-Z0-9][a-zA-Z0-9_-]*" required value={username} onChange={(e) => setUsername(e.target.value)} /></div>
          <div><label htmlFor="profile-lang" className="label">Language</label><select id="profile-lang" className="input" value={lang} onChange={(e) => setLang(e.target.value as 'en' | 'vi')}><option value="en">English</option><option value="vi">Tiếng Việt</option></select></div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Account active</label>
        </div> : <><p className="text-sm text-slate-500">These intervals apply only to {student.name}, starting with the next skill update.</p><div className="grid gap-3 sm:grid-cols-2">{Object.entries(intervalLabels).map(([key, label]) => <div key={key}><label className="label" htmlFor={key}>{label} (days)</label><input id={key} className="input" type="number" min={0} max={365} step={1} required value={iv[key]} onChange={(e) => setIv({ ...iv, [key]: Number(e.target.value) })} /></div>)}</div></>}
        <button className="btn-primary" disabled={busy}>Save {tab === 'Profile' ? 'profile' : 'learning settings'}</button>
      </form>}
      {tab === 'Password' && <form className="max-w-md space-y-3" onSubmit={(e) => { e.preventDefault(); void save('password'); }}><label className="label" htmlFor="reset-password">New password for {student.name}</label><input id="reset-password" className="input" type="password" autoComplete="new-password" minLength={3} maxLength={72} required value={password} onChange={(e) => setPassword(e.target.value)} /><button className="btn-primary" disabled={busy}>Reset password</button></form>}
      {tab === 'Question Banks' && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void save('bank'); }}><p className="text-sm">Select the bank for {student.name}&apos;s new tests. Existing attempts keep their original questions and timer.</p><label className="label" htmlFor="assigned-bank">Published shared or private bank</label><select id="assigned-bank" className="input" value={bankId} required onChange={(e) => setBankId(e.target.value)}><option value="">Select a bank</option>{banks.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select><button className="btn-primary" disabled={busy || !bankId}>Assign bank to {student.name}</button><p className="text-sm">Use the import / export section below to create a private bank for this user.</p></form>}
    </div>
    {busy && <p role="status">Saving…</p>}{message && <p role="status" className="text-emerald-700">{message}</p>}{error && <p role="alert" className="text-rose-700">{error}</p>}
  </section>;
}

export function CreateUser() {
  const [username, setUsername] = useState(''); const [name, setName] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <details className="card p-4"><summary className="cursor-pointer font-bold">Create user</summary><form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const user = await api<{ id: string }>('/api/admin/users', 'POST', { username, name, password });
      setUsername(''); setName(''); setPassword(''); window.location.assign(`/admin/students?userId=${encodeURIComponent(user.id)}`);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }}><div><label className="label" htmlFor="new-username">Username</label><input id="new-username" className="input" required maxLength={40} autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} /></div><div><label className="label" htmlFor="new-name">Display name</label><input id="new-name" className="input" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} /></div><div><label className="label" htmlFor="new-password">Initial password</label><input id="new-password" className="input" type="password" autoComplete="new-password" required minLength={3} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} /></div><button className="btn-primary self-end" disabled={busy}>{busy ? 'Creating…' : 'Create user'}</button>{error && <p role="alert" className="text-rose-700">{error}</p>}</form></details>;
}
