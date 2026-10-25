import { defineConfig, devices } from '@playwright/test'

// Runs the production build in WebKit (Safari's engine) on an iPhone-sized screen.
// Build first: `npm run build && npm run test:e2e`.
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: 'http://localhost:4173/practice-app/', trace: 'retain-on-failure' },
  projects: [{ name: 'iPhone WebKit', use: { ...devices['iPhone 13'] } }],
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/practice-app/',
    reuseExistingServer: !process.env.CI,
  },
})
