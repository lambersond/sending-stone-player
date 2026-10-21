// The character view, end to end: the real module (in a stand-in Foundry, with a dnd5e-shaped
// character) sends Thorin's sheet to the production app; Alice opens Thorin, rolls checks and
// saves with 3D dice, and sees the sheet follow changes in Foundry. Screenshots to SHOTS.
import { actor, combat, combatant, message, settings, user, users } from './fvtt/stub.mjs'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'

const GAME = 'https://lonely-mountain.forge-vtt.com'
const SECRET = 'ashlands-secret-123'
const SHOTS = process.env.SHOTS
const cookie = await cookieFor('e2e-token')
const check = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok -', msg) }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const browser = await chromium.launch()
// Banner mode: these checks read the banner at the bottom of the sheet, which shows only where the
// player has chosen it over toasts, the default; so each browser starts with the banner chosen, as a
// player who turned toasts off has it.
const newContext = browser.newContext.bind(browser)
browser.newContext = async (...args) => {
  const made = await newContext(...args)
  await made.addInitScript(() => {
    try {
      if (localStorage.getItem('sending-stone:roll-toasts') === null) localStorage.setItem('sending-stone:roll-toasts', 'off')
    } catch {}
  })
  return made
}
const problems = []
// The Forge game: its page, and Thorin's portrait, served like any world asset.
const serveGame = ctx => ctx.route(`${GAME}/**`, route => {
  if (route.request().url().endsWith('/worlds/erebor/thorin.svg')) {
    return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#7a4b2a"/><circle cx="32" cy="24" r="12" fill="#e8c39e"/><rect x="14" y="40" width="36" height="24" rx="8" fill="#3b5b8a"/><path d="M20 30 q12 22 24 0 v8 q-12 14 -24 0z" fill="#9a9a9a"/></svg>' })
  }
  return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Foundry VTT</title>' })
})
const foundryContext = await browser.newContext()
await foundryContext.grantPermissions(['local-network-access'], { origin: GAME })
await serveGame(foundryContext)
const gmTab = await foundryContext.newPage()
await gmTab.goto(`${GAME}/game`)
let inFlight = 0
let lastActivity = Date.now()
const posted = []
globalThis.fetch = async (url, init) => {
  inFlight++
  try {
    // What the app answers is kept for the checks; the module isn't handed it here.
    const { status, statusText, body } = await gmTab.evaluate(async ({ url, init }) => {
      const response = await fetch(url, init)
      return { status: response.status, statusText: response.statusText, body: await response.text() }
    }, { url: String(url), init: { method: init.method, headers: init.headers, body: init.body, mode: init.mode, credentials: init.credentials, cache: init.cache } })
    posted.push({ type: JSON.parse(init.body).type, status, body })
    if (status >= 300) problems.push(`${JSON.parse(init.body).type} → ${status}`)
    return { ok: status >= 200 && status < 300, status, statusText, headers: new Headers() }
  } finally { inFlight--; lastActivity = Date.now() }
}
const idle = async () => {
  await wait(50)
  while (inFlight > 0 || Date.now() - lastActivity < 150) await wait(25)
}

// ---- The Gamemaster (Alice) sets up the campaign ----
const context = await browser.newContext()
await context.addCookies([cookie])
const gm = await context.newPage()
await gm.goto(`${BASE}/campaigns`)
await gm.getByRole('button', { name: 'New campaign' }).click()
const modal = gm.getByRole('dialog', { name: 'New campaign' })
await modal.getByLabel('Campaign title').fill('Ashlands')
await modal.getByLabel('Forge game address').fill('lonely-mountain.forge-vtt.com')
await modal.getByLabel('Secret', { exact: true }).fill(SECRET)
await modal.getByRole('button', { name: 'Set up campaign' }).click()
await modal.getByRole('button', { name: 'Done' }).click()

