import { defineConfig } from '@playwright/test';
const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  use: {
    baseURL: 'http://127.0.0.1:5175', headless: true,
    ...(executablePath ? { launchOptions: { executablePath, args:['--no-sandbox'] } } : { channel: 'chrome' }),
  },
  webServer: {
    command: 'npm run dev -- --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175',
    env: { VITE_SUPABASE_URL:'https://subway-test.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY:'test-publishable-key' },
    reuseExistingServer: false,
  },
  reporter: 'list',
});
