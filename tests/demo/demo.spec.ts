import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { parseCsvText } from '../../src/lib/csv/import';
import { rowsToCsv } from '../../src/lib/csv/export';
import type { CsvRow } from '../../src/lib/csv/columns';

test('static demo saves answers, grades, practises, imports/exports and clears progress without an API', async ({ page }, info) => {
  const apiRequests: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => { if (new URL(r.url()).pathname.startsWith('/api/')) apiRequests.push(r.url()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Kenny Math Challenge', exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Math Tests', exact: true }).click();
  await expect(page.getByTestId('test-card-30')).toBeVisible();
  await page.getByTestId('test-card-1').getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByTestId('option-A').click();
  const expiry = await page.evaluate(() => JSON.parse(localStorage.getItem('kenny-math-demo-v1')!).attempts[0].expiresAt);
  await page.getByTestId('next').click();
  await page.reload();
  await expect(page.getByTestId('option-A')).toHaveAttribute('aria-checked', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kenny-math-demo-v1')!).attempts[0].expiresAt)).toBe(expiry);
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('submit-open').click();
  await expect(page.getByTestId('score')).toContainText('/30');
  await expect(page.getByText('Step by step').first()).toBeVisible();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Smart Review', exact: true }).click();
  await page.getByTestId('practice-mistakes').click();
  for (let i = 0; i < 10; i++) {
    await page.getByTestId('option-B').click();
    await expect(page.getByTestId('review-feedback')).toBeVisible();
    if (i < 9) await page.getByTestId('next').click();
  }
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('submit-open').click();
  await expect(page.getByTestId('score')).toContainText('/10');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Admin demo', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByTestId('export-link').click();
  const download = await pending;
  const original = info.outputPath('demo-export.csv');
  await download.saveAs(original);
  const buffer = fs.readFileSync(original);
  expect([...buffer.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const rows = parseCsvText(buffer.toString('utf8')).rows as CsvRow[];
  expect(rows).toHaveLength(900);
  rows[0].learning_tip = 'Demo import test: new learning tip.';
  const valid = info.outputPath('new-bank.csv');
  const invalid = info.outputPath('incomplete-bank.csv');
  fs.writeFileSync(valid, rowsToCsv(rows));
  fs.writeFileSync(invalid, rowsToCsv(rows.slice(0, 30)));
  await page.getByTestId('import-file').setInputFiles(valid);
  await page.getByTestId('import-validate').click();
  await expect(page.getByTestId('import-report')).toContainText('The file is valid');
  await page.getByTestId('import-file').setInputFiles(invalid);
  await expect(page.getByTestId('import-report')).not.toBeVisible();
  await page.getByTestId('import-validate').click();
  await expect(page.getByTestId('import-report')).toContainText('cannot be saved');
  await page.getByTestId('import-file').setInputFiles(valid);
  await page.getByTestId('import-validate').click();
  await expect(page.getByTestId('import-report')).toContainText('The file is valid');
  await page.getByLabel('Name for the new bank', { exact: true }).fill('Demo Imported Bank');
  await page.getByTestId('import-commit').click();
  await expect(page.getByRole('status')).toContainText('Saved as a new draft');
  const draft = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('kenny-math-demo-v1')!);
    return { bank: state.banks[1], active: state.activeBankId };
  });
  expect(draft.active).toBe('demo-original');
  expect(draft.bank.status).toBe('DRAFT');
  expect(draft.bank.questions[0].learningTip).toBe(rows[0].learning_tip);
  const bankCard = page.locator('div.card').filter({ has: page.getByRole('heading', { name: 'Demo Imported Bank', exact: true }) });
  page.once('dialog', (d) => d.accept());
  await bankCard.getByRole('button', { name: 'Publish / Activate', exact: true }).click();
  await expect(bankCard).toContainText('ACTIVE');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Demo Imported Bank', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear progress', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Clear all progress', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kenny-math-demo-v1')!).attempts.length)).toBe(2);
  await page.getByRole('button', { name: 'Clear progress', exact: true }).click();
  await dialog.getByLabel('Type CLEAR to confirm').fill('CLEAR');
  await dialog.getByRole('button', { name: 'Clear all progress', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Progress cleared');
  const cleared = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('kenny-math-demo-v1')!);
    return { attempts: state.attempts.length, banks: state.banks.length, active: state.activeBankId };
  });
  expect(cleared).toEqual({ attempts: 0, banks: 2, active: draft.bank.id });
  expect(apiRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('deep links, mobile layout and persisted expiry work on the static server', async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  for (const path of ['/', '/tests', '/progress', '/review', '/admin/login']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
  await page.goto('/tests');
  await page.getByTestId('test-card-2').getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByTestId('option-A').click();
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('kenny-math-demo-v1')!);
    state.attempts[0].expiresAt = Date.now() - 1000;
    localStorage.setItem('kenny-math-demo-v1', JSON.stringify(state));
  });
  await page.reload();
  await expect(page).toHaveURL(/\/results\//);
  await expect(page.getByTestId('score')).toContainText('/30');
  expect((await request.get('/api/admin/banks')).status()).toBe(404);
});
