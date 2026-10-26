import { test, expect, devices, type Browser, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

/*
 * Visual check for dependency updates (run by CI on Dependabot branches):
 * screenshots every screen of the app built before the update (./base) and
 * after it (.), with the same made-up data, and requires them to be identical.
 * A dependency update should never change how the app looks.
 */

const BUILDS = { base: 'http://localhost:4181/practice-app/', head: 'http://localhost:4180/practice-app/' }
const FIXTURE = fileURLToPath(new URL('fixture.json', import.meta.url))
const OUT = fileURLToPath(new URL('../../test-results/visual/', import.meta.url))

async function screens(browser: Browser, baseURL: string): Promise<Map<string, Buffer>> {
  const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 1500 }, baseURL })
  const page = await context.newPage()
  // The same "random" draws in both builds.
  await page.addInitScript(() => {
    let s = 42
    Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
  })
  const shots = new Map<string, Buffer>()
  // The version line names the commit, so it always differs: mask it.
  const shot = async (name: string) => {
    await page.waitForTimeout(300)
    shots.set(name, await page.screenshot({ mask: [page.getByText(/^Version /)] }))
  }
  const tap = (p: Page, role: 'button' | 'link', name: string | RegExp) =>
    p.getByRole(role, typeof name === 'string' ? { name, exact: true } : { name }).first().click()

  await page.goto('./#/import')
  await shot('01-import')
  await page.locator('input[type=file]').setInputFiles(FIXTURE)
  await page.getByText('Import complete.').waitFor()
  await shot('02-import-summary')
  await page.goto('./#/')
  await shot('03-home')
  await tap(page, 'button', /Juggling/)
  await shot('04-dashboard')
  await tap(page, 'button', 'Settings')
  await page.getByText('Advanced').click()
  await shot('05-settings')
  await tap(page, 'button', 'Delete activity')
  await shot('06-delete-confirm')
  await tap(page, 'button', 'Cancel')
  await tap(page, 'button', /← Cancel/)
  await tap(page, 'link', 'Practice')
  await shot('07-practice-chooser')
  await tap(page, 'button', /Auto Practice/)
  await shot('08-auto-setup')
  await tap(page, 'button', /Advanced Filter/)
  await shot('09-advanced-filter')
  await tap(page, 'button', /Cancel|Close|✕/)
  await tap(page, 'button', /Start/)
  await shot('10-auto-item')
  await tap(page, 'button', /Tap to reveal/)
  await shot('11-auto-item-revealed')
  await tap(page, 'button', 'Exit')
  await tap(page, 'link', 'Practice')
  await tap(page, 'button', /Manual Practice/)
  await shot('12-manual-list')
  await page.getByRole('list').getByRole('button').first().click()
  await shot('13-manual-rate')
  await page.goto('./#/')
  await tap(page, 'button', /Juggling/)
  await tap(page, 'button', 'Tricks')
  await shot('14-items-list')
  await tap(page, 'button', /^Filter/)
  await tap(page, 'button', 'Archived')
  await shot('15-items-archived')
  await page.getByRole('listitem').getByRole('link').first().click()
  await shot('16-item-page')
  await tap(page, 'button', 'Edit')
  await shot('17-item-edit')
  await tap(page, 'button', 'Tricks')
  await tap(page, 'button', /\+ Add/)
  await shot('18-item-add')
  await tap(page, 'button', 'Stats')
  await shot('19-stats')
  await tap(page, 'button', 'By session')
  await page.getByRole('button').filter({ hasText: /\d+ items?/ }).first().click({ timeout: 5000 })
  await shot('20-stats-sessions')
  await context.close()
  return shots
}

test('every screen looks the same before and after the update', async ({ browser }) => {
  test.setTimeout(240_000)
  const base = await screens(browser, BUILDS.base)
  const head = await screens(browser, BUILDS.head)
  expect([...head.keys()]).toEqual([...base.keys()])

  mkdirSync(OUT, { recursive: true })
  const changed: string[] = []
  for (const [name, before] of base) {
    const a = PNG.sync.read(before)
    const b = PNG.sync.read(head.get(name)!)
    if (a.width !== b.width || a.height !== b.height) {
      changed.push(`${name}: size ${a.width}×${a.height} → ${b.width}×${b.height}`)
      continue
    }
    const diff = new PNG({ width: a.width, height: a.height })
    const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0 })
    if (pixels > 0) {
      changed.push(`${name}: ${pixels} pixels differ`)
      // Kept for a person to look at (test-results/ is uploaded by CI on failure).
      writeFileSync(`${OUT}${name}-before.png`, before)
      writeFileSync(`${OUT}${name}-after.png`, head.get(name)!)
      writeFileSync(`${OUT}${name}-diff.png`, PNG.sync.write(diff))
    }
  }
  expect(changed, `Screens that look different after the update:\n${changed.join('\n')}`).toEqual([])
  expect(base.size).toBe(20)
})
