import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './creds';

test('admin: login, generate bank, validate, export, import, preview, publish, activate', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Incorrect email or password.')).toBeVisible();
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // Generate 900 questions into a new draft
  await page.getByRole('link', { name: 'Question Generator' }).click();
  await page.getByLabel('Bank name').fill('E2E generated bank');
  await page.getByTestId('generate-900').click();
  await expect(page.getByTestId('gen-log')).toContainText('Validation: 900/900 valid', { timeout: 120_000 });

  // Export the original (active) bank as CSV
  await page.getByRole('link', { name: 'Import / Export' }).click();
  const download = page.waitForEvent('download');
  await page.getByTestId('export-link').click();
  const file = await download;
  const csvPath = path.join(test.info().outputDir, 'export.csv');
  await file.saveAs(csvPath);
  const raw = fs.readFileSync(csvPath);
  expect(raw[0]).toBe(0xef); // UTF-8 BOM
  expect(raw.toString('utf8').split('\r\n').length).toBeGreaterThan(900);

  // Import it again: validate, preview, save as draft
  await page.getByTestId('import-file').setInputFiles(csvPath);
  await page.getByTestId('import-validate').click();
  await expect(page.getByTestId('import-report')).toContainText('The file is valid');
  await expect(page.getByTestId('import-report')).toContainText('Preview');
  await page.getByTestId('import-commit').click();
  await expect(page.getByTestId('import-done')).toContainText('Saved as a new draft');

  // An invalid file is rejected
  const bad = path.join(test.info().outputDir, 'bad.csv');
  fs.writeFileSync(bad, raw.toString('utf8').split('\r\n').slice(0, 40).join('\r\n'));
  await page.getByTestId('import-file').setInputFiles(bad);
  await page.getByTestId('import-validate').click();
  await expect(page.getByTestId('import-report')).toContainText('cannot be saved');

  // Bank versions: publish the generated draft (accept review flags) and check the active marker
  await page.getByRole('link', { name: 'Bank Versions' }).click();
  await expect(page.getByTestId('bank-2')).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('bank-2').getByRole('button', { name: 'Publish / Activate' }).click();
  await expect(page.getByTestId('bank-2')).toContainText('ACTIVE', { timeout: 30_000 });

  // Roll back to bank 1
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('bank-1').getByRole('button', { name: 'Restore / Activate' }).click();
  await expect(page.getByTestId('bank-1')).toContainText('ACTIVE', { timeout: 30_000 });

  // Question manager is read-only for published banks, editable for drafts
  await page.getByRole('link', { name: 'Question Manager' }).click();
  await expect(page.getByTestId('question-table')).toBeVisible();
  await expect(page.getByText('This bank is published, so it is read-only')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
});
