// Players' rolls from the app, end to end: the real module, in a stand-in Foundry with dnd5e
// 5.3.3's real dice classes, fetches from the production app, from a browser on the game's page;
// Alice rolls from Thorin's sheet on her phone and sees what the game made of each roll. Run with
// --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import { combat, combatant, settings, user, users, actors } from './fvtt/stub.mjs'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'
import { DND5E5 } from './fvtt/paths.mjs'

const DND5E = `${DND5E5}/module/dice`
const GAME = 'https://lonely-mountain.forge-vtt.com'
const SECRET = 'ashlands-secret-123'
const SHOTS = process.env.SHOTS
const cookie = await cookieFor('e2e-token')
const check = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok -', msg) }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(test, what, ms = 30_000) {
  const end = Date.now() + ms
  while (!(await test())) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`)
    await wait(100)
  }
}
const shoot = async (page, name) => {
  if (!SHOTS) return
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

// Foundry's hooks: callAll and call run their handlers at once, as Foundry's do.
const registry = new Map()
globalThis.Hooks = {
  on(name, fn) { if (!registry.has(name)) registry.set(name, []); registry.get(name).push(fn); return fn },
  once(name, fn) { return this.on(name, fn) },
  off(name, fn) { registry.set(name, (registry.get(name) ?? []).filter(f => f !== fn)) },
  call(name, ...args) {
    for (const fn of registry.get(name) ?? []) if (fn(...args) === false) return false
    return true
  },
  callAll(name, ...args) { return Promise.all((registry.get(name) ?? []).map(fn => fn(...args))).then(() => true) },
}

// ---- Foundry's page, which the module's requests come from ----
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
const foundryContext = await browser.newContext()
await foundryContext.grantPermissions(['local-network-access'], { origin: GAME })
await foundryContext.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Foundry VTT</title>' }))
const gmTab = await foundryContext.newPage()
await gmTab.goto(`${GAME}/game`)
const posted = []
let fetches = 0
globalThis.fetch = async (url, init) => {
  // Made from the game's page, and given up on there when the module gives it up.
  const id = ++fetches
  init.signal?.addEventListener('abort', () => {
    void gmTab.evaluate(id => globalThis.__aborts?.[id]?.abort(), id).catch(() => {})
  }, { once: true })
  const { status, statusText, type, body, error } = await gmTab.evaluate(async ({ id, url, init }) => {
    const controller = new AbortController()
    ;(globalThis.__aborts ??= {})[id] = controller
    try {
      const response = await fetch(url, { ...init, signal: controller.signal })
      return { status: response.status, statusText: response.statusText, type: response.headers.get('content-type'), body: await response.text() }
    } catch (error) {
      return { error: error.name }
    } finally {
      delete globalThis.__aborts[id]
    }
  }, { id, url: String(url), init: { method: init.method, headers: init.headers, body: init.body, mode: init.mode, credentials: init.credentials, cache: init.cache } })
  if (error) throw new DOMException('The fetch was given up on', error)
  const sent = JSON.parse(init.body)
  posted.push({ url: String(url), type: sent.type ?? 'fetch', session: sent.session, data: sent.data, status, body })
  if (status >= 300) problems.push(`${sent.type ?? url} → ${status}`)
  return {
    ok: status >= 200 && status < 300, status, statusText,
    headers: new Headers(type ? { 'content-type': type } : {}),
    json: async () => JSON.parse(body), text: async () => body,
  }
}

// ---- The Gamemaster sets up the campaign in the app ----
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

// ---- Foundry, with dnd5e's dice and Thorin ----
const { core } = await import('./fvtt/dice-core.mjs')
const { default: BasicDie } = await import(`${DND5E}/basic-die.mjs`)
const { default: BasicRoll } = await import(`${DND5E}/basic-roll.mjs`)
const { default: D20Die } = await import(`${DND5E}/d20-die.mjs`)
const { default: D20Roll } = await import(`${DND5E}/d20-roll.mjs`)
Object.assign(CONFIG.Dice, { BasicDie, BasicRoll, D20Die, D20Roll })
CONFIG.Dice.terms.d = BasicDie
const ABILITIES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
CONFIG.DND5E = {
  skills: { prc: { label: 'Perception', ability: 'wis' }, ste: { label: 'Stealth', ability: 'dex' } },
  tools: { thief: { label: "Thieves' Tools", ability: 'dex' } },
  abilities: Object.fromEntries(Object.entries(ABILITIES).map(([id, label]) => [id, { label, abbreviation: id }])),
  defaultAbilities: { initiative: 'dex' },
}
globalThis.dnd5e = { settings: { rulesVersion: 'modern' } }
const { Actor5e, rollCombatInitiative } = await import('./fvtt/actor5e.mjs')

users.activeGM = user('gm', 'Gamemaster', true)
const alice = user('alice', 'Alice')
const thorin = new Actor5e({
  id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 4, dex: 1, con: 3, wis: 2 },
  skills: { prc: { ability: 'wis' }, ste: { ability: 'dex', value: 0 } },
  // A fighter, with three of his five d10 hit dice left.
  classes: [{ identifier: 'fighter', denomination: 'd10', levels: 5, spent: 2 }],
})
thorin.itemTypes = { class: thorin._classes }
// What the sheet shows, as dnd5e prepares it.
thorin.system.skills.prc.total = 5
thorin.system.skills.prc.passive = 15
thorin.system.skills.ste.total = 1
thorin.system.skills.ste.passive = 11
thorin.system.attributes.init.total = 1
thorin.system.attributes.ac = { value: 18 }
thorin.system.details = { level: 5 }
actors.set('thorin', thorin)
alice.character = thorin

await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-ash': SECRET })
settings.set('chatEvents', true)
settings.set('combatEvents', true)
settings.set('campaigns', [{ id: 'camp-ash', title: 'Ashlands', characters: ['thorin'], rolls: true }])
await Hooks.callAll('ready')
await until(() => posted.some(p => p.url.endsWith('/api/bridge/commands')), "the module's first fetch")
const stored = () => sql(`select "rollsEnabled", array_to_string("rollKinds", ','), "bridgePolledAt" is not null from campaign where title = 'Ashlands'`)
// From module 0.29.0, ending a concentration too, wherever players' rolls are made.
// Changed on purpose (round 0.36.0 §13.4): from module 0.36.0, ending a turn too, wherever players' rolls are made.
check(stored() === 't|skill,tool,ability,save,death,initiative,hitDie,hitDice,formula,endConcentration,endTurn,textRoll|t', `the app keeps that the game takes players' rolls, hit dice and formulas among them, and the module is fetching them (${stored()})`)
const hello = posted.find(p => p.type === 'bridge.hello')
check(JSON.parse(hello.body).features?.commands === true, 'the app tells the module, answering its hello, that it has rolls to fetch')

