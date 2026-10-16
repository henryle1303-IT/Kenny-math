import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './creds';

test('admin clears progress only after confirmation, keeps the bank and can start again', async ({ page, request }) => {
  const clearUrl = '/api/admin/progress/clear';
  expect((await request.post(clearUrl, { data: { confirmation: 'CLEAR' } })).status()).toBe(401);

  const started = await page.request.post('/api/attempts', { data: { testNumber: 5 } });
  expect(started.ok()).toBe(true);
  const { attemptId } = await started.json();
  const taking = await (await page.request.get(`/api/attempts/${attemptId}`)).json();
  expect((await page.request.put(`/api/attempts/${attemptId}/answer`, { data: { questionId: taking.questions[0].id, selected: 'A' } })).ok()).toBe(true);
  expect((await page.request.post(`/api/attempts/${attemptId}/submit`)).ok()).toBe(true);
  const open = await (await page.request.post('/api/attempts', { data: { testNumber: 6 } })).json();
  const { sessionId } = await (await page.request.post('/api/review/smart')).json();
  await page.goto(`/review/${sessionId}`);
  await page.getByTestId('rv-option-A').click();
  await expect(page.getByTestId('review-feedback')).toBeVisible();

  await page.goto('/admin/login');
  await page.getByLabel('Email', { exact: true }).fill(ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  async function bankSnapshot() {
    const { banks } = await (await page.request.get('/api/admin/banks')).json() as {
      banks: { id: string; version: number; status: string; isActive: boolean; _count: { questions: number } }[];
    };
    return banks.map((b) => ({ id: b.id, version: b.version, status: b.status, isActive: b.isActive, questions: b._count.questions }));
  }
  const banksBefore = await bankSnapshot();
  const settingsBefore = await (await page.request.get('/api/admin/settings')).json();
  expect((await page.request.post(clearUrl, { data: { confirmation: 'wrong' } })).status()).toBe(400);
  expect((await page.request.post(clearUrl, { data: { confirmation: 'CLEAR' }, headers: { origin: 'http://evil.example' } })).status()).toBe(403);

  await page.getByRole('link', { name: 'Student Progress', exact: true }).click();
  await page.getByRole('button', { name: 'Clear progress', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Clear all progress', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect((await page.request.get(`/api/attempts/${attemptId}`)).status()).toBe(200);

  await page.setViewportSize({ width: 375, height: 700 });
  await page.getByRole('button', { name: 'Clear progress', exact: true }).click();
  await dialog.getByLabel('Type CLEAR to confirm').fill('clear');
  await expect(dialog.getByRole('button', { name: 'Clear all progress', exact: true })).toBeDisabled();
  await dialog.getByLabel('Type CLEAR to confirm').fill('CLEAR');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await dialog.getByRole('button', { name: 'Clear all progress', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('status')).toContainText('Progress cleared.');
  await expect(page.getByRole('table').nth(0).getByRole('row')).toHaveCount(1);
  await expect(page.getByRole('table').nth(1).getByRole('row')).toHaveCount(1);
  expect((await page.request.get(`/api/attempts/${attemptId}`)).status()).toBe(404);
  expect((await page.request.get(`/api/attempts/${open.attemptId}`)).status()).toBe(404);
  expect(await bankSnapshot()).toEqual(banksBefore);
  expect(await (await page.request.get('/api/admin/settings')).json()).toEqual(settingsBefore);
  await page.goto('/admin/settings');
  await expect(page.getByText('student.progress.clear', { exact: true })).toBeVisible();

  await page.goto('/tests');
  await page.getByTestId('test-card-5').getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByTestId('question-text')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Question 1, not answered', exact: true })).toBeVisible();
  expect((await page.request.post(clearUrl, { data: { confirmation: 'CLEAR' } })).status()).toBe(200);
});
