import type { Built, Template, Tier, Topic } from './types';
import type { Rng } from './rng';

export function T(
  id: string,
  skill: string,
  skillLabel: string,
  topic: Topic,
  tiers: [Tier, Tier],
  build: (r: Rng, tier: Tier) => Built,
): Template {
  return { id, skill, skillLabel, topic, tiers, build };
}