// The Gamemaster's card says so.
await gm.reload()
const card = gm.getByRole('article', { name: 'Ashlands' })
await card.getByText("Players' rolls").waitFor()
check(/made in your game too, with the same dice/.test(await card.textContent()), "the Gamemaster's campaign card says players' rolls reach the game")
await shoot(gm, 'gm-card')

// Alice plays Thorin.
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  select 'sheet-thorin', 'Thorin', '${GAME}', 'Ashlands', id, 'thorin', 'e2e-user', now() from campaign where title = 'Ashlands'`)

// ---- On a phone ----
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' })
await phone.addCookies([cookie])
await phone.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '' }))
const page = await phone.newPage()
page.on('pageerror', e => problems.push(`pageerror: ${e.message}`))
await page.goto(`${BASE}/characters/sheet-thorin`)
const sheet = page.getByRole('region', { name: 'Character' })
const tray = page.getByRole('region', { name: 'Your rolls' })
await sheet.getByRole('button', { name: /^Perception check/ }).waitFor()
// The switch that keeps them here is in the sheet's settings, behind the cog beside its tabs.
const settingsCog = page.getByRole('button', { name: 'Settings', exact: true })
const sheetSettings = page.getByRole('dialog', { name: 'Settings' })
/** Open the sheet's settings, and its switch, if it has one, once it's there. */
const openSettings = async () => {
  await settingsCog.click()
  await sheetSettings.waitFor()
  return sheetSettings.getByRole('switch', { name: 'Send to the table' })
}
const closeSettings = async () => {
  await page.keyboard.press('Escape')
  await sheetSettings.waitFor({ state: 'detached' })
}
const reach = 'Checks, saves and hit dice you roll or spend here are made in your Gamemaster’s game too, with the same dice.'
await tray.getByText(reach).waitFor()
const sendSwitch = await openSettings()
check(await sendSwitch.isChecked() && await tray.getByRole('switch').count() === 0, "the tray says rolls go to the Gamemaster's game, with a switch in the sheet's settings to keep them here")
await closeSettings()

/** The roll Alice's latest request asked for, and the message the game made of it. */
const latestRequest = () => JSON.parse(sql(`select row_to_json(r)::text from (select id, status, payload, "claimSession", result from roll_request order by "createdAt" desc limit 1) r`) || 'null')
const messageFor = id => game.messages.contents.find(m => m.flags['sending-stone']?.request === id)
const requests = () => Number(sql('select count(*) from roll_request'))

async function rollAtTable(button, what) {
  const before = requests()
  await button.click()
  await until(() => requests() > before, `${what} to be sent`)
  const request = latestRequest()
  await until(() => latestRequest().status === 'done' || latestRequest().status === 'failed', `${what} to be made`)
  const made = latestRequest()
  const status = tray.getByRole('status')
  await status.getByText(/At the table|Rolled at the table|Not made at the table/).waitFor({ timeout: 30_000 })
  return { request, made, message: messageFor(request.id), text: await status.textContent() }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
/** How many hit dice a request spent at once asked for, and how many the game made: kept as JSON, whose keys the database orders. */
const spentOf = request => [request.result?.spent?.count, request.result?.spent?.made]
const sum = values => values.reduce((total, value) => total + value, 0)
/** The cards the game posted for one of Alice's requests, in the order it posted them. */
const cardsFor = id => game.messages.contents.filter(m => m.flags['sending-stone']?.request === id)
/** A Use button on the sheet, once the game has sent the sheet on which it can be used. */
async function usable(name) {
  await sheet.getByRole('button', { name }).waitFor({ timeout: 15_000 })
  await page.waitForFunction(name => [...document.querySelectorAll('button')].some(b => b.getAttribute('aria-label') === name && !b.disabled), name, { timeout: 15_000 })
  return sheet.getByRole('button', { name })
}
/** From now until the page is left, whether the tray asks Alice to keep the page open, as it does while it sends rolls one after another. */
const watchKeepOpen = () => page.evaluate(() => {
  globalThis.__keepOpen = false
  const seen = () => { if (document.body.textContent.includes('Keep this page open')) globalThis.__keepOpen = true }
  new MutationObserver(seen).observe(document.body, { subtree: true, childList: true, characterData: true })
  seen()
})
const saidKeepOpen = () => page.evaluate(() => globalThis.__keepOpen === true)
/**
 * From now on, announce each change the game makes to Thorin, or to one of his classes, as Foundry
 * announces it, so that the module sends his sheet again: a class's as a change to him, which is
 * how the module hears of it.
 */
function announced(document) {
  const update = document.update
  document.update = async function (changes) {
    await update.call(this, changes)
    await Hooks.callAll('updateActor', thorin, this === thorin ? changes : {})
  }
}
/** What the sheet's Use buttons say of Thorin's hit dice, such as "Use a d10 hit die, 3 of 5 left". */
const shownHitDice = () => sheet.getByRole('button', { name: /^Use a d\d+ hit die/ }).evaluateAll(buttons => buttons.map(b => b.getAttribute('aria-label')))
/** The hit points the sheet shows, such as "10/40". */
const shownHitPoints = async () => /(\d+)\s*\/\s*(\d+)/.exec(await sheet.getByRole('term').filter({ hasText: /^Hit points$/ }).locator('xpath=..').textContent())?.slice(1).join('/')
/** Whether the sheet comes to show these hit dice left, and these hit points, within 15 seconds. */
async function sheetShows(dice, hp) {
  try {
    await until(async () => same(await shownHitDice(), dice) && (await shownHitPoints()) === hp, 'the sheet', 15_000)
    return true
  } catch {
    return false
  }
}
/** What the sheet shows of Thorin's hit dice and hit points, for a check's message. */
const sheetSays = async () => `${(await shownHitDice()).map(name => name.replace('Use a ', ''))}; ${await shownHitPoints()} HP`

// ---- A skill check ----
let { request, made, message, text } = await rollAtTable(sheet.getByRole('button', { name: /^Perception check/ }), 'Perception')
check(request.payload.kind === 'skill' && request.payload.key === 'prc' && request.payload.explicit === false, `a tap sends Perception, as the sheet has it (${JSON.stringify(request.payload)})`)
check(made.status === 'done' && made.claimSession === hello.session, "the module's session fetched it")
const natural = request.payload.dice[0].results[0]
check(message && message.author.id === 'alice' && message.speaker.actor === 'thorin', 'the game made it as Alice, speaking as Thorin')
check(message.rolls[0].dice[0].results[0].result === natural, `with the d20 Alice rolled: ${natural}`)
check(new RegExp(`d20 ${natural} \\+5`).test(text) && text.includes(`At the table: ${message.rolls[0].total}`), `the tray shows her d20, and the game's total: "${text}"`)
await shoot(page, 'phone-at-the-table')

