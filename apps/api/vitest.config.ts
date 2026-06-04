// Vitest settings for the API: tests use the separate test database and share it, so test files
// run one at a time and every test starts from empty tables.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
    globalSetup: ['src/test/global-setup.ts'],
    setupFiles: ['src/test/env.ts', 'src/test/reset-between-tests.ts']
  }
});
