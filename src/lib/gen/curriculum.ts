import { TOPICS, type Tier, type Topic } from './types';

export const TEST_COUNT = 30;
export const QUESTIONS_PER_TEST = 30;
export const TOTAL_QUESTIONS = TEST_COUNT * QUESTIONS_PER_TEST;
export const TEST_TIME_LIMIT_SEC = 30 * 60;

export type Level = 'Beginner' | 'Intermediate' | 'Advanced';
export const LEVELS: Level[] = ['Beginner', 'Intermediate', 'Advanced'];

export function levelOf(testNumber: number): Level {
  return testNumber <= 10 ? 'Beginner' : testNumber <= 20 ? 'Intermediate' : 'Advanced';
}

export function testTitle(testNumber: number): string {
  return `Math Test ${testNumber}`;
}

/** Difficulty band inside a test: 0 easier (1-10), 1 moderate (11-20), 2 challenging (21-25), 3 most challenging (26-30). */
export function bandOf(position: number): 0 | 1 | 2 | 3 {
  return position <= 10 ? 0 : position <= 20 ? 1 : position <= 25 ? 2 : 3;
}
export const BAND_NAMES = ['Easier', 'Moderate', 'Challenging', 'Most challenging'] as const;

/**
 * Overall difficulty rating (1-5). Rises across the 30 tests AND across the bands inside each test
 * (Beginner tests span about 1-3, Intermediate 2-4, Advanced 3-5).
 */
export function ratingFor(testNumber: number, position: number): Tier {
  const tf = (testNumber - 1) / (TEST_COUNT - 1);
  const d = 1 + 2.6 * tf + 1.4 * (bandOf(position) / 3);
  return Math.min(5, Math.max(1, Math.round(d))) as Tier;
}

/** How many of each topic appear in one 30-question test (sums to 30). */
export const TOPIC_WEIGHTS: Record<Topic, number> = {
  'Whole Numbers': 2,
  'Order of Operations': 2,
  Fractions: 3,
  Decimals: 3,
  Percentages: 2,
  Ratios: 2,
  Measurement: 2,
  Geometry: 3,
  'Time & Speed': 2,
  'Word Problems': 3,
  Patterns: 2,
  'Logical Reasoning': 1,
  'Multi-step Problems': 2,
  'Reasoning Challenges': 1,
};

export const TOPIC_LIST: readonly Topic[] = TOPICS;