// ---- Advantage, chosen from the roll's menu ----
await sheet.getByRole('button', { name: /^Stealth check/ }).click({ button: 'right' })
;({ request, made, message, text } = await rollAtTable(page.getByRole('menuitem', { name: 'Roll with advantage' }), 'Stealth with advantage'))
check(request.payload.mode === 1 && request.payload.explicit === true && request.payload.dice[0].results.length === 2, 'a menu choice sends both d20s, as the player chose')
check(JSON.stringify(message.rolls[0].dice[0].results.map(r => r.result)) === JSON.stringify(request.payload.dice[0].results) && message.rolls[0].hasAdvantage, 'the game rolls it with advantage, with both her d20s')

// ---- A saving throw with Bless ----
await sheet.getByRole('button', { name: /^Constitution saving throw/ }).click({ button: 'right' })
await page.getByRole('menuitem', { name: 'Modify roll…' }).click()
const dialog = page.getByRole('dialog', { name: 'Modify roll' })
await dialog.getByRole('textbox', { name: 'Extra dice or modifiers' }).fill('1d4')
;({ request, made, message, text } = await rollAtTable(dialog.getByRole('button', { name: 'Roll' }), 'a blessed save'))
check(request.payload.kind === 'save' && JSON.stringify(request.payload.extras) === '[{"sign":1,"count":1,"sides":4}]', 'Modify roll sends the save with the d4 added')
check(message.rolls[0].formula.startsWith('1d20 + 1d4') && message.rolls[0].dice[1].results[0].result === request.payload.dice[1].results[0], `the game adds the d4 Alice rolled (${message.rolls[0].formula})`)
check(text.includes(`At the table: ${message.rolls[0].total}`), `and the tray shows its total: "${text}"`)

// ---- A hit die, spent from its own Hit dice tile, beside the hit points ----
const hpBefore = thorin.system.attributes.hp.value
const useHitDie = sheet.getByRole('button', { name: 'Use a d10 hit die, 3 of 5 left' })
check((await useHitDie.textContent()) === 'Use', `the d10's button says Use (${await useHitDie.textContent()})`)
const hitPointsTile = await sheet.getByRole('term').filter({ hasText: /^Hit points$/ }).locator('xpath=..').boundingBox()
const hitDiceTile = await sheet.getByRole('term').filter({ hasText: /^Hit dice$/ }).locator('xpath=..').boundingBox()
check(Math.abs(hitPointsTile.y - hitDiceTile.y) < 1 && hitDiceTile.x > hitPointsTile.x, `on a phone the Hit dice tile sits beside the hit points (${JSON.stringify([hitPointsTile, hitDiceTile])})`)
;({ request, made, message, text } = await rollAtTable(useHitDie, 'a hit die'))
const [hitDieRolled] = request.payload.dice[0].results
check(request.payload.kind === 'hitDie' && request.payload.denomination === 'd10' && request.payload.dice.length === 1, `the d10 in his Hit dice tile spends one, with the die Alice rolled (${JSON.stringify(request.payload)})`)
const healed = Math.min(Math.max(1, hitDieRolled + 3), 40 - hpBefore)
check(message?.flags.dnd5e.roll.type === 'hitDie' && message.rolls[0].dice[0].results[0].result === hitDieRolled, `the game spends Thorin's hit die with her ${hitDieRolled} (${message?.rolls[0].formula})`)
check(thorin.system.attributes.hp.value === hpBefore + healed && made.result.healed === healed && thorin._classes[0].system.hd.spent === 3, `dnd5e heals Thorin ${healed}, to ${thorin.system.attributes.hp.value}, and marks the die spent`)
check(text.includes(`At the table: ${message.rolls[0].total} · ${healed} HP regained`), `the tray says what it gave back: "${text}"`)
await shoot(page, 'phone-hit-die')

// ---- Two hit dice at once, from the Use button's popover ----
// From here, the sheet in the app follows what the game spends, as Foundry's announcements of
// each change to Thorin and his classes reach the module.
announced(thorin)
announced(thorin._classes[0])
// Hurt again, with two of his five left.
thorin.system.attributes.hp.value = 10
await Hooks.callAll('updateActor', thorin, { system: { attributes: { hp: { value: 10 } } } })
const useTwo = await usable('Use a d10 hit die, 2 of 5 left')
await useTwo.click({ button: 'right' })
const hitDicePopover = page.getByRole('dialog', { name: 'Use d10 hit dice' })
await hitDicePopover.waitFor()
await hitDicePopover.getByRole('button', { name: 'One die more' }).click()
check((await hitDicePopover.textContent()).includes('Heals 2d10 + 6'), `the popover offers two, with his Constitution for each (${await hitDicePopover.textContent()})`)
await shoot(page, 'phone-hit-dice-popover')
const requestsBeforeTwo = requests()
await watchKeepOpen()
await hitDicePopover.getByRole('button', { name: 'Use 2 d10 hit dice' }).click()
await until(() => requests() > requestsBeforeTwo && ['done', 'failed'].includes(latestRequest().status), 'both hit dice to be spent', 60_000)
// From module 0.20.0, one request for both, the game spending them one after the other.
const spentTwo = latestRequest()
const [first, second] = spentTwo.payload.dice[0]?.results ?? []
check(requests() === requestsBeforeTwo + 1 && spentTwo.payload.kind === 'hitDice' && same(spentTwo.payload.hitDice.map(({ denomination, count }) => [denomination, count]), [['d10', 2]])
  && same(spentTwo.payload.dice.map(({ faces, results }) => [faces, results.length]), [[10, 2]])
  && spentTwo.payload.mode === 0 && spentTwo.payload.explicit === false && same(spentTwo.payload.extras, []),
  `one request for both, with the dice Alice rolled (${JSON.stringify(spentTwo.payload)})`)
