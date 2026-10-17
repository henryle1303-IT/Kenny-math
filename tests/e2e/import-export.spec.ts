import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { generateFullBank } from '../../src/lib/gen/bank';
import { CORE_COLUMNS } from '../../src/lib/csv/columns';
import { questionToCsvRow, rowsToCsv } from '../../src/lib/csv/export';
import { mapCsvRows, parseCsvText } from '../../src/lib/csv/import';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './creds';

test.beforeEach(async ({ page }) => {
  const res = await page.request.post('/api/student/login', { data: { username: 'kenny', password: '123' } });
  expect(res.ok()).toBe(true);
});

const generated = generateFullBank('qa-external-import-2026-10-16');
const inputRows = generated.map((q) => questionToCsvRow({
  questionId: `NEW-${q.questionId}`, testNumber: q.testNumber, position: q.position, level: q.level,
  difficulty: q.difficulty, topic: q.topic, skill: q.skill, questionText: q.text,
  optionA: q.options[0], optionB: q.options[1], optionC: q.options[2], optionD: q.options[3],
  correctAnswer: q.correct, explanation: q.explanation, commonMistake: q.commonMistake,
  learningTip: `Ôn tập: ${q.learningTip}`, verifyExpr: q.verifyExpr, validationStatus: '',
}, '', 0));
// An external CSV needs no existing bank IDs, versions or validation status.
const csv = rowsToCsv(inputRows, [...CORE_COLUMNS, 'verify_expr']);
const content = (text: string) => mapCsvRows(parseCsvText(text)).rows.map((r) => r.data);

async function signIn(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email', { exact: true }).fill(ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Admin', exact: true }).getByRole('link', { name: 'Import / Export', exact: true }).click();
}

