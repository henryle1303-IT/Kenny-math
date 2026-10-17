import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Runs last (file name sorts after the other specs) because the demo bank takes a bank version number.
test.beforeAll(() => {
  execFileSync(process.execPath, [path.resolve('node_modules/tsx/dist/cli.mjs'), 'scripts/demo-seed.ts'], { env: { ...process.env, DATABASE_URL: `file:${path.resolve('prisma/e2e.db')}` }, stdio: 'inherit' });
});

test.beforeEach(async ({ page }) => {
  const res = await page.request.post('/api/student/login', { data: { username: 'demo', password: '123' } });
  expect(res.ok()).toBe(true);
});

async function start(page: Page, n: number) {
  await page.goto('/tests');
  await page.getByTestId(`test-card-${n}`).getByRole('button', { name: /Start|Bắt đầu|Resume|Tiếp tục|Retry|Làm lại/ }).click();
  await expect(page).toHaveURL(/\/attempt\//);
}
const next = (page: Page) => page.getByTestId('next').click();

test('demo user sees only its three tests', async ({ page }) => {
  await page.goto('/tests');
  for (const n of [1, 11, 21]) await expect(page.getByTestId(`test-card-${n}`)).toBeVisible();
  await expect(page.getByTestId('test-card-2')).toHaveCount(0);
});

test('test 11: numeric, multiple choice, fill blanks, true/false, multi select and ordering', async ({ page }) => {
  await start(page, 11);
  await expect(page.getByTestId('progress-text')).toHaveText(/1 .* 6|Question 1 of 6/);

  // 1 numeric input: an equivalent decimal is accepted; it saves by itself after a pause
  await page.getByTestId('answer-input').fill('0.75');
  await page.getByTestId('answer-input').blur();
  await next(page);
  // 2 multiple choice
  await page.getByTestId('option-C').click();
  await expect(page.getByTestId('option-C')).toHaveAttribute('aria-checked', 'true');
  await next(page);
  // 3 fill in the blanks (the TeX fractions in the text must stay intact)
  await expect(page.getByTestId('question-text')).toContainText('[ 1 ]');
  await expect(page.getByTestId('question-text').locator('.katex').first()).toBeVisible();
  await page.getByTestId('blank-1').fill('1');
  await page.getByTestId('blank-2').fill('10');
  await page.getByTestId('blank-2').blur();
  await next(page);
  // 4 true / false
  await page.getByTestId('tf-1-true').click();
  await page.getByTestId('tf-2-false').click();
  await page.getByTestId('tf-3-true').click();
  await expect(page.getByTestId('tf-2-false')).toHaveAttribute('aria-checked', 'true');
  await next(page);
  // 5 multi select: choose the 1st and 3rd
  await page.getByTestId('multi-0').click();
  await page.getByTestId('multi-2').click();
  await expect(page.getByTestId('multi-0')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('multi-1')).toHaveAttribute('aria-checked', 'false');
  await next(page);
  // 6 ordering: the list starts shuffled and cannot be right before anything is moved
  const indexes = async () => (await page.locator('[data-testid^="order-item-"]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-index')))));
  expect(await indexes()).not.toEqual([0, 1, 2, 3]);
  // selection sort with the arrow buttons: item i belongs at position i (items are stored in the right order)
  for (let target = 0; target < 4; target++) {
    for (let guard = 0; guard < 8; guard++) {
      const pos = (await indexes()).indexOf(target);
      if (pos <= target) break;
      await page.getByTestId(`order-up-${pos + 1}`).click();
      await expect.poll(async () => (await indexes()).indexOf(target)).toBe(pos - 1);
    }
  }
  expect(await indexes()).toEqual([0, 1, 2, 3]);
  await expect(page.locator('[data-testid^="order-item-"]')).toHaveCount(4);

  // everything is saved: reload keeps the answers
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByRole('button', { name: /Question 6, answered/ })).toBeVisible();
  await page.getByRole('button', { name: /Question 1, answered/ }).click();
  await expect(page.getByTestId('answer-input')).toHaveValue('0.75');
  await page.getByRole('button', { name: /Question 3, answered/ }).click();
  await expect(page.getByTestId('blank-2')).toHaveValue('10');

  await page.getByTestId('submit-open').click();
  await page.getByTestId('submit-confirm').click();
  await expect(page).toHaveURL(/\/results\//);
  await page.getByRole('link', { name: /review/i }).first().click();
  // all six answers (including the decimal 0.75 for a fraction answer) are marked correct
  for (let n = 1; n <= 6; n++) await expect(page.getByTestId(`review-q-${n}`)).toContainText(/Correct|Đúng/);
  await expect(page.getByTestId('review-typed-1')).toContainText('0.75');
});

test('test 21: wrong answers show the right answer in the review and typed text ignores capital letters', async ({ page }) => {
  await start(page, 21);
  await page.getByTestId('answer-input').fill('13');
  await page.getByTestId('answer-input').blur();
  await next(page);
  await page.getByTestId('option-A').click();
  await next(page);
  await page.getByTestId('answer-input').fill('Cube');
  await page.getByTestId('answer-input').blur();
  await page.getByTestId('submit-open').click();
  await page.getByTestId('submit-confirm').click();
  await expect(page).toHaveURL(/\/results\//);
  await page.goto(page.url() + '/review');
  await expect(page.getByTestId('review-typed-1')).toContainText('13');
  await expect(page.getByTestId('review-typed-1')).toContainText('6.5');
  // capital letters do not matter for typed text: "Cube" was marked right
  await expect(page.getByTestId('review-q-3')).toContainText(/Correct|Đúng/);
});