const twoCards = cardsFor(spentTwo.id)
check(spentTwo.status === 'done' && same(twoCards.map(m => [m.flags.dnd5e.roll.type, m.rolls[0].dice[0].results[0].result]), [['hitDie', first], ['hitDie', second]]),
  `the game spends them a card each, with her ${first} then her ${second} (${twoCards.map(m => m.rolls[0].formula)})`)
check(thorin._classes[0].system.hd.spent === 5 && same(spentOf(spentTwo), [2, 2]), `dnd5e marks both spent (${thorin._classes[0].system.hd.spent} of 5)`)
const healedTwo = spentTwo.result.healed
const totalTwo = sum(twoCards.flatMap(m => m.rolls.map(r => r.total)))
check(thorin.system.attributes.hp.value === 10 + healedTwo && healedTwo === Math.min(totalTwo, 30), `and heals Thorin ${healedTwo}, to ${thorin.system.attributes.hp.value}`)
const twoStatus = tray.getByRole('status')
await twoStatus.getByText(/At the table: \d+ · \d+ HP regained/).waitFor({ timeout: 30_000 })
const twoText = await twoStatus.textContent()
check(twoText.includes('Hit dice (2d10)') && twoText.includes(`2d10 (${first}, ${second})`), `the tray shows one roll of both dice: "${twoText}"`)
check(twoText.includes(`At the table: ${totalTwo} · ${healedTwo} HP regained`), `and what the game made of them together, ${totalTwo}, and gave back, ${healedTwo}: "${twoText}"`)
check(!(await saidKeepOpen()), 'sent as one, the tray never asks to keep the page open')
check(await sheetShows(['Use a d10 hit die, 0 of 5 left'], `${10 + healedTwo}/40`), `the sheet in the app says both are spent, and gives his hit points as the game left them (${await sheetSays()})`)
await shoot(page, 'phone-hit-dice-two')