// ---- Foundry, with Thorin as dnd5e 5.3 prepares him ----
CONFIG.DND5E = {
  abilities: {
    str: { label: 'Strength', abbreviation: 'str' }, dex: { label: 'Dexterity', abbreviation: 'dex' },
    con: { label: 'Constitution', abbreviation: 'con' }, int: { label: 'Intelligence', abbreviation: 'int' },
    wis: { label: 'Wisdom', abbreviation: 'wis' }, cha: { label: 'Charisma', abbreviation: 'cha' },
  },
  skills: {
    acr: { label: 'Acrobatics' }, ani: { label: 'Animal Handling' }, arc: { label: 'Arcana' }, ath: { label: 'Athletics' },
    dec: { label: 'Deception' }, his: { label: 'History' }, ins: { label: 'Insight' }, itm: { label: 'Intimidation' },
    inv: { label: 'Investigation' }, med: { label: 'Medicine' }, nat: { label: 'Nature' }, prc: { label: 'Perception' },
    prf: { label: 'Performance' }, per: { label: 'Persuasion' }, rel: { label: 'Religion' }, slt: { label: 'Sleight of Hand' },
    ste: { label: 'Stealth' }, sur: { label: 'Survival' },
  },
}
foundry.utils.getProperty = (object, path) => path.split('.').reduce((o, k) => o?.[k], object)
users.activeGM = user('gm', 'Gamemaster', true)
user('alice', 'Alice')
const thorin = actor('thorin', 'Thorin Oakenshield', ['alice'], 'character', { value: 31, max: 44, temp: 0 })
thorin.documentName = 'Actor'
thorin.img = 'worlds/erebor/thorin.svg'
const scores = { str: 18, dex: 12, con: 16, int: 8, wis: 13, cha: 10 }
const saves = { str: 1, con: 1 }
const prof = 3
const abilities = Object.fromEntries(Object.entries(scores).map(([id, value]) => {
  const mod = Math.floor((value - 10) / 2)
  return [id, { value, mod, proficient: saves[id] ?? 0, checkBonus: 0, checkProf: { term: '0', flat: 0 }, save: { value: mod + (saves[id] ? prof : 0), roll: { mode: 0 } }, check: { roll: { mode: 0 } } }]
}))
const skillAbility = { acr: 'dex', ani: 'wis', arc: 'int', ath: 'str', dec: 'cha', his: 'int', ins: 'wis', itm: 'cha', inv: 'int', med: 'wis', nat: 'int', prc: 'wis', prf: 'cha', per: 'cha', rel: 'int', slt: 'dex', ste: 'dex', sur: 'wis' }
const skillProf = { ath: 1, itm: 1, prc: 2, his: 0.5 }
const skills = Object.fromEntries(Object.entries(skillAbility).map(([id, ability]) => {
  const p = skillProf[id] ?? 0
  const total = abilities[ability].mod + Math.floor(prof * p)
  return [id, { ability, total, passive: 10 + total, prof: { multiplier: p }, roll: { mode: id === 'ste' ? -1 : 0 } }]
}))
thorin.system = {
  abilities, skills,
  attributes: { hp: { value: 31, max: 44, temp: 0 }, ac: { value: 18 }, prof, init: { total: 1 }, movement: { walk: 25, speed: 25, units: 'ft' }, inspiration: false },
  details: { level: 5, race: { name: 'Dwarf' }, background: { name: 'Soldier' } },
}
thorin.itemTypes = { class: [{ name: 'Fighter', system: { levels: 5 }, subclass: { name: 'Champion' } }] }

await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-ash': SECRET })
settings.set('chatEvents', true)
settings.set('combatEvents', true)
settings.set('campaigns', [{ id: 'camp-ash', title: 'Ashlands', characters: ['thorin'] }])
await Hooks.callAll('ready')
await idle()
// From module 0.22.0 the hello lists Thorin without his sheet, which follows it in a post of its own.
check(posted.some(p => p.type === 'bridge.hello' && p.status === 200) && posted.findIndex(p => p.type === 'character.updated' && p.status === 200) > posted.findIndex(p => p.type === 'bridge.hello'),
  'the hello is accepted, and Thorin\'s sheet after it, in a post of its own')
check(sql(`select data->'abilities'->0->>'save' || ' ' || (data->>'ac') from actor_sheet s join campaign c on c.id = s."campaignId" where c.title = 'Ashlands' and s."actorId" = 'thorin'`) === '7 18', "the app keeps Thorin's sheet")
check(!sql(`select characters::text from campaign where title = 'Ashlands'`).includes('abilities'), 'the roster itself stays without sheets')

