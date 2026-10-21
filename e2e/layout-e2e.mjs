// The game table with a long chat and a big fight, at phone, tablet and desktop sizes: does the
// page itself scroll, as well as the pane? Screenshots to SHOTS.
import { actor, combat, combatant, message, settings, user, users } from './fvtt/stub.mjs'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'

const GAME = 'https://lonely-mountain.forge-vtt.com'
const SECRET = 'ashlands-secret-123'
const SHOTS = process.env.SHOTS
const EXPECT = process.env.EXPECT ?? 'report'
const cookie = await cookieFor('e2e-token')
const check = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok -', msg) }

const browser = await chromium.launch()
const problems = []
const foundry = await browser.newContext()
await foundry.grantPermissions(['local-network-access'], { origin: GAME })
await foundry.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Foundry VTT</title>' }))
const gmTab = await foundry.newPage()
await gmTab.goto(`${GAME}/game`)
let inFlight = 0
let lastActivity = Date.now()
globalThis.fetch = async (url, init) => {
  inFlight++
  try {
    const { status, statusText } = await gmTab.evaluate(async ({ url, init }) => {
      const response = await fetch(url, init)
      return { status: response.status, statusText: response.statusText }
    }, { url: String(url), init: { method: init.method, headers: init.headers, body: init.body, mode: init.mode, credentials: init.credentials, cache: init.cache } })
    if (status >= 300) problems.push(`${JSON.parse(init.body).type} → ${status}`)
    return { ok: status >= 200 && status < 300, status, statusText, headers: new Headers() }
  } finally { inFlight--; lastActivity = Date.now() }
}
const idle = async () => {
  await new Promise(resolve => setTimeout(resolve, 50))
  while (inFlight > 0 || Date.now() - lastActivity < 150) await new Promise(resolve => setTimeout(resolve, 25))
}

// The Gamemaster (Alice) sets up the campaign, then Foundry connects.
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

users.activeGM = user('gm', 'Gamemaster', true)
user('alice', 'Alice')
const thorin = actor('thorin', 'Thorin Oakenshield', ['alice'], 'character', { value: 31, max: 44, temp: 0 })
const goblins = Array.from({ length: 11 }, (_, i) => actor(`gob${i}`, `Goblin ${i + 1}`, [], 'npc', { value: 7, max: 7, temp: 0 }))
await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-ash': SECRET })
settings.set('chatEvents', true)
settings.set('combatEvents', true)
settings.set('campaigns', [{ id: 'camp-ash', title: 'Ashlands', characters: ['thorin'] }])
await Hooks.callAll('ready')
await idle()

// Alice plays Thorin.
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  select 'layout-thorin', 'Thorin Oakenshield', '${GAME}', 'Ashlands', id, 'thorin', 'e2e-user', now() from campaign where title = 'Ashlands'`)

// A fight with twelve combatants, and forty messages.
const fight = combat('cmbt-big')
await Hooks.callAll('createCombat', fight)
for (const [index, who] of [thorin, ...goblins].entries()) {
  await Hooks.callAll('createCombatant', combatant(fight, `c-${who.id}`, who, { initiative: 20 - index + 0.01 * index }))
}
fight.started = true; fight.round = 2; fight.turn = 3
await Hooks.callAll('combatTurnChange', fight, { round: 2, turn: 2, combatantId: 'c-gob1' }, { round: 2, turn: 3, combatantId: 'c-gob2' })
const by = who => ({ speakerActor: who, speaker: { actor: who.id }, alias: who.name, author: users.get('alice'), _source: { author: 'alice' } })
// Rolls carry text only for screen readers, which stretched the page as well.
const DamageRoll = CONFIG.Dice.DamageRoll
const die = (faces, values) => ({ expression: `${values.length}d${faces}`, faces, number: values.length, results: values.map(result => ({ result, active: true })) })
const damage = (total, values) => Object.assign(new DamageRoll(), { formula: '2d8 + 4', total, dice: [die(8, values)], options: { type: 'piercing' } })
const rolled = i => i % 4 === 0 ? { rolls: [damage(15, [6, 5])], flags: { dnd5e: { messageType: 'roll', roll: { type: 'damage' }, item: { id: 'axe', type: 'weapon' }, targets: [] } }, getAssociatedItem: () => ({ name: 'Axe', type: 'weapon' }) } : {}
for (let i = 1; i <= 40; i++) {
  const line = i % 3 === 0 ? 'A longer line of table talk, to wrap across the bubble on a narrow screen and fill it out.' : `Message ${i}`
  await Hooks.callAll('createChatMessage', message(`m${i}`, { ...by(i % 2 ? thorin : goblins[i % 11]), content: `<p>${line}</p>`, timestamp: Date.now() - (40 - i) * 60_000, ...rolled(i) }))
}
await idle()
check(problems.length === 0, `the module's events were accepted ${problems.join(', ')}`)

// The page scrolls only if the document is taller (or wider) than the window.
const measure = page => page.evaluate(() => {
  const root = document.scrollingElement
  const panes = [...document.querySelectorAll('*')]
    .filter(el => ['auto', 'scroll'].includes(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight)
    .map(el => el.getAttribute('aria-label') || el.id || el.className.toString().slice(0, 40))
  return { pageY: root.scrollHeight - root.clientHeight, pageX: root.scrollWidth - root.clientWidth, panes }
})

const sizes = [
  ['phone', 390, 844],
  ['tablet-portrait', 820, 1180],
  ['tablet-landscape', 1180, 820],
  ['laptop', 1440, 900],
  ['desktop', 1920, 1080],
]
const results = {}
for (const [name, width, height] of sizes) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: 'dark' })
  await ctx.addCookies([cookie])
  const page = await ctx.newPage()
  page.on('pageerror', e => problems.push(`${name} pageerror: ${e.message}`))
  await page.goto(`${BASE}/characters/layout-thorin`)
  // One pane opens on the character, combat a tab away; side by side, combat is beside it.
  await page.getByRole('heading', { level: 1 }).waitFor()
  const combatTab = page.getByRole('button', { name: /^Combat/ })
  const visibleTabs = await combatTab.isVisible()
  if (visibleTabs) await combatTab.click()
  await page.getByText('Goblin 11').first().waitFor()
  results[name] = { tabs: visibleTabs, combat: await measure(page) }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-combat.png` })
  if (visibleTabs) {
    await page.getByRole('button', { name: /^Chat/ }).click()
    await page.getByText('Message 38').first().waitFor()
    results[name].chat = await measure(page)
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-chat.png` })
  }
  await ctx.close()
}
console.log(JSON.stringify(results, null, 1))
if (EXPECT === 'fixed') {
  for (const [name, result] of Object.entries(results)) {
    for (const view of [result.combat, result.chat].filter(Boolean)) {
      check(view.pageY === 0 && view.pageX === 0, `${name}: the page itself does not scroll`)
    }
  }
  check(results.phone.tabs && results['tablet-portrait'].tabs, 'phones and portrait tablets keep the tabs')
  for (const name of ['tablet-landscape', 'laptop', 'desktop']) {
    check(!results[name].tabs, `${name}: combat and chat side by side, no tabs`)
  }
}
console.log('problems:', problems)
await browser.close()
process.exit(0)
