import { XpAdmin } from '@/components/admin/XpAdmin';
import { getXpConfig } from '@/lib/services/xp';
import { adminListRewards } from '@/lib/services/rewards';

export const dynamic = 'force-dynamic';

export default async function XpPage() {
  const [config, shop] = await Promise.all([getXpConfig(), adminListRewards()]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">XP and Rewards</h1>
      <p className="text-sm text-slate-600">Choose how many XP each action earns, switch features on or off, and set rewards students can ask for. Give, take or reset a single user&apos;s XP in User Profiles.</p>
      <XpAdmin config={config} shop={shop} />
    </div>
  );
}