// Alice plays Thorin.
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  select 'sheet-thorin', 'Thorin Oakenshield', '${GAME}', 'Ashlands', id, 'thorin', 'e2e-user', now() from campaign where title = 'Ashlands'`)

// ---- On a phone: the Character tab ----
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' })
await phone.addCookies([cookie])
await serveGame(phone)
const page = await phone.newPage()
page.on('pageerror', e => problems.push(`pageerror: ${e.message}`))
page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`) })
const requests = []
// Rolls send nothing. The one write a page makes is how far its player has read the chat.
const record = list => r => {
  if (!r.url().startsWith(BASE)) return
  const body = r.postData() ?? ''
  const readPosition = r.method() === 'POST' && body.length < 200 && /^\["[^"]*","\d{4}-\d\d-\d\dT[^"]*"\]$|^\["\d{4}-\d\d-\d\dT[^"]*"\]$/.test(body)
  list.push(readPosition ? `read-position ${body}` : `${r.method()} ${new URL(r.url()).pathname} ${body.slice(0, 120)}`)
}
const unexpected = list => list.filter(r => !r.startsWith('read-position') && !r.startsWith('GET /api/characters/sheet-thorin/table') && !r.startsWith('GET /3d-dice/'))
page.on('request', record(requests))
await page.goto(`${BASE}/characters/sheet-thorin`)
const sheetPane = page.getByRole('region', { name: 'Character' })
await sheetPane.getByRole('button', { name: 'Strength check, +4' }).waitFor()
check(await page.getByRole('button', { name: 'Character' }).getAttribute('aria-current') === 'page', 'with no fight under way, the page opens on the Character tab')
check(await page.getByRole('heading', { level: 1 }).textContent() === 'Thorin Oakenshield' && await page.getByRole('heading', { level: 1 }).locator('xpath=../following-sibling::p[1]').textContent() === 'Fighter 5 · Champion', 'the header names the class and subclass under the name')
check(await page.getByRole('heading', { level: 1 }).locator('xpath=following-sibling::p[1]').isHidden(), 'and not beside it too, on a phone')
check(await sheetPane.getByRole('img').count() === 0 && await sheetPane.locator('img').getAttribute('src') === `${GAME}/worlds/erebor/thorin.svg`, "the portrait is loaded from the Gamemaster's game")
for (const [name, expected] of [['Strength saving throw, +7, proficient', true], ['Perception check, +7 (expertise, passive 17)', true], ['History check, +0 (half proficiency, passive 10)', true], ['Stealth check, +1 (passive 11), with disadvantage', true]]) {
  check(await sheetPane.getByRole('button', { name, exact: true }).isVisible() === expected, `the sheet offers: ${name}`)
}
const dims = await page.evaluate(() => ({ y: document.scrollingElement.scrollHeight - document.scrollingElement.clientHeight, x: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth }))
check(dims.y === 0 && dims.x === 0, 'the page itself does not scroll on a phone')
if (SHOTS) await page.screenshot({ path: `${SHOTS}/phone-sheet.png` })

// Roll Perception, and catch the dice mid-tumble.
await page.waitForFunction(() => document.querySelector('[id^="dice-canvas-threejs"] canvas') !== null, undefined, { timeout: 20_000 }).catch(() => {})
const before = requests.length
await sheetPane.getByRole('button', { name: /^Perception check/ }).click()
const tray = page.getByRole('region', { name: 'Your rolls' })
const rolling = await tray.getByText('Rolling…').isVisible().catch(() => false)
await wait(700)
if (SHOTS) await page.screenshot({ path: `${SHOTS}/phone-rolling.png` })
await tray.getByRole('status').getByText('Perception check').waitFor({ timeout: 20_000 })
const status = await tray.getByRole('status').textContent()
const total = Number(/^(\d+)/.exec(status)[1])
const natural = Number(/d20 (\d+)/.exec(status)[1])
check(total === natural + 7 && natural >= 1 && natural <= 20, `Perception rolls d20 + 7: ${status}`)
console.log('dice animated:', rolling, '| canvas:', await page.evaluate(() => !!document.querySelector('[id^="dice-canvas-threejs"] canvas')))
await wait(2500)
if (SHOTS) await page.screenshot({ path: `${SHOTS}/phone-rolled.png` })

