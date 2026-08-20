#!/usr/bin/env node
/* End-to-end smoke test: builds the app, serves it, drives every page and the
   keyboard shortcuts in headless Chromium. Run: npm run test:ui */
import { spawn, execSync } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = 4187
const base = `http://localhost:${PORT}`
const root = new URL('..', import.meta.url).pathname

execSync('npm --prefix app run build', { cwd: root, stdio: 'inherit' })
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root + 'app', stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 1500))

const failures = []
const check = (cond, msg) => { if (!cond) failures.push(msg) }

try {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`console ${m.text()}`))

  for (const r of ['/', '/learn', '/learn/06-s3', '/drill', '/cards', '/exam', '/mistakes', '/cheatsheet', '/progress']) {
    await page.goto(base + r, { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), `${r}: horizontal overflow`)
  }

  // lecture iframe renders a diagram and reports its height
  await page.goto(base + '/learn/08-vpc', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check((await page.frameLocator('iframe').locator('figure.diagram').count()) >= 2, 'lecture iframe: diagrams missing')
  check((await page.locator('iframe').evaluate((f) => f.getBoundingClientRect().height)) > 3000, 'lecture iframe: height not reported')

  // nav shortcuts
  await page.keyboard.press('k'); await page.waitForTimeout(200)
  check(page.url().endsWith('/cheatsheet'), 'shortcut k did not open the cheat sheet')
  await page.keyboard.press('['); await page.waitForTimeout(200)
  check((await page.locator('aside').count()) === 0, 'shortcut [ did not hide the sidebar')
  await page.keyboard.press('[')

  // drill: pick, rate confidence, check, next
  await page.goto(base + '/drill', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Start' }).click()
  await page.keyboard.press('1'); await page.keyboard.press('s'); await page.keyboard.press('Enter'); await page.waitForTimeout(300)
  check((await page.locator('text=/Why [A-E]/').count()) === 1, 'drill: explanation not revealed')
  await page.keyboard.press('Enter'); await page.waitForTimeout(300)
  check((await page.locator('text=2/10').count()) === 1, 'drill: Enter did not advance')

  // cards: flip and grade
  await page.goto(base + '/cards', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Start' }).click()
  await page.keyboard.press('Space'); await page.waitForTimeout(400)
  check(await page.getByRole('button', { name: /Good/ }).isVisible(), 'cards: space did not flip')
  await page.keyboard.press('3'); await page.waitForTimeout(200)
  check((await page.locator('text=/149 left/').count()) === 1, 'cards: grade key did not advance')

  // exam: quick mode, answer all, submit, review
  await page.goto(base + '/exam', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Quick/ }).click(); await page.waitForTimeout(200)
  for (let i = 0; i < 15; i++) { await page.keyboard.press('1'); if (i < 14) await page.keyboard.press('ArrowRight') }
  await page.getByRole('button', { name: 'Finish' }).click()
  await page.getByRole('button', { name: 'Submit' }).last().click(); await page.waitForTimeout(500)
  check((await page.locator('text=/15 correct|\\/15 correct/').count()) === 1, 'exam: results not shown')
  await page.getByRole('button', { name: 'Review every question' }).click(); await page.waitForTimeout(300)
  check((await page.locator('text=Q15').count()) === 1, 'exam: review missing questions')

  check(errors.length === 0, `browser errors: ${errors.join(' | ')}`)
  await browser.close()
} catch (e) {
  failures.push(`crashed: ${e.message}`)
} finally {
  server.kill()
}

if (failures.length) {
  console.error(`✗ smoke failed:\n  - ${failures.join('\n  - ')}`)
  process.exit(1)
}
console.log('✓ smoke ok — every page renders, shortcuts work, no browser errors')
