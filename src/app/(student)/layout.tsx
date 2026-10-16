import { Nav } from '@/components/Nav';

export const dynamic = 'force-dynamic';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </>
  );
}
