import { defineConfig } from '@playwright/test'

// Visual check for dependency updates: compares the app built before the update
// (./base, a git worktree) with the app built after it (.). See e2e/visual/.
// Locally: git worktree add base main && (cd base && npm ci && npm run build)
//          && npm run build && npm run test:visual
export default defineConfig({
  testDir: 'e2e/visual',
  testMatch: '*.visual.ts',
  forbidOnly: !!process.env.CI,
  workers: 1,
  use: { browserName: 'webkit' },
  webServer: [
    { command: 'npm run preview -- --port 4180 --strictPort', url: 'http://localhost:4180/practice-app/', reuseExistingServer: !process.env.CI },
    { command: 'npm run preview -- --port 4181 --strictPort', cwd: 'base', url: 'http://localhost:4181/practice-app/', reuseExistingServer: !process.env.CI },
  ],
})
