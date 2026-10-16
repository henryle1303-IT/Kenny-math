import { describe, expect, it } from 'vitest';
import { formatDuration, gradeAnswers, isExpired, remainingMs, starsFor, timeUsedSeconds } from '@/lib/grading';

const item = (id: string, correct: string, selected: string | null, topic = 'Fractions', difficulty = 1) => ({ questionId: id, correctAnswer: correct, selected, topic, difficulty });

describe('gradeAnswers', () => {
  it('scores 1 per correct answer and never goes negative', () => {
    const r = gradeAnswers([item('1', 'A', 'A'), item('2', 'B', 'C'), item('3', 'D', null), item('4', 'C', 'C', 'Geometry', 3)]);
    expect(r).toMatchObject({ score: 2, correct: 2, incorrect: 1, unanswered: 1, total: 4, percentage: 50 });
    expect(r.perQuestion.map((p) => p.isCorrect)).toEqual([true, false, null, true]);
  });
  it('breaks results down by topic and difficulty', () => {
    const r = gradeAnswers([item('1', 'A', 'A'), item('2', 'A', 'B'), item('3', 'A', 'A', 'Geometry', 2)]);
    expect(r.byTopic.find((t) => t.key === 'Fractions')).toMatchObject({ total: 2, correct: 1, accuracy: 0.5 });
    expect(r.byDifficulty.map((d) => d.key)).toEqual(['1', '2']);
  });
  it('handles an empty test', () => {
    expect(gradeAnswers([]).percentage).toBe(0);
  });
});

describe('timer helpers', () => {
  const start = new Date('2026-01-01T10:00:00Z');
  const expires = new Date(start.getTime() + 30 * 60_000);
  it('computes remaining time from the persisted expiry', () => {
    expect(remainingMs(expires, new Date(start.getTime() + 10 * 60_000))).toBe(20 * 60_000);
    expect(remainingMs(expires, new Date(expires.getTime() + 5000))).toBe(0);
  });
  it('detects expiry', () => {
    expect(isExpired(expires, new Date(start.getTime() + 29 * 60_000))).toBe(false);
    expect(isExpired(expires, expires)).toBe(true);
  });
  it('caps time used at the limit', () => {
    expect(timeUsedSeconds(start, new Date(start.getTime() + 125_000), expires)).toBe(125);
    expect(timeUsedSeconds(start, new Date(expires.getTime() + 600_000), expires)).toBe(1800);
  });
  it('formats durations and stars', () => {
    expect(formatDuration(125)).toBe('2:05');
    expect([95, 80, 55, 20].map(starsFor)).toEqual([3, 2, 1, 0]);
  });
});
