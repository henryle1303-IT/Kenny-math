/** Normalisation shared by every typed (free text) answer. Applied to both the student's input and the accepted answers. */
export interface TextOptions {
  caseSensitive?: boolean;
  ignoreDiacritics?: boolean;
}

export function normalizeText(s: string, opts: TextOptions = {}): string {
  let out = s.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (opts.ignoreDiacritics) out = out.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFC');
  if (!opts.caseSensitive) out = out.toLowerCase();
  return out;
}

export function textMatches(input: string, accepted: string[], opts: TextOptions = {}): boolean {
  const a = normalizeText(input, opts);
  if (!a) return false;
  return accepted.some((x) => normalizeText(x, opts) === a);
}
