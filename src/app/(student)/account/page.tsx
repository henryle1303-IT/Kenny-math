import { getStudent, getLang } from '@/lib/services/core';
import { getXpSummary } from '@/lib/services/xp';
import { StudentPassword } from '@/components/StudentPassword';
import { Cosmetics } from '@/components/xp/Cosmetics';

export default async function AccountPage() {
  const student = await getStudent(); const lang = await getLang();
  const xp = await getXpSummary(student.id).catch(() => null);
  return <div className="space-y-4"><h1 className="text-2xl font-bold">{student.name}</h1><p>{student.username}</p>{xp && <Cosmetics lang={lang} level={xp.level} avatar={xp.avatar} theme={xp.theme} />}<StudentPassword lang={lang} /></div>;
}
