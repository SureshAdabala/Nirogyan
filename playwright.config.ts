import { defineConfig, devices } from '@playwright/test';

const clientUrl = process.env.P10_CLIENT_URL ?? 'http://127.0.0.1:3100';
const outputDirectory = process.env.P10_PLAYWRIGHT_OUTPUT_DIR ?? './tmp/p10-playwright/artifacts';
const reportDirectory = process.env.P10_PLAYWRIGHT_REPORT_DIR ?? './tmp/p10-playwright/report';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: outputDirectory,
  timeout: 1_200_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { outputFolder: reportDirectory, open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    actionTimeout: 15_000,
    baseURL: clientUrl,
    locale: 'en-IN',
    navigationTimeout: 300_000,
    timezoneId: 'Asia/Kolkata',
    permissions: ['clipboard-read', 'clipboard-write'],
    screenshot: 'only-on-failure',
    trace: 'on',
    video: 'on',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
