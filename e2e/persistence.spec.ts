import { test, expect, type Page } from '@playwright/test'

/** Number of practice logs saved in IndexedDB (not just in memory). */
function savedLogCount(page: Page): Promise<number> {
  return page.evaluate(() => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open('practice-app')
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const req = open.result.transaction('logs').objectStore('logs').count()
      req.onsuccess = () => { open.result.close(); resolve(req.result) }
      req.onerror = () => reject(req.error)
    }
  }))
}

test('a rating is saved to the database and survives a reload', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: '+ Add Activity' }).click()
  await page.getByPlaceholder('Activity name (e.g. Juggling)').fill('Juggling')
  await page.getByPlaceholder('Item label, singular (e.g. trick, route)').fill('trick')
  await page.getByRole('button', { name: 'Add', exact: true }).click()

  await page.getByRole('button', { name: /Juggling/ }).click()
  await page.getByRole('button', { name: 'Tricks' }).click()
  await page.getByRole('button', { name: '+ Add trick' }).click()
  await page.getByPlaceholder('trick name').fill('Mills Mess')
  await page.getByRole('button', { name: 'Struggled' }).click()
  await page.getByRole('button', { name: 'Add trick' }).click()

  await page.getByRole('button', { name: 'Practice' }).click()
  await page.getByRole('button', { name: /Manual Practice/ }).click()
  await page.getByRole('button', { name: /Mills Mess/ }).click()
  await page.getByRole('button', { name: 'Solid' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Saved "Mills Mess"')).toBeVisible()

  await expect.poll(() => savedLogCount(page)).toBe(1)
  await page.goto('./#/')
  await page.reload()
  await expect(page.getByText('Practiced today')).toBeVisible()
  await page.getByRole('button', { name: /Juggling/ }).click()
  await expect(page.getByRole('link', { name: /green/i })).toContainText('1')
})
