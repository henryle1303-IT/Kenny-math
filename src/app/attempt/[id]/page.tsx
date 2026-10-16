import { redirect } from 'next/navigation';
import katex from 'katex';
import { getAttemptForTaking, AppError } from '@/lib/services/attempts';
import { TestRunner } from '@/components/TestRunner';

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

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data;
  try {
    data = await getAttemptForTaking(id);
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
      questions={data.questions.map((q) => ({ id: q.id, number: q.number, textHtml: html(q.text), optionsHtml: q.options.map(html) }))}
    />
  );
}
