import { Rng, hashString } from './rng';
import { TEMPLATES, templatesFor } from './registry';
import { buildFromTemplate } from './engine';
import { QUESTIONS_PER_TEST, TEST_COUNT, TOPIC_WEIGHTS, levelOf, ratingFor } from './curriculum';
import type { GeneratedQuestion, Template, Tier, Topic } from './types';
import { TOPICS } from './types';

export const DEFAULT_BANK_SEED = 'kenny-grade5-v1';

export interface Slot {
  testNumber: number;
  position: number;
  rating: Tier;
  topic: Topic;
  templateId: string;
}

export function questionIdFor(testNumber: number, position: number): string {
  return `T${String(testNumber).padStart(2, '0')}-Q${String(position).padStart(2, '0')}`;
}

function minTierOfTopic(topic: Topic): number {
  return Math.min(...TEMPLATES.filter((t) => t.topic === topic).map((t) => t.tiers[0]));
}

/** Decide which topic goes at which position of one test, respecting difficulty and weights. */
function planTopics(rng: Rng, testNumber: number): Topic[] {
  const ratings = Array.from({ length: QUESTIONS_PER_TEST }, (_, i) => ratingFor(testNumber, i + 1));
  const remaining = new Map<Topic, number>(TOPICS.map((t) => [t, TOPIC_WEIGHTS[t]]));
  const result: Topic[] = new Array(QUESTIONS_PER_TEST);
  const minT = new Map<Topic, number>(TOPICS.map((t) => [t, minTierOfTopic(t)]));
  for (let p = QUESTIONS_PER_TEST; p >= 1; p--) {
    const rating = ratings[p - 1];
    const cands = TOPICS.filter((t) => (remaining.get(t) ?? 0) > 0 && rating >= (minT.get(t) ?? 1));
    // Hall-style feasibility: slots needing tier >= k must still fit into positions with rating >= k.
    let mustK = 0;
    for (let k = 5; k >= 2; k--) {
      const need = TOPICS.reduce((s, t) => s + ((minT.get(t) ?? 1) >= k ? remaining.get(t) ?? 0 : 0), 0);
      let cap = 0;
      for (let q = 1; q <= p; q++) if (ratings[q - 1] >= k) cap++;
      if (need > 0 && need >= cap) {
        mustK = k;
        break;
      }
    }
    const forced = mustK ? cands.filter((t) => (minT.get(t) ?? 1) >= mustK) : [];
    const pool = forced.length ? forced : cands;
    const prev = result[p]; // the topic placed at p+1
    const nonRepeat = pool.filter((t) => t !== prev);
    const finalPool = nonRepeat.length ? nonRepeat : pool;
    // weight by remaining count
    const bag: Topic[] = [];
    for (const t of finalPool) for (let i = 0; i < (remaining.get(t) ?? 0); i++) bag.push(t);
    const chosen = rng.pick(bag);
    result[p - 1] = chosen;
    remaining.set(chosen, (remaining.get(chosen) ?? 0) - 1);
  }
  return result;
}

/** Deterministic plan for the whole bank (balanced use of templates). */
export function planBank(seed: string = DEFAULT_BANK_SEED): Slot[] {
  const usage = new Map<string, number>();
  const slots: Slot[] = [];
  for (let t = 1; t <= TEST_COUNT; t++) {
    const rng = new Rng(`${seed}|plan|${t}`);
    const topics = planTopics(rng, t);
    const skillsInTest = new Set<string>();
    const templatesInTest = new Set<string>();
    for (let p = 1; p <= QUESTIONS_PER_TEST; p++) {
      const rating = ratingFor(t, p);
      const topic = topics[p - 1];
      let cands = templatesFor(topic, rating);
      if (!cands.length) cands = TEMPLATES.filter((x) => x.topic === topic);
      const scored = cands.map((c) => ({
        c,
        score: (usage.get(c.id) ?? 0) + (skillsInTest.has(c.skill) ? 3 : 0) + (templatesInTest.has(c.id) ? 3 : 0) + rng.next() * 0.9,
      }));
      scored.sort((a, b) => a.score - b.score);
      const pick = scored[0].c;
      usage.set(pick.id, (usage.get(pick.id) ?? 0) + 1);
      skillsInTest.add(pick.skill);
      templatesInTest.add(pick.id);
      slots.push({ testNumber: t, position: p, rating, topic, templateId: pick.id });
    }
  }
  return slots;
}

export interface GeneratedSlotQuestion extends GeneratedQuestion {
  questionId: string;
  testNumber: number;
  position: number;
  level: string;
  difficulty: number;
}

const templateById = new Map<string, Template>(TEMPLATES.map((t) => [t.id, t]));

/**
 * Generate the question for one slot. `taken` holds fingerprints of questions already in the bank,
 * so every question in the bank is different.
 */
export function generateForSlot(seed: string, slot: Slot, taken: Set<string>, variant = 0): GeneratedSlotQuestion {
  const base = templateById.get(slot.templateId);
  if (!base) throw new Error(`Unknown template ${slot.templateId}`);
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    // after many failures fall back to other templates of the same topic
    const t =
      attempt < 40
        ? base
        : (() => {
            const alts = templatesFor(slot.topic, slot.rating);
            return alts[attempt % alts.length] ?? base;
          })();
    const rng = new Rng(`${seed}|T${slot.testNumber}|Q${slot.position}|v${variant}|a${attempt}`);
    try {
      const q = buildFromTemplate(t, rng, slot.rating);
      if (taken.has(q.fingerprint)) continue;
      return {
        ...q,
        questionId: questionIdFor(slot.testNumber, slot.position),
        testNumber: slot.testNumber,
        position: slot.position,
        level: levelOf(slot.testNumber),
        difficulty: slot.rating,
      };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Could not generate a unique question for test ${slot.testNumber} #${slot.position}: ${(lastErr as Error)?.message ?? 'duplicates'}`);
}

export function seedFor(bankSeed: string, extra: string): string {
  return `${bankSeed}~${hashString(extra)}`;
}
