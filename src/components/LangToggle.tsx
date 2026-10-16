'use client';
import { useRouter } from 'next/navigation';

export function LangToggle({ lang }: { lang: 'en' | 'vi' }) {
  const router = useRouter();
  async function toggle() {
    await fetch('/api/student/lang', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang: lang === 'en' ? 'vi' : 'en' }) });
    router.refresh();
  }
  return (
    <button onClick={toggle} className="btn-ghost !px-2 text-xs font-bold" aria-label="Switch language">
      {lang === 'en' ? 'VI' : 'EN'}
    </button>
  );
}