// ---- Hit dice of three sizes, two of them spent at once ----
// Thorin takes up a rogue's levels and a wizard's: two d8s and a d6 besides his d10s, three of
// which he has again; and is hurt again.
const afterTwo = thorin.system.attributes.hp.value
const fighter = thorin._classes[0].system.hd
const added = new Actor5e({
  id: 'scratch', name: 'Scratch',
  classes: [{ identifier: 'rogue', denomination: 'd8', levels: 2 }, { identifier: 'wizard', denomination: 'd6', levels: 1 }],
})._classes
for (const cls of added) {
  cls.parent = thorin
  thorin._classes.push(cls)
  announced(cls)
}
const [rogue, wizard] = added.map(cls => cls.system.hd)
fighter.spent = 2
thorin.system.attributes.hp.value = 10
await Hooks.callAll('updateActor', thorin, { system: { attributes: { hp: { value: 10 } } } })
const useD8 = await usable('Use a d8 hit die, 2 of 2 left')
const mixedPopover = page.getByRole('dialog', { name: 'Use hit dice' })
const mixedRows = mixedPopover.getByRole('listitem')
/** The popover's rows: each size, how many of it are chosen, and of how many, such as "d8 1 of 2". */
const rowsOf = () => mixedRows.evaluateAll(rows => rows.map(row => [...row.children].map(child => child.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ')))
await useD8.click({ button: 'right' })
await mixedPopover.waitFor()
check(same(await rowsOf(), ['d10 0 of 3', 'd8 1 of 2', 'd6 0 of 1']), `right-clicked, the d8's Use button opens a popover for every size, the largest first, the d8 at one (${await rowsOf()})`)
await mixedPopover.getByRole('button', { name: 'One d10 more' }).click()
await mixedPopover.getByRole('button', { name: 'One d10 more' }).click()
check(same(await rowsOf(), ['d10 2 of 3', 'd8 1 of 2', 'd6 0 of 1']) && (await mixedPopover.textContent()).includes('Heals 2d10 + 1d8 + 9'),
  `two d10s more, it heals 2d10 + 1d8, with his Constitution for each (${await mixedPopover.textContent()})`)
const mixedBox = await mixedPopover.boundingBox()
check(mixedBox.x >= 0 && mixedBox.x + mixedBox.width <= 390, `the popover fits a 390-pixel phone (${JSON.stringify(mixedBox)})`)
await shoot(page, 'phone-hit-dice-mixed')
await page.keyboard.press('Escape')
await mixedPopover.waitFor({ state: 'hidden' })
// On a narrower phone, its three rows fit too.
await page.setViewportSize({ width: 360, height: 780 })
await useD8.click({ button: 'right' })
await mixedPopover.waitFor()
await mixedPopover.getByRole('button', { name: 'One d10 more' }).click()
await mixedPopover.getByRole('button', { name: 'One d10 more' }).click()
const narrowBox = await mixedPopover.boundingBox()
check((await mixedRows.count()) === 3 && narrowBox.x >= 0 && narrowBox.x + narrowBox.width <= 360, `and a 360-pixel one, with its three rows (${JSON.stringify(narrowBox)})`)
await shoot(page, 'phone-hit-dice-mixed-360')
await page.keyboard.press('Escape')
await mixedPopover.waitFor({ state: 'hidden' })
await page.setViewportSize({ width: 390, height: 844 })
await useD8.click({ button: 'right' })
await mixedPopover.waitFor()
await mixedPopover.getByRole('button', { name: 'One d10 more' }).click()
await mixedPopover.getByRole('button', { name: 'One d10 more' }).click()
const requestsBeforeMixed = requests()
await watchKeepOpen()
await mixedPopover.getByRole('button', { name: 'Use 3 hit dice: 2d10 and 1d8' }).click()
await until(() => requests() > requestsBeforeMixed && ['done', 'failed'].includes(latestRequest().status), 'the three hit dice to be spent', 60_000)
const mixed = latestRequest()
const [tens = [], eights = []] = mixed.payload.dice.map(({ results }) => results)
check(requests() === requestsBeforeMixed + 1 && mixed.payload.kind === 'hitDice'
  && same(mixed.payload.hitDice.map(({ denomination, count }) => [denomination, count]), [['d10', 2], ['d8', 1]])
  && same(mixed.payload.dice.map(({ faces, results }) => [faces, results.length]), [[10, 2], [8, 1]]),
  `one request for all three, the largest first, with the dice Alice rolled (${JSON.stringify(mixed.payload)})`)
const mixedCards = cardsFor(mixed.id)
check(mixed.status === 'done' && same(mixedCards.map(m => [m.flags.dnd5e.roll.type, m.rolls[0].dice[0].faces, m.rolls[0].dice[0].results[0].result]), [['hitDie', 10, tens[0]], ['hitDie', 10, tens[1]], ['hitDie', 8, eights[0]]]),
  `the game spends them a card each, in the order she rolled them: ${tens}, then ${eights} (${mixedCards.map(m => m.rolls[0].formula)})`)
check(fighter.spent === 4 && rogue.spent === 1 && wizard.spent === 0 && same(spentOf(mixed), [3, 3]),
  `dnd5e marks two d10s and a d8 spent (${[fighter.spent, rogue.spent, wizard.spent]})`)
const mixedTotal = sum(mixedCards.flatMap(m => m.rolls.map(r => r.total)))
const mixedStatus = tray.getByRole('status')
await mixedStatus.getByText(/At the table: \d+ · \d+ HP regained/).waitFor({ timeout: 30_000 })
const mixedText = await mixedStatus.textContent()
check(mixedText.includes('Hit dice (2d10 + 1d8)') && mixedText.includes(`2d10 (${tens.join(', ')})`) && mixedText.includes(`1d8 (${eights[0]})`)
  && mixedText.includes(`At the table: ${mixedTotal} · ${mixed.result.healed} HP regained`) && thorin.system.attributes.hp.value === 10 + mixed.result.healed,
  `the tray shows one roll of all three, and what the game made of them: "${mixedText}"`)
check(!(await saidKeepOpen()), 'sent as one, the tray never asks to keep the page open for them')
check(await sheetShows(['Use a d10 hit die, 1 of 5 left', 'Use a d8 hit die, 1 of 2 left', 'Use a d6 hit die, 1 of 1 left'], `${10 + mixed.result.healed}/40`),
  `the sheet in the app says a d10 is left of his five, a d8 of his two, and his d6, and gives his hit points as the game left them (${await sheetSays()})`)
await shoot(page, 'phone-hit-dice-mixed-made')

// ---- Hit dice spent at once, the page left as soon as they're sent ----
// Sent as one, the game spends them all the same: none is left for the page to send.
thorin.system.attributes.hp.value = 10
await Hooks.callAll('updateActor', thorin, { system: { attributes: { hp: { value: 10 } } } })
await usable('Use a d8 hit die, 1 of 2 left')
const useD6 = await usable('Use a d6 hit die, 1 of 1 left')
await useD6.click({ button: 'right' })
await mixedPopover.waitFor()
await mixedPopover.getByRole('button', { name: 'One d8 more' }).click()
const requestsBeforeLeaving = requests()
const posting = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/characters/sheet-thorin/rolls'))
await mixedPopover.getByRole('button', { name: 'Use 2 hit dice: 1d8 and 1d6' }).click()
const sentLeaving = await posting
await page.goto('about:blank')
await until(() => rogue.spent === 2 && wizard.spent === 1, 'the game to spend both, the page left', 60_000)
await until(() => ['done', 'failed'].includes(latestRequest().status), 'the app to hear they were spent', 30_000)
const leftBehind = latestRequest()
check(sentLeaving.status() === 202 && requests() === requestsBeforeLeaving + 1 && leftBehind.status === 'done'
  && same(leftBehind.payload.hitDice.map(({ denomination, count }) => [denomination, count]), [['d8', 1], ['d6', 1]]) && same(spentOf(leftBehind), [2, 2]),
  `with the page left as soon as they were sent, the game spends both, from the one request (${JSON.stringify(leftBehind.payload.hitDice)})`)
await page.goto(`${BASE}/characters/sheet-thorin`)
await sheet.getByRole('button', { name: /^Perception check/ }).waitFor()

// ---- Hit dice spent at once, his hit points full before the last ----
// Hurt only a little, Thorin is brought to full by the first of two d10s: the game spends no more,
// as dnd5e stops spending them on a rest, and says how many it made.
fighter.spent = 2
thorin.system.attributes.hp.value = 38
await Hooks.callAll('updateActor', thorin, { system: { attributes: { hp: { value: 38 } } } })
const useD10Hurt = await usable('Use a d10 hit die, 3 of 5 left')
await useD10Hurt.click({ button: 'right' })
await mixedPopover.waitFor()
await mixedPopover.getByRole('button', { name: 'One d10 more' }).click()
// His d8s and his d6 all spent, the popover still has a row for them, at none of none.
const noneLeftSteps = await mixedPopover.getByRole('button', { name: /^One d[68] (?:fewer|more)$/ }).evaluateAll(buttons => buttons.map(b => b.getAttribute('aria-disabled')))
check(same(await rowsOf(), ['d10 2 of 3', 'd8 0 of 0', 'd6 0 of 0']) && same(noneLeftSteps, ['true', 'true', 'true', 'true']),
  `with none left of a size, its row says none of none, neither of its buttons to be used (${await rowsOf()}; ${noneLeftSteps})`)
const requestsBeforeFull = requests()
await mixedPopover.getByRole('button', { name: 'Use 2 hit dice: 2d10' }).click()
await until(() => requests() > requestsBeforeFull && ['done', 'failed'].includes(latestRequest().status), 'the game to stop at full hit points', 60_000)
const stopped = latestRequest()
const stoppedCards = cardsFor(stopped.id)
const [firstToFull] = stopped.payload.dice[0]?.results ?? []
check(requests() === requestsBeforeFull + 1 && stopped.payload.kind === 'hitDice' && same(stopped.payload.hitDice.map(({ denomination, count }) => [denomination, count]), [['d10', 2]]),
  `two d10s are one request (${JSON.stringify(stopped.payload)})`)
check(stopped.status === 'failed' && stopped.result.reason === 'full-hp' && same(spentOf(stopped), [2, 1]) && stopped.result.healed === 2
  && same(stoppedCards.map(m => m.rolls[0].dice[0].results[0].result), [firstToFull]),
  `the game spends the first, with her ${firstToFull}, then stops at full hit points, one of the two made (${JSON.stringify(stopped.result)})`)
check(fighter.spent === 3 && thorin.system.attributes.hp.value === 40, `dnd5e marks one d10 spent, and heals Thorin to full (${fighter.spent} of 5 spent, ${thorin.system.attributes.hp.value} HP)`)
const stoppedStatus = tray.getByRole('status')
await stoppedStatus.getByText(/made at the table/).waitFor({ timeout: 30_000 })
const stoppedText = await stoppedStatus.textContent()
check(stoppedText.includes('Hit dice (2d10)') && stoppedText.includes('1 of 2 made at the table · 2 HP regained. Not the rest: you’re at full hit points'),
  `the tray says one of the two was made, what it gave back, and why the other wasn't: "${stoppedText}"`)
// Why reads on from what was made, rather than in a column of its own beside it.
const flow = await stoppedStatus.locator('p', { hasText: 'Not the rest' }).evaluate(line => {
  const box = (text, which) => {
    const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.includes(text)) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      const { left, right, top, bottom } = [...range.getClientRects()].at(which)
      return { left, right, top, bottom }
    }
  }
  return { before: box('Not the rest', -1), after: box('full hit points', 0) }
})
const { before: madeEnds, after: whyStarts } = flow
const readsOn = madeEnds && whyStarts && (Math.abs(whyStarts.top - madeEnds.top) < 2 ? whyStarts.left >= madeEnds.right - 1 : whyStarts.top >= madeEnds.bottom - 1)
check(readsOn, `and why reads on from what was made, on its line or the next (${JSON.stringify(flow)})`)
await shoot(page, 'phone-hit-dice-full-hp')
// At full hit points, the sheet spends none.
const fullTitles = () => sheet.getByRole('button', { name: /^Use a d\d+ hit die/ }).evaluateAll(buttons => buttons.map(b => [b.disabled, b.title]))
check(await sheetShows(['Use a d10 hit die, 2 of 5 left', 'Use a d8 hit die, 0 of 2 left', 'Use a d6 hit die, 0 of 1 left'], '40/40')
  && same(await fullTitles(), [[true, 'At full hit points'], [true, 'None left'], [true, 'None left']]),
  `and the sheet in the app, at full hit points, spends none more (${await sheetSays()}; ${JSON.stringify(await fullTitles())})`)

// The game heals him to full before his sheet says so: of hit dice spent at once, it spends none.
thorin.system.attributes.hp.value = 39
await Hooks.callAll('updateActor', thorin, { system: { attributes: { hp: { value: 39 } } } })
const useD10Stale = await usable('Use a d10 hit die, 2 of 5 left')
thorin.system.attributes.hp.value = 40
await useD10Stale.click({ button: 'right' })
await mixedPopover.waitFor()
await mixedPopover.getByRole('button', { name: 'One d10 more' }).click()
const requestsBeforeRefused = requests()
await mixedPopover.getByRole('button', { name: 'Use 2 hit dice: 2d10' }).click()
await until(() => requests() > requestsBeforeRefused && ['done', 'failed'].includes(latestRequest().status), 'the game to refuse them at full hit points', 60_000)
const refusedFull = latestRequest()
check(refusedFull.payload.kind === 'hitDice' && refusedFull.status === 'failed' && refusedFull.result.reason === 'full-hp' && refusedFull.result.spent == null
  && cardsFor(refusedFull.id).length === 0 && fighter.spent === 3 && thorin.system.attributes.hp.value === 40,
  `already at full hit points in the game, it refuses them, spending none and posting nothing (${JSON.stringify(refusedFull.result)})`)
const refusedStatus = tray.getByRole('status')
await refusedStatus.getByText(/Not made at the table/).waitFor({ timeout: 30_000 })
const refusedText = await refusedStatus.textContent()
check(refusedText.includes('Not made at the table: you’re at full hit points'), `the tray says why: "${refusedText}"`)

// ---- Hit dice spent at once in a game before module 0.20.0 ----
// A game that doesn't take several at once is sent a hit die each, the largest first, each once the
// one before is made, while the page is kept open.
fighter.spent = 2
rogue.spent = 0
wizard.spent = 0
thorin.system.attributes.hp.value = 10
await Hooks.callAll('updateActor', thorin, { system: { attributes: { hp: { value: 10 } } } })
const kindsHeld = sql(`select array_to_string("rollKinds", ',') from campaign where title = 'Ashlands'`)
sql(`update campaign set "rollKinds" = array_remove("rollKinds", 'hitDice') where title = 'Ashlands'`)
await page.reload()
const useD10 = await usable('Use a d10 hit die, 3 of 5 left')
await usable('Use a d8 hit die, 2 of 2 left')
await useD10.click({ button: 'right' })
await mixedPopover.waitFor()
await mixedPopover.getByRole('button', { name: 'One d8 more' }).click()
const requestsBeforeEach = requests()
await watchKeepOpen()
// Changed on purpose (round 0.36.0 §13.4): from module 0.36.0, ending a turn too, wherever players' rolls are made.
check(stored() === 't|skill,tool,ability,save,death,initiative,hitDie,formula,endConcentration,endTurn,textRoll|t', `the app has it the game takes a hit die at a time, not several at once (${stored()})`)
// The game takes three seconds over each, as a busy one may: the tray asks to keep the page open
// only while it waits on the game once its own dice have settled, which a game making both within
// half a second never has it do.
const rollHitDie = thorin.rollHitDie
thorin.rollHitDie = async function (...args) {
  await new Promise(resolve => setTimeout(resolve, 3000))
  return rollHitDie.apply(this, args)
}
await mixedPopover.getByRole('button', { name: 'Use 2 hit dice: 1d10 and 1d8' }).click()
await until(() => requests() === requestsBeforeEach + 2 && ['done', 'failed'].includes(latestRequest().status), 'both hit dice to be spent, one after the other', 60_000)
thorin.rollHitDie = rollHitDie
const spentEach = JSON.parse(sql(`select json_agg(r order by r."createdAt")::text from (select id, status, payload, result, "createdAt", "completedAt" from roll_request order by "createdAt" desc limit 2) r`))
check(same(spentEach.map(r => [r.status, r.payload.kind, r.payload.denomination, r.payload.dice.map(({ faces, results }) => [faces, results.length])]), [['done', 'hitDie', 'd10', [[10, 1]]], ['done', 'hitDie', 'd8', [[8, 1]]]]),
  `a request a die, the d10 first (${JSON.stringify(spentEach.map(r => r.payload))})`)
check(new Date(spentEach[1].createdAt) >= new Date(spentEach[0].completedAt), `the second sent once the game had made the first (${spentEach[0].completedAt} → ${spentEach[1].createdAt})`)
check(fighter.spent === 3 && rogue.spent === 1 && wizard.spent === 0, `dnd5e marks a d10 and a d8 spent (${[fighter.spent, rogue.spent, wizard.spent]})`)
const eachStatus = tray.getByRole('status')
await eachStatus.getByText(/At the table: \d+ · \d+ HP regained/).waitFor({ timeout: 30_000 })
const eachText = await eachStatus.textContent()
check(eachText.includes('Hit dice (1d10 + 1d8)') && (await saidKeepOpen()), `the tray shows one roll of both, and asked to keep the page open while they were sent: "${eachText}"`)
sql(`update campaign set "rollKinds" = string_to_array('${kindsHeld}', ',') where title = 'Ashlands'`)
// Changed on purpose (round 0.36.0 §13.4): from module 0.36.0, ending a turn too, wherever players' rolls are made.
check(stored() === 't|skill,tool,ability,save,death,initiative,hitDie,hitDice,formula,endConcentration,endTurn,textRoll|t', `the app has it again that the game takes several at once (${stored()})`)

// ---- No more than twenty at once ----
// A barbarian's level gives Thorin a d12, and a boon twenty more besides, as dnd5e counts a class's
// hit dice (class.mjs:221, its levels and any additional): of twenty-one, he spends no more than
// twenty at once, of one size or of every size together.
const [barbarian] = new Actor5e({ id: 'scratch', name: 'Scratch', classes: [{ identifier: 'barbarian', denomination: 'd12', levels: 1 }] })._classes
Object.defineProperty(barbarian.system.hd, 'max', { get: () => 1 + 20 })
barbarian.parent = thorin
thorin._classes.push(barbarian)
await Hooks.callAll('updateActor', thorin, {})
const useD12 = await usable('Use a d12 hit die, 21 of 21 left')
await useD12.click({ button: 'right' })
await mixedPopover.waitFor()
const moreD12 = mixedPopover.getByRole('button', { name: 'One d12 more' })
for (let chosen = 1; chosen < 20; chosen++) await moreD12.click()
/** Each size's button for one more: whether it can't be used, and its title. */
const moreOf = () => mixedPopover.getByRole('button', { name: /^One d\d+ more$/ }).evaluateAll(buttons => buttons.map(b => [b.getAttribute('aria-label'), b.getAttribute('aria-disabled'), b.title]))
const capped = ['d12', 'd10', 'd8', 'd6'].map(die => [`One ${die} more`, 'true', 'At most 20 at once'])
check(same(await rowsOf(), ['d12 20 of 21', 'd10 0 of 2', 'd8 0 of 1', 'd6 0 of 1']) && (await mixedPopover.textContent()).includes('Heals 20d12 + 60') && same(await moreOf(), capped),
  `twenty d12s chosen, no more of any size can be, each saying why (${await rowsOf()}; ${JSON.stringify(await moreOf())})`)
await moreD12.click({ force: true })
check(same(await rowsOf(), ['d12 20 of 21', 'd10 0 of 2', 'd8 0 of 1', 'd6 0 of 1']), `nor is one more chosen, its button pressed (${await rowsOf()})`)
await mixedPopover.getByRole('button', { name: 'One d12 fewer' }).click()
await mixedPopover.getByRole('button', { name: 'One d10 more' }).click()
check(same(await rowsOf(), ['d12 19 of 21', 'd10 1 of 2', 'd8 0 of 1', 'd6 0 of 1']) && (await mixedPopover.textContent()).includes('Heals 19d12 + 1d10 + 60')
  && same(await moreOf(), capped) && (await mixedPopover.getByRole('button', { name: 'Use 20 hit dice: 19d12 and 1d10' }).count()) === 1,
  `with one d12 fewer, a d10 may be chosen instead, twenty in all again (${await rowsOf()})`)
const capBox = await mixedPopover.boundingBox()
check(capBox.x >= 0 && capBox.x + capBox.width <= 390 && capBox.y >= 0 && capBox.y + capBox.height <= 844, `its four rows fit the phone (${JSON.stringify(capBox)})`)
await shoot(page, 'phone-hit-dice-cap')
await page.keyboard.press('Escape')
await mixedPopover.waitFor({ state: 'hidden' })

// ---- Thorin a fighter alone again, his d10s spent ----
thorin._classes.splice(1)
fighter.spent = 5
thorin.system.attributes.hp.value = afterTwo
await Hooks.callAll('updateActor', thorin, { system: { attributes: { hp: { value: afterTwo } } } })
await page.reload()
await sheet.getByRole('button', { name: 'Use a d10 hit die, 0 of 5 left' }).waitFor({ timeout: 15_000 })
check(same(await shownHitDice(), ['Use a d10 hit die, 0 of 5 left']), `Thorin's sheet has his d10s alone again, all spent (${await sheetSays()})`)

// ---- Initiative, in a fight ----
const fight = combat('cmbt1')
fight.rollInitiative = rollCombatInitiative
combatant(fight, 'c-gob', null, { name: 'Goblin', initiative: 12 })
const turn = combatant(fight, 'c-thorin', thorin, { initiative: null })
Object.defineProperty(game, 'combat', { get: () => game.combats.get('cmbt1'), configurable: true })
await Hooks.callAll('createCombat', fight)
const initiative = sheet.getByRole('button', { name: 'Initiative, +1, to roll for the combat' })
await initiative.waitFor({ timeout: 15_000 })
await shoot(page, 'phone-initiative-to-roll')
;({ request, made, message, text } = await rollAtTable(initiative, 'initiative'))
check(request.payload.kind === 'initiative' && request.payload.combatId === 'cmbt1', 'the Initiative button rolls for the combat Thorin waits in')
check(turn.initiative === message.rolls[0].total && message.rolls[0].dice[0].results[0].result === request.payload.dice[0].results[0], `the game gives Thorin initiative ${turn.initiative}, with Alice's d20`)
check(text.includes(`At the table: ${turn.initiative}`), `the tray shows it: "${text}"`)
await Hooks.callAll('updateCombatant', turn, { initiative: turn.initiative })
await sheet.getByRole('button', { name: 'Initiative, +1' }).waitFor({ timeout: 15_000 })
check(true, 'once rolled, Initiative rolls only in the app')

// ---- A death saving throw ----
thorin.system.attributes.hp.value = 0
thorin.system.attributes.death.success = 1
await Hooks.callAll('updateActor', thorin, { system: { attributes: { hp: { value: 0 } } } })
const deathSave = sheet.getByRole('button', { name: 'Death saving throw' })
await deathSave.waitFor({ timeout: 15_000 })
await deathSave.scrollIntoViewIfNeeded()
await shoot(page, 'phone-death-save')
;({ request, made, message, text } = await rollAtTable(deathSave, 'a death save'))
const d20 = request.payload.dice[0].results[0]
check(request.payload.kind === 'death' && message.flags.dnd5e.roll.type === 'death', 'the death save button rolls a death saving throw in the game')
check(d20 === 20 ? thorin.system.attributes.hp.value === 1 : (d20 >= 10 ? thorin.system.attributes.death.success === 2 : thorin.system.attributes.death.failure >= 1), `dnd5e marks it on Thorin, as it would (d20 ${d20})`)
thorin.system.attributes.hp.value = 30
thorin.system.attributes.death.success = 0
thorin.system.attributes.death.failure = 0
await Hooks.callAll('updateActor', thorin, { system: { attributes: { hp: { value: 30 } } } })

// ---- A roll the game makes blind ----
core.forceBlind = true
;({ request, made, message, text } = await rollAtTable(sheet.getByRole('button', { name: /^Perception check/ }), 'a blind roll'))
core.forceBlind = false
check(made.status === 'done' && made.result.visible === false && made.result.rolls.length === 0 && message.blind, 'a roll the game made blind is reported without its roll')
check(text.includes('Rolled at the table, hidden by your Gamemaster') && !text.includes('At the table:'), `the tray says it was rolled, hidden: "${text}"`)
await shoot(page, 'phone-hidden')

// ---- Turned off by the Gamemaster ----
const count = requests()
await game.settings.set('sending-stone', 'campaigns', [{ id: 'camp-ash', title: 'Ashlands', characters: ['thorin'], rolls: false }])
await until(() => stored().startsWith('f|'), 'the app to hear rolls are off')
await tray.getByText("Only you see these rolls for now. They aren't sent to your Gamemaster's game.").waitFor({ timeout: 15_000 })
const noSwitch = await openSettings()
// The settings always have Roll results (#153, toasts2), the player's own choice, here the banner;
// no switch sends rolls, nor is there any other.
const switches = await sheetSettings.getByRole('switch').evaluateAll(all => all.map(el => el.labels?.[0]?.textContent.trim()))
const results = await sheetSettings.getByRole('radiogroup', { name: 'Roll results' }).getByRole('radio').evaluateAll(all => all.map(el => `${el.textContent}:${el.getAttribute('aria-checked')}`))
check(await tray.getByRole('switch').count() === 0 && await noSwitch.count() === 0 && JSON.stringify(switches) === '[]' && JSON.stringify(results) === '["Toasts:false","Banner:true"]',
  `turned off, the tray says rolls stay with the player, with no switch to send them in the sheet's settings, only Roll results, on Banner (${switches}; ${results})`)
await closeSettings()
await sheet.getByRole('button', { name: /^Perception check/ }).click()
await wait(1500)
check(requests() === count, 'and a roll is not sent')
await gm.reload()
check(/They stay here/.test(await gm.getByRole('article', { name: 'Ashlands' }).textContent()), "the Gamemaster's card says players' rolls stay in the app")

// ---- The game gone quiet ----
await game.settings.set('sending-stone', 'campaigns', [{ id: 'camp-ash', title: 'Ashlands', characters: ['thorin'], rolls: true }])
await tray.getByText(reach).waitFor({ timeout: 15_000 })
check(await (await openSettings()).isChecked(), "turned on again, the tray says rolls go to the game, and the sheet's settings have the switch again, on")
await closeSettings()
// The Gamemaster's browser stops fetching, as when its tab closes, before the app notices.
const { stopPollers } = await import(`${MODULE}/scripts/commands.mjs`)
users.get('gm').isActiveGM = false
const { checkBridge } = await import(`${MODULE}/scripts/bridge.mjs`)
checkBridge()
stopPollers()
await wait(500)
const quiet = requests()
await sheet.getByRole('button', { name: /^Perception check/ }).click()
await until(() => requests() > quiet, 'the unfetched roll to be sent')
await tray.getByRole('status').getByText('Sending to your Gamemaster’s game…').waitFor({ timeout: 10_000 })
sql(`update roll_request set "createdAt" = now() - interval '31 seconds' where status = 'pending'`)
await tray.getByRole('status').getByText(/Not made at the table: your Gamemaster’s game didn’t pick it up/).waitFor({ timeout: 15_000 })
check(true, "a roll the game never picks up is said not to have been made")
await shoot(page, 'phone-not-picked-up')

console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors, and the app took everything the module sent')
await browser.close()
process.exit(0)
