import { TEMPLATES } from '../registry';
import { buildFromTemplate, fingerprintOf, finishBuilt, formatExplanation, skeletonOf } from '../engine';
import type { Built, Template, Tier } from '../types';
import type { Rng } from '../rng';
import type { QuestionType } from '../../question-types';
import { displayCorrect } from '../../question-types';
import { AU_MCQ } from './mcq';
import { AU_TYPED } from './typed';
import { NOT_TYPEABLE, REUSED, SECTIONS, type SectionId } from './sections';
import type { AuMcq, TypedTemplate } from './types';

/** One finished question, before it gets an id and position. */
export interface AuQuestion {
  templateId: string;
  section: SectionId;
  skill: string;
  questionType: QuestionType;
  text: string;
  options: [string, string, string, string];
  correctAnswer: string;
  answerData: string | null;
  explanation: string;
  commonMistake: string;
  learningTip: string;
  verifyExpr: string | null;
  fingerprint: string;
  skeleton: string;
}

const byId = new Map<string, Template>(TEMPLATES.map((t) => [t.id, t]));

/** Every source of multiple choice and typed-number questions: reused generator templates plus the new Australian ones. */
export interface McqSource {
  id: string;
  section: SectionId;
  skill: string;
  typeable: boolean;
  /** MCQ build */
  mcq: (r: Rng, tier: Tier) => AuQuestion;
  /** Built (numeric answer) for conversion to NUMERIC_INPUT */
  built: (r: Rng, tier: Tier) => Built;
}

function mcqQuestion(id: string, section: SectionId, skill: string, b: Built, r: Rng, tier: Tier): AuQuestion {
  const g = finishBuilt(id, b, r, skill, 'Whole Numbers', tier);
  return {
    templateId: id, section, skill, questionType: 'MCQ', text: g.text, options: g.options, correctAnswer: g.correct, answerData: null,
    explanation: g.explanation, commonMistake: g.commonMistake, learningTip: g.learningTip, verifyExpr: g.verifyExpr, fingerprint: g.fingerprint, skeleton: g.skeleton,
  };
}

export const MCQ_SOURCES: McqSource[] = [
  ...SECTIONS.flatMap((s) =>
    REUSED[s.id].map((tid): McqSource => {
      const t = byId.get(tid);
      if (!t) throw new Error(`Unknown generator template ${tid}`);
      const clampTier = (tier: Tier) => Math.min(t.tiers[1], Math.max(t.tiers[0], tier)) as Tier;
      return {
        id: tid, section: s.id, skill: t.skill, typeable: !NOT_TYPEABLE.has(tid),
        mcq: (r, tier) => {
          const g = buildFromTemplate(t, r, tier);
          return { templateId: tid, section: s.id, skill: t.skill, questionType: 'MCQ', text: g.text, options: g.options, correctAnswer: g.correct, answerData: null, explanation: g.explanation, commonMistake: g.commonMistake, learningTip: g.learningTip, verifyExpr: g.verifyExpr, fingerprint: g.fingerprint, skeleton: g.skeleton };
        },
        built: (r, tier) => t.build(r, clampTier(tier)),
      };
    }),
  ),
  ...AU_MCQ.map((t: AuMcq): McqSource => ({
    id: t.id, section: t.section, skill: t.skill, typeable: t.typeable,
    mcq: (r, tier) => mcqQuestion(t.id, t.section, t.skill, t.build(r, tier), r, tier),
    built: (r, tier) => t.build(r, tier),
  })),
];

// ---- numeric conversion -------------------------------------------------------------------------------------
const UNIT_OK = /^(cm|mm|m|km|g|kg|ml|l|litres?|metres?|hours?|minutes?|seconds?|days?|tonnes?|t|squares?|students?|degrees|cm²|m²|km²|cm³|m³|°)$/i;

export function numericDef(correct: string, text: string): { def: Record<string, unknown> } | null {
  const c = correct.trim();
  const simplest = /simplest form/i.test(text);
  let mm = /^\\\((\d+)\\frac\{(\d+)\}\{(\d+)\}\\\)$/.exec(c);
  if (mm) {
    const [w, n, d] = [Number(mm[1]), Number(mm[2]), Number(mm[3])];
    return { def: { accepted: [`${w} ${n}/${d}`, `${w * d + n}/${d}`], format: 'mixed', ...(simplest ? { requireSimplified: true } : {}) } };
  }
  mm = /^\\\(\\frac\{(\d+)\}\{(\d+)\}\\\)$/.exec(c);
  if (mm) return { def: { accepted: [`${mm[1]}/${mm[2]}`], format: 'fraction', ...(simplest ? { requireSimplified: true } : {}) } };
  mm = /^\\\((\d+)\\\)$/.exec(c);
  if (mm) return { def: { accepted: [mm[1]] } };
  mm = /^\$([\d,]+(?:\.\d+)?)$/.exec(c);
  if (mm) return { def: { accepted: [mm[1].replace(/,/g, '')] } };
  mm = /^(-?[\d,]+(?:\.\d+)?)$/.exec(c);
  if (mm) return { def: { accepted: [mm[1].replace(/,/g, '')] } };
  mm = /^([\d,]+(?:\.\d+)?) ?(\S+)$/.exec(c);
  if (mm && UNIT_OK.test(mm[2])) return { def: { accepted: [mm[1].replace(/,/g, '')], unit: mm[2] } };
  return null;
}

export function numericQuestion(src: McqSource, r: Rng, tier: Tier): AuQuestion | null {
  const b = src.built(r, tier);
  const d = numericDef(b.correct, b.text);
  if (!d) return null;
  return {
    templateId: `${src.id}#number`, section: src.section, skill: src.skill, questionType: 'NUMERIC_INPUT', text: b.text, options: ['', '', '', ''], correctAnswer: '',
    answerData: JSON.stringify(d.def), explanation: formatExplanation(b, b.correct), commonMistake: b.mistake, learningTip: b.tip, verifyExpr: b.verify,
    fingerprint: fingerprintOf(b.text, b.correct), skeleton: skeletonOf(b.text),
  };
}

export function typedQuestion(t: TypedTemplate, r: Rng, tier: Tier): AuQuestion {
  const b = t.build(r, tier);
  const answerData = JSON.stringify(b.def);
  return {
    templateId: t.id, section: t.section, skill: t.skill, questionType: t.kind, text: b.text, options: ['', '', '', ''], correctAnswer: '', answerData,
    explanation: formatExplanation(b, b.answer), commonMistake: b.mistake, learningTip: b.tip, verifyExpr: b.verify ?? null,
    fingerprint: fingerprintOf(b.text, `${displayCorrect({ questionType: t.kind, answerData, correctAnswer: '' })}|${answerData}`), skeleton: skeletonOf(b.text),
  };
}

export const TYPED_SOURCES = AU_TYPED;
