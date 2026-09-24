import { test } from '@playwright/test';

// TEMPORARY preview render probe (deleted after use)
test('probe preview render', async ({ page }) => {
  const logs = [];
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + String(e?.message || e).slice(0, 400)));
  page.on('console', (m) => {
    if (['error', 'warning'].includes(m.type())) logs.push(m.type().toUpperCase() + ': ' + m.text().slice(0, 300));
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  const u = `pv_${Date.now()}`;
  await page.goto('/signup');
  await page.fill('input[type="text"]', u);
  await page.fill('input[type="email"]', `${u}@example.com`);
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.locator('nav[aria-label="Activity Rail"] button[title="Settings"]').first().click();
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const all = [...document.querySelectorAll('div')];
    const previewCol = all.find((d) => d.textContent.includes('Live preview'));
    return {
      previewColHTML: previewCol ? previewCol.innerHTML.slice(0, 600) : null,
      hasMiniRail: document.body.innerHTML.includes('MiniRail') ? true : document.body.innerText.includes('Ava'),
      bodyLen: document.body.innerHTML.length,
    };
  });
  console.log('PV=' + JSON.stringify(info));
  console.log('PVLOGS=' + JSON.stringify(logs.slice(0, 10)));
});
