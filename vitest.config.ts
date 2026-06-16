import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests live next to the code under src/. Playwright owns tests/e2e.
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
