import { test, expect } from '@playwright/test'

test('the page has a Content-Security-Policy that stops it contacting other sites', async ({ page }) => {
  await page.goto('./')
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(csp).toContain("connect-src 'self'")
  expect(csp).toContain("script-src 'self'")

  // Loading anything from another site must be refused by the browser, not just fail.
  const violated = await page.evaluate(() => new Promise<string>(resolve => {
    document.addEventListener('securitypolicyviolation', e => resolve(e.violatedDirective), { once: true })
    const img = new Image()
    img.src = 'https://example.com/pixel.png'
    setTimeout(() => resolve('none'), 3000)
  }))
  expect(violated).toMatch(/^img-src/)
})