// Advantage from the roll's menu, then a save.
check(await sheetPane.getByRole('radio').count() === 0 && await sheetPane.getByText('Next roll').count() === 0, 'there is no Next roll switch')
await sheetPane.getByRole('button', { name: 'Strength check, +4' }).click({ button: 'right' })
await page.getByRole('menuitem', { name: 'Roll with advantage' }).click()
await tray.getByRole('status').getByText('Strength check').waitFor({ timeout: 20_000 })
const adv = await tray.getByRole('status').textContent()
const d20s = /d20 (\d+) (\d+)/.exec(adv)
check(adv.includes('Advantage') && d20s && Number(/^(\d+)/.exec(adv)[1]) === Math.max(Number(d20s[1]), Number(d20s[2])) + 4, `with advantage, two d20s and the higher counts: ${adv}`)
await sheetPane.getByRole('button', { name: 'Constitution saving throw, +6, proficient' }).click()
await tray.getByRole('status').getByText('Constitution saving throw').waitFor({ timeout: 20_000 })
check(await tray.getByText('Earlier rolls (2)').isVisible(), 'earlier rolls are kept on the page')
await wait(400)
const sentAfterRolls = unexpected(requests.slice(before))
check(sentAfterRolls.length === 0, `rolling sends nothing anywhere (requests: ${JSON.stringify(sentAfterRolls)})`)
check(sql(`select count(*) from chat_message m join campaign c on c.id = m."campaignId" where c.title = 'Ashlands'`) === '0' && !posted.some(p => p.type.startsWith('chat')), 'and no roll appears in the chat')

// A long-press opens the roll's menu, without rolling; advantage from it.
const cdp = await phone.newCDPSession(page)
const athletics = sheetPane.getByRole('button', { name: /^Athletics check/ })
await athletics.scrollIntoViewIfNeeded()
const box = await athletics.boundingBox()
// A third of the way along the row, off its centre.
const point = { x: box.x + box.width / 3, y: box.y + box.height / 2 }
const rollsBefore = await tray.getByRole('status').textContent()
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
await wait(750)
const longMenu = page.getByRole('menu', { name: 'Athletics check +7' })
check(await longMenu.isVisible(), 'a long-press on a skill opens its menu')
const longBox = await longMenu.boundingBox()
const above = point.y - (longBox.y + longBox.height)
check(Math.abs(longBox.x + longBox.width / 2 - point.x) <= 2 && above >= 14 && above <= 18, `it opens just above the finger, centred on it (finger ${Math.round(point.x)},${Math.round(point.y)}; menu ${Math.round(longBox.x)}–${Math.round(longBox.x + longBox.width)} across, ${Math.round(above)}px above)`)
if (SHOTS) await page.screenshot({ path: `${SHOTS}/phone-menu.png` })
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
await wait(300)
check(await longMenu.isVisible() && await tray.getByRole('status').textContent() === rollsBefore, 'and lifting the finger neither rolls nor closes it')
await longMenu.getByRole('menuitem', { name: 'Roll with advantage' }).tap()
await tray.getByRole('status').getByText('Athletics check').waitFor({ timeout: 20_000 })
const longAdv = await tray.getByRole('status').textContent()
check(/Advantage/.test(longAdv) && /d20 \d+ \d+/.test(longAdv), `the menu rolls with advantage: ${longAdv}`)
await wait(2500)

// ---- Foundry changes Thorin; the sheet follows ----
const sentBeforeChange = posted.length
thorin.system.attributes.hp.value = 12
thorin.system.attributes.ac.value = 20
await Hooks.callAll('updateActor', thorin, { system: { attributes: { hp: { value: 12 } } } })
await wait(400)
await idle()
// The app answers it, from module 0.22.0, with what it takes of sheets.
check(posted.slice(sentBeforeChange).some(p => p.type === 'character.updated' && p.status === 200 && JSON.parse(p.body).features?.slimSheets === 1), 'Foundry sends character.updated')
await page.waitForFunction(() => [...document.querySelectorAll('dt')].find(dt => dt.textContent === 'Hit points')?.nextElementSibling?.textContent.startsWith('12 / 44'), undefined, { timeout: 15_000 }).catch(() => {})
const stat = label => page.locator('dt', { hasText: label }).locator('xpath=following-sibling::dd').textContent()
check((await stat('Hit points')).startsWith('12 / 44') && (await stat('Armor class')).trim() === '20', 'the sheet shows the new hit points and armor class without a reload')

