import { RichText } from './RichText';

const LABELS: [RegExp, string][] = [
  [/^what it asks:\s*/i, 'What is it asking?'],
  [/^concept:\s*/i, 'The maths idea'],
];

/** Shows the structured explanation: asks, concept, steps, answer, common mistake and tip. */
export function Explanation({ explanation, commonMistake, learningTip }: { explanation: string; commonMistake?: string | null; learningTip?: string | null }) {
  const lines = explanation.split('\n').map((l) => l.trim()).filter(Boolean);
  const head: { title: string; body: string }[] = [];
  const steps: string[] = [];
  let answer = '';
  const other: string[] = [];
  for (const l of lines) {
    const lab = LABELS.find(([re]) => re.test(l));
    if (lab) head.push({ title: lab[1], body: l.replace(lab[0], '') });
    else if (/^step\s*\d+:/i.test(l)) steps.push(l.replace(/^step\s*\d+:\s*/i, ''));
    else if (/^answer:/i.test(l)) answer = l.replace(/^answer:\s*/i, '');
    else other.push(l);
  }
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-sky-50 p-4 text-[15px] leading-relaxed ring-1 ring-sky-200">
      {head.map((h) => (
        <div key={h.title}>
          <div className="text-xs font-bold uppercase tracking-wide text-sky-700">{h.title}</div>
          <RichText text={h.body} />
        </div>
      ))}
      {(steps.length > 0 || other.length > 0) && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-sky-700">Step by step</div>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {steps.map((s, i) => (
              <li key={i}><RichText text={s} /></li>
            ))}
            {other.map((s, i) => (
              <li key={`o${i}`} className="list-none -ml-5"><RichText text={s} /></li>
            ))}
          </ol>
        </div>
      )}
      {answer && (
        <div className="rounded-lg bg-white px-3 py-2 font-semibold text-emerald-700 ring-1 ring-emerald-200">
          Answer: <RichText text={answer} />
        </div>
      )}
      {commonMistake && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
          <span className="font-semibold text-amber-800">Watch out: </span><RichText text={commonMistake} />
        </div>
      )}
      {learningTip && (
        <div className="rounded-lg bg-violet-50 px-3 py-2 ring-1 ring-violet-200">
          <span className="font-semibold text-violet-800">Tip: </span><RichText text={learningTip} />
        </div>
      )}
    </div>
  );
}
