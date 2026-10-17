import { beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { ensureActiveBank, ensureAdmin } from './helpers';
import { exportBankCsv, cloneBank, getBankOrThrow } from '@/lib/services/banks';
import { analyzeImport, commitImport } from '@/lib/services/importer';
import { parseCsvText } from '@/lib/csv/import';
import { rowsToCsv } from '@/lib/csv/export';
import { login, adminFromToken, ADMIN_COOKIE } from '@/lib/services/admin-auth';
import { POST as settings } from '@/app/api/admin/settings/route';
import { GET as exportRoute } from '@/app/api/admin/banks/[id]/export/route';
import type { CsvRow } from '@/lib/csv/columns';

let sharedId = '';
let csv = '';
let adminToken = '';
const password = 'admin-qa-initial';
const email = 'admin-regressions@test.local';
const bytes = (text: string) => Buffer.from(text);
function request(path: string, body: unknown) {
  return new Request(`http://localhost:3000${path}`, { method: 'POST', headers: { host: 'localhost:3000', 'content-type': 'application/json', cookie: `${ADMIN_COOKIE}=${adminToken}` }, body: JSON.stringify(body) });
}

beforeAll(async () => {
  sharedId = (await ensureActiveBank()).id;
  csv = (await exportBankCsv(sharedId)).csv;
  await ensureAdmin(email, password);
  adminToken = (await login(email, password, 'admin-qa')).token;
});

describe('admin import/export regressions', () => {
  it('rejects an invalid export range instead of exporting the whole bank', async () => {
    for (const selection of ['abc', '0', '31', '1,abc', '1-999999', '1,,2', '2.5']) {
      const response = await exportRoute(new Request(`http://localhost:3000/api/admin/banks/${sharedId}/export?tests=${encodeURIComponent(selection)}`, { headers: { cookie: `${ADMIN_COOKIE}=${adminToken}` } }), { params: Promise.resolve({ id: sharedId }) });
      expect(response.status, selection).toBe(400);
      expect(response.headers.get('content-type')).toContain('json');
    }
  });

  it('does not treat the unused base selector as the source of a full-bank import', async () => {
    const owner = await prisma.student.create({ data: { name: 'Private source owner' } });
    const privateBank = await prisma.questionBank.create({ data: { name: 'Private unused selection', version: 9001, ownerId: owner.id } });
    const result = await analyzeImport({ name: 'full.csv', bytes: bytes(csv) }, 'NEW_BANK', { baseBankId: privateBank.id });
    expect(result.report.ok).toBe(true);
    expect((await prisma.importJob.findUniqueOrThrow({ where: { id: result.jobId } })).baseBankId).toBeNull();
    const invalid = await analyzeImport({ name: 'bad.csv', bytes: bytes('question_id,test_id\nX,1') }, 'NEW_BANK', {});
    const count = await prisma.questionBank.count();
    await expect(commitImport(invalid.jobId, {})).rejects.toThrow('validation errors');
    expect(await prisma.questionBank.count()).toBe(count);
  });

  it('rolls back rejected publish during replace-active and allows retrying the same import', async () => {
    const rows = parseCsvText(csv).rows as unknown as CsvRow[];
    rows[0] = { ...rows[0], question_text: 'Which option matches the teacher’s hidden number?', verify_expr: '' };
    const analyzed = await analyzeImport({ name: 'review.csv', bytes: bytes(rowsToCsv(rows)) }, 'REPLACE_ACTIVE', {});
    expect(analyzed.report.ok).toBe(true);
    expect(analyzed.report.reviewRows).toBeGreaterThan(0);
    const before = await prisma.questionBank.count();
    await expect(commitImport(analyzed.jobId, { activate: true, confirmText: 'REPLACE' })).rejects.toMatchObject({ code: 'REVIEW_REQUIRED' });
    expect(await prisma.questionBank.count()).toBe(before);
    expect((await prisma.importJob.findUniqueOrThrow({ where: { id: analyzed.jobId } })).status).toBe('VALIDATED');
    expect((await getBankOrThrow(sharedId)).isActive).toBe(true);
    const result = await commitImport(analyzed.jobId, { activate: true, confirmText: 'REPLACE', acknowledgeReview: true });
    expect(result.activated).toBe(true);
    expect(await prisma.questionBank.count()).toBe(before + 1);
  });

  it('commits a job only once when two requests arrive together', async () => {
    const { jobId } = await analyzeImport({ name: 'double.csv', bytes: bytes(csv) }, 'NEW_BANK', {});
    const before = await prisma.questionBank.count();
    const results = await Promise.allSettled([commitImport(jobId, {}), commitImport(jobId, {})]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.questionBank.count()).toBe(before + 1);
    expect((await prisma.importJob.findUniqueOrThrow({ where: { id: jobId } })).status).toBe('COMMITTED');
  });

  it('rejects invalid question-list pagination and a missing bank with friendly errors', async () => {
    const { listQuestions } = await import('@/lib/services/banks');
    await expect(listQuestions(sharedId, { page: NaN })).rejects.toMatchObject({ status: 400 });
    await expect(listQuestions(sharedId, { pageSize: -1 })).rejects.toMatchObject({ status: 400 });
    await expect(listQuestions('missing-bank', {})).rejects.toMatchObject({ status: 404 });
    const copy = await cloneBank(sharedId, 'QA question list');
    expect((await listQuestions(copy.id, { page: 1, pageSize: 10 })).items).toHaveLength(10);
  });
});

describe('admin settings and sessions', () => {
  it('rejects malformed objects and invalid intervals without changing stored defaults', async () => {
    const before = await prisma.setting.findUnique({ where: { key: 'learningConfig' } });
    for (const body of [null, { action: 'intervals', intervals: { afterIncorrect: 0.5, afterCorrectOnce: 1, afterCorrectTwice: 3, afterConsistent: 7 } }, { action: 'intervals', intervals: { afterIncorrect: null, afterCorrectOnce: 1, afterCorrectTwice: 3, afterConsistent: 7 } }, { action: 'intervals', intervals: { afterIncorrect: '', afterCorrectOnce: 1, afterCorrectTwice: 3, afterConsistent: 7 } }]) {
      const response = await settings(request('/api/admin/settings', body));
      expect(response.status).toBe(400);
    }
    expect(await prisma.setting.findUnique({ where: { key: 'learningConfig' } })).toEqual(before);
  });

  it('changes the password, keeps the initiating session and revokes other admin sessions', async () => {
    const other = await login(email, password, 'admin-qa-other');
    const response = await settings(request('/api/admin/settings', { action: 'password', current: password, next: 'admin-qa-changed' }));
    expect(response.status).toBe(200);
    expect((await adminFromToken(adminToken))?.email).toBe(email);
    expect(await adminFromToken(other.token)).toBeNull();
    await expect(login(email, password, 'admin-qa-old')).rejects.toThrow('Incorrect');
    expect((await login(email, 'admin-qa-changed', 'admin-qa-new')).token).toBeTruthy();
  });
});
