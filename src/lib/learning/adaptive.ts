import type { Tier } from '../gen/types';

export const TIER_NAMES: Record<number, string> = { 1: 'Foundational', 2: 'Basic', 3: 'Moderately challenging', 4: 'Advanced practice', 5: 'Advanced practice' };

/** Raw target tier from recent accuracy (spec 6.4). */
export function targetTier(accuracy: number | null): Tier {
  if (accuracy === null) return 2;
  if (accuracy < 0.5) return 1;
  if (accuracy < 0.7) return 2;
  if (accuracy < 0.85) return 3;
  return 4;
}

/**
 * Choose the practice tier for a skill. Changes are gradual: never more than one step away from the
 * tier last used for that skill, and the first Smart Review for a skill never starts above tier 3.
 */
export function chooseTier(accuracy: number | null, lastTier: number | null | undefined): Tier {
  const target = targetTier(accuracy);
  if (!lastTier) return Math.min(target, 3) as Tier;
  const clamped = Math.max(lastTier - 1, Math.min(lastTier + 1, target));
  return Math.min(5, Math.max(1, clamped)) as Tier;
}