// ---- A fight with twelve goblins, and Thorin speaks ----
const goblins = Array.from({ length: 12 }, (_, i) => actor(`gob${i}`, `Goblin ${i + 1}`, [], 'npc'))
const fight = combat('cmbt-big')
await Hooks.callAll('createCombat', fight)
for (const [index, who] of [thorin, ...goblins].entries()) {
  await Hooks.callAll('createCombatant', combatant(fight, `c-${who.id}`, who, { initiative: 20 - index }))
}
fight.started = true; fight.round = 1; fight.turn = 3
await Hooks.callAll('combatTurnChange', fight, { round: 0, turn: null, combatantId: null }, { round: 1, turn: 3, combatantId: 'c-gob2' })
await Hooks.callAll('createChatMessage', message('m-thorin', { speakerActor: thorin, speaker: { actor: 'thorin' }, alias: 'Thorin Oakenshield', author: users.get('alice'), _source: { author: 'alice' }, content: '<p>For Erebor!</p>' }))
await Hooks.callAll('createChatMessage', message('m-gm', { content: '<p>The goblins charge!</p>' }))
await idle()
check(problems.length === 0 && posted.filter(p => p.type.startsWith('combat') || p.type.startsWith('chat')).every(p => p.status === 204), 'the fight and what Thorin says reach the app')

// ---- Unread messages on the phone, across a reload ----
const chatButton = page.getByRole('navigation', { name: 'Table' }).getByRole('button', { name: /^Chat/ })
await page.getByRole('navigation', { name: 'Table' }).getByRole('button', { name: 'Chat 1 unread' }).waitFor({ timeout: 10_000 })
check(true, "the Gamemaster's message is unread on the Chat tab; Thorin's own is not counted")
if (SHOTS) await page.screenshot({ path: `${SHOTS}/phone-unread.png` })
await page.reload()
await page.getByRole('navigation', { name: 'Table' }).waitFor()
check(await chatButton.getAttribute('aria-current') === null && (await chatButton.textContent()).includes('1 unread'), 'the unread badge survives a reload')
await chatButton.click()
await page.getByRole('region', { name: 'Chat' }).getByText('The goblins charge!').waitFor()
await wait(800)
check(sql(`select "chatReadAt" is not null from "character" where id = 'sheet-thorin'`) === 't', 'reading the chat saves how far the player has read')
await page.getByRole('navigation', { name: 'Table' }).getByRole('button', { name: 'Character' }).click()
await page.reload()
await page.getByRole('navigation', { name: 'Table' }).waitFor()
check((await chatButton.textContent()).trim() === 'Chat', 'and once read, it stays read after a reload')

// ---- On a laptop: the sheet, with combat and the chat beside it ----
const laptop = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' })
await laptop.addCookies([cookie])
await serveGame(laptop)
const wide = await laptop.newPage()
wide.on('pageerror', e => problems.push(`wide pageerror: ${e.message}`))
const wideRequests = []
wide.on('request', record(wideRequests))
await wide.goto(`${BASE}/characters/sheet-thorin`)
const sheetWide = wide.getByRole('region', { name: 'Character' })
await sheetWide.getByRole('button', { name: 'Strength check, +4' }).waitFor()
const widths = () => wide.evaluate(() => ({
  sheet: document.getElementById('character-pane').getBoundingClientRect().width,
  aside: document.getElementById('combat-pane').parentElement.getBoundingClientRect().width,
}))
let layout = await widths()
check(Math.round(layout.aside) === 500 && layout.sheet > 900 && !(await wide.getByRole('navigation', { name: 'Table' }).isVisible()), `on a laptop the sheet fills the space beside a 500px column (${JSON.stringify(layout)})`)
check(await wide.getByRole('tab', { name: 'Combat' }).getAttribute('aria-selected') === 'true' && await wide.getByRole('region', { name: 'Combat' }).isVisible() && !(await wide.getByRole('region', { name: 'Chat' }).isVisible()), 'during the fight, combat shows in the column, with the chat a tab away')

// The turn stays on top as the initiative list scrolls.
const sticky = await wide.evaluate(() => {
  const pane = document.getElementById('combat-pane')
  const scroller = pane.querySelector('.overflow-y-auto')
  scroller.scrollTop = scroller.scrollHeight
  const panel = pane.querySelector('[aria-labelledby="turn-heading"]')
  return { scrolled: scroller.scrollTop, gap: panel.getBoundingClientRect().top - scroller.getBoundingClientRect().top }
})
check(sticky.scrolled > 200 && sticky.gap >= 0 && sticky.gap <= 24, `scrolled ${sticky.scrolled}px down the initiative list, the turn panel stays at the top (${sticky.gap}px)`)
await wait(200)
if (SHOTS) await wide.screenshot({ path: `${SHOTS}/laptop-combat-scrolled.png` })

