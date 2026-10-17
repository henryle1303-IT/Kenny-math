'use client';
import { useState } from 'react';

export default function StudentLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <main className="mx-auto flex min-h-screen max-w-sm items-center px-4"><form className="card w-full space-y-4 p-6" onSubmit={async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const res = await fetch('/api/student/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const d = await res.json(); if (!res.ok) throw new Error(d.error || 'Could not sign in.');
      window.location.replace('/');
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }}>
    <h1 className="text-2xl font-extrabold text-brand-800">Math Challenge</h1>
    <p>Student sign in / Đăng nhập học sinh</p>
    <label className="label" htmlFor="username">Username / Tên đăng nhập</label>
    <input id="username" className="input" autoComplete="username" autoCapitalize="none" required maxLength={40} value={username} onChange={(e) => setUsername(e.target.value)} />
    <label className="label" htmlFor="password">Password / Mật khẩu</label>
    <input id="password" className="input" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in / Đăng nhập'}</button>
  </form></main>;
}
