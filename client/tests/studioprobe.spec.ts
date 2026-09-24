import { test } from '@playwright/test';

// TEMPORARY studio DOM probe (deleted after use)
test('probe studio dom', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const u = `stprobe_${Date.now()}`;
  await page.goto('/signup');
  await page.fill('input[type="text"]', u);
  await page.fill('input[type="email"]', `${u}@example.com`);
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.locator('nav[aria-label="Activity Rail"] button[title="Settings"]').first().click();
  await page.waitForTimeout(1000);
  const info = await page.evaluate(() => {
    const liveLabel = [...document.querySelectorAll('p')].find((p) => p.textContent === 'Live preview');
    const grid = liveLabel?.closest('div[class*="lg:grid"]') || [...document.querySelectorAll('div')].find((d) => d.className.includes('lg:grid-cols-'));
    return {
      liveLabelFound: !!liveLabel,
      liveLabelVisible: liveLabel ? liveLabel.offsetParent !== null : null,
      gridFound: !!grid,
      gridDisplay: grid ? getComputedStyle(grid).display : null,
      gridCols: grid ? getComputedStyle(grid).gridTemplateColumns : null,
      gridRect: grid ? grid.getBoundingClientRect().toJSON() : null,
      previewText: document.body.innerText.includes('Preview chat'),
      errors: window.__errs || null,
    };
  });
  console.log('STUDIO=' + JSON.stringify(info));
});