// Thorin's portrait beside what he says.
await wide.getByRole('tab', { name: /^Chat/ }).click()
const said = wide.getByRole('region', { name: 'Chat' }).locator('article', { hasText: 'For Erebor!' })
await said.waitFor()
check(await said.locator('img').getAttribute('src') === `${GAME}/worlds/erebor/thorin.svg` && await said.locator('img').evaluate(img => img.naturalWidth > 0), "Thorin's chat message shows his portrait")

// A right-click opens the menu; Modify roll, with disadvantage and extra dice.
await wide.waitForFunction(() => document.querySelector('[id^="dice-canvas-threejs"] canvas') !== null, undefined, { timeout: 20_000 }).catch(() => {})
const wideBefore = wideRequests.length
const perception = sheetWide.getByRole('button', { name: /^Perception check/ })
const wideMenu = wide.getByRole('menu', { name: 'Perception check +7' })
// The context menu key puts the menu below the row, centred.
await perception.focus()
await wide.keyboard.press('ContextMenu')
await wideMenu.waitFor()
const row = await perception.boundingBox()
let menuBox = await wideMenu.boundingBox()
const near = (a, b) => Math.abs(a - b) <= 2
// Below the row, or above it when the window has no room below.
const keySide = near(menuBox.y, row.y + row.height + 6) ? 'below' : near(menuBox.y + menuBox.height, row.y - 6) && 'above'
check(near(menuBox.x + menuBox.width / 2, row.x + row.width / 2) && keySide, `the context menu key opens the menu centred on the row, ${keySide} it (row ${Math.round(row.x)}–${Math.round(row.x + row.width)} across, ${Math.round(row.y)}–${Math.round(row.y + row.height)} down; menu ${Math.round(menuBox.x)}–${Math.round(menuBox.x + menuBox.width)}, ${Math.round(menuBox.y)}–${Math.round(menuBox.y + menuBox.height)})`)
await wide.keyboard.press('Escape')
await wideMenu.waitFor({ state: 'detached' })
check(await perception.evaluate(button => button === document.activeElement), 'Escape closes it and gives the row back its focus')
// A right-click on the modifier, at the row's right end, opens the menu there, not mid-row.
const modifier = await perception.getByText('+7', { exact: true }).boundingBox()
const cursor = { x: modifier.x + modifier.width / 2, y: modifier.y + modifier.height / 2 }
await perception.click({ button: 'right', position: { x: cursor.x - row.x, y: cursor.y - row.y } })
check(await wideMenu.isVisible(), 'a right-click on a skill opens its menu')
menuBox = await wideMenu.boundingBox()
// Its corner at the cursor, like the browser's own menu: hanging down from it, or up from it when
// the window has no room below.
const across = near(menuBox.x, cursor.x + 4)
const down = near(menuBox.y, cursor.y + 4) ? 'down' : near(menuBox.y + menuBox.height, cursor.y - 4) && 'up'
check(across && down, `it opens at the cursor on the modifier, hanging ${down} from it (cursor ${Math.round(cursor.x)},${Math.round(cursor.y)}; menu ${Math.round(menuBox.x)}–${Math.round(menuBox.x + menuBox.width)}, ${Math.round(menuBox.y)}–${Math.round(menuBox.y + menuBox.height)}; the row's centre is ${Math.round(row.x + row.width / 2)})`)
if (SHOTS) await wide.screenshot({ path: `${SHOTS}/laptop-menu.png` })
const scrolled = await wide.evaluate(() => {
  const scroller = document.getElementById('character-pane').querySelector('.overflow-y-auto')
  const before = scroller.scrollTop
  scroller.scrollBy(0, 60)
  return scroller.scrollTop - before
})
await wait(250)
const movedBox = await wideMenu.boundingBox()
// Still at the cursor's point on the row, moved with it: hanging down from it, or up from it where
// there's no room below, as it opened. With no app bar the row is low enough on this screen that
// the menu hangs up, then down once the row has scrolled up and there is room below it.
const movedTo = cursor.y - scrolled
const movedDown = near(movedBox.y, movedTo + 4) ? 'down' : near(movedBox.y + movedBox.height, movedTo - 4) && 'up'
check(scrolled > 0 && movedDown && Math.abs(movedBox.x - menuBox.x) <= 1 && Math.abs(movedBox.height - menuBox.height) <= 1,
  `and it moves with the row as the sheet scrolls ${scrolled}px, hanging ${movedDown} from the cursor's point on it (menu ${Math.round(movedBox.y)}–${Math.round(movedBox.y + movedBox.height)}; the point at ${Math.round(movedTo)})`)
