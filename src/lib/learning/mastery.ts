export type Mastery = 'NOT_ENOUGH_DATA' | 'NEEDS_PRACTICE' | 'DEVELOPING' | 'IMPROVING' | 'MASTERED';

export const MASTERY_LABELS: Record<Mastery, string> = {
  NOT_ENOUGH_DATA: 'Not Enough Data',
  NEEDS_PRACTICE: 'Needs Practice',
  DEVELOPING: 'Developing',
  IMPROVING: 'Improving',
  MASTERED: 'Mastered',
};

export interface LearningConfig {
  /** Attempts needed before a status other than “Not Enough Data” is given. */
  minAttempts: number;
  /** Recent window (latest N attempts of a skill). */
  window: number;
  /** Evidence needed for Mastered. */
  masteryMinAttempts: number;
  masteryMinSessions: number;
  /** Spaced review intervals in days. */
  intervals: { afterIncorrect: number; afterCorrectOnce: number; afterCorrectTwice: number; afterConsistent: number };
}

export const DEFAULT_CONFIG: LearningConfig = {
  minAttempts: 3,
  window: 10,
  masteryMinAttempts: 5,
  masteryMinSessions: 2,
  intervals: { afterIncorrect: 0, afterCorrectOnce: 1, afterCorrectTwice: 3, afterConsistent: 7 },
};

export interface SkillEventLite {
  isCorrect: boolean;
  sessionKey: string;
  createdAt: Date;
}

export interface SkillState {
  totalAttempts: number;
  totalCorrect: number;
  recentAccuracy: number | null;
  recentCount: number;
  recentWrong: number;
  sessionCount: number;
  mastery: Mastery;
  streakSessions: number;
  lastEventAt: Date | null;
  nextReviewDate: Date | null;
}

export function masteryFor(accuracy: number | null, attempts: number, sessions: number, cfg: LearningConfig = DEFAULT_CONFIG): Mastery {
  if (accuracy === null || attempts < cfg.minAttempts) return 'NOT_ENOUGH_DATA';
  if (accuracy < 0.5) return 'NEEDS_PRACTICE';
  if (accuracy < 0.7) return 'DEVELOPING';
  if (accuracy < 0.85) return 'IMPROVING';
  return attempts >= cfg.masteryMinAttempts && sessions >= cfg.masteryMinSessions ? 'MASTERED' : 'IMPROVING';
}

export function intervalDays(streak: number, cfg: LearningConfig = DEFAULT_CONFIG): number {
  if (streak <= 0) return cfg.intervals.afterIncorrect;
  if (streak === 1) return cfg.intervals.afterCorrectOnce;
  if (streak === 2) return cfg.intervals.afterCorrectTwice;
  return cfg.intervals.afterConsistent;
}

/** Compute a skill's state from all its events (any order). */
export function computeSkillState(eventsIn: SkillEventLite[], cfg: LearningConfig = DEFAULT_CONFIG): SkillState {
  const events = eventsIn.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const totalAttempts = events.length;
  const totalCorrect = events.filter((e) => e.isCorrect).length;
  const recent = events.slice(-cfg.window);
  const recentCount = recent.length;
  const recentCorrect = recent.filter((e) => e.isCorrect).length;
  const recentAccuracy = recentCount ? recentCorrect / recentCount : null;
  const sessionCount = new Set(recent.map((e) => e.sessionKey)).size;

  // A session counts as "correct" for spaced review if every attempt in it was correct.
  const order: string[] = [];
  const ok = new Map<string, boolean>();
  for (const e of events) {
    if (!ok.has(e.sessionKey)) {
      ok.set(e.sessionKey, true);
      order.push(e.sessionKey);
    }
    if (!e.isCorrect) ok.set(e.sessionKey, false);
  }
  let streak = 0;
  for (let i = order.length - 1; i >= 0 && ok.get(order[i]); i--) streak++;

  const lastEventAt = events.length ? events[events.length - 1].createdAt : null;
  const nextReviewDate = lastEventAt ? new Date(lastEventAt.getTime() + intervalDays(streak, cfg) * 86_400_000) : null;
  return {
    totalAttempts,
    totalCorrect,
    recentAccuracy,
    recentCount,
    recentWrong: recentCount - recentCorrect,
    sessionCount,
    mastery: masteryFor(recentAccuracy, recentCount, sessionCount, cfg),
    streakSessions: streak,
    lastEventAt,
    nextReviewDate,
  };
}
