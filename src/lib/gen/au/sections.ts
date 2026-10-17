import type { QuestionType } from '../../question-types';

/** The 16 sections of the Australian Year 5 bank (number, measurement, space, statistics and probability). */
export const SECTIONS = [
  { id: 'S1', label: 'Place Value & Rounding', perTest: 2 },
  { id: 'S2', label: 'Operations & Problem Solving', perTest: 3 },
  { id: 'S3', label: 'Factors & Multiples', perTest: 2 },
  { id: 'S4', label: 'Fractions', perTest: 3 },
  { id: 'S5', label: 'Decimals', perTest: 2 },
  { id: 'S6', label: 'Money', perTest: 2 },
  { id: 'S7', label: 'Patterns & Algebra', perTest: 2 },
  { id: 'S8', label: 'Units of Measurement', perTest: 2 },
  { id: 'S9', label: 'Perimeter, Area & Volume', perTest: 2 },
  { id: 'S10', label: 'Time', perTest: 2 },
  { id: 'S11', label: 'Angles', perTest: 1 },
  { id: 'S12', label: 'Shapes & Objects', perTest: 2 },
  { id: 'S13', label: 'Transformations & Symmetry', perTest: 1 },
  { id: 'S14', label: 'Location & Maps', perTest: 1 },
  { id: 'S15', label: 'Data', perTest: 2 },
  { id: 'S16', label: 'Chance', perTest: 1 },
] as const;
export type SectionId = (typeof SECTIONS)[number]['id'];
export const sectionLabel = (id: SectionId) => SECTIONS.find((s) => s.id === id)!.label;

/** How many questions of each type one 30-question test has, by level (MCQ fills the rest). */
export const TYPE_MIX: Record<'Beginner' | 'Intermediate' | 'Advanced', Partial<Record<QuestionType, number>>> = {
  Beginner: { NUMERIC_INPUT: 5, TRUE_FALSE: 2, MULTI_SELECT: 2, FILL_BLANK: 1, ORDERING: 1, SHORT_TEXT: 1 },
  Intermediate: { NUMERIC_INPUT: 6, TRUE_FALSE: 3, MULTI_SELECT: 2, FILL_BLANK: 2, ORDERING: 1, SHORT_TEXT: 1 },
  Advanced: { NUMERIC_INPUT: 8, TRUE_FALSE: 3, MULTI_SELECT: 2, FILL_BLANK: 3, ORDERING: 1, SHORT_TEXT: 1 },
};

/** Existing generator templates reused for multiple choice, by section. Anything above Year 5 (ratio, speed, percent, fraction x and /) is left out. */
export const REUSED: Record<SectionId, string[]> = {
  S1: ['wn.place', 'wn.expanded', 'wn.round'],
  S2: ['wn.addsub', 'wn.mul', 'wn.div', 'wn.remainder', 'wp.twostep', 'wp.groups', 'wp.times', 'wp.savings', 'ms.recipe', 'ms.party'],
  S3: ['wn.factors', 'wn.gcf', 'wn.lcm', 'wn.primes', 'rc.divisible'],
  S4: ['fr.mixed', 'fr.simplify', 'fr.equiv', 'fr.of', 'fr.mixedops', 'fr.compare'],
  S5: ['dec.addsub', 'dec.place', 'dec.pow10', 'dec.compare', 'dec.round', 'dec.fraction'],
  S6: ['dec.money', 'wp.moneyunit'],
  S7: ['pa.arith', 'pa.rule', 'pa.shapes', 'pa.special', 'oo.basic', 'oo.error', 'rc.missing'],
  S8: ['me.convert', 'me.mixedunits', 'me.pieces', 'me.compare'],
  S9: ['ge.perimeter', 'ge.area', 'ge.composite', 'ge.volume', 'ge.volumemissing', 'ge.capacity', 'ge.squarepa', 'ge.cubesfit', 'ms.fence'],
  S10: ['ts.elapsed', 'ts.arrival', 'ts.convert'],
  S11: ['ge.angles'],
  S12: [],
  S13: [],
  S14: [],
  S15: ['wp.table'],
  S16: [],
};

/** Reused templates whose answer cannot be typed as a plain number (they say "which of these", or the answer is a time/mixed unit). */
export const NOT_TYPEABLE = new Set(['fr.compare', 'dec.compare', 'wn.expanded', 'ts.elapsed', 'ts.arrival', 'fr.mixed']);
