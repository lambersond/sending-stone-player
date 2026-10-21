import { chromium } from 'playwright'
import { BASE, cookieFor } from './env.mjs'

const SHOTS = process.env.SHOTS
const sessionCookie = await cookieFor('e2e-token')
const check = (cond, msg) => { if (!cond) { throw new Error('FAIL: ' + msg) } console.log('ok -', msg) }

// Record the <html> class at the moment <main> is parsed, i.e. before the page content can paint
// and before React hydrates.
const recordFirstPaintClass = () => {
  new MutationObserver((_, observer) => {
    if (document.querySelector('main')) {
      window.__classAtMain = document.documentElement.className
      observer.disconnect()
    }
  }).observe(document, { childList: true, subtree: true })
}

const browser = await chromium.launch()
const messages = []
const watch = page => {
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) messages.push(`${m.type()}: ${m.text()}`) })
  page.on('pageerror', e => messages.push('pageerror: ' + e.message))
}
const pageBg = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor)
const isDark = page => page.evaluate(() => document.documentElement.classList.contains('dark'))
const checked = page => page.getByRole('radio', { checked: true }).getAttribute('aria-label')

// 1. Device in dark mode, nothing chosen: follows the device
const darkOs = await browser.newContext({ viewport: { width: 1100, height: 800 }, colorScheme: 'dark' })
await darkOs.addInitScript(recordFirstPaintClass)
let page = await darkOs.newPage(); watch(page)
await page.goto(BASE + '/')
await page.getByRole('radio', { name: 'System', checked: true }).waitFor()
check(await isDark(page), 'device dark + System -> dark class')
check(await page.evaluate(() => window.__classAtMain.includes('dark')), 'dark class set before <main> is parsed')
check(await pageBg(page) === 'rgb(13, 13, 20)', 'dark page background')
check(await page.evaluate(() => document.documentElement.style.colorScheme) === 'dark', 'color-scheme: dark for native controls')

// 2. Choose Light on a dark device: sticks across reloads with no flash
await page.getByRole('radio', { name: 'Light' }).click()
check(!(await isDark(page)) && await pageBg(page) === 'rgb(246, 246, 249)', 'Light applies immediately')
await page.reload()
await page.getByRole('radio', { name: 'Light', checked: true }).waitFor()
check(await page.evaluate(() => !window.__classAtMain.includes('dark') && window.__classAtMain.includes('light')), 'saved Light applied before <main> is parsed (no flash)')
check(await pageBg(page) === 'rgb(246, 246, 249)', 'Light kept after reload')

// 3. Back to System follows the device again
await page.getByRole('radio', { name: 'System' }).click()
check(await isDark(page), 'System follows the dark device again')

// 4. Device in light mode, choose Dark, signed in on the characters page
const lightOs = await browser.newContext({ viewport: { width: 1100, height: 900 }, colorScheme: 'light' })
await lightOs.addInitScript(recordFirstPaintClass)
await lightOs.addCookies([sessionCookie])
page = await lightOs.newPage(); watch(page)
await page.goto(BASE + '/characters')
await page.getByRole('radio', { name: 'System', checked: true }).waitFor()
check(!(await isDark(page)), 'device light + System -> light')
await page.getByRole('radio', { name: 'Dark' }).click()
check(await isDark(page), 'Dark applies on a light device')
await page.goto(BASE + '/characters/' + (await page.getByRole('link', { name: /Thorin/ }).getAttribute('href')).split('/').pop())
// The page's own heading: since 0.34.0 the Character pane shows on a wide screen with no sheet too,
// with its "Thorin Oakenshield's sheet hasn't arrived".
await page.getByRole('heading', { level: 1, name: 'Thorin Oakenshield', exact: true }).waitFor()
check(await isDark(page) && await page.evaluate(() => window.__classAtMain.includes('dark')), 'Dark kept on the next page with no flash')
// A character's page has no app bar, and this Thorin no sheet, so no settings: the theme is one
// tap back, on the characters list.
await page.screenshot({ path: `${SHOTS}/theme-character-dark.png` })
await page.goto(BASE + '/characters')
await page.getByRole('radio', { name: 'Dark', checked: true }).waitFor()
check(await checked(page) === 'Dark', 'toggle shows Dark')
await page.screenshot({ path: `${SHOTS}/theme-characters-dark.png`, fullPage: true })

// 5. Another tab picks up the change
const other = await lightOs.newPage(); watch(other)
await other.goto(BASE + '/')
await other.getByRole('radio', { name: 'Dark', checked: true }).waitFor()
await page.getByRole('radio', { name: 'Light' }).click()
await other.waitForFunction(() => !document.documentElement.classList.contains('dark'))
check(true, 'other tab follows the change')

// 6. Phone width, signed in: header fits
const phone = await browser.newContext({ viewport: { width: 360, height: 760 }, isMobile: true, colorScheme: 'light' })
await phone.addCookies([sessionCookie])
const m = await phone.newPage(); watch(m)
await m.goto(BASE + '/characters')
await m.getByRole('radio', { name: 'System', checked: true }).waitFor()
check(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll at 360px')
check(await m.evaluate(() => document.querySelector('header a').getBoundingClientRect().height < 30), 'brand stays on one line at 360px')
await m.getByRole('radio', { name: 'Dark' }).click()
await m.screenshot({ path: `${SHOTS}/theme-phone-dark.png` })
await m.getByRole('radio', { name: 'Light' }).click()
await m.screenshot({ path: `${SHOTS}/theme-phone-light.png` })

console.log('console messages:', JSON.stringify(messages, null, 1))
await browser.close()
