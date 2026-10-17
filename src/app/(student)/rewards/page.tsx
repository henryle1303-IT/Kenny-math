import { getLang, getStudent } from '@/lib/services/core';
import { listRewardsForStudent } from '@/lib/services/rewards';
import { RewardShop } from '@/components/xp/RewardShop';
import { xt } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function RewardsPage() {
  const student = await getStudent();
  const [lang, data] = await Promise.all([getLang(), listRewardsForStudent(student.id)]);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-extrabold text-brand-800">🎁 {xt(lang, 'rewards')}</h1>
      {data.enabled ? <RewardShop lang={lang} initial={data} /> : <p className="card p-4" data-testid="shop-closed">{xt(lang, 'shopClosed')}</p>}
    </div>
  );
}
