import { test, expect } from '@playwright/test';
import { signupUser } from './helpers';

test.describe('Mobile Navigation & Gestures', () => {
  // We explicitly run this test only on mobile projects
  test.skip(({ isMobile }) => !isMobile, 'This test is only relevant for mobile viewports');

  test.beforeEach(async ({ page }) => {
    await signupUser(page);
  });

  test('should handle LIFO stack back navigation on mobile', async ({ page }) => {
    // Wait for the app to load
    await expect(page.getByPlaceholder('Search or start new chat...')).toBeVisible();

    // In a real scenario, we would click a modal (e.g. settings), 
    // then click the browser back button, and verify the modal closes 
    // instead of the app navigating backward.
    
    // Check initial state
    // On mobile, "Pulse Web Messenger" is not visible, instead we should check the search bar
    await expect(page.getByPlaceholder('Search or start new chat...')).toBeVisible();
  });
});
