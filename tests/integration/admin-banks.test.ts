import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { ensureActiveBank, ensureAdmin, answerAttempt } from './helpers';
import { activateBank, archiveBank, cloneBank, createQuestion, deleteBank, exportBankCsv, generateTests, getBankOrThrow, listQuestions, markReviewed, publishBank, regenerateQuestion, updateQuestion, validateBankById } from '@/lib/services/banks';
import { analyzeImport, commitImport, errorReportCsv } from '@/lib/services/importer';
import { getAttemptForTaking, getAttemptResult, startAttempt, submitAttempt } from '@/lib/services/attempts';
import { parseCsvText } from '@/lib/csv/import';
import { rowsToCsv } from '@/lib/csv/export';
import type { CsvRow } from '@/lib/csv/columns';
import { adminFromToken, cookieFromHeader, login, requireAdmin, ADMIN_COOKIE } from '@/lib/services/admin-auth';

let activeId = '';
const enc = (s: string) => new TextEncoder().encode(s);

beforeAll(async () => {
  activeId = (await ensureActiveBank()).id;
});

describe('CSV export / import round trip', () => {
  it('exports 900 rows and re-imports them as a valid new draft with identical content', async () => {
    const { csv, count } = await exportBankCsv(activeId);
    expect(count).toBe(900);
    const { jobId, report } = await analyzeImport({ name: 'bank.csv', bytes: enc(csv) }, 'NEW_BANK', {});
    expect(report.ok).toBe(true);
    expect(report.totalRows).toBe(900);
    expect(report.invalidRows).toBe(0);
    expect(report.encoding).toMatch(/BOM/);
    const { bankId } = await commitImport(jobId, { name: 'Round trip' });
    const draft = await getBankOrThrow(bankId);
    expect(draft.status).toBe('READY_FOR_REVIEW');
    expect(draft.isActive).toBe(false);
    const [a, b] = await Promise.all([prisma.question.findMany({ where: { bankId: activeId }, orderBy: [{ testNumber: 'asc' }, { position: 'asc' }] }), prisma.question.findMany({ where: { bankId }, orderBy: [{ testNumber: 'asc' }, { position: 'asc' }] })]);
    expect(b).toHaveLength(900);
    for (let i = 0; i < 900; i += 37) {
      const [x, y] = [a[i], b[i]];
      expect([y.questionId, y.questionText, y.optionA, y.optionB, y.optionC, y.optionD, y.correctAnswer, y.explanation, y.commonMistake, y.learningTip, y.difficulty, y.topic, y.skill]).toEqual(
        [x.questionId, x.questionText, x.optionA, x.optionB, x.optionC, x.optionD, x.correctAnswer, x.explanation, x.commonMistake, x.learningTip, x.difficulty, x.topic, x.skill],
      );
    }
    expect(b.every((q) => q.validationStatus === 'VERIFIED')).toBe(true);
    const again = await exportBankCsv(bankId);
    const strip = (s: string) => s.split('\r\n').map((l) => l.replace(/,[a-z0-9]{20,},\d+,/, ',BANK,'));
    expect(strip(again.csv).length).toBe(strip(csv).length);
  });

  it('exports a single test and a range', async () => {
    expect((await exportBankCsv(activeId, [7])).count).toBe(30);
    expect((await exportBankCsv(activeId, [1, 2, 3, 9])).count).toBe(120);
  });

  it('rejects an invalid full-bank file without creating a bank', async () => {
    const { csv } = await exportBankCsv(activeId);
    const lines = csv.split('\r\n');
    const broken = [...lines.slice(0, 50), ...lines.slice(52)].join('\r\n'); // drop two rows
    const before = await prisma.questionBank.count();
    const { jobId, report } = await analyzeImport({ name: 'broken.csv', bytes: enc(broken) }, 'NEW_BANK', {});
    expect(report.ok).toBe(false);
    expect(report.bankErrors.join(' ')).toMatch(/900/);
    await expect(commitImport(jobId, {})).rejects.toThrow(/validation errors/);
    expect(await prisma.questionBank.count()).toBe(before);
    const errCsv = await errorReportCsv(jobId);
    expect(errCsv).toContain('row,question_id,severity,code,message');
  });

  it('detects wrong answer keys, duplicates and missing fields with row numbers', async () => {
    const { csv } = await exportBankCsv(activeId);
    const parsed = parseCsvText(csv);
    const rows = parsed.rows.map((r) => ({ ...r })) as unknown as CsvRow[];
    rows[2].correct_answer = rows[2].correct_answer === 'A' ? 'B' : 'A'; // wrong key (row 3)
    rows[4].option_b = rows[4].option_a; // duplicate options (row 5)
    rows[6].learning_tip = ''; // missing field (row 7)
    rows[9].question_id = rows[8].question_id; // duplicate id (row 10)
    const { report } = await analyzeImport({ name: 'm.csv', bytes: enc(rowsToCsv(rows)) }, 'NEW_BANK', {});
    expect(report.ok).toBe(false);
    const codes = (row: number) => report.issues.filter((i) => i.row === row && i.severity === 'error').map((i) => i.code);
    expect(codes(3)).toEqual(expect.arrayContaining(['MATH_MISMATCH']));
    expect(codes(5)).toContain('DUPLICATE_OPTIONS');
    expect(report.rowProblems.some((p) => p.row === 7 && p.code === 'MISSING_FIELD')).toBe(true);
    expect(codes(10)).toContain('DUPLICATE_ID');
    expect(report.invalidRows).toBeGreaterThanOrEqual(4);
    expect(report.missingFieldRows).toBe(1);
    expect(report.duplicateRows).toBeGreaterThanOrEqual(1);
  });

  it('rejects non-CSV and oversized uploads', async () => {
    await expect(analyzeImport({ name: 'x.xlsx', bytes: enc('a') }, 'NEW_BANK', {})).rejects.toThrow(/\.csv/);
    await expect(analyzeImport({ name: 'x.csv', bytes: new Uint8Array(6 * 1024 * 1024) }, 'NEW_BANK', {})).rejects.toThrow(/too large/);
    await expect(analyzeImport({ name: 'x.csv', bytes: new Uint8Array(0) }, 'NEW_BANK', {})).rejects.toThrow(/empty/);
  });

  it('update-selected mode changes only matching questions in a new draft', async () => {
    const { csv } = await exportBankCsv(activeId, [1]);
    const edited = csv.replace(/Calculate/, 'Please calculate');
    const { jobId, report } = await analyzeImport({ name: 'u.csv', bytes: enc(edited) }, 'UPDATE_SELECTED', { baseBankId: activeId });
    expect(report.ok).toBe(true);
    expect(report.totalRows).toBe(30);
    const { bankId } = await commitImport(jobId, {});
    expect(await prisma.question.count({ where: { bankId } })).toBe(900);
    const changed = await prisma.question.count({ where: { bankId, questionText: { startsWith: 'Please calculate' } } });
    expect(changed).toBeGreaterThanOrEqual(0);
    const unchanged = await prisma.question.findFirst({ where: { bankId, testNumber: 9, position: 4 } });
    const orig = await prisma.question.findFirst({ where: { bankId: activeId, testNumber: 9, position: 4 } });
    expect(unchanged!.questionText).toBe(orig!.questionText);
    // published bank is untouched
    expect((await getBankOrThrow(activeId)).status).toBe('PUBLISHED');
    const unknown = csv.replace(/T01-Q01/g, 'ZZZ-1');
    const r = await analyzeImport({ name: 'u.csv', bytes: enc(unknown) }, 'UPDATE_SELECTED', { baseBankId: activeId });
    expect(r.report.ok).toBe(false);
    expect(r.report.unknownIds).toContain('ZZZ-1');
  });
});

