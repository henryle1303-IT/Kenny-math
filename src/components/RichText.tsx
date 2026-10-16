import katex from 'katex';

/** Renders text containing inline maths written as \( ... \). Plain text is escaped by React. */
export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const parts = text.split(/(\\\(.+?\\\))/gs);
  return (
    <span className={`whitespace-pre-line ${className}`}>
      {parts.map((p, i) => {
        const m = /^\\\((.+)\\\)$/s.exec(p);
        if (!m) return <span key={i}>{p}</span>;
        let html = '';
        try {
          html = katex.renderToString(m[1], { throwOnError: false, strict: 'ignore', trust: false });
        } catch {
          return <span key={i}>{m[1]}</span>;
        }
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </span>
  );
}
