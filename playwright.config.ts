import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 30000,
  retries: 0,
  projects: [
    {
      name: 'counter',
      testMatch: /counter\.spec\.ts$/,
      use: {
        baseURL: 'http://localhost:3000',
        headless: true,
      },
    },
    {
      name: 'blog',
      testMatch: /blog\.spec\.ts$/,
      use: {
        baseURL: 'http://localhost:3001',
        headless: true,
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter example-counter exec tsx server.ts',
      port: 3000,
      timeout: 15000,
      reuseExistingServer: true,
    },
    {
      command: 'PORT=3001 pnpm --filter example-blog exec tsx server.ts',
      port: 3001,
      timeout: 15000,
      reuseExistingServer: true,
    },
  ],
});
