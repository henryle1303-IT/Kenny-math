import { StudentLogout } from './StudentLogout';
import Link from 'next/link';
import { BookOpenCheck, Home, LineChart, Sparkles } from 'lucide-react';
import { getLang, getStudent } from '@/lib/services/core';
import { tr } from '@/lib/i18n';
import { LangToggle } from './LangToggle';

export async function Nav() {
  const lang = await getLang();
  const student = await getStudent();
  const items = [
    { href: '/', label: 'Home', Icon: Home },
    { href: '/tests', label: 'Math Tests', Icon: BookOpenCheck },
    { href: '/review', label: 'Smart Review', Icon: Sparkles },
    { href: '/progress', label: 'My Progress', Icon: LineChart },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between flex-wrap gap-2 px-4 py-2">
        <Link href="/" className="text-lg font-extrabold text-brand-700">
          🧮 <span className="hidden sm:inline">{lang === 'vi' ? `Thử thách Toán của ${student.name}` : `${student.name} Math Challenge`}</span>
        </Link>
        <nav aria-label="Main" className="flex w-full min-w-0 flex-wrap items-center gap-1 sm:w-auto">
          {items.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className="btn-ghost !px-3 text-sm sm:text-base">
              <Icon size={18} aria-hidden />
              <span className="hidden sm:inline">{tr(lang, label)}</span>
              <span className="sr-only sm:hidden">{tr(lang, label)}</span>
            </Link>
          ))}
          <LangToggle lang={lang} />
          <Link href="/account" className="btn-ghost max-w-32 truncate text-sm" aria-label={lang === 'vi' ? `Tài khoản ${student.name}` : `Account for ${student.name}`}>{student.name}</Link>
          <StudentLogout lang={lang} />
        </nav>
      </div>
    </header>
  );
}
