import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './creds';

test('switching user cards replaces the profile and keeps Question Banks interactive', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email', { exact: true }).fill(ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'User Profiles', exact: true }).click();
  let previous = 'Kenny';
  for (const name of ['Henry', 'Moon', 'Kenny', 'Henry']) {
    await page.getByRole('link', { name: new RegExp(`^${name} ${name.toLowerCase()} ·`) }).click();
    await expect(page.getByRole('region', { name: `Profile for ${previous}`, exact: true })).toHaveCount(0);
    const profile = page.getByRole('region', { name: `Profile for ${name}`, exact: true });
    await expect(profile).toHaveCount(1);
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    await profile.getByRole('tab', { name: 'Question Banks', exact: true }).click();
    await expect(profile.getByLabel('Published shared or private bank')).toBeVisible();
    await expect(profile.getByRole('button', { name: `Assign bank to ${name}`, exact: true })).toBeEnabled();
    await profile.getByRole('tab', { name: 'Profile', exact: true }).click();
    await expect(profile.getByLabel('Display name', { exact: true })).toHaveValue(name);
    previous = name;
  }
});
