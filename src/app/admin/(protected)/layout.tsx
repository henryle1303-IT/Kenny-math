import { redirect } from 'next/navigation';
import Link from 'next/link';
import { currentAdmin } from '@/lib/services/admin-auth';
import { LogoutButton } from '@/components/admin/LogoutButton';

const NAV = [
  ['/admin', 'Dashboard'],
  ['/admin/questions', 'Question Manager'],
  ['/admin/generator', 'Question Generator'],
  ['/admin/import', 'Import / Export'],
  ['/admin/banks', 'Bank Versions'],
  ['/admin/students', 'Student Progress'],
  ['/admin/settings', 'Settings'],
];

export default async function ProtectedAdmin({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');
  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="text-lg font-extrabold text-brand-800">🛠️ Kenny Math – Admin</div>
        <div className="flex items-center gap-2 text-sm text-slate-600"><span>{admin.email}</span><LogoutButton /></div>
        <nav aria-label="Admin" className="flex w-full flex-wrap gap-1">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="btn-ghost !min-h-9 !px-3 text-sm">{label}</Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
