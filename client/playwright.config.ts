import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  // Generous assertions: cold Vite dev-server boot + bcrypt signup + first
  // API fan-out can exceed the 5s default under parallel load (3 browsers).
  expect: { timeout: 15000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  // webServer: [
  //   {
  //     command: 'npm run dev',
  //     url: 'http://localhost:5000', // server
  //     cwd: '../server',
  //     reuseExistingServer: !process.env.CI,
  //   },
  //   {
  //     command: 'npm run dev',
  //     url: 'http://localhost:5173', // client
  //     cwd: './',
  //     reuseExistingServer: !process.env.CI,
  //   },
  // ],
});
