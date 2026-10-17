'use client';
import { useState } from 'react';

export function StudentLogout({ lang }: { lang: 'en' | 'vi' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <><button className="btn-ghost text-sm" disabled={busy} onClick={async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/student/logout', { method: 'POST' });
      if (!res.ok) throw new Error('Could not sign out. Please try again.');
      window.location.replace('/login');
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }}>{lang === 'vi' ? 'Đăng xuất' : 'Sign out'}</button>{error && <span role="alert">{error}</span>}</>;
}