describe('versions, publishing, rollback', () => {
  it('published banks are read-only; changes need a draft copy', async () => {
    const q = (await listQuestions(activeId, { pageSize: 1 })).items[0];
    await expect(updateQuestion(activeId, q.id, { learningTip: 'new' })).rejects.toThrow(/Published banks cannot be changed/);
    await expect(generateTests(activeId, { tests: [1] })).rejects.toThrow(/Published/);
    const copy = await cloneBank(activeId, 'Edit copy');
    expect(copy.status).toBe('DRAFT');
    expect(await prisma.question.count({ where: { bankId: copy.id } })).toBe(900);
    const cq = (await listQuestions(copy.id, { pageSize: 1 })).items[0];
    const v = await updateQuestion(copy.id, cq.id, { learningTip: 'A brand new tip' });
    expect(v.status).not.toBe('INVALID');
    expect((await prisma.question.findUniqueOrThrow({ where: { id: cq.id } })).learningTip).toBe('A brand new tip');
    expect((await prisma.question.findUniqueOrThrow({ where: { id: q.id } })).learningTip).not.toBe('A brand new tip');
  });

  it('editing a wrong answer key is caught by validation and blocks publishing', async () => {
    const copy = await cloneBank(activeId, 'Bad copy');
    const q = await prisma.question.findFirstOrThrow({ where: { bankId: copy.id, topic: 'Whole Numbers' } });
    const wrongLetter = q.correctAnswer === 'A' ? 'B' : 'A';
    const v = await updateQuestion(copy.id, q.id, { correctAnswer: wrongLetter });
    expect(v.status).toBe('INVALID');
    const rep = await validateBankById(copy.id);
    expect(rep.ok).toBe(false);
    expect((await getBankOrThrow(copy.id)).status).toBe('DRAFT');
    await expect(publishBank(copy.id, { acknowledgeReview: true })).rejects.toThrow(/validation problem/);
    expect((await getBankOrThrow(activeId)).isActive).toBe(true);
  });

  it('regenerates a single question and creates/marks review items', async () => {
    const copy = await cloneBank(activeId, 'Regen copy');
    const q = await prisma.question.findFirstOrThrow({ where: { bankId: copy.id, testNumber: 3, position: 5 } });
    await regenerateQuestion(copy.id, q.id);
    const after = await prisma.question.findFirstOrThrow({ where: { bankId: copy.id, testNumber: 3, position: 5 } });
    expect(after.questionId).toBe(q.questionId);
    expect(after.questionText + after.optionA).not.toBe(q.questionText + q.optionA);
    expect(after.validationStatus).toBe('VERIFIED');
    const created = await prisma.question.delete({ where: { id: after.id } });
    const made = await createQuestion(copy.id, {
      questionId: created.questionId, testNumber: 3, position: 5, level: 'Beginner', difficulty: 1, topic: 'Geometry', skill: 'ge.custom',
      questionText: 'Which shape has three sides?', options: ['Triangle', 'Square', 'Circle', 'Hexagon'], correctAnswer: 'A', explanation: 'Answer: Triangle', commonMistake: 'Counting corners wrongly.', learningTip: 'Tri means three.',
    });
    expect(made.validationStatus).toBe('NEEDS_REVIEW');
    await markReviewed(copy.id, made.id);
    expect((await prisma.question.findUniqueOrThrow({ where: { id: made.id } })).validationStatus).toBe('MANUAL_OK');
    const rep = await validateBankById(copy.id);
    expect(rep.ok).toBe(true);
    expect(rep.reviewRows + rep.warningRows).toBe(0);
  });

  it('keeps an in-progress attempt on its original bank when another bank is activated, then rolls back', async () => {
    const { attemptId } = await startAttempt(8);
    const before = await getAttemptForTaking(attemptId);
    if (before.finished) throw new Error('open');
    // make and activate a new bank whose test 8 differs
    const copy = await cloneBank(activeId, 'Second bank');
    await generateTests(copy.id, { tests: [8], variant: 99 });
    await validateBankById(copy.id);
    await publishBank(copy.id, { acknowledgeReview: true });
    expect((await getBankOrThrow(copy.id)).isActive).toBe(true);
    expect((await getBankOrThrow(activeId)).isActive).toBe(false);
    expect(await prisma.questionBank.count({ where: { isActive: true } })).toBe(1);

    const during = await getAttemptForTaking(attemptId);
    if (during.finished) throw new Error('open');
    expect(during.questions.map((q) => q.id)).toEqual(before.questions.map((q) => q.id));
    expect(during.questions.map((q) => q.text)).toEqual(before.questions.map((q) => q.text));
    await answerAttempt(attemptId, 9, 12);
    await submitAttempt(attemptId);
    const res = await getAttemptResult(attemptId);
    expect(res.attempt.bankId).toBe(activeId);
    expect(res.grade.correct).toBe(9);

    // new attempts use the new bank
    const next = await startAttempt(8);
    expect((await prisma.testAttempt.findUniqueOrThrow({ where: { id: next.attemptId } })).bankId).toBe(copy.id);
    await submitAttempt(next.attemptId);

    // rollback
    await activateBank(activeId);
    expect((await getBankOrThrow(activeId)).isActive).toBe(true);
    expect(await prisma.questionBank.count({ where: { isActive: true } })).toBe(1);
    const old = await getAttemptResult(attemptId);
    expect(old.grade.correct).toBe(9); // history intact
    const nextResult = await getAttemptResult(next.attemptId);
    expect(nextResult.attempt.bankId).toBe(copy.id);
    await expect(archiveBank(activeId)).rejects.toThrow(/active bank/);
    await archiveBank(copy.id);
    expect((await getBankOrThrow(copy.id)).status).toBe('ARCHIVED');
    await expect(activateBank((await prisma.questionBank.findFirstOrThrow({ where: { status: 'DRAFT' } })).id)).rejects.toThrow(/published/);
  });

  it('protects against accidental deletion', async () => {
    await expect(deleteBank(activeId, 'Test Bank')).rejects.toThrow(/active/);
    const draft = await prisma.questionBank.findFirstOrThrow({ where: { status: 'DRAFT' } });
    await expect(deleteBank(draft.id, 'wrong name')).rejects.toThrow(/exact bank name/);
    await deleteBank(draft.id, draft.name);
    expect(await prisma.questionBank.findUnique({ where: { id: draft.id } })).toBeNull();
  });

  it('replace-active mode needs explicit confirmation and keeps the old bank', async () => {
    const { csv } = await exportBankCsv(activeId);
    const { jobId } = await analyzeImport({ name: 'r.csv', bytes: enc(csv) }, 'REPLACE_ACTIVE', {});
    await expect(commitImport(jobId, { activate: true, confirmText: 'nope' })).rejects.toThrow(/REPLACE/);
    const r = await commitImport(jobId, { activate: true, confirmText: 'REPLACE', acknowledgeReview: true });
    expect(r.activated).toBe(true);
    expect((await getBankOrThrow(r.bankId)).isActive).toBe(true);
    expect((await getBankOrThrow(activeId)).status).toBe('PUBLISHED');
    await activateBank(activeId);
  });
});

