import Link from 'next/link';
import { BookOpenCheck, LineChart, Sparkles, Trophy } from 'lucide-react';
import { getProgress } from '@/lib/services/progress';
import { getLang, getStudent } from '@/lib/services/core';
import { tr } from '@/lib/i18n';
import { MasteryBadge, pct } from '@/components/ui';
import { PracticeButton } from '@/components/PracticeButton';
import { prisma } from '@/lib/db';

export default async function HomePage() {
  const [student, p, lang, open] = await Promise.all([
    getStudent(),
    getProgress(),
    getLang(),
    prisma.testAttempt.findFirst({ where: { status: 'IN_PROGRESS', expiresAt: { gt: new Date() } }, orderBy: { startedAt: 'desc' } }),
  ]);
  const cards = [
    { href: '/tests', title: 'Math Tests', text: '30 tests, from easy to challenging', Icon: BookOpenCheck, color: 'from-sky-500 to-brand-600' },
    { href: '/review', title: 'Smart Review', text: 'Practise what you find tricky', Icon: Sparkles, color: 'from-violet-500 to-fuchsia-600' },
    { href: '/progress', title: 'My Progress', text: 'See how much you have grown', Icon: LineChart, color: 'from-emerald-500 to-teal-600' },
  ];
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-4xl font-black text-brand-800">{tr(lang, 'Kenny Math Challenge')}</h1>
        <p className="mt-1 text-lg text-slate-600">{tr(lang, 'Welcome back')}, <b>{student.name}</b>! 👋</p>
      </section>

      {open && (
        <Link href={`/attempt/${open.id}`} className="card flex items-center justify-between border-l-4 border-amber-400 p-4">
          <span className="font-semibold">You have a test in progress (Test {open.testNumber}).</span>
          <span className="btn-primary">{tr(lang, 'Resume')}</span>
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ href, title, text, Icon, color }) => (
          <Link key={href} href={href} className={`card bg-gradient-to-br ${color} p-5 text-white transition hover:-translate-y-0.5 hover:shadow-lg`}>
            <Icon size={32} aria-hidden />
            <div className="mt-3 text-xl font-extrabold">{tr(lang, title)}</div>
            <div className="text-sm opacity-90">{text}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          [tr(lang, 'Tests completed'), `${p.testsCompleted}/30`],
          [tr(lang, 'Latest score'), p.latestScore === null ? '–' : `${p.latestScore}/30`],
          [tr(lang, 'Best score'), p.bestScore === null ? '–' : `${p.bestScore}/30`],
          [tr(lang, 'Average score'), p.averageScore === null ? '–' : `${p.averageScore}/30`],
        ] as [string, string][]).map(([l, v]) => (
          <div key={l} className="card p-4 text-center">
            <div className="text-2xl font-extrabold text-brand-700">{v}</div>
            <div className="text-sm text-slate-500">{l}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><Sparkles size={18} /> Smart Review</h2>
          <p className="mb-3 text-slate-600">{p.weakest.length ? 'I found some skills to practise. Ready for ten new questions?' : 'Finish a test and I will suggest what to practise.'}</p>
          <PracticeButton />
        </section>
        <section className="card p-4">
          <h2 className="mb-2 text-lg font-bold">{tr(lang, 'Skills needing practice')}</h2>
          {p.weakest.length === 0 ? <p className="text-slate-500">Nothing yet – great!</p> : (
            <ul className="space-y-2">{p.weakest.map((s) => <li key={s.skillId} className="flex items-center justify-between"><span>{s.label}</span><b className="text-rose-600">{pct(s.accuracy)}</b></li>)}</ul>
          )}
        </section>
        <section className="card p-4">
          <h2 className="mb-2 text-lg font-bold">{tr(lang, 'Ready for Review')}</h2>
          {p.readyForReview.length === 0 ? <p className="text-slate-500">Nothing is due. 👍</p> : (
            <ul className="space-y-2">{p.readyForReview.slice(0, 4).map((s) => <li key={s.skillId} className="flex items-center justify-between"><span>{s.label}</span><MasteryBadge status={s.mastery} label={s.masteryLabel} /></li>)}</ul>
          )}
        </section>
        <section className="card p-4">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold"><Trophy size={18} className="text-amber-500" /> Badges</h2>
          {(p.masteryCounts.MASTERED ?? 0) === 0 && p.testsCompleted === 0 ? <p className="text-slate-500">Earn stars on tests and mastery badges for skills!</p> : (
            <div className="flex flex-wrap gap-2">
              {p.skills.filter((s) => s.mastery === 'MASTERED').map((s) => <span key={s.skillId} className="badge bg-emerald-100 text-emerald-700">★ {s.label}</span>)}
              {p.testsCompleted > 0 && <span className="badge bg-amber-100 text-amber-700">🏅 {p.testsCompleted} test{p.testsCompleted === 1 ? '' : 's'} done</span>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