test('imports a genuinely new 900-question CSV, exports identical content, publishes and grades it', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await signIn(page);
  const { banks: before } = await (await page.request.get('/api/admin/banks')).json();
  const original = before.find((b: { isActive: boolean }) => b.isActive);
  const originalCsv = await (await page.request.get(`/api/admin/banks/${original.id}/export`)).text();
  const originalContent = content(originalCsv);
  const expected = content(csv);
  expect(expected).toHaveLength(900);
  expect(expected.some((q, i) => q.questionText !== originalContent[i].questionText)).toBe(true);
  const csvPath = testInfo.outputPath('new-question-bank.csv');
  fs.writeFileSync(csvPath, csv);
  await testInfo.attach('new-question-bank.csv', { path: csvPath, contentType: 'text/csv' });

  await page.getByTestId('import-file').setInputFiles(csvPath);
  await page.getByTestId('import-validate').click();
  await expect(page.getByTestId('import-report')).toContainText('The file is valid');
  await expect(page.getByTestId('rep-Total rows')).toHaveText('900');
  await expect(page.getByTestId('rep-Invalid rows')).toHaveText('0');
  await page.getByLabel('Name for the new bank (optional)').fill('External CSV – new questions');
  const committing = page.waitForResponse((r) => r.url().endsWith('/commit') && r.request().method() === 'POST');
  await page.getByTestId('import-commit').click();
  const committed = await committing;
  expect(committed.ok()).toBe(true);
  const { bankId } = await committed.json();
  await expect(page.getByTestId('import-done')).toContainText('Saved as a new draft');
  const { banks: after } = await (await page.request.get('/api/admin/banks')).json();
  const imported = after.find((b: { id: string }) => b.id === bankId);
  expect(imported).toMatchObject({ status: 'READY_FOR_REVIEW', isActive: false, source: 'IMPORTED', _count: { questions: 900 } });
  expect(after.find((b: { isActive: boolean }) => b.isActive).id).toBe(original.id);

  await page.getByLabel('Bank', { exact: true }).selectOption(bankId);
  async function downloadExport() {
    const pending = page.waitForEvent('download');
    await page.getByTestId('export-link').click();
    const download = await pending;
    const saved = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(saved);
    const raw = fs.readFileSync(saved);
    expect([...raw.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    return content(raw.toString('utf8'));
  }
  expect(await downloadExport()).toEqual(expected);
  await page.getByLabel(/Tests \(blank = all 900\)/).fill('7');
  expect(await downloadExport()).toEqual(expected.filter((q) => q.testNumber === 7));
  await page.getByLabel(/Tests \(blank = all 900\)/).fill('1-3,9');
  expect(await downloadExport()).toEqual(expected.filter((q) => [1, 2, 3, 9].includes(q.testNumber)));

  await page.getByRole('link', { name: 'Bank Versions', exact: true }).click();
  const card = page.getByTestId(`bank-${imported.version}`);
  page.once('dialog', (d) => d.accept());
  await card.getByRole('button', { name: 'Publish / Activate', exact: true }).click();
  const validation = JSON.parse(imported.validationJson);
  if (validation.reviewRows + validation.warningRows > 0) {
    await expect(card.getByRole('status')).toContainText('flagged for manual review');
    await card.getByRole('checkbox', { name: 'accept questions flagged for review', exact: true }).check();
    page.once('dialog', (d) => d.accept());
    await card.getByRole('button', { name: 'Publish / Activate', exact: true }).click();
  }
  await expect(card.getByText('ACTIVE', { exact: true })).toBeVisible();
  expect((await page.request.post('/api/admin/users/kenny', { data: { action: 'bank', bankId: imported.id } })).ok()).toBe(true);
  const started = await page.request.post('/api/attempts', { data: { testNumber: 25 } });
  expect(started.ok()).toBe(true);
  const { attemptId } = await started.json();
  const taking = await (await page.request.get(`/api/attempts/${attemptId}`)).json();
  const test25 = expected.filter((q) => q.testNumber === 25);
  expect(taking.questions.map((q: { text: string }) => q.text)).toEqual(test25.map((q) => q.questionText));
  expect((await page.request.put(`/api/attempts/${attemptId}/answer`, { data: { questionId: taking.questions[0].id, selected: test25[0].correctAnswer } })).ok()).toBe(true);
  const result = await page.request.post(`/api/attempts/${attemptId}/submit`);
  expect(result.ok()).toBe(true);
  expect((await result.json()).score).toBe(1);

  expect((await page.request.post('/api/admin/users/kenny', { data: { action: 'bank', bankId: original.id } })).ok()).toBe(true);
  // Restore the previous bank so this test does not affect later student tests.
  page.once('dialog', (d) => d.accept());
  const originalCard = page.getByTestId(`bank-${original.version}`);
  await originalCard.getByRole('button', { name: 'Restore / Activate', exact: true }).click();
  await expect(originalCard.getByText('ACTIVE', { exact: true })).toBeVisible();
  expect(content(await (await page.request.get(`/api/admin/banks/${original.id}/export`)).text())).toEqual(originalContent);
});

test('changing the selected CSV invalidates the previous validation before a bank can be saved', async ({ page }, testInfo) => {
  await signIn(page);
  const valid = testInfo.outputPath('valid.csv');
  const incomplete = testInfo.outputPath('incomplete.csv');
  fs.writeFileSync(valid, csv);
  fs.writeFileSync(incomplete, rowsToCsv(inputRows.slice(0, 30), [...CORE_COLUMNS, 'verify_expr']));
  await page.getByTestId('import-file').setInputFiles(valid);
  await page.getByTestId('import-validate').click();
  await expect(page.getByTestId('import-report')).toContainText('The file is valid');
  await page.getByTestId('import-file').setInputFiles(incomplete);
  await expect(page.getByTestId('import-report')).not.toBeVisible();
  await expect(page.getByTestId('import-commit')).not.toBeVisible();
  await page.getByTestId('import-validate').click();
  await expect(page.getByTestId('import-report')).toContainText('cannot be saved');
  await expect(page.getByTestId('import-commit')).not.toBeVisible();
  await page.getByRole('checkbox', { name: /include example rows/ }).check();
  await expect(page.getByTestId('import-report')).not.toBeVisible();
  await page.getByTestId('import-validate').click();
  await expect(page.getByTestId('import-report')).toContainText('cannot be saved');
  await page.getByRole('radio', { name: /C – Update selected questions/ }).check();
  await expect(page.getByTestId('import-report')).not.toBeVisible();
  await expect(page.getByTestId('import-commit')).not.toBeVisible();
});
