import type { SkillInfo, Template, Tier, Topic } from './types';
import { wholeTemplates } from './templates/whole';
import { orderTemplates } from './templates/order';
import { fractionTemplates } from './templates/fractions';
import { decimalTemplates } from './templates/decimals';
import { percentTemplates } from './templates/percent';
import { ratioTemplates } from './templates/ratio';
import { measureTemplates } from './templates/measure';
import { geometryTemplates } from './templates/geometry';
import { timeTemplates } from './templates/time';
import { wordTemplates } from './templates/word';
import { patternTemplates } from './templates/patterns';
import { logicTemplates } from './templates/logic';
import { multistepTemplates } from './templates/multistep';
import { reasoningTemplates } from './templates/reasoning';

export const TEMPLATES: Template[] = [
  ...wholeTemplates,
  ...orderTemplates,
  ...fractionTemplates,
  ...decimalTemplates,
  ...percentTemplates,
  ...ratioTemplates,
  ...measureTemplates,
  ...geometryTemplates,
  ...timeTemplates,
  ...wordTemplates,
  ...patternTemplates,
  ...logicTemplates,
  ...multistepTemplates,
  ...reasoningTemplates,
];

export function templatesFor(topic: Topic, tier: Tier): Template[] {
  return TEMPLATES.filter((t) => t.topic === topic && t.tiers[0] <= tier && tier <= t.tiers[1]);
}

export function templatesForSkill(skill: string): Template[] {
  return TEMPLATES.filter((t) => t.skill === skill);
}

const skillMap = new Map<string, SkillInfo>();
for (const t of TEMPLATES) if (!skillMap.has(t.skill)) skillMap.set(t.skill, { id: t.skill, label: t.skillLabel, topic: t.topic });
export const SKILLS: SkillInfo[] = [...skillMap.values()];

export function skillInfo(id: string): SkillInfo | undefined {
  return skillMap.get(id);
}
export function skillLabel(id: string): string {
  return skillMap.get(id)?.label ?? id;
}