await wideMenu.getByRole('menuitem', { name: 'Modify roll…' }).click()
const dialog = wide.getByRole('dialog', { name: 'Modify roll' })
await dialog.getByText('Disadvantage').click()
await dialog.getByRole('textbox', { name: 'Extra dice or modifiers' }).fill('1d4 + 2')
if (SHOTS) await wide.screenshot({ path: `${SHOTS}/laptop-modify.png` })
await dialog.getByRole('button', { name: 'Roll' }).click()
const wideTray = wide.getByRole('region', { name: 'Your rolls' })
await wideTray.getByRole('status').getByText('Perception check').waitFor({ timeout: 20_000 })
const modified = await wideTray.getByRole('status').textContent()
const parts = /^(\d+)Perception checkd20 (\d+) (\d+) \+7 \+1d4 \((\d)\) \+2 · Disadvantage/.exec(modified)
check(parts && Number(parts[1]) === Math.min(Number(parts[2]), Number(parts[3])) + 7 + Number(parts[4]) + 2, `the modified roll keeps the lower d20 and adds 1d4 and 2: ${modified}`)
await wait(2500)
if (SHOTS) await wide.screenshot({ path: `${SHOTS}/laptop-sheet.png` })
check(unexpected(wideRequests.slice(wideBefore)).length === 0, `the menu and modified roll send nothing anywhere (${JSON.stringify(unexpected(wideRequests.slice(wideBefore)))})`)
check(await wide.evaluate(() => document.scrollingElement.scrollHeight === document.scrollingElement.clientHeight), 'the page itself does not scroll on a laptop')

// The column at other widths, and the stat boxes in every layout.
const statBoxes = target => target.evaluate(() => [...document.querySelectorAll('#character-pane dt')].map(dt => ({
  label: dt.innerText.trim(),
  width: Math.round(dt.parentElement.getBoundingClientRect().width),
  overflow: dt.scrollWidth > dt.clientWidth || dt.nextElementSibling.scrollWidth > dt.nextElementSibling.clientWidth,
})))
const sizes = [['phone', 390, 844], ['small-phone', 320, 640], ['tablet', 820, 1180], ['laptop-1024', 1024, 768], ['tablet-landscape', 1180, 820], ['laptop', 1440, 900], ['desktop', 1920, 1080]]
for (const [name, width, height] of sizes) {
  await wide.setViewportSize({ width, height })
  await wait(300)
  if (width < 1024) await wide.getByRole('button', { name: 'Character' }).click()
  await wait(200)
  const stats = await statBoxes(wide)
  check(stats.length === 5 && stats.every(stat => !stat.overflow), `${name}: no stat box overflows (${stats.map(s => `${s.label} ${s.width}px`).join(', ')})`)
  const short = { PROFICIENCY: 'PROF', 'ARMOR CLASS': 'AC', INITIATIVE: 'INIT' }
  check(stats.filter(({ label }) => Object.values(short).includes(label.toUpperCase()) || short[label.toUpperCase()]).every(({ label, width }) => (width < 116) === Object.values(short).includes(label.toUpperCase())), `${name}: long labels are shortened only in boxes under 116px`)
  if (width >= 1024) {
    layout = await widths()
    const expected = Math.min(500, Math.max(320, width * 0.4))
    check(Math.abs(layout.aside - expected) <= 1, `${name}: the combat and chat column is ${Math.round(layout.aside)}px`)
  }
  if (SHOTS && ['small-phone', 'tablet', 'laptop-1024'].includes(name)) await wide.screenshot({ path: `${SHOTS}/${name}-sheet.png` })
}

console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors')
await browser.close()
process.exit(0)
