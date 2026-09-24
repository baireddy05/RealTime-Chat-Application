import { test } from '@playwright/test';

// TEMPORARY studio screenshot (deleted after use)
test('studio shot now', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const u = `st2_${Date.now()}`;
  await page.goto('/signup');
  await page.fill('input[type="text"]', u);
  await page.fill('input[type="email"]', `${u}@example.com`);
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.locator('nav[aria-label="Activity Rail"] button[title="Settings"]').first().click();
  await page.waitForTimeout(1200);
  await page.getByText('Custom Colors').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test-results/layout/studio-now.png' });
});
