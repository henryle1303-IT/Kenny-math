import Papa from 'papaparse';
import { z } from 'zod';
import { ALL_COLUMNS, CORE_COLUMNS } from './columns';
import { unsanitizeCell } from './export';
import type { QuestionData } from '../validate/question';

export { MAX_UPLOAD_BYTES } from './limits';

export interface DecodedText {
  text: string;
  encoding: string;
}

/** Detect the text encoding (BOM, UTF-8, UTF-16, fall back to Windows-1252) and decode. */
export function decodeCsvBytes(bytes: Uint8Array): DecodedText {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'UTF-8 (with BOM)' };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'UTF-16 LE' };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'UTF-16 BE' };
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'UTF-8' };
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'Windows-1252 (fallback)' };
  }
}

export interface ParsedCsv {
  encoding: string;
  headers: string[];
  rows: Record<string, string>[];
  parseErrors: string[];
  delimiter: string;
}

export function parseCsvText(text: string, encoding = 'UTF-8'): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: 'greedy',
    comments: '#',
    transformHeader: (h) => h.replace(/^﻿/, '').trim().toLowerCase(),
  });
  const parseErrors = result.errors
    .filter((e) => e.type !== 'Delimiter' || result.data.length === 0)
    .map((e) => `CSV parse problem${e.row !== undefined ? ` near row ${e.row + 1}` : ''}: ${e.message}`);
  return {
    encoding,
    headers: result.meta.fields ?? [],
    rows: result.data,
    parseErrors,
    delimiter: result.meta.delimiter,
  };
}

export function parseCsvBytes(bytes: Uint8Array): ParsedCsv {
  if (bytes.includes(0) && !(bytes[0] === 0xff || bytes[0] === 0xfe)) {
    return { encoding: 'binary', headers: [], rows: [], parseErrors: ['This does not look like a text CSV file (binary content detected).'], delimiter: ',' };
  }
  const { text, encoding } = decodeCsvBytes(bytes);
  return parseCsvText(text, encoding);
}

const intStr = z.string().trim().regex(/^\d+$/, 'must be a whole number');

export const rowSchema = z.object({
  question_id: z.string().trim().min(1, 'question_id is required').max(64),
  test_id: intStr,
  question_number: intStr,
  test_level: z.string().trim().min(1, 'test_level is required'),
  difficulty: intStr,
  topic: z.string().trim().min(1, 'topic is required').max(80),
  skill: z.string().trim().min(1, 'skill is required').max(80),
  question_text: z.string().trim().min(1, 'question_text is required').max(4000),
  option_a: z.string().trim().min(1, 'option_a is required').max(500),
  option_b: z.string().trim().min(1, 'option_b is required').max(500),
  option_c: z.string().trim().min(1, 'option_c is required').max(500),
  option_d: z.string().trim().min(1, 'option_d is required').max(500),
  correct_answer: z.string().trim().toUpperCase().regex(/^[ABCD]$/, 'correct_answer must be A, B, C or D'),
  explanation: z.string().trim().min(1, 'explanation is required').max(8000),
  common_mistake: z.string().trim().min(1, 'common_mistake is required').max(1000),
  learning_tip: z.string().trim().min(1, 'learning_tip is required').max(1000),
  bank_id: z.string().optional(),
  bank_version: z.string().optional(),
  verify_expr: z.string().max(500).optional(),
  validation_status: z.string().optional(),
});

export interface ParsedRow {
  row: number; // 1-based data row (header and comment lines are not counted)
  data: QuestionData;
}
export interface RowProblem {
  row: number;
  questionId: string;
  message: string;
  code: string;
}

export interface MappedCsv {
  missingColumns: string[];
  unknownColumns: string[];
  rows: ParsedRow[];
  problems: RowProblem[];
  skippedExamples: number;
}

/** Validate columns and coerce each row to QuestionData. Rows that cannot be coerced are reported in `problems`. */
export function mapCsvRows(parsed: ParsedCsv, opts: { includeExamples?: boolean } = {}): MappedCsv {
  const missingColumns = CORE_COLUMNS.filter((c) => !parsed.headers.includes(c));
  const unknownColumns = parsed.headers.filter((h) => h && !(ALL_COLUMNS as readonly string[]).includes(h));
  const rows: ParsedRow[] = [];
  const problems: RowProblem[] = [];
  let skippedExamples = 0;
  if (missingColumns.length) return { missingColumns: [...missingColumns], unknownColumns, rows, problems, skippedExamples };

  parsed.rows.forEach((raw, idx) => {
    const row = idx + 1;
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) clean[k] = typeof v === 'string' ? unsanitizeCell(v) : '';
    if (!opts.includeExamples && /^example-/i.test((clean.question_id ?? '').trim())) {
      skippedExamples++;
      return;
    }
    const res = rowSchema.safeParse(clean);
    if (!res.success) {
      for (const issue of res.error.issues) {
        problems.push({ row, questionId: clean.question_id ?? '', code: issue.message.includes('required') ? 'MISSING_FIELD' : 'BAD_VALUE', message: `${issue.path.join('.') || 'row'}: ${issue.message}` });
      }
      return;
    }
    const d = res.data;
    rows.push({
      row,
      data: {
        questionId: d.question_id,
        testNumber: Number(d.test_id),
        position: Number(d.question_number),
        level: d.test_level.charAt(0).toUpperCase() + d.test_level.slice(1).toLowerCase(),
        difficulty: Number(d.difficulty),
        topic: d.topic,
        skill: d.skill,
        questionText: d.question_text,
        options: [d.option_a, d.option_b, d.option_c, d.option_d],
        correctAnswer: d.correct_answer,
        explanation: d.explanation,
        commonMistake: d.common_mistake,
        learningTip: d.learning_tip,
        verifyExpr: d.verify_expr?.trim() ? d.verify_expr.trim() : null,
      },
    });
  });
  return { missingColumns: [], unknownColumns, rows, problems, skippedExamples };
}
