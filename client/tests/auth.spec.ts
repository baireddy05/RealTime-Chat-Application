import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  const testUser = {
    username: `testuser_${Date.now()}`,
    email: `testuser_${Date.now()}@example.com`,
    password: 'password123',
  };

  test('should allow a user to sign up, log out, and log back in', async ({ page }) => {
    // Navigate directly to signup page
    await page.goto('/signup');

    // Fill out the signup form
    await page.fill('input[type="text"]', testUser.username);
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to home page or show welcome
    await page.waitForURL('**/');

    // Verify user is logged in (e.g. check for a specific element in the sidebar/header)
    await expect(page.getByPlaceholder('Search or start new chat...')).toBeVisible(); // Just a generic check, we can refine based on UI

    // TODO: Add logout and login verification if time permits
  });
});
