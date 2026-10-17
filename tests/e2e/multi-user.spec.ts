import { expect, test, type Page } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './creds';

async function signIn(page: Page, username: string, password = '123') {
  await page.goto('/login');
  await page.getByLabel('Username / Tên đăng nhập', { exact: true }).fill(username);
  await page.getByLabel('Password / Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in / Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/');
}

test('four users see their own names, independent history, and protected resources', async ({ page, request }) => {
  expect((await request.post('/api/attempts', { data: { testNumber: 4 } })).status()).toBe(401);
  await page.goto('/progress');
  await expect(page).toHaveURL('/login');
  let henryAttempt = '';
  let henryQuestion = '';
  for (const [username, name] of [['kenny', 'Kenny'], ['henry', 'Henry'], ['xoai', 'Xoai'], ['moon', 'Moon']]) {
    await signIn(page, username);
    await expect(page.getByRole('heading', { name: `${name} Math Challenge`, exact: true })).toBeVisible();
    await expect(page).toHaveTitle(`${name} Math Challenge`);
    if (username !== 'kenny') await expect(page.getByText(/Kenny/)).toHaveCount(0);
    await page.goto('/review');
    await expect(page.getByRole('heading', { name: `${name} Smart Review` })).toBeVisible();
    if (username === 'henry') {
      const started = await page.request.post('/api/attempts', { data: { testNumber: 24 } });
      henryAttempt = (await started.json()).attemptId;
      const taking = await (await page.request.get(`/api/attempts/${henryAttempt}`)).json();
      henryQuestion = taking.questions[0].id;
      expect((await page.request.put(`/api/attempts/${henryAttempt}/answer`, { data: { questionId: henryQuestion, selected: 'A' } })).ok()).toBe(true);
    }
    if (username === 'moon') {
      expect((await page.request.get(`/api/attempts/${henryAttempt}`)).status()).toBe(404);
      expect((await page.request.put(`/api/attempts/${henryAttempt}/answer`, { data: { questionId: henryQuestion, selected: 'B' } })).status()).toBe(404);
      expect((await page.request.post(`/api/attempts/${henryAttempt}/submit`)).status()).toBe(404);
      await page.goto('/');
      await expect(page.getByText('You have a test in progress')).toHaveCount(0);
    }
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL('/login');
    expect((await page.request.get(`/api/attempts/${henryAttempt || 'unknown'}`)).status()).toBe(401);
  }
});

test('admin profiles update names and language per user; password changes revoke sessions', async ({ page }, testInfo) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email', { exact: true }).fill(ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'User Profiles', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'User Profiles', exact: true })).toBeVisible();
  await page.goto('/admin/students?userId=henry');
  await page.getByRole('tabpanel').getByLabel('Display name', { exact: true }).fill('Henry Toán');
  await page.getByLabel('Language', { exact: true }).selectOption('vi');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await signIn(page, 'henry');
  await expect(page.getByRole('heading', { name: 'Thử thách Toán của Henry Toán' })).toBeVisible();
  await expect(page).toHaveTitle('Thử thách Toán của Henry Toán');
  await page.goto('/admin/students?userId=henry');
  await page.getByRole('tab', { name: 'Password', exact: true }).click();
  await page.getByLabel('New password for Henry Toán', { exact: true }).fill('henry-new-password');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Password reset' })).toBeVisible();
  await page.goto('/progress'); await expect(page).toHaveURL('/login');
  await signIn(page, 'henry', 'henry-new-password');
  await page.goto('/account');
  await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill('henry-new-password');
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('123');
  await page.getByRole('button', { name: 'Lưu mật khẩu' }).click();
  await expect(page).toHaveURL('/login');
  await signIn(page, 'henry');
  await page.goto('/admin/students?userId=henry');
  await page.getByRole('tabpanel').getByLabel('Display name', { exact: true }).fill('Henry');
  await page.getByLabel('Language', { exact: true }).selectOption('en');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Henry Math Challenge' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('multi-user-henry-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/admin/students?userId=moon');
  await page.screenshot({ path: testInfo.outputPath('multi-user-admin-profiles.png'), fullPage: true });
});

test('admin imports and publishes a private bank for Moon through the profile', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/admin/login');
  await page.getByLabel('Email', { exact: true }).fill(ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  const { banks } = await (await page.request.get('/api/admin/banks')).json();
  const shared = banks.find((b: { isActive: boolean; ownerId: string | null }) => b.isActive && !b.ownerId);
  const csv = await (await page.request.get(`/api/admin/banks/${shared.id}/export`)).body();
  await page.goto('/admin/students?userId=moon');
  await page.getByText('Import / export question banks — Moon', { exact: true }).click();
  await page.getByTestId('import-file').setInputFiles({ name: 'moon-private.csv', mimeType: 'text/csv', buffer: csv });
  await page.getByTestId('import-validate').click();
  await expect(page.getByTestId('import-report')).toContainText('The file is valid');
  await page.getByLabel('Name for the new bank (optional)').fill('Moon E2E private');
  await page.getByTestId('import-commit').click();
  await expect(page.getByTestId('import-done')).toContainText('Saved as a new draft');
  const latest = await (await page.request.get('/api/admin/banks')).json();
  const privateBank = latest.banks.find((b: { name: string; ownerId: string | null }) => b.name === 'Moon E2E private' && b.ownerId === 'moon');
  expect(privateBank).toBeTruthy();
  await page.goto('/admin/banks');
  const card = page.getByTestId(`bank-${privateBank.version}`);
  await card.getByRole('checkbox', { name: 'accept questions flagged for review', exact: true }).check();
  page.once('dialog', (d) => d.accept());
  await card.getByRole('button', { name: 'Publish / Activate', exact: true }).click();
  await expect(card.getByRole('status')).toContainText('Published and activated');
  await page.goto('/admin/students?userId=moon');
  await page.getByRole('tab', { name: 'Question Banks', exact: true }).click();
  await expect(page.getByLabel('Published shared or private bank')).toHaveValue(privateBank.id);
  await signIn(page, 'moon');
  const started = await page.request.post('/api/attempts', { data: { testNumber: 23 } });
  expect(started.ok()).toBe(true);
  const { attemptId } = await started.json();
  const progress = await (await page.request.get('/api/admin/progress/backup?studentId=moon')).json();
  expect(progress.attempts.find((a: { id: string }) => a.id === attemptId).bankId).toBe(privateBank.id);
  await page.goto('/admin/students?userId=kenny');
  await page.getByRole('tab', { name: 'Question Banks', exact: true }).click();
  await expect(page.getByLabel('Published shared or private bank')).toHaveValue(shared.id);
  expect((await page.request.post('/api/admin/users/moon', { data: { action: 'bank', bankId: shared.id } })).ok()).toBe(true);
});
