// End-to-end tests: starts the API and the web app against the test database, on their own
// ports so they never clash with `npm run dev`. Emails are read from Mailpit.
import { defineConfig, devices } from '@playwright/test';

const testDatabase = process.env.TEST_DATABASE_URL ?? 'postgres://wunan:wunan@localhost:5432/wunan_test';
const apiPort = 3100;
const webPort = 5174;
const placesPort = 3101;

export const API_URL = `http://localhost:${apiPort}`;
export const WEB_URL = `http://localhost:${webPort}`;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  globalSetup: './tests/e2e/helpers/global-setup.ts',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // A fake place-search server, so place suggestions never reach the internet.
      command: `node apps/api/src/test/places-stub.ts ${placesPort}`,
      cwd: '../..',
      url: `http://127.0.0.1:${placesPort}/api?q=riverside`,
      reuseExistingServer: false
    },
    {
      command: 'npm run dev -w apps/api',
      cwd: '../..',
      url: `${API_URL}/api/v1/health`,
      reuseExistingServer: false,
      env: {
        DATABASE_URL: testDatabase,
        API_PORT: String(apiPort),
        SITE_URL: WEB_URL,
        PHOTOS_DIR: './photos-test',
        E2E_RELAXED_LIMITS: 'true',
        PLACES_URL: `http://127.0.0.1:${placesPort}`,
        // A key pair used only by the tests, so the device-notification button is shown.
        VAPID_PUBLIC_KEY: 'BCqW4uR_wB7SZCVZ_9zzRJqI3_9-z424hVlLZvkW2xcOi_i-GQpnxl_pmV5wJxMrt3IDVUtvm_y0sO36t_VrlZc',
        VAPID_PRIVATE_KEY: 'aunHLGGAk5OXa9xzRJjf6zAY4qB4gZzfryFCb51kUI4',
        VAPID_SUBJECT: 'mailto:tests@example.org'
      }
    },
    {
      command: `npx vite dev --port ${webPort}`,
      url: WEB_URL,
      reuseExistingServer: false,
      env: {
        API_INTERNAL_URL: API_URL,
        SITE_URL: WEB_URL,
        SVELTEKIT_OUT_DIR: '.svelte-kit-e2e',
        VITE_CACHE_DIR: 'node_modules/.vite-e2e'
      }
    }
  ]
});
