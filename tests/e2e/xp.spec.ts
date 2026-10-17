import { expect, test, type APIRequestContext } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './creds';

async function adminLogin(request: APIRequestContext) {
  const res = await request.post('/api/admin/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  expect(res.ok()).toBe(true);
}

test('student earns XP for a test, sees it on the results page, home, and in Vietnamese', async ({ page }) => {
  expect((await page.request.post('/api/student/login', { data: { username: 'moon', password: '123' } })).ok()).toBe(true);
  await page.goto('/');
  await expect(page.getByTestId('xp-card')).toBeVisible();
  await expect(page.getByTestId('xp-level')).toContainText('Level 1');
  await expect(page.getByTestId('xp-chip')).toBeVisible();
  await expect(page.getByTestId('quest-correct5')).toBeVisible();

  const started = await (await page.request.post('/api/attempts', { data: { testNumber: 2 } })).json();
  const taking = await (await page.request.get(`/api/attempts/${started.attemptId}`)).json();
  for (const q of taking.questions) expect((await page.request.put(`/api/attempts/${started.attemptId}/answer`, { data: { questionId: q.id, selected: 'A' } })).ok()).toBe(true);
  expect((await page.request.post(`/api/attempts/${started.attemptId}/submit`)).ok()).toBe(true);

  await page.goto(`/results/${started.attemptId}`);
  await expect(page.getByTestId('xp-result')).toBeVisible();
  const earned = Number((await page.getByTestId('xp-result-total').innerText()).replace(/\D/g, ''));
  expect(earned).toBeGreaterThanOrEqual(20);

  await page.goto('/');
  await expect(page.getByTestId('xp-total')).toHaveText(String(earned));
  await page.getByRole('button', { name: 'Switch language' }).click();
  await expect(page.getByTestId('xp-level')).toContainText('Cấp');
  await page.goto('/progress');
  await expect(page.getByTestId('xp-progress')).toBeVisible();
  await expect(page.getByTestId('badge-first_correct')).toBeVisible();
  await page.getByRole('button', { name: 'Switch language' }).click(); // back to English for later tests
  await expect(page.getByTestId('xp-vs-last')).toBeVisible();
});

test('Smart Review shows XP feedback after a correct answer', async ({ page }) => {
  expect((await page.request.post('/api/student/login', { data: { username: 'xoai', password: '123' } })).ok()).toBe(true);
  const { sessionId } = await (await page.request.post('/api/review/smart')).json();
  await page.goto(`/review/${sessionId}`);
  let sawXp = false;
  for (let i = 0; i < 10 && !sawXp; i++) {
    await page.getByTestId('rv-option-A').click();
    await expect(page.getByTestId('review-feedback')).toBeVisible();
    sawXp = (await page.getByTestId('xp-gain').count()) > 0;
    if (!sawXp && i < 9) await page.getByTestId('review-next').click();
  }
  expect(sawXp).toBe(true);
  await expect(page.getByTestId('xp-gained')).toContainText('XP');
});

test('parent opens the shop, student redeems, parent approves', async ({ page, request }) => {
  await adminLogin(request);
  expect((await request.put('/api/admin/xp', { data: { features: { shop: true } } })).ok()).toBe(true);
  const reward = await (await request.post('/api/admin/rewards', { data: { name: 'Extra story', nameVi: 'Thêm truyện', costXp: 1, maxPerWeek: 1 } })).json();
  expect((await page.request.post('/api/student/login', { data: { username: 'moon', password: '123' } })).ok()).toBe(true);
  await page.goto('/rewards');
  await expect(page.getByTestId('reward-item')).toHaveCount(1);
  await page.getByTestId('redeem').click();
  await expect(page.getByTestId('redemption')).toContainText('Waiting');
  const list = await (await request.get('/api/admin/rewards')).json();
  const pending = list.redemptions.find((r: { status: string; reward: string }) => r.status === 'PENDING' && r.reward === 'Extra story');
  expect(pending).toBeTruthy();
  expect((await request.post(`/api/admin/redemptions/${pending.id}`, { data: { decision: 'APPROVE' } })).ok()).toBe(true);
  await page.reload();
  await expect(page.getByTestId('redemption')).toContainText('Approved');
  // tidy up so other specs see the default state
  await request.delete(`/api/admin/rewards/${reward.id}`);
  expect((await request.put('/api/admin/xp', { data: { features: { shop: false } } })).ok()).toBe(true);
  await page.goto('/rewards');
  await expect(page.getByTestId('shop-closed')).toBeVisible();
});

test('admin XP page and user XP panel load', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.goto('/admin/xp');
  await expect(page.getByRole('heading', { name: 'XP and Rewards' })).toBeVisible();
  await expect(page.getByLabel('XP per correct answer')).toHaveValue('10');
  await page.goto('/admin/students?userId=moon');
  await expect(page.getByTestId('admin-xp')).toBeVisible();
  await expect(page.getByTestId('axp-Level')).toBeVisible();
});
