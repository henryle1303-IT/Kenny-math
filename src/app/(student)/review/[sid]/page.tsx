import { getStudent } from '@/lib/services/core';
import { notFound } from 'next/navigation';
import katex from 'katex';
import { AppError } from '@/lib/services/attempts';
import { getReviewSession } from '@/lib/services/review';
import { ReviewRunner } from '@/components/ReviewRunner';

export const dynamic = 'force-dynamic';

function html(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .split(/(\\\(.+?\\\))/gs)
    .map((p) => {
      const m = /^\\\((.+)\\\)$/s.exec(p);
      if (!m) return esc(p).replace(/\n/g, '<br/>');
      try {
        return katex.renderToString(m[1], { throwOnError: false, strict: 'ignore' });
      } catch {
        return esc(m[1]);
      }
    })
    .join('');
}

export default async function SessionPage({ params }: { params: Promise<{ sid: string }> }) {
  const student = await getStudent();
  const { sid } = await params;
  let s;
  try {
    s = await getReviewSession(sid, student.id);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  return (
    <ReviewRunner
      studentName={student.name}
      sessionId={s.id}
      kind={s.kind}
      sourceQuestionId={s.sourceQuestionId}
      questions={s.questions.map((q) => ({
        id: q.id, position: q.position, skillLabel: q.skillLabel, tier: q.tier, topic: q.topic,
        textHtml: html(q.text), optionsHtml: q.options.map(html), optionsText: q.options,
        selected: q.selected, correct: q.correct, isCorrect: q.isCorrect, explanation: q.explanation, commonMistake: q.commonMistake, learningTip: q.learningTip,
      }))}
    />
  );
}
