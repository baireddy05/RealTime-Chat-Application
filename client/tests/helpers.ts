import { Page } from '@playwright/test';

export async function signupUser(page: Page) {
  const testUser = {
    username: `testuser_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: `testuser_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@example.com`,
    password: 'password123',
  };

  await page.goto('/signup');
  await page.fill('input[type="text"]', testUser.username);
  await page.fill('input[type="email"]', testUser.email);
  await page.fill('input[type="password"]', testUser.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
  return testUser;
}
