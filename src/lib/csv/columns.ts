/** Stable CSV columns (order matters for exports). */
export const CORE_COLUMNS = [
  'question_id',
  'test_id',
  'question_number',
  'test_level',
  'difficulty',
  'topic',
  'skill',
  'question_text',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_answer',
  'explanation',
  'common_mistake',
  'learning_tip',
] as const;

/** Extra bank-level / verification columns used for reliable round trips. Optional on import. */
export const EXTRA_COLUMNS = ['bank_id', 'bank_version', 'verify_expr', 'validation_status'] as const;

export const ALL_COLUMNS = [...CORE_COLUMNS, ...EXTRA_COLUMNS] as const;

export const COLUMN_DESCRIPTIONS: Record<(typeof ALL_COLUMNS)[number], string> = {
  question_id: 'Unique question ID inside the bank, e.g. T01-Q01. Used to match questions when updating.',
  test_id: 'Test number 1-30',
  question_number: 'Position of the question inside its test, 1-30',
  test_level: 'Beginner (tests 1-10), Intermediate (11-20) or Advanced (21-30)',
  difficulty: 'Whole number 1 (easiest) to 5 (hardest)',
  topic: 'Mathematical topic, e.g. Fractions',
  skill: 'Specific skill id, e.g. fr.add (used by Smart Review)',
  question_text: 'The question. Wrap maths in \\( ... \\), e.g. \\(\\frac{3}{4}\\)',
  option_a: 'Answer A',
  option_b: 'Answer B',
  option_c: 'Answer C',
  option_d: 'Answer D',
  correct_answer: 'A, B, C or D',
  explanation: 'Step-by-step solution. It must state the correct answer.',
  common_mistake: 'The most common student error',
  learning_tip: 'A short piece of learning advice',
  bank_id: '(optional) ID of the bank the file was exported from',
  bank_version: '(optional) Version number of the bank the file was exported from',
  verify_expr: '(optional) Expression that evaluates to the correct answer, used for automatic checking, e.g. 3/4+1/8',
  validation_status: '(optional, informational) Status when exported. It is recalculated on import.',
};

export type CsvColumn = (typeof ALL_COLUMNS)[number];
export type CsvRow = Record<CsvColumn, string>;
