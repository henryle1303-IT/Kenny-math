import { expect, test, type Page } from '@playwright/test';
import Papa from 'papaparse';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './creds';
import { parseCsvText } from '../../src/lib/csv/import';
import { BOM, rowsToCsv } from '../../src/lib/csv/export';
import type { CsvRow } from '../../src/lib/csv/columns';

test.beforeEach(async ({ page }) => {
  expect((await page.request.post('/api/admin/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).ok()).toBe(true);
});

async function activeBank(page: Page) {
  const { banks } = await (await page.request.get('/api/admin/banks')).json();
  return banks.find((b: { isActive: boolean }) => b.isActive);
}
async function bankCount(page: Page) { return (await (await page.request.get('/api/admin/banks')).json()).banks.length; }
async function sourceCsv(page: Page) {
  const bank = await activeBank(page);
  const csv = await (await page.request.get(`/api/admin/banks/${bank.id}/export`)).text();
  return { bank, csv, rows: parseCsvText(csv).rows as unknown as CsvRow[] };
}

test('export validates selections in place; bad files and template examples produce useful reports', async ({ page }) => {
  const { csv, rows } = await sourceCsv(page);
  const before = await bankCount(page);
  await page.goto('/admin/import');
  await page.getByLabel(/Tests \(blank = all 900\)/).fill('1,wrong');
  await page.getByTestId('export-link').click();
  await expect(page).toHaveURL(/\/admin\/import$/);
  await expect(page.getByRole('alert').filter({ hasText: 'test numbers' })).toContainText('test numbers');
  await page.getByTestId('import-file').setInputFiles({ name: 'missing.csv', mimeType: 'text/csv', buffer: Buffer.from('question_id,test_id\nX,1') });
  await page.getByTestId('import-validate').click();
  await expect(page.getByTestId('import-report')).toContainText('Missing required column');
  await expect(page.getByTestId('import-commit')).toHaveCount(0);
  const errorUrl = await page.getByRole('link', { name: 'Download error report (CSV)' }).getAttribute('href');
  const errors = await page.request.get(errorUrl!);
  expect(errors.headers()['content-type']).toContain('text/csv');
  expect((await errors.body()).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  expect(await errors.text()).toContain('Missing required column');
  for (const [name, buffer, status] of [['empty.csv', Buffer.alloc(0), 400], ['wrong.txt', Buffer.from(csv), 400], ['huge.csv', Buffer.alloc(4 * 1024 * 1024 + 1, 65), 413]] as const) {
    const response = await page.request.post('/api/admin/import', { multipart: { mode: 'NEW_BANK', file: { name, mimeType: 'text/csv', buffer } } });
    expect(response.status(), name).toBe(status);
  }
  await page.getByTestId('import-file').setInputFiles({ name: 'oversized.csv', mimeType: 'text/csv', buffer: Buffer.alloc(4 * 1024 * 1024 + 1, 65) });
  await page.getByTestId('import-validate').click();
  await expect(page.getByTestId('import-error')).toContainText('limit 4 MB');
  const duplicates = rows.map((r) => ({ ...r })); duplicates[1].question_id = duplicates[0].question_id;
  const response = await page.request.post('/api/admin/import', { multipart: { mode: 'NEW_BANK', file: { name: 'duplicates.csv', mimeType: 'text/csv', buffer: Buffer.from(rowsToCsv(duplicates)) } } });
  const rejected = await response.json();
  expect(rejected.report.duplicateRows).toBeGreaterThan(0);
  expect((await page.request.post(`/api/admin/import/${rejected.jobId}/commit`, { data: {} })).status()).toBe(422);
  const template = await (await page.request.get('/api/admin/template')).body();
  for (const includeExamples of ['false', 'true']) {
    const result = await (await page.request.post('/api/admin/import', { multipart: { mode: 'NEW_BANK', includeExamples, file: { name: 'template.csv', mimeType: 'text/csv', buffer: template } } })).json();
    expect(result.report.skippedExamples).toBe(includeExamples === 'false' ? 3 : 0);
    expect(result.report.totalRows).toBe(includeExamples === 'false' ? 0 : 3);
    expect(result.report.invalidRows).toBe(0);
    expect(result.report.canCommit).toBe(false);
  }
  expect(await bankCount(page)).toBe(before);
});

test('full CSV import accepts UTF-16 and semicolon encoding with identical question counts', async ({ page }) => {
  const { csv, rows } = await sourceCsv(page);
  const files = [Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(csv.replace(/^\uFEFF/, ''), 'utf16le')]), Buffer.from(BOM + Papa.unparse(rows, { delimiter: ';', newline: '\r\n' }))];
  for (const buffer of files) {
    const response = await page.request.post('/api/admin/import', { multipart: { mode: 'NEW_BANK', file: { name: 'encoded.csv', mimeType: 'text/csv', buffer } } });
    expect(response.ok()).toBe(true);
    const result = await response.json();
    expect(result.report).toMatchObject({ ok: true, totalRows: 900, invalidRows: 0 });
  }
});

test('replace-active rolls back missing review acceptance and succeeds on retry', async ({ page }) => {
  const { bank, rows } = await sourceCsv(page);
  rows[0] = { ...rows[0], question_text: 'Which option matches the teacher’s hidden number?', verify_expr: '' };
  const count = await bankCount(page);
  await page.goto('/admin/import');
  await page.getByRole('radio', { name: /B – Replace/ }).check();
  await page.getByTestId('import-file').setInputFiles({ name: 'review.csv', mimeType: 'text/csv', buffer: Buffer.from(rowsToCsv(rows)) });
  await page.getByTestId('import-validate').click();
  await expect(page.getByTestId('import-report')).toContainText('The file is valid');
  await page.getByRole('checkbox', { name: /Publish and activate it now/ }).check();
  await page.getByLabel('Type REPLACE to confirm').fill('wrong');
  await page.getByTestId('import-commit').click();
  await expect(page.getByTestId('import-error')).toContainText('Type REPLACE');
  expect(await bankCount(page)).toBe(count);
  await page.getByLabel('Type REPLACE to confirm').fill('REPLACE');
  await page.getByTestId('import-commit').click();
  await expect(page.getByTestId('import-error')).toContainText('flagged for manual review');
  expect(await bankCount(page)).toBe(count);
  expect((await activeBank(page)).id).toBe(bank.id);
  await page.getByRole('checkbox', { name: 'I accept questions flagged for manual review', exact: true }).check();
  await page.getByTestId('import-commit').click();
  await expect(page.getByTestId('import-done')).toContainText('Saved, published and activated');
  expect(await bankCount(page)).toBe(count + 1);
  expect((await activeBank(page)).id).not.toBe(bank.id);
  expect((await page.request.post(`/api/admin/banks/${bank.id}/activate`, { data: { confirm: true } })).ok()).toBe(true);
});

test('update-selected imports a private copy and preserves the shared source', async ({ page }) => {
  const { bank, rows } = await sourceCsv(page);
  const original = rows[0].learning_tip;
  const edited = { ...rows[0], learning_tip: 'Ôn tập riêng: "Moon",\nkiểm tra từng bước.' };
  await page.goto('/admin/students?userId=moon');
  await page.getByText('Import / export question banks — Moon', { exact: true }).click();
  await page.getByRole('radio', { name: /C – Update selected/ }).check();
  await page.getByLabel('Bank to update', { exact: true }).selectOption(bank.id);
  await page.getByTestId('import-file').setInputFiles({ name: 'update.csv', mimeType: 'text/csv', buffer: Buffer.from(rowsToCsv([edited])) });
  await page.getByTestId('import-validate').click();
  await expect(page.getByTestId('rep-Total rows')).toHaveText('1');
  await page.getByLabel('Name for the new bank (optional)').fill('QA Moon selected update');
  const saving = page.waitForResponse((r) => r.url().endsWith('/commit') && r.request().method() === 'POST');
  await page.getByTestId('import-commit').click();
  const { bankId } = await (await saving).json();
  await expect(page.getByTestId('import-done')).toContainText('Saved as a new draft');
  const { banks } = await (await page.request.get('/api/admin/banks')).json();
  expect(banks.find((b: { id: string }) => b.id === bankId)).toMatchObject({ ownerId: 'moon', parentBankId: bank.id, _count: { questions: 900 } });
  const result = parseCsvText(await (await page.request.get(`/api/admin/banks/${bankId}/export`)).text()).rows;
  expect(result[0].learning_tip).toBe(edited.learning_tip);
  const source = parseCsvText(await (await page.request.get(`/api/admin/banks/${bank.id}/export`)).text()).rows;
  expect(source[0].learning_tip).toBe(original);
});

test('question manager filters and edits a draft; failed save stays open; bank validation keeps its report', async ({ page }) => {
  const shared = await activeBank(page);
  const { bank } = await (await page.request.post(`/api/admin/banks/${shared.id}/clone`, { data: { name: 'QA editor draft' } })).json();
  const listing = await (await page.request.get(`/api/admin/banks/${bank.id}/questions?test=1`)).json();
  const question = listing.items[0];
  await page.goto(`/admin/questions?bank=${bank.id}`);
  await expect(page.getByTestId('question-table')).toContainText(question.questionId);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page 2 of 30', { exact: true })).toBeVisible();
  await page.getByLabel('Search', { exact: true }).fill(question.questionId);
  await expect(page.getByTestId('question-table').getByRole('row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Common mistake');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Learning tip', { exact: true }).fill('QA edited tip');
  const path = `**/api/admin/banks/${bank.id}/questions/${question.id}`;
  await page.route(path, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary test save failure' }) }));
  await page.getByRole('button', { name: 'Save and re-check', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Temporary test save failure');
  await page.unroute(path);
  await page.getByRole('button', { name: 'Save and re-check', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const changed = await (await page.request.get(`/api/admin/banks/${bank.id}/questions?q=${question.questionId}`)).json();
  expect(changed.items[0].learningTip).toBe('QA edited tip');
  await page.goto('/admin/banks');
  const card = page.getByTestId(`bank-${bank.version}`);
  await card.getByRole('button', { name: 'Validate', exact: true }).click();
  await expect(card.getByRole('status')).toContainText('900/900 valid');
  expect((await page.request.delete(`/api/admin/banks/${bank.id}/archive`, { data: { confirmName: 'wrong-name' } })).status()).toBe(400);
  expect((await page.request.delete(`/api/admin/banks/${bank.id}/archive`, { data: { confirmName: bank.name } })).ok()).toBe(true);
});

test('generator clears an old topic filter when switching to a new full bank', async ({ page }) => {
  const shared = await activeBank(page);
  const { bank } = await (await page.request.post(`/api/admin/banks/${shared.id}/clone`, { data: { name: 'QA generator source' } })).json();
  await page.goto('/admin/generator');
  await page.getByLabel('Where to put the questions', { exact: true }).selectOption(bank.id);
  const topic = page.getByLabel('Only regenerate one topic (existing drafts)', { exact: true });
  await topic.selectOption({ index: 1 });
  await page.getByLabel('Where to put the questions', { exact: true }).selectOption('new');
  await expect(topic).toHaveValue('');
  await expect(topic).toBeDisabled();
  await page.getByLabel('Bank name', { exact: true }).fill('QA full generated bank');
  await page.getByTestId('generate-900').click();
  await expect(page.getByTestId('gen-log')).toContainText('Validation: 900/900 valid', { timeout: 120000 });
});

test('user creation validates duplicates, profile settings stay private, and progress backup restores only its owner', async ({ page }) => {
  await page.goto('/admin/students?userId=kenny');
  await page.locator('summary').filter({ hasText: 'Create user' }).click();
  await page.locator('#new-username').fill('kenny');
  await page.locator('#new-name').fill('QA learner');
  await page.locator('#new-password').fill('123');
  await page.getByRole('button', { name: 'Create user', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Username already exists' })).toContainText('Username already exists');
  await page.locator('#new-username').fill('adminqa');
  await page.getByRole('button', { name: 'Create user', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'QA learner', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Profile for Kenny', exact: true })).toHaveCount(0);
  const id = new URL(page.url()).searchParams.get('userId')!;
  await page.getByRole('tab', { name: 'Learning Settings', exact: true }).click();
  await page.locator('#afterCorrectOnce').fill('19');
  await page.getByRole('button', { name: 'Save learning settings', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  const profile = await (await page.request.get(`/api/admin/users/${id}`)).json();
  expect(JSON.parse(profile.learningConfig).intervals.afterCorrectOnce).toBe(19);
  expect((await page.request.post('/api/student/login', { data: { username: 'adminqa', password: '123' } })).ok()).toBe(true);
  const { attemptId } = await (await page.request.post('/api/attempts', { data: { testNumber: 1 } })).json();
  expect((await page.request.post(`/api/attempts/${attemptId}/submit`)).ok()).toBe(true);
  const backupUrl = `/api/admin/progress/backup?studentId=${id}`;
  expect((await page.request.post(backupUrl, { data: { action: 'save' } })).ok()).toBe(true);
  const backup = await (await page.request.get(backupUrl)).json();
  expect(backup.attempts).toHaveLength(1);
  const wrong = await page.request.post('/api/admin/progress/backup?studentId=moon', { data: { action: 'import', backup, confirmation: 'RESTORE' } });
  expect(wrong.status()).toBe(409);
  expect((await page.request.post(`/api/admin/progress/clear?studentId=${id}`, { data: { confirmation: 'wrong' } })).status()).toBe(400);
  expect((await page.request.post(`/api/admin/progress/clear?studentId=${id}`, { data: { confirmation: 'CLEAR' } })).ok()).toBe(true);
  expect((await (await page.request.get(backupUrl)).json()).attempts).toHaveLength(0);
  expect((await page.request.post(backupUrl, { data: { action: 'import', backup, confirmation: 'RESTORE' } })).ok()).toBe(true);
  expect((await (await page.request.get(backupUrl)).json()).attempts).toHaveLength(1);
});

test('settings reject blank/decimal days; admin password change invalidates the other session', async ({ page, playwright }) => {
  const original = (await (await page.request.get('/api/admin/settings')).json()).learning.intervals;
  await page.goto('/admin/settings');
  const interval = page.getByLabel('After an incorrect answer (days)', { exact: true });
  await interval.fill('');
  await page.getByRole('button', { name: 'Save intervals', exact: true }).click();
  await expect(interval).toHaveValue('');
  expect(await interval.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
  await interval.fill('0.5');
  expect(await interval.evaluate((el: HTMLInputElement) => el.validity.stepMismatch)).toBe(true);
  await interval.fill('2');
  await page.getByRole('button', { name: 'Save intervals', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Defaults saved');
  expect((await page.request.post('/api/admin/settings', { data: { action: 'intervals', intervals: original } })).ok()).toBe(true);
  const second = await playwright.request.newContext({ baseURL: 'http://localhost:3210' });
  try {
    expect((await second.post('/api/admin/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).ok()).toBe(true);
    await page.getByLabel('Current password', { exact: true }).fill('wrong');
    await page.getByLabel(/New password/).fill('qa-admin-new-password');
    await page.getByRole('button', { name: 'Change password', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('current password is not correct');
    await page.getByLabel('Current password', { exact: true }).fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Change password', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Password changed');
    expect((await page.request.get('/api/admin/settings')).ok()).toBe(true);
    expect((await second.get('/api/admin/settings')).status()).toBe(401);
    expect((await page.request.post('/api/admin/settings', { data: { action: 'password', current: 'qa-admin-new-password', next: ADMIN_PASSWORD } })).ok()).toBe(true);
  } finally { await second.dispose(); }
});

test('admin pages stay within phone width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  for (const url of ['/admin', '/admin/import', '/admin/students?userId=moon', '/admin/banks', '/admin/questions', '/admin/settings', '/admin/generator']) {
    await page.goto(url);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), url).toBeLessThanOrEqual(1);
  }
  await page.screenshot({ path: 'qa/admin-functional-mobile.png', fullPage: true });
});
