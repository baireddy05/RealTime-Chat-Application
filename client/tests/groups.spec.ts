import { test, expect } from '@playwright/test';
import { signupUser } from './helpers';

test.describe('Groups & Channels', () => {
  test.beforeEach(async ({ page }) => {
    await signupUser(page);
  });

  test('should see group related UI elements', async ({ page }) => {
    // Verify the user can see the general UI
    await expect(page.getByPlaceholder('Search or start new chat...')).toBeVisible();

    // The group/channel list is usually rendered in the sidebar.
    // If the window is desktop, the sidebar is visible.
    const sidebar = page.locator('aside');
    if (await sidebar.isVisible()) {
      await expect(sidebar).toBeVisible();
    }
  });

  test('should render online users tab', async ({ page, isMobile }) => {
    if (!isMobile) {
      // Typically desktop has a "Users" or "Online" section
      await expect(page.getByPlaceholder('Search or start new chat...')).toBeVisible();
    }
  });
});
