#!/usr/bin/env node
/* End-to-end smoke test: builds the app, serves it, drives every page and the
   keyboard shortcuts in headless Chromium. Run: npm run test:ui */
import { spawn, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { chromium } from 'playwright'

const PORT = 4187
const base = process.env.SMOKE_BASE_URL ?? `http://localhost:${PORT}`
const root = new URL('..', import.meta.url).pathname

// Only .env.local is loaded automatically: this harness writes study activity.
// For an external server, supply dedicated SAA_TEST_* account credentials.
if (!process.env.SMOKE_BASE_URL && existsSync(root + 'app/.env.local')) loadEnvFile(root + 'app/.env.local')
const email = process.env.SAA_TEST_EMAIL ?? (!process.env.SMOKE_BASE_URL ? process.env.OWNER_EMAIL : undefined)
const password = process.env.SAA_TEST_PASSWORD ?? (!process.env.SMOKE_BASE_URL ? process.env.OWNER_PASSWORD : undefined)
if (!email || !password) throw new Error('Set SAA_TEST_EMAIL and SAA_TEST_PASSWORD for a dedicated test account.')
let server
if (!process.env.SMOKE_BASE_URL) {
  if (!process.env.SMOKE_SKIP_BUILD) execSync('npm run build', { cwd: root, stdio: 'inherit' })
  // Match the test origin for Better Auth cookies and CSRF validation.
  server = spawn('npx', ['next', 'start', '--port', String(PORT)], {
    cwd: root + 'app', stdio: 'ignore', env: { ...process.env, BETTER_AUTH_URL: base },
  })
  for (let retry = 0; retry < 60; retry++) {
    try { if ((await fetch(base)).ok) break } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
}

const failures = []
const check = (cond, msg) => { if (!cond) failures.push(msg) }

let browser
try {
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`console ${m.text()} ${m.location().url}`))
  page.on('response', async (response) => {
    if (response.status() === 409) { const body = await response.json().catch(() => ({})); errors.push(`conflict ${JSON.stringify(body.paths ?? body.error)}`) }
  })

  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.locator('#main-content').waitFor()
  // Reset only resumable sessions belonging to the explicitly supplied test account.
  const reset = await page.evaluate(async () => {
    const current = await (await fetch('/api/progress')).json()
    const changes = ['activeDrill', 'activeExam'].filter((key) => current.data[key] != null).map((key) => ({ path: [key], before: current.data[key], after: null }))
    if (!changes.length) return true
    return (await fetch('/api/progress', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operationId: crypto.randomUUID(), revision: current.revision, changes }) })).ok
  })
  check(reset, 'test account session reset failed')
  await page.reload({ waitUntil: 'networkidle' })
  console.log('smoke: authenticated, checking routes')

  for (const r of ['/', '/learn', '/learn/06-s3', '/drill', '/cards', '/exam', '/mistakes', '/cheatsheet', '/progress', ...(existsSync(root + 'app/src/app/(study)/maps/page.tsx') ? ['/maps'] : [])]) {
    await page.goto(base + r, { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), `${r}: horizontal overflow`)
  }

  // Lectures are native app content: diagrams and deep links share the page.
  await page.goto(base + '/learn/08-vpc', { waitUntil: 'networkidle' })
  check((await page.locator('.lecture-prose figure.diagram').count()) >= 2, 'lecture: diagrams missing')
  check((await page.locator('iframe').count()) === 0, 'lecture: still embedded in an iframe')
  const heading = page.locator('.lecture-prose h2[id]').first()
  check(await heading.isVisible(), 'lecture: native section headings missing')

  // nav shortcuts
  await page.keyboard.press('k'); await page.waitForTimeout(200)
  check(page.url().endsWith('/cheatsheet'), 'shortcut k did not open the cheat sheet')
  await page.keyboard.press('['); await page.waitForTimeout(200)
  check((await page.locator('aside').count()) === 0, 'shortcut [ did not hide the sidebar')
  await page.keyboard.press('[')

  // drill: pick, rate confidence, check, next
  await page.goto(base + '/drill', { waitUntil: 'networkidle' })
  const endDrill = page.getByRole('button', { name: 'End', exact: true })
  if (await endDrill.isVisible()) await endDrill.click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await page.keyboard.press('1'); await page.keyboard.press('s'); await page.keyboard.press('Enter'); await page.waitForTimeout(300)
  check((await page.locator('text=/Why [1-8]/').count()) === 1, 'drill: explanation not revealed')
  await page.keyboard.press('Enter'); await page.waitForTimeout(300)
  check((await page.locator('text=2/10').count()) === 1, 'drill: Enter did not advance')

  console.log('smoke: drill passed')

  // hard bank: a v2 drill must count against the v2 bank only
  const answered = () => page.locator('xpath=//div[text()="Answered"]/following-sibling::div[1]').first().textContent().then(Number)
  await page.goto(base + '/progress', { waitUntil: 'networkidle' })
  const originalBefore = await answered()
  await page.getByRole('button', { name: 'Hard', exact: true }).click(); await page.waitForTimeout(200)
  const hardBefore = await answered()

  await page.goto(base + '/drill?bank=v2', { waitUntil: 'networkidle' })
  const endHard = page.getByRole('button', { name: 'End', exact: true })
  if (await endHard.isVisible()) await endHard.click()
  check(await page.getByRole('button', { name: 'Hard', exact: true }).getAttribute('aria-pressed') === 'true', 'drill: ?bank=v2 did not select the hard bank')
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await page.keyboard.press('1'); await page.keyboard.press('Enter'); await page.waitForTimeout(400)
  check((await page.locator('text=/Why [1-8]/').count()) === 1, 'drill: hard bank explanation not revealed')
  await page.getByRole('button', { name: 'End', exact: true }).click()

  await page.goto(base + '/progress', { waitUntil: 'networkidle' })
  check(await answered() === originalBefore, 'progress: a hard-bank answer leaked into the original bank')
  await page.getByRole('button', { name: 'Hard', exact: true }).click(); await page.waitForTimeout(200)
  check(await answered() === hardBefore + 1, 'progress: the hard-bank answer was not counted against the hard bank')
  console.log('smoke: hard bank passed')
  // cards: flip and grade
  await page.goto(base + '/cards', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Start' }).click()
  await page.keyboard.press('Space'); await page.waitForTimeout(400)
  check(await page.getByRole('button', { name: /Good/ }).isVisible(), 'cards: space did not flip')
  const beforeGrade = Number((await page.locator('text=/\\d+ left/').first().textContent()).match(/\d+/)[0])
  await page.keyboard.press('3'); await page.waitForTimeout(200)
  const afterGrade = Number((await page.locator('text=/\\d+ left/').first().textContent()).match(/\d+/)[0])
  check(afterGrade === beforeGrade - 1, `cards: grade key did not advance (${beforeGrade} → ${afterGrade})`)

  console.log('smoke: cards passed')
  // exam: quick mode, answer all, submit, review
  await page.goto(base + '/exam', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Quick/ }).click(); await page.waitForTimeout(200)
  for (let i = 0; i < 15; i++) { await page.keyboard.press('1'); if (i < 14) await page.keyboard.press('ArrowRight') }
  await page.getByRole('button', { name: 'Finish' }).click()
  await page.getByRole('button', { name: 'Submit' }).last().click(); await page.waitForTimeout(500)
  check((await page.locator('text=/15 correct|\\/15 correct/').count()) === 1, 'exam: results not shown')
  await page.getByRole('button', { name: 'Review every question' }).click(); await page.waitForTimeout(300)
  check((await page.locator('text=Q15').count()) === 1, 'exam: review missing questions')

  console.log('smoke: exam passed')
  // maps: select a service, reveal the bad design, move the canvas, keep a note
  if (existsSync(root + 'app/src/app/(study)/maps/[id]/page.tsx')) {
    const mapUrl = base + '/maps/order-checkout'
    const viewport = () => page.evaluate(() => document.querySelector('.react-flow__viewport').style.transform)
    await page.goto(mapUrl, { waitUntil: 'networkidle' })
    await page.locator('.react-flow__node[data-id="api"]').waitFor()

    await page.locator('.react-flow__node[data-id="api"]').click(); await page.waitForTimeout(200)
    check(await page.getByText('Validates the request boundary').isVisible(), 'maps: click did not explain the selected service')
    // Nodes are focusable: the keyboard must select without a pointer.
    await page.locator('.react-flow__node[data-id="queue"]').focus()
    await page.keyboard.press('Enter'); await page.waitForTimeout(200)
    check(await page.getByText('The queue absorbs spikes').isVisible(), 'maps: Enter did not select the focused service')

    await page.getByRole('button', { name: 'Show bad examples' }).click(); await page.waitForTimeout(200)
    check(await page.getByText('Where the design breaks').isVisible(), 'maps: bad examples did not appear')
    check((await page.locator('.react-flow__node', { hasText: 'Bad example' }).count()) > 0, 'maps: bad nodes carry no non-colour marker')
    await page.getByRole('button', { name: 'Hide bad examples' }).click(); await page.waitForTimeout(200)
    check((await page.locator('.react-flow__node', { hasText: 'Bad example' }).count()) === 0, 'maps: bad examples did not toggle off')

    const atRest = await viewport()
    const pane = await page.locator('.react-flow__pane').boundingBox()
    await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2)
    await page.mouse.down(); await page.mouse.move(pane.x + pane.width / 2 - 140, pane.y + pane.height / 2 - 70, { steps: 8 }); await page.mouse.up()
    await page.waitForTimeout(200)
    const panned = await viewport()
    check(panned !== atRest, 'maps: dragging did not pan the canvas')
    await page.getByRole('button', { name: 'Zoom In' }).click(); await page.waitForTimeout(400)
    check((await viewport()) !== panned, 'maps: zoom control did not change the canvas')

    const note = `smoke note ${Date.now()}`
    await page.getByRole('tab', { name: 'My notes' }).click()
    await page.getByLabel('Architecture notes').fill(note)
    await page.getByLabel('Architecture notes').blur()
    await page.waitForTimeout(1200)
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('tab', { name: 'My notes' }).click()
    check((await page.getByLabel('Architecture notes').inputValue()) === note, 'maps: the note did not survive a reload')

    await page.setViewportSize({ width: 390, height: 844 })
    for (const r of ['/maps', '/maps/order-checkout']) {
      await page.goto(base + r, { waitUntil: 'networkidle' })
      await page.waitForTimeout(300)
      check(!(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), `${r}: horizontal overflow at 390px`)
    }
    await page.setViewportSize({ width: 1280, height: 900 })
    console.log('smoke: maps passed')
  }

  check(errors.length === 0, `browser errors: ${errors.join(' | ')}`)
  await browser.close()
} catch (e) {
  failures.push(`crashed: ${e.message}`)
} finally {
  await browser?.close()
  server?.kill()
}

if (failures.length) {
  console.error(`✗ smoke failed:\n  - ${failures.join('\n  - ')}`)
  process.exit(1)
}
console.log('✓ smoke ok — every page renders, shortcuts work, no browser errors')
