import { getStudent, getLang } from '@/lib/services/core';
import { Nav } from '@/components/Nav';

export const dynamic = 'force-dynamic';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await getStudent();
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </>
  );
}

export async function generateMetadata() {
  const s = await getStudent(); const lang = await getLang();
  return { title: lang === 'vi' ? `Thử thách Toán của ${s.name}` : `${s.name} Math Challenge` };
}
