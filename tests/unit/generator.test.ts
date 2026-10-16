import { describe, expect, it } from 'vitest';
import { TEMPLATES, SKILLS, templatesFor } from '@/lib/gen/registry';
import { buildFromTemplate } from '@/lib/gen/engine';
import { Rng } from '@/lib/gen/rng';
import { TOPICS, type Tier } from '@/lib/gen/types';
import { DEFAULT_BANK_SEED, generateForSlot, planBank } from '@/lib/gen/bank';
import { QUESTIONS_PER_TEST, TEST_COUNT, TOPIC_WEIGHTS, bandOf, levelOf, ratingFor } from '@/lib/gen/curriculum';
import { validateQuestion } from '@/lib/validate/question';

describe('curriculum', () => {
  it('maps tests to levels', () => {
    expect(levelOf(1)).toBe('Beginner');
    expect(levelOf(10)).toBe('Beginner');
    expect(levelOf(11)).toBe('Intermediate');
    expect(levelOf(21)).toBe('Advanced');
    expect(levelOf(30)).toBe('Advanced');
  });
  it('bands follow the specification', () => {
    expect([1, 10, 11, 20, 21, 25, 26, 30].map(bandOf)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
  it('difficulty never decreases inside a test and rises across tests', () => {
    for (let t = 1; t <= TEST_COUNT; t++) {
      let prev = 0;
      for (let p = 1; p <= QUESTIONS_PER_TEST; p++) {
        const r = ratingFor(t, p);
        expect(r).toBeGreaterThanOrEqual(prev);
        prev = r;
      }
      expect(ratingFor(t, 30)).toBeGreaterThan(ratingFor(t, 1) - 1);
    }
    expect(ratingFor(25, 1)).toBeGreaterThan(ratingFor(5, 1));
    expect(ratingFor(30, 30)).toBe(5);
    expect(ratingFor(1, 1)).toBe(1);
  });
  it('topic weights add up to 30', () => {
    expect(Object.values(TOPIC_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(30);
  });
});

describe('templates', () => {
  it('every topic and tier has templates', () => {
    for (const t of TOPICS) expect(TEMPLATES.some((x) => x.topic === t)).toBe(true);
    for (const tier of [1, 2, 3, 4, 5] as Tier[]) for (const t of TOPICS) {
      if (tier === 1 && ['Logical Reasoning', 'Multi-step Problems', 'Reasoning Challenges'].includes(t)) continue;
      expect(templatesFor(t, tier).length, `${t} tier ${tier}`).toBeGreaterThan(0);
    }
  });
  it('template ids and skill ids are unique/consistent', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    expect(SKILLS.length).toBeGreaterThan(50);
  });
  it('every template produces verified, valid questions at every tier it supports', () => {
    for (const t of TEMPLATES) {
      for (let tier = t.tiers[0]; tier <= t.tiers[1]; tier++) {
        for (let s = 0; s < 25; s++) {
          let q;
          try {
            q = buildFromTemplate(t, new Rng(`unit-${t.id}-${tier}-${s}`), tier as Tier);
          } catch (e) {
            if (/negative answers/.test((e as Error).message)) continue;
            throw new Error(`${t.id} tier ${tier} seed ${s}: ${(e as Error).message}`);
          }
          const v = validateQuestion({
            questionId: 'T01-Q01', testNumber: 1, position: 1, level: 'Beginner', difficulty: tier, topic: q.topic, skill: q.skill, questionText: q.text,
            options: q.options, correctAnswer: q.correct, explanation: q.explanation, commonMistake: q.commonMistake, learningTip: q.learningTip, verifyExpr: q.verifyExpr,
          });
          expect(v.issues.filter((i) => i.severity === 'error'), `${t.id}: ${q.text}`).toEqual([]);
          expect(new Set(q.options).size).toBe(4);
          expect(q.explanation).toContain(q.options['ABCD'.indexOf(q.correct)]);
        }
      }
    }
  });
  it('is deterministic for a seed', () => {
    const t = TEMPLATES[0];
    const a = buildFromTemplate(t, new Rng('x'), 2);
    const b = buildFromTemplate(t, new Rng('x'), 2);
    expect(a).toEqual(b);
  });
});

describe('bank plan', () => {
  const plan = planBank(DEFAULT_BANK_SEED);
  it('has 900 slots, 30 per test, with the right topic mix', () => {
    expect(plan).toHaveLength(900);
    for (let t = 1; t <= 30; t++) {
      const slots = plan.filter((s) => s.testNumber === t);
      expect(slots).toHaveLength(30);
      for (const topic of TOPICS) expect(slots.filter((s) => s.topic === topic).length).toBe(TOPIC_WEIGHTS[topic]);
    }
  });
  it('is deterministic', () => {
    expect(planBank(DEFAULT_BANK_SEED)).toEqual(plan);
  });
  it('generates 900 distinct questions', () => {
    const taken = new Set<string>();
    const texts = new Set<string>();
    for (const s of plan) {
      const q = generateForSlot(DEFAULT_BANK_SEED, s, taken);
      expect(taken.has(q.fingerprint)).toBe(false);
      taken.add(q.fingerprint);
      texts.add(q.text);
      expect(q.difficulty).toBe(s.rating);
    }
    expect(taken.size).toBe(900);
    expect(texts.size).toBeGreaterThan(850);
  });
});
