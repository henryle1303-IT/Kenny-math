'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Repeat } from 'lucide-react';

export function SimilarButton({ questionId, tier, label = 'Try a Similar Question' }: { questionId: string; tier?: number; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go() {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/review/similar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ questionId, tier }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      router.push(`/review/${d.sessionId}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <span>
      <button onClick={go} disabled={busy} className="btn-secondary !min-h-10 text-sm">
        <Repeat size={16} /> {busy ? 'Making a question…' : label}
      </button>
      {err && <span role="alert" className="ml-2 text-sm text-rose-600">{err}</span>}
    </span>
  );
}
