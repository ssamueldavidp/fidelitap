// Authenticated browser smoke test — catches runtime bugs lint/build can't see
// (hydration mismatches, SSR races, console errors, broken pages).
//
// Requires: local Supabase + `pnpm dev` running, and a Pro/Premium-plan test
// business at the email/password below (so the Campaigns page check is meaningful).
// Run: node e2e/smoke.mjs
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'pagopro@correo.com'
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestE2E123!'
const TEST_CARD_SLUG = process.env.E2E_TEST_CARD_SLUG ?? 'prueba-de-tarjetas-fidelitap-41af'

const SHOTS = path.join(__dirname, 'screenshots')
fs.mkdirSync(SHOTS, { recursive: true })

const errors = []
const results = []

function logResult(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

// Authenticated context
const context = await browser.newContext()
const page = await context.newPage()
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`[console] ${page.url()} :: ${msg.text()}`)
})
page.on('pageerror', (err) => errors.push(`[pageerror] ${page.url()} :: ${err.message}`))

async function shot(name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true })
}

try {
  // ── Landing page ──
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await shot('01-landing')
  logResult('Landing page loads', await page.locator('text=fidelitap').first().isVisible())

  // ── Login (existing test account) ──
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[name="email"]', TEST_EMAIL)
  await page.fill('input[name="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {})
  await page.waitForLoadState('networkidle')
  await shot('02-dashboard')
  logResult('Login succeeds, lands on dashboard', page.url().includes('/dashboard'), page.url())

  // ── Cards ──
  await page.goto(`${BASE}/cards`, { waitUntil: 'networkidle' })
  await shot('03-cards')
  logResult('Cards page loads', page.url().includes('/cards'))

  await page.goto(`${BASE}/cards/nueva`, { waitUntil: 'networkidle' })
  await shot('04-cards-nueva')
  const hasEditor = await page.locator('text=Nueva tarjeta').first().isVisible().catch(() => false)
  const hasLimitNotice = await page.locator('text=Límite alcanzado').isVisible().catch(() => false)
  logResult('New card route resolves (editor or plan-limit notice)', hasEditor || hasLimitNotice, `editor=${hasEditor} limitNotice=${hasLimitNotice}`)

  // ── Customers ──
  await page.goto(`${BASE}/customers`, { waitUntil: 'networkidle' })
  await shot('05-customers')
  logResult('Customers page loads', page.url().includes('/customers'))

  // ── Campaigns (Pro/Premium should show the form, not the upsell) ──
  await page.goto(`${BASE}/campaigns`, { waitUntil: 'networkidle' })
  await shot('06-campaigns')
  const hasUpsell = await page.locator('text=disponibles en los planes').isVisible().catch(() => false)
  const hasForm = await page.locator('text=Crear campaña').isVisible().catch(() => false)
  logResult('Campaigns page shows form (test account must be Pro/Premium)', hasForm && !hasUpsell, `upsell=${hasUpsell} form=${hasForm}`)

  // ── Poster ──
  await page.goto(`${BASE}/poster`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500) // preview image generation
  await shot('07-poster')
  logResult('Poster page loads', page.url().includes('/poster'))

  // ── Settings ──
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' })
  await shot('08-settings')
  logResult('Settings page loads', page.url().includes('/settings'))

  // ── Scanner ──
  await page.goto(`${BASE}/scanner`, { waitUntil: 'networkidle' })
  await shot('09-scanner')
  logResult('Scanner page loads', page.url().includes('/scanner'))

  // ── Public activation page ──
  await page.goto(`${BASE}/c/${TEST_CARD_SLUG}`, { waitUntil: 'networkidle' })
  await shot('10-activate')
  logResult('Public activation page loads', await page.locator('text=Activar mi tarjeta').isVisible().catch(() => false))

  // ── Legal pages ──
  await page.goto(`${BASE}/privacy`, { waitUntil: 'networkidle' })
  await shot('11-privacy')
  logResult('Privacy page loads', await page.locator('text=tratamiento de datos personales').first().isVisible().catch(() => false))

  await page.goto(`${BASE}/terms`, { waitUntil: 'networkidle' })
  await shot('12-terms')
  logResult('Terms page loads', await page.locator('h1:has-text("Términos")').isVisible().catch(() => false))

  // ── Register page (must be logged out — separate incognito-style context) ──
  const loggedOutContext = await browser.newContext()
  const loggedOutPage = await loggedOutContext.newPage()
  loggedOutPage.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[console] ${loggedOutPage.url()} :: ${msg.text()}`)
  })
  await loggedOutPage.goto(`${BASE}/register?plan=basic`, { waitUntil: 'networkidle' })
  await loggedOutPage.screenshot({ path: path.join(SHOTS, '13-register.png'), fullPage: true })
  logResult('Register page loads (logged out)', await loggedOutPage.locator('text=Crea tu cuenta').isVisible().catch(() => false))
  await loggedOutContext.close()

} catch (err) {
  errors.push(`[fatal] ${err.message}`)
} finally {
  await browser.close()
}

console.log('\n=== CONSOLE/PAGE ERRORS ===')
if (errors.length === 0) console.log('(none)')
errors.forEach((e) => console.log(e))

console.log('\n=== SUMMARY ===')
const failed = results.filter((r) => !r.ok)
console.log(`${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) {
  console.log('FAILED:')
  failed.forEach((f) => console.log(` - ${f.name} ${f.detail}`))
}

process.exit(failed.length > 0 || errors.length > 0 ? 1 : 0)
