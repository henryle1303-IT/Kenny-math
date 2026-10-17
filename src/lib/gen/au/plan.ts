import { QUESTIONS_PER_TEST, TEST_COUNT, levelOf, ratingFor } from '../curriculum';
import { questionIdFor } from '../bank';
import { Rng } from '../rng';
import type { QuestionType } from '../../question-types';
import { validateQuestion, type QuestionData } from '../../validate/question';
import { MCQ_SOURCES, TYPED_SOURCES, numericQuestion, typedQuestion, type AuQuestion } from './assemble';
import { SECTIONS, TYPE_MIX, sectionLabel, type SectionId } from './sections';

export const AU_SEED = 'kenny-au-y5-v1';

export interface AuBankRow {
  testNumber: number;
  position: number;
  level: string;
  difficulty: number;
  topic: string;
  question: AuQuestion;
}

type Kind = QuestionType;

export function toQuestionData(row: AuBankRow): QuestionData {
  const q = row.question;
  return {
    questionId: questionIdFor(row.testNumber, row.position), testNumber: row.testNumber, position: row.position, level: row.level, difficulty: row.difficulty,
    topic: row.topic, skill: q.skill, questionText: q.text, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation,
    commonMistake: q.commonMistake, learningTip: q.learningTip, verifyExpr: q.verifyExpr, questionType: q.questionType, answerData: q.answerData,
  };
}

/** Plan and build the whole 30 x 30 bank. Deterministic for a given seed. */
export function buildAuBank(seed: string = AU_SEED): AuBankRow[] {
  const usage = new Map<string, number>();
  const used = new Set<string>();
  const rows: AuBankRow[] = [];

  const sourcesFor = (kind: Kind, section: SectionId) => {
    if (kind === 'MCQ') return MCQ_SOURCES.filter((s) => s.section === section);
    if (kind === 'NUMERIC_INPUT') return MCQ_SOURCES.filter((s) => s.section === section && s.typeable);
    return TYPED_SOURCES.filter((s) => s.section === section && s.kind === kind);
  };
  const idOf = (kind: Kind, src: { id: string }) => (kind === 'NUMERIC_INPUT' ? `${src.id}#number` : src.id);
  const available = (kind: Kind, section: SectionId) => {
    const list = sourcesFor(kind, section);
    if (kind === 'SHORT_TEXT') return list.some((s) => !usage.get(s.id));
    return list.length > 0;
  };

  for (let t = 1; t <= TEST_COUNT; t++) {
    const level = levelOf(t);
    const rng = new Rng(`${seed}|plan|${t}`);
    const remaining = new Map<SectionId, number>(SECTIONS.map((s) => [s.id, s.perTest]));
    const kinds: Kind[] = [];
    for (const [k, n] of Object.entries(TYPE_MIX[level])) for (let i = 0; i < (n ?? 0); i++) kinds.push(k as Kind);
    const items: { section: SectionId; kind: Kind }[] = [];
    // Scarcest types first so they still find a section.
    const scarcity = (k: Kind) => SECTIONS.filter((s) => available(k, s.id)).length;
    for (const kind of kinds.sort((a, b) => scarcity(a) - scarcity(b))) {
      let cands = SECTIONS.filter((s) => (remaining.get(s.id) ?? 0) > 0 && available(kind, s.id));
      let steal = false;
      if (!cands.length) {
        cands = SECTIONS.filter((s) => available(kind, s.id));
        steal = true;
      }
      const bag: SectionId[] = [];
      for (const s of cands) for (let i = 0; i < Math.max(1, remaining.get(s.id) ?? 0); i++) bag.push(s.id);
      const section = rng.pick(bag);
      if (steal) {
        const donor = [...remaining.entries()].sort((a, b) => b[1] - a[1])[0][0];
        remaining.set(donor, (remaining.get(donor) ?? 0) - 1);
      } else remaining.set(section, (remaining.get(section) ?? 0) - 1);
      items.push({ section, kind });
    }
    for (const s of SECTIONS) for (let i = 0; i < Math.max(0, remaining.get(s.id) ?? 0); i++) items.push({ section: s.id, kind: 'MCQ' });
    if (items.length !== QUESTIONS_PER_TEST) throw new Error(`Test ${t}: planned ${items.length} questions`);

    let order = rng.shuffle(items);
    // avoid the same section or the same type twice in a row where possible
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < order.length; i++) {
        if (order[i].section === order[i - 1].section || (order[i].kind !== 'MCQ' && order[i].kind === order[i - 1].kind)) {
          const j = order.findIndex((x, k) => k > i && x.section !== order[i - 1].section && x.section !== order[i].section && !(x.kind !== 'MCQ' && x.kind === order[i - 1].kind) && (k + 1 >= order.length || order[k + 1].section !== order[i].section));
          if (j > 0) [order[i], order[j]] = [order[j], order[i]];
        }
      }
    }
    order = order.slice();

    const skeletonsInTest = new Map<string, number>();
    order.forEach((item, idx) => {
      const p = idx + 1;
      const rating = ratingFor(t, p);
      const list = sourcesFor(item.kind, item.section);
      if (!list.length) throw new Error(`No templates for ${item.kind} in ${item.section}`);
      let built: AuQuestion | null = null;
      for (let attempt = 0; attempt < 60 && !built; attempt++) {
        const scored = list.map((s) => ({ s, score: (usage.get(idOf(item.kind, s)) ?? 0) + (item.kind === 'SHORT_TEXT' ? 0 : new Rng(`${seed}|${t}|${p}|${attempt}|${s.id}`).next() * 1.2) }));
        scored.sort((a, b) => a.score - b.score);
        const src = scored[attempt % Math.min(3, scored.length)].s;
        const r = new Rng(`${seed}|${t}|${p}|${attempt}`);
        let q: AuQuestion | null = null;
        try {
          q = item.kind === 'MCQ' ? (src as (typeof MCQ_SOURCES)[number]).mcq(r, rating) : item.kind === 'NUMERIC_INPUT' ? numericQuestion(src as (typeof MCQ_SOURCES)[number], r, rating) : typedQuestion(src as (typeof TYPED_SOURCES)[number], r, rating);
        } catch {
          q = null;
        }
        if (!q || used.has(q.fingerprint)) continue;
        const sk = `${q.skeleton}|${q.questionType}`;
        if (attempt < 25 && (skeletonsInTest.get(sk) ?? 0) >= 1) continue;
        const row: AuBankRow = { testNumber: t, position: p, level, difficulty: rating, topic: sectionLabel(item.section), question: q };
        if (validateQuestion(toQuestionData(row)).status !== 'VERIFIED') continue;
        built = q;
        used.add(q.fingerprint);
        skeletonsInTest.set(sk, (skeletonsInTest.get(sk) ?? 0) + 1);
        usage.set(idOf(item.kind, src), (usage.get(idOf(item.kind, src)) ?? 0) + 1);
        rows.push(row);
      }
      if (!built) throw new Error(`Could not build ${item.kind} for ${item.section} at test ${t} position ${p}`);
    });
  }
  return rows;
}
