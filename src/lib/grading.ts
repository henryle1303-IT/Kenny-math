export interface GradeInput {
  questionId: string;
  correctAnswer: string;
  topic: string;
  difficulty: number;
  selected: string | null;
}

export interface Breakdown {
  key: string;
  total: number;
  correct: number;
  accuracy: number;
}

export interface GradeResult {
  score: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  percentage: number;
  byTopic: Breakdown[];
  byDifficulty: Breakdown[];
  perQuestion: { questionId: string; isCorrect: boolean | null }[];
}

/** 1 point per correct answer, nothing for wrong or blank answers. No negative marking. */
export function gradeAnswers(items: GradeInput[]): GradeResult {
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  const topic = new Map<string, Breakdown>();
  const diff = new Map<string, Breakdown>();
  const bump = (m: Map<string, Breakdown>, key: string, ok: boolean) => {
    const b = m.get(key) ?? { key, total: 0, correct: 0, accuracy: 0 };
    b.total++;
    if (ok) b.correct++;
    b.accuracy = b.correct / b.total;
    m.set(key, b);
  };
  const perQuestion: GradeResult['perQuestion'] = [];
  for (const it of items) {
    const answered = it.selected !== null && it.selected !== '';
    const ok = answered && it.selected === it.correctAnswer;
    if (!answered) unanswered++;
    else if (ok) correct++;
    else incorrect++;
    perQuestion.push({ questionId: it.questionId, isCorrect: answered ? ok : null });
    bump(topic, it.topic, ok);
    bump(diff, String(it.difficulty), ok);
  }
  const total = items.length;
  return {
    score: correct,
    correct,
    incorrect,
    unanswered,
    total,
    percentage: total ? Math.round((correct / total) * 1000) / 10 : 0,
    byTopic: [...topic.values()].sort((a, b) => a.key.localeCompare(b.key)),
    byDifficulty: [...diff.values()].sort((a, b) => Number(a.key) - Number(b.key)),
    perQuestion,
  };
}

/** Seconds used: from start until submission, never more than the time limit. */
export function timeUsedSeconds(startedAt: Date, submittedAt: Date, expiresAt: Date): number {
  const end = Math.min(submittedAt.getTime(), expiresAt.getTime());
  return Math.max(0, Math.round((end - startedAt.getTime()) / 1000));
}

export function remainingMs(expiresAt: Date | number, now: Date | number = Date.now()): number {
  const e = typeof expiresAt === 'number' ? expiresAt : expiresAt.getTime();
  const n = typeof now === 'number' ? now : now.getTime();
  return Math.max(0, e - n);
}

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= expiresAt.getTime();
}

export function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function starsFor(percentage: number): 0 | 1 | 2 | 3 {
  return percentage >= 90 ? 3 : percentage >= 75 ? 2 : percentage >= 50 ? 1 : 0;
}
