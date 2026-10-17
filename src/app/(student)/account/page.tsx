import { getStudent, getLang } from '@/lib/services/core';
import { StudentPassword } from '@/components/StudentPassword';

export default async function AccountPage() {
  const student = await getStudent(); const lang = await getLang();
  return <div className="space-y-4"><h1 className="text-2xl font-bold">{student.name}</h1><p>{student.username}</p><StudentPassword lang={lang} /></div>;
}