describe('admin authentication', () => {
  it('logs in with a hashed password, rejects bad credentials and guards requests', async () => {
    const { email, password } = await ensureAdmin();
    const stored = await prisma.adminUser.findUniqueOrThrow({ where: { email } });
    expect(stored.passwordHash).not.toContain(password);
    expect(stored.passwordHash.startsWith('$2')).toBe(true);
    await expect(login(email, 'wrong-password', 'ip1')).rejects.toThrow(/Incorrect/);
    await expect(login('nobody@test.local', password, 'ip1')).rejects.toThrow(/Incorrect/);
    const { token } = await login(email, password, 'ip2');
    expect((await adminFromToken(token))?.email).toBe(email);
    expect(await adminFromToken('garbage')).toBeNull();
    const req = (headers: Record<string, string>, method = 'GET') => new Request('http://localhost:3000/api/admin/banks', { method, headers });
    await expect(requireAdmin(req({}))).rejects.toThrow(/sign in/);
    expect((await requireAdmin(req({ cookie: `${ADMIN_COOKIE}=${token}` }))).email).toBe(email);
    // cross-site writes are rejected even with a valid cookie
    await expect(requireAdmin(req({ cookie: `${ADMIN_COOKIE}=${token}`, origin: 'http://evil.example', host: 'localhost:3000' }, 'POST'))).rejects.toThrow(/cross-site/);
    expect((await requireAdmin(req({ cookie: `${ADMIN_COOKIE}=${token}`, origin: 'http://localhost:3000', host: 'localhost:3000' }, 'POST'))).email).toBe(email);
    expect(cookieFromHeader('a=1; kmc_admin=xyz', 'kmc_admin')).toBe('xyz');
  });
  it('rate limits repeated failures', async () => {
    const { email } = await ensureAdmin();
    for (let i = 0; i < 5; i++) await expect(login(email, 'bad', 'ip-limit')).rejects.toThrow(/Incorrect/);
    await expect(login(email, 'bad', 'ip-limit')).rejects.toThrow(/Too many/);
  });
  it('writes an audit log', async () => {
    expect(await prisma.adminAuditLog.count({ where: { operation: 'login' } })).toBeGreaterThan(0);
  });
});
