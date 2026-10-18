import { expect, test } from '@playwright/test';

test('public install metadata and icon files are available before sign-in', async ({ page, request }) => {
  await page.goto('/login');
  const link = page.locator('link[rel="manifest"]');
  await expect(link).toHaveCount(1);
  const href = await link.getAttribute('href');
  expect(href).toBeTruthy();
  const response = await request.get(href!);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/manifest+json');
  const manifest = await response.json();
  expect(manifest).toMatchObject({ id: '/', name: 'TuanLeUp', short_name: 'TuanLeUp', display: 'standalone', start_url: '/', scope: '/', theme_color: '#1d4ed8', background_color: '#eff6ff' });
  for (const [src, size] of [
    ['/icons/icon-192.png', 192], ['/icons/icon-512.png', 512],
    ['/icons/icon-maskable-512.png', 512], ['/icons/apple-touch-icon.png', 180],
  ] as const) {
    const icon = await request.get(src);
    expect(icon.status()).toBe(200);
    expect(icon.headers()['content-type']).toContain('image/png');
    const png = await icon.body();
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  }
  await expect(page.locator('meta[name="application-name"]')).toHaveAttribute('content', 'TuanLeUp');
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveCount(1);
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'TuanLeUp');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1d4ed8');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/apple-touch-icon.png');
  const browserManifest = await (await page.context().newCDPSession(page)).send('Page.getAppManifest');
  expect(browserManifest.errors).toEqual([]);
  expect(JSON.parse(browserManifest.data!)).toMatchObject({ name: 'TuanLeUp', display: 'standalone' });
  expect((await request.get('/api/student/xp')).status()).toBe(401);
  expect((await request.get('/api/admin/users')).status()).toBe(401);
});

test('phone and tablet layouts keep login and student navigation usable without a service worker', async ({ page }) => {
  for (const viewport of [{ width: 375, height: 812 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Sign in / Đăng nhập', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Username / Tên đăng nhập', { exact: true }).fill('henry');
  await page.getByLabel('Password / Mật khẩu', { exact: true }).fill('123');
  await page.getByRole('button', { name: 'Sign in / Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Henry Math Challenge', exact: true })).toBeVisible();
  await expect(page).toHaveTitle('Henry Math Challenge');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  expect(await page.evaluate(async () => await caches.keys())).toEqual([]);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('/login');
});
