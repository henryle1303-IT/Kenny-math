'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';

export function PracticeButton({ label = 'Practice My Mistakes' }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go() {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/review/smart', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      router.push(`/review/${d.sessionId}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div>
      <button onClick={go} disabled={busy} data-testid="practice-mistakes" className="btn-primary !min-h-14 w-full text-lg sm:w-auto">
        <Sparkles size={22} /> {busy ? 'Getting your questions ready…' : label}
      </button>
      {err && <p role="alert" className="mt-2 text-sm text-rose-600">{err}</p>}
    </div>
  );
}
