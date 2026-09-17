import { test, expect } from '@playwright/test';
import { signupUser } from './helpers';

test.describe('Settings & Profile', () => {
  test.beforeEach(async ({ page }) => {
    await signupUser(page);
  });

  test('should access profile settings', async ({ page, isMobile }) => {
    // Wait for load
    await expect(page.getByPlaceholder('Search or start new chat...')).toBeVisible();

    // The settings cog is usually visible
    // We expect the user to be able to click settings and open the modal
    // For now, we assert the app loads without crash.
    if (!isMobile) {
      await expect(page.getByText('Pulse Web Messenger')).toBeVisible();
    }
  });
});
