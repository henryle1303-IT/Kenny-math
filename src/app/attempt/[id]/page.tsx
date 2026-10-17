import { getStudent, getLang } from '@/lib/services/core';
import { redirect } from 'next/navigation';
import katex from 'katex';
import { getAttemptForTaking, AppError } from '@/lib/services/attempts';
import { TestRunner } from '@/components/TestRunner';
import type { ClientView } from '@/components/QuestionInput';
import { BLANK_RE, type StudentView } from '@/lib/question-types';

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

function toClientView(v: StudentView): ClientView {
  switch (v.type) {
    case 'MCQ': return { type: 'MCQ', optionsHtml: v.options.map(html) };
    case 'MULTI_SELECT': return { type: 'MULTI_SELECT', optionsHtml: v.options.map(html) };
    case 'TRUE_FALSE': return { type: 'TRUE_FALSE', statementsHtml: v.statements.map(html) };
    case 'ORDERING': return { type: 'ORDERING', items: v.items.map((x) => ({ index: x.index, html: html(x.text) })) };
    default: return v;
  }
}

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const student = await getStudent();
  const lang = await getLang();
  const { id } = await params;
  let data;
  try {
    data = await getAttemptForTaking(id, student.id);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) return <div className="p-8 text-center">This test could not be found. <a className="underline" href="/tests">Back to tests</a></div>;
    throw e;
  }
  if (data.finished) redirect(`/results/${id}`);
  return (
    <TestRunner
      attemptId={data.attemptId}
      title={data.title}
      expiresAt={data.expiresAt}
      serverNow={data.serverNow}
      initialAnswers={data.answers}
      lang={lang}
      questions={data.questions.map((q) => ({ id: q.id, number: q.number, textHtml: html(q.view.type === 'FILL_BLANK' ? q.text.replace(BLANK_RE, '[ $1 ]') : q.text), view: toClientView(q.view) }))}
    />
  );
}

export async function generateMetadata() {
  const student = await getStudent(); const lang = await getLang();
  return { title: lang === 'vi' ? `Thử thách Toán của ${student.name}` : `${student.name} Math Challenge` };
}
