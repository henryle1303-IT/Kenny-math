import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const res = await page.request.post('/api/student/login', { data: { username: 'kenny', password: '123' } });
  expect(res.ok()).toBe(true);
});

test('student: pick a test, answer, refresh without losing progress, submit, review, Smart Review, progress', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Kenny Math Challenge' })).toBeVisible();
  await page.getByRole('link', { name: 'Math Tests' }).first().click();
  await expect(page.getByTestId('test-card-1')).toBeVisible();
  await expect(page.getByTestId('test-card-30')).toBeVisible();
  await expect(page.getByText('30 questions').first()).toBeVisible();

  await page.getByTestId('test-card-1').getByRole('button', { name: 'Start' }).click();
  await expect(page).toHaveURL(/\/attempt\//);
  await expect(page.getByTestId('timer')).toContainText(/(29|30):\d\d/);
  await expect(page.getByTestId('progress-text')).toHaveText('Question 1 of 30');

  // answer the first 6 questions with option A, navigate with Next
  for (let i = 0; i < 6; i++) {
    await page.getByTestId('option-A').click();
    await expect(page.getByTestId('option-A')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('next').click();
  }
  await expect(page.getByTestId('progress-text')).toHaveText('Question 7 of 30');
  const timerBefore = await page.getByTestId('timer').innerText();

  // refresh: answers and timer persist
  await page.reload();
  await expect(page.getByTestId('timer')).toContainText(/(29|30):\d\d|(2[0-9]):\d\d/);
  const mins = Number((await page.getByTestId('timer').innerText()).trim().split(':')[0]);
  expect(mins).toBeLessThanOrEqual(Number(timerBefore.trim().split(':')[0]));
  await page.getByRole('button', { name: 'Question 3, answered' }).click();
  await expect(page.getByTestId('option-A')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: 'Question 20, not answered' })).toBeVisible();

  // change an answer, then go to the last question and submit with confirmation
  await page.getByTestId('option-B').click();
  await expect(page.getByTestId('option-B')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('submit-open').click();
  await expect(page.getByRole('dialog')).toContainText('6 of 30');
  await page.getByRole('button', { name: 'Keep working' }).click();
  await page.getByTestId('submit-open').click();
  await page.getByTestId('submit-confirm').click();

  await expect(page).toHaveURL(/\/results\//);
  await expect(page.getByTestId('score')).toBeVisible();
  await expect(page.getByText('Unanswered').first()).toBeVisible();

  // review answers with explanations
  await page.getByTestId('review-answers').click();
  await expect(page.getByTestId('review-q-1')).toBeVisible();
  await expect(page.getByText('Step by step').first()).toBeVisible();
  await page.goto(page.url().replace(/\?.*/, '') + '?filter=wrong');
  const similar = page.getByRole('button', { name: 'Try a Similar Question' }).first();
  await similar.click();
  await expect(page).toHaveURL(/\/review\//);
  await expect(page.getByTestId('review-question')).toBeVisible();
  await page.getByTestId('rv-option-A').click();
  await expect(page.getByTestId('review-feedback')).toBeVisible();

  // Smart Review: practise my mistakes (10 questions)
  await page.goto('/review');
  await page.getByTestId('practice-mistakes').click();
  await expect(page).toHaveURL(/\/review\/.+/);
  for (let i = 0; i < 10; i++) {
    await page.getByTestId('rv-option-B').click();
    await expect(page.getByTestId('review-feedback')).toBeVisible();
    await page.getByTestId(i < 9 ? 'review-next' : 'review-finish').click();
  }
  await expect(page.getByTestId('review-score')).toBeVisible();

  await page.goto('/progress');
  await expect(page.getByRole('heading', { name: 'My Learning Progress' })).toBeVisible();
  await expect(page.getByText('Skill mastery')).toBeVisible();
  await page.goto('/');
  await expect(page.getByText('Tests completed')).toBeVisible();
});

test('student UI works on a phone-sized screen without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  for (const url of ['/', '/tests', '/progress', '/review']) {
    await page.goto(url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, url).toBeLessThanOrEqual(1);
  }
  await page.goto('/tests');
  await page.getByTestId('test-card-2').getByRole('button', { name: 'Start' }).click();
  await expect(page.getByTestId('question-text')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('admin area is protected and student pages expose no admin controls', async ({ page, request }) => {
  const res = await request.get('/api/admin/banks');
  expect(res.status()).toBe(401);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto('/');
  await expect(page.getByText(/admin/i)).toHaveCount(0);
});
