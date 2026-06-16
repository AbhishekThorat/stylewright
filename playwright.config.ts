import { defineConfig } from '@playwright/test';

// Extensions only load in a persistent context with a real (non-headless or
// new-headless) Chromium, so each test launches its own context. See
// tests/e2e/fixtures.ts.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  use: {
    trace: 'on-first-retry',
  },
});
