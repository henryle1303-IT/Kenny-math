export type Tier = 1 | 2 | 3 | 4 | 5;

export const TOPICS = [
  'Whole Numbers',
  'Order of Operations',
  'Fractions',
  'Decimals',
  'Percentages',
  'Ratios',
  'Measurement',
  'Geometry',
  'Time & Speed',
  'Word Problems',
  'Patterns',
  'Logical Reasoning',
  'Multi-step Problems',
  'Reasoning Challenges',
] as const;
export type Topic = (typeof TOPICS)[number];

/** What a template returns for one concrete set of parameters. */
export interface Built {
  /** Question text. Inline math is wrapped in \( ... \). */
  text: string;
  /** Display text of the correct option. */
  correct: string;
  /** Plausible wrong options (reflecting common mistakes), best first. At least 3 should be given. */
  wrong: string[];
  /** Independent expression that must evaluate to the correct option's numeric value. */
  verify: string;
  /** Optional second, independently coded check (e.g. brute force search). */
  check?: () => boolean;
  /** What the question is asking (one sentence, child friendly). */
  asks: string;
  /** The maths idea in one sentence. */
  concept: string;
  /** Solution steps. */
  steps: string[];
  mistake: string;
  tip: string;
  /** Extra text that makes the question unique beyond its wording (optional). */
  key?: string;
  /** Padding generator for numeric distractors: returns an option text for a numeric offset. */
  pad?: (delta: number) => string;
}

export interface Template {
  id: string;
  skill: string;
  skillLabel: string;
  topic: Topic;
  /** Inclusive tier range this template can produce. */
  tiers: [Tier, Tier];
  build: (r: import('./rng').Rng, tier: Tier) => Built;
}

export interface SkillInfo {
  id: string;
  label: string;
  topic: Topic;
}

/** A fully built question, ready to be stored. */
export interface GeneratedQuestion {
  templateId: string;
  skill: string;
  topic: Topic;
  tier: Tier;
  text: string;
  options: [string, string, string, string];
  correct: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  commonMistake: string;
  learningTip: string;
  verifyExpr: string;
  fingerprint: string;
  skeleton: string;
}
