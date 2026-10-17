import type { Built, Tier } from '../types';
import type { Rng } from '../rng';
import type { QuestionType } from '../../question-types';
import type { SectionId } from './sections';

/** A multiple-choice template with a numeric answer, built the same way as the original generator's templates. */
export interface AuMcq {
  id: string;
  section: SectionId;
  skill: string;
  /** Can the same question be asked as "type the number"? */
  typeable: boolean;
  build: (r: Rng, tier: Tier) => Built;
}

export interface TypedBuilt {
  text: string;
  asks: string;
  concept: string;
  steps: string[];
  /** The correct answer as it should read in the explanation. */
  answer: string;
  mistake: string;
  tip: string;
  verify?: string | null;
  /** answer_data for the question type. */
  def: unknown;
}

export type OtherKind = Exclude<QuestionType, 'MCQ' | 'NUMERIC_INPUT'>;
export interface TypedTemplate {
  id: string;
  section: SectionId;
  skill: string;
  kind: OtherKind;
  build: (r: Rng, tier: Tier) => TypedBuilt;
}
