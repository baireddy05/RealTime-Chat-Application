import { test } from '@playwright/test';

// TEMPORARY studio layout verification (deleted after use)
async function login(page, tag) {
  const u = `studio_${tag}_${Date.now()}`;
  await page.goto('/signup');
  await page.fill('input[type="text"]', u);
  await page.fill('input[type="email"]', `${u}@example.com`);
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

test('studio desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, 'd');
  await page.locator('nav[aria-label="Activity Rail"] button[title="Settings"]').first().click();
  await page.waitForTimeout(1000);
  await page.getByText('Custom Colors').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/layout/studio-desktop.png' });
});

test('studio mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'm');
  await page.locator('button[title="More options"]').first().click();
  await page.waitForTimeout(500);
  const settingsItem = page.getByText('Settings & Animations').first();
  if (await settingsItem.count()) await settingsItem.click();
  await page.waitForTimeout(1000);
  await page.getByText('Custom Colors').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/layout/studio-mobile.png' });
});
