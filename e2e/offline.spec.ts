import { test, expect } from '@playwright/test'

// The installed app must open with no network once it has been visited:
// the service worker (vite-plugin-pwa) precaches everything.
test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Practice App' })).toBeVisible()
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Practice App' })).toBeVisible()
  await page.getByRole('button', { name: '+ Add Activity' }).click()
  await expect(page.getByPlaceholder('Activity name (e.g. Juggling)')).toBeVisible()
})
