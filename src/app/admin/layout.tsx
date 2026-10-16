export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin – Kenny Math Challenge' };
export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
