import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

/** "3c760fd · Oct 25, 2026": the commit and build date, shown on Home. */
function appVersion(): string {
  let sha = process.env.GITHUB_SHA?.slice(0, 7)
  if (!sha) {
    try {
      sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    } catch {
      sha = 'dev'
    }
  }
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${sha} · ${date}`
}

export default defineConfig({
  base: '/practice-app/',
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  build: {
    outDir: 'dist',
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Practice App',
        short_name: 'Practice',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    // e2e/ holds the Playwright tests (npm run test:e2e), not Vitest ones.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    globals: true,
    // Tests assume the user's timezone so local-date behaviour is exercised
    // (UTC-7/-8: evening practice is already "tomorrow" in UTC).
    env: { TZ: 'America/Los_Angeles' },
  },
})
