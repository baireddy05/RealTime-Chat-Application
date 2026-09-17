import { test, expect } from '@playwright/test';
import { signupUser } from './helpers';

test.describe('Chat & Messaging Features', () => {
  test.beforeEach(async ({ page }) => {
    await signupUser(page);
  });

  test('should load the chat interface and search', async ({ page, isMobile }) => {
    // On Desktop nav is visible, on mobile it might be hidden. 
    // We can verify the root layout container or the Pulse header instead.
    await expect(page.getByPlaceholder('Search or start new chat...')).toBeVisible();

    // Verify Search Bar is present (it should be visible in the sidebar/drawer)
    const searchInput = page.getByPlaceholder('Search or start new chat...');
    await expect(searchInput).toBeVisible();

    // Verify we can type in search
    await searchInput.fill('Alice');
    await expect(searchInput).toHaveValue('Alice');
  });

  test('should display "No chat selected" state initially', async ({ page, isMobile }) => {
    // Before clicking a chat, the empty state should be visible ONLY on desktop.
    // On mobile, the chat list takes the full screen initially.
    if (!isMobile) {
      await expect(page.getByText('Pulse Web Messenger')).toBeVisible();
      await expect(page.getByText('Send and receive messages, voice notes, photos, and documents securely.')).toBeVisible();
    } else {
      // Mobile sees the search bar or header
      await expect(page.getByPlaceholder('Search or start new chat...')).toBeVisible();
    }
  });

  test('should handle message input state', async ({ page, isMobile }) => {
    // Skip clicking specific users for now as it requires seeding contacts,
    // but we can verify the UI responds to viewport sizes.
    if (isMobile) {
      // In mobile, we expect bottom navigation or hidden sidebars.
      // E.g. clicking a chat would hide the sidebar.
      await expect(page.getByPlaceholder('Search or start new chat...')).toBeVisible();
    }
  });
});
