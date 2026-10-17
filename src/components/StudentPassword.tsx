'use client';
import { useState } from 'react';

export function StudentPassword({ lang }: { lang: 'en' | 'vi' }) {
  const [current, setCurrent] = useState(''); const [next, setNext] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const vi = lang === 'vi';
  return <form className="card max-w-md space-y-4 p-5" onSubmit={async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const res = await fetch('/api/student/password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ current, next }) });
      const d = await res.json(); if (!res.ok) throw new Error(d.error);
      window.location.replace('/login');
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }}>
    <h2 className="font-bold">{vi ? 'Đổi mật khẩu' : 'Change password'}</h2>
    <label className="label" htmlFor="current">{vi ? 'Mật khẩu hiện tại' : 'Current password'}</label>
    <input id="current" type="password" className="input" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
    <label className="label" htmlFor="next">{vi ? 'Mật khẩu mới' : 'New password'}</label>
    <input id="next" type="password" className="input" required minLength={3} maxLength={72} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
    <p className="text-sm text-slate-500">{vi ? 'Sau khi đổi mật khẩu, hãy đăng nhập lại trên các thiết bị.' : 'After changing your password, sign in again on your devices.'}</p>
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    <button className="btn-primary" disabled={busy}>{vi ? 'Lưu mật khẩu' : 'Save password'}</button>
  </form>;
}
