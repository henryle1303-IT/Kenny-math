import { Frac } from '../math/fraction';
import { evalExpr } from '../math/expr';
import { evaluateArithmeticQuestion, parseOptionValue } from '../math/parse';
import type { Built, GeneratedQuestion, Template, Tier } from './types';
import { Rng } from './rng';

const LETTERS = ['A', 'B', 'C', 'D'] as const;
const PAD_DELTAS = [1, -1, 2, -2, 10, -10, 5, -5, 3, -3, 100, -100, 20, -20, 4, -4];

export function skeletonOf(text: string): string {
  return text
    .replace(/\\\(.*?\\\)/g, '⟨m⟩')
    .replace(/\d+(?:[.,]\d+)*/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function fingerprintOf(text: string, correct: string): string {
  return `${text.replace(/\s+/g, ' ').trim().toLowerCase()}|${correct.replace(/\s+/g, ' ').trim().toLowerCase()}`;
}

export function normText(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function formatExplanation(b: Pick<Built, 'asks' | 'concept' | 'steps'>, correct: string): string {
  const lines = [`What it asks: ${b.asks}`, `Concept: ${b.concept}`];
  b.steps.forEach((s, i) => lines.push(`Step ${i + 1}: ${s}`));
  lines.push(`Answer: ${correct}`);
  return lines.join('\n');
}

/** Turn a template's output into a finished, verified multiple-choice question. */
export function finishBuilt(templateId: string, b: Built, r: Rng, skill: string, topic: GeneratedQuestion['topic'], tier: Tier): GeneratedQuestion {
  const correctVal = parseOptionValue(b.correct);
  if (!correctVal) throw new Error(`${templateId}: cannot parse correct option "${b.correct}"`);

  if (correctVal.cmp(0) < 0) throw new Error(`${templateId}: negative answers are not used`);
  // Independent verification of the answer.
  const expected = evalExpr(b.verify);
  if (!expected.eq(correctVal)) {
    throw new Error(`${templateId}: verify expression ${b.verify} = ${expected} but option is ${b.correct} (${correctVal})`);
  }
  if (b.check && !b.check()) throw new Error(`${templateId}: independent check failed`);
  const arith = evaluateArithmeticQuestion(b.text);
  if (arith && !arith.eq(correctVal)) throw new Error(`${templateId}: arithmetic text check disagrees`);

  // Assemble three distinct distractors.
  const seenText = new Set<string>([normText(b.correct)]);
  const seenVal: Frac[] = [correctVal];
  const wrong: string[] = [];
  const consider = (t: string): boolean => {
    const nt = normText(t);
    if (!nt || seenText.has(nt)) return false;
    const v = parseOptionValue(t);
    if (v && seenVal.some((x) => x.eq(v))) return false;
    if (v && correctVal.cmp(0) > 0 && v.cmp(0) <= 0) return false;
    seenText.add(nt);
    if (v) seenVal.push(v);
    wrong.push(t);
    return true;
  };
  for (const w of b.wrong) {
    if (wrong.length >= 3) break;
    consider(w);
  }
  if (b.pad) {
    for (const d of PAD_DELTAS) {
      if (wrong.length >= 3) break;
      consider(b.pad(d));
    }
  }
  if (wrong.length < 3) throw new Error(`${templateId}: only ${wrong.length} distractors for "${b.text}"`);

  const order = r.shuffle([b.correct, ...wrong.slice(0, 3)]);
  const correctIdx = order.indexOf(b.correct);
  return {
    templateId,
    skill,
    topic,
    tier,
    text: b.text,
    options: order as GeneratedQuestion['options'],
    correct: LETTERS[correctIdx],
    explanation: formatExplanation(b, b.correct),
    commonMistake: b.mistake,
    learningTip: b.tip,
    verifyExpr: b.verify,
    fingerprint: fingerprintOf(b.text, b.correct),
    skeleton: skeletonOf(b.text),
  };
}

export function buildFromTemplate(t: Template, r: Rng, tier: Tier): GeneratedQuestion {
  const clamped = Math.min(t.tiers[1], Math.max(t.tiers[0], tier)) as Tier;
  const b = t.build(r, clamped);
  return finishBuilt(t.id, b, r, t.skill, t.topic, clamped);
}
