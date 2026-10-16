'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function StartTestButton({ testNumber, label, secondary }: { testNumber: number; label: string; secondary?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go() {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/attempts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ testNumber }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not start the test.');
      router.push(`/attempt/${data.attemptId}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div>
      <button onClick={go} disabled={busy} className={secondary ? 'btn-secondary w-full' : 'btn-primary w-full'}>
        {busy ? 'Starting…' : label}
      </button>
      {err && <p role="alert" className="mt-1 text-sm text-rose-600">{err}</p>}
    </div>
  );
}
