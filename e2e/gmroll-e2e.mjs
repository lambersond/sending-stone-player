// The Gamemaster at any sheet of their campaign, rolling as the character (#156), end to end: the
// real module, in a stand-in Foundry with dnd5e 5.3.3's real dice classes and its attacks ported,
// fetches from the production app, from a browser on the game's page. Alice runs "Ashlands", whose
// roster is Thorin, whom Bob plays, and Balin, whom nobody has claimed; both are in a fight with a
// goblin. From her campaign card Alice opens each one's sheet without claiming it and rolls as
// them, on a tablet and a phone: checks, a save, attacks, a hit die, a death save and the answer to
// a save the game asks for. Each is made in the game as the character's, by the same author as its
// player's would be, and every message it makes is flagged and badged "GM" in Foundry and pilled
// "GM" in the app, for Bob too. Bob, as Thorin's player and as the Gamemaster of another campaign,
// "Mirkwood", made by SQL, reaches none of Ashlands' Gamemaster pages; nor does Alice Mirkwood's.
// Since module 0.25.0 each roll's result lists the messages it made, and only those get the pill:
// a message of Bob's with a roll's flags copied gets none. With the module's chat events off, Bob
// sees Alice's rolls as Thorin as his own, as toasts on his phone and in the banner on his tablet,
// marked GM, with the game's result and nothing to roll after them. Her area attack as Thorin at
// three bandits and a lurker says whom it hit, "Hit 3 of 4: Bandit 1, Bandit 3, Lurker", in the
// order they were picked, by the names Bob's own view of the fight gives them; once the Gamemaster
// hides the lurker, which the app then keeps hidden, Bob's pages count it, "and 1 more", and its
// name is nowhere in them nor in what the app sends him.
// SKEW=1 with MODULE (or MODULE_DIR) set to module 0.22.0 checks the app's side against a module
// that can't mark a roll: the Gamemaster's rolls stay in the app. SKEW=024 with module 0.24.0,
// against one that marks them but lists no messages: the app keeps its rule from before, the pill on
// a message the character speaks while the roll is recent, so the copy gets one. Synthetic
// characters only. Run with --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs.
// Screenshots to SHOTS.
import { mkdirSync, readFileSync } from 'node:fs'
import { combat, combatant, settings, user, users, actors } from './fvtt/stub.mjs'
import { JSDOM } from 'jsdom'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'
import { DND5E5 } from './fvtt/paths.mjs'

// Module 0.24.0, which makes the Gamemaster's rolls but lists none of their messages.
const OLD_RULE = process.env.SKEW === '024'
// Module 0.22.0, which can't make them.
const SKEW = !!process.env.SKEW && !OLD_RULE
const DND5E = `${DND5E5}/module/dice`
const GAME = 'https://lonely-mountain.forge-vtt.com'
const SECRET = 'ashlands-secret-123'
const SHOTS = process.env.SHOTS
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const ALICE = await cookieFor('e2e-token')
const BOB = await cookieFor('e2e-bob-token')
const check = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok -', msg) }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const realNow = Date.now
async function until(test, what, ms = 30_000) {
  const end = realNow() + ms
  while (!(await test())) {
    if (realNow() > end) throw new Error(`Timed out waiting for ${what}`)
    await wait(100)
  }
}
const shoot = async (page, name, options = {}) => {
  if (!SHOTS) return
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${SHOTS}/${name}${SKEW ? '-skew' : ''}${OLD_RULE ? '-skew024' : ''}.png`, ...options })
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// Foundry's hooks: callAll and call run their handlers at once, as Foundry's do.
const registry = new Map()
globalThis.Hooks = {
  on(name, fn) { if (!registry.has(name)) registry.set(name, []); registry.get(name).push(fn); return fn },
  once(name, fn) {
    const once = (...args) => { this.off(name, once); return fn(...args) }
    return this.on(name, once)
  },
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
/** Every command the module fetched, by its id. */
const fetchedCommand = id => posted.filter(p => p.type === 'fetch' && p.status === 200)
  .flatMap(p => { try { return JSON.parse(p.body).commands ?? [] } catch { return [] } }).find(command => command.id === id)

// ---- Alice sets up the campaign in the app ----
const aliceSetup = await browser.newContext()
await aliceSetup.addCookies([ALICE])
const setup = await aliceSetup.newPage()
await setup.goto(`${BASE}/campaigns`)
await setup.getByRole('button', { name: 'New campaign' }).click()
const modal = setup.getByRole('dialog', { name: 'New campaign' })
await modal.getByLabel('Campaign title').fill('Ashlands')
await modal.getByLabel('Forge game address').fill('lonely-mountain.forge-vtt.com')
await modal.getByLabel('Secret', { exact: true }).fill(SECRET)
await modal.getByRole('button', { name: 'Set up campaign' }).click()
await modal.getByRole('button', { name: 'Done' }).click()
const A = sql(`select id from campaign where title = 'Ashlands'`)

// ---- Foundry, with dnd5e's dice and attacks, Thorin, Balin and a goblin ----
globalThis.document = { hidden: false }
const { messages } = await import('./fvtt/dice-core.mjs')
const { default: BasicDie } = await import(`${DND5E}/basic-die.mjs`)
const { default: BasicRoll } = await import(`${DND5E}/basic-roll.mjs`)
const { default: D20Die } = await import(`${DND5E}/d20-die.mjs`)
const { default: D20Roll } = await import(`${DND5E}/d20-roll.mjs`)
const { default: DamageRoll } = await import(`${DND5E}/damage-roll.mjs`)
Object.assign(CONFIG.Dice, { BasicDie, BasicRoll, D20Die, D20Roll, DamageRoll })
CONFIG.Dice.terms.d = BasicDie
const ABILITIES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
CONFIG.DND5E = {
  skills: { prc: { label: 'Perception', ability: 'wis' } },
  tools: {},
  abilities: Object.fromEntries(Object.entries(ABILITIES).map(([id, label]) => [id, { label, abbreviation: id }])),
  defaultAbilities: { initiative: 'dex', concentration: 'con' },
  damageTypes: { slashing: { label: 'Slashing' }, bludgeoning: { label: 'Bludgeoning' }, fire: { label: 'Fire' } },
  healingTypes: { healing: { label: 'Healing' } },
  activityActivationTypes: { action: { label: 'Action', header: 'Actions' } },
}
CONFIG.statusEffects = []
settings.set('messageMode', 'public')
settings.set('criticalDamageModifiers', false)
settings.set('criticalDamageMaxDice', false)
settings.set('attackRollVisibility', 'hideAC')
settings.set('challengeVisibility', 'all')
// The module's English, for its badge; anything else as its key, as before.
const english = JSON.parse(readFileSync(`${MODULE}/lang/en.json`, 'utf8'))
const lookup = text => String(text).split('.').reduce((o, part) => (o && typeof o === 'object') ? o[part] : undefined, english)
const localize = game.i18n.localize.bind(game.i18n)
game.i18n.localize = text => (typeof lookup(text) === 'string' ? lookup(text) : localize(text))

const { Actor5e } = await import('./fvtt/actor5e.mjs')
const { AttackActivity, equip } = await import('./fvtt/activity5e.mjs')
const { placeables } = await import('./fvtt/midi-fake.mjs')
const { requestCard } = await import('./fvtt/dnd5e-cards.mjs')
globalThis.dnd5e = {
  settings: { rulesVersion: 'modern' },
  documents: { activity: { AttackActivity } },
  registry: {
    messages: {
      get(id, type) {
        return [...messages.values()].filter(m => (m.flags?.dnd5e?.originatingMessage === id) && (m.flags?.dnd5e?.roll?.type === type))
      },
    },
  },
}
globalThis.Item = { implementation: class { constructor(data) { Object.assign(this, data); this.system ??= {} } } }
globalThis.fromUuidSync = uuid => {
  const [type, id] = String(uuid).split('.')
  return type === 'Actor' ? (actors.get(id) ?? null) : null
}

users.activeGM = user('gm', 'Gamemaster', true)
users.get('gm').targets = new Set()
const bob = user('bob', 'Bob')
const weapon = (id, name, activity, denomination, damageType, modifier) => ({
  id, name, type: 'weapon',
  system: { properties: [], quantity: 1, attackType: 'melee', equipped: true },
  activities: [{
    id: activity, damage: [{ number: 1, denomination, bonus: '@mod', types: [damageType] }],
    labels: { modifier, damage: [{ formula: `1d${denomination} + 3`, damageType, label: `1d${denomination} + 3 ${damageType[0].toUpperCase()}${damageType.slice(1)}` }] },
  }],
})
/** dnd5e's itemTypes, with the character's classes among them, for its hit dice and features. */
const withClasses = actor => Object.defineProperty(actor, 'itemTypes', {
  configurable: true,
  get() {
    const types = { weapon: [], consumable: [], spell: [], feat: [], class: actor._classes }
    for (const item of actor.items.values()) (types[item.type] ??= []).push(item)
    return types
  },
})
// Thorin, Bob's: a fighter with a longsword, hurt, three of his five d10 hit dice left.
const thorin = new Actor5e({
  id: 'thorin', name: 'Thorin', owners: ['bob'], mods: { str: 3, dex: 1, con: 3, wis: 2 },
  skills: { prc: { ability: 'wis' } }, hp: { value: 20, max: 44, temp: 0 },
  classes: [{ identifier: 'fighter', denomination: 'd10', levels: 5, spent: 2 }],
})
thorin.system.details = { level: 5 }
equip(thorin, {
  ac: 18,
  items: [weapon('longsword', 'Longsword', 'swing', 8, 'slashing', '+6'), {
    // An attack at an area: a cone of fire, at everyone caught in it, as attacks-e2e's.
    id: 'breath', name: 'Breath Weapon', type: 'feat', system: { properties: [] },
    activities: [{
      id: 'breathBlast', template: 'cone', damage: [{ number: 2, denomination: 6, types: ['fire'] }],
      labels: { modifier: '+6', damage: [{ formula: '2d6', damageType: 'fire', label: '2d6 Fire' }] },
    }],
  }],
})
withClasses(thorin)
thorin.system.skills.prc.total = 5
thorin.system.skills.prc.passive = 15
thorin.system.attributes.init.total = 1
actors.set('thorin', thorin)
bob.character = thorin
// Balin, whom no player owns: a cleric with a mattock.
const balin = new Actor5e({
  id: 'balin', name: 'Balin', owners: [], mods: { str: 2, dex: 0, con: 2, wis: 3 },
  skills: { prc: { ability: 'wis' } }, hp: { value: 30, max: 30, temp: 0 },
})
balin.system.details = { level: 5 }
equip(balin, { ac: 16, items: [weapon('mattock', 'Mattock', 'smash', 8, 'bludgeoning', '+5')] })
balin.system.skills.prc.total = 6
balin.system.skills.prc.passive = 16
balin.system.attributes.init.total = 0
actors.set('balin', balin)
// A goblin to fight, with its token on the Gamemaster's canvas.
const goblin = new Actor5e({ id: 'goblin', name: 'Goblin', mods: {}, hp: { value: 30, max: 30, temp: 0 } })
goblin.type = 'npc'
actors.set('goblin', goblin)
equip(goblin, { ac: 13 })
const goblinToken = { id: 'tokgoblin', name: 'Goblin', uuid: 'Scene.scene.Token.tokgoblin', actor: goblin, hidden: false }
goblinToken.object = { id: goblinToken.id, name: 'Goblin', document: goblinToken, actor: goblin }
placeables.set(goblinToken.id, goblinToken.object)

/** The roll request the app keeps for an id, or the latest. */
const rollRow = id => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, role, "characterId", "requestedById", "claimToken", payload, result from roll_request ${id ? `where id = '${id}'` : 'order by "createdAt" desc limit 1'}) r`) || 'null')
const requests = () => Number(sql('select count(*) from roll_request'))
const messageFor = (id, key = 'request') => messages.contents.find(m => m.flags?.['sending-stone']?.[key] === id)
const ownFlags = message => message?.flags?.['sending-stone']
/** A use's card's own flags but for the use the module keeps on it, for its damage to follow. */
const cardFlags = message => { const { usage, ...flags } = ownFlags(message) ?? {}; return usage ? flags : null }
const byGm = messageId => sql(`select "byGm" from chat_message where "messageId" = '${messageId}' and "campaignId" = '${A}'`)
/** A roll's result as the module posted it, the latest. */
const resultOf = id => posted.findLast(p => p.type === 'command.result' && p.data?.id === id)?.data
/**
 * Whether a Gamemaster's roll's result lists exactly these messages, as module 0.25.0's does, in
 * any order; or, from module 0.24.0, lists none.
 */
const lists = async (id, ids) => {
  await until(() => resultOf(id), `${id}'s result`, 15_000)
  return OLD_RULE ? !('messages' in resultOf(id)) : same([...(resultOf(id).messages ?? ['none'])].sort(), [...ids].sort())
}
const LISTED = OLD_RULE ? 'its result, from module 0.24.0, lists no messages' : 'its result lists exactly its messages'

// ---- Skew: the Gamemaster's roll pending from a newer module, then 0.22.0 starts ----
const PAYLOAD = { kind: 'skill', key: 'prc', mode: 0, explicit: false, extras: [], dice: [{ faces: 20, results: [11] }] }
if (SKEW) {
  sql(`update campaign set "rollFeatures" = '{gmRolls}', "helloSession" = 'old' where id = '${A}'`)
  sql(`insert into roll_request (id, "campaignId", "characterId", role, "requestedById", "actorId", kind, payload, status, "updatedAt")
    values ('gm-pending-e2e', '${A}', null, 'gm', 'e2e-user', 'balin', 'skill', '${JSON.stringify(PAYLOAD)}', 'pending', now())`)
}

await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-ash': SECRET })
settings.set('chatEvents', true)
settings.set('combatEvents', true)
settings.set('campaigns', [{ id: 'camp-ash', title: 'Ashlands', characters: ['thorin', 'balin'], rolls: true, attacks: true, prompts: true }])
await Hooks.callAll('ready')
await until(() => posted.some(p => p.url.endsWith('/api/bridge/commands')), "the module's first fetch")
const features = () => sql(`select array_to_string("rollFeatures", ',') from campaign where id = '${A}'`)
await until(() => SKEW ? !features().split(',').includes('gmRolls') : features().split(',').includes('gmRolls'), 'the hello to be taken', 15_000)
const hello = posted.find(p => p.type === 'bridge.hello')
if (SKEW) {
  check(!features().split(',').includes('gmRolls') && !('gmRolls' in hello.data.features.rolls),
    `module 0.22.0's hello says nothing of the Gamemaster's rolls, and the app keeps none (${features()})`)
} else if (OLD_RULE) {
  check(features().split(',').includes('gmRolls') && hello.data.features.rolls.gmRolls === true
    && !features().split(',').includes('gmRollMessages') && !('gmRollMessages' in hello.data.features.rolls),
    `module 0.24.0's hello says it makes the Gamemaster's rolls as a character, but not that their results list their messages, and the app keeps that (${features()})`)
} else {
  check(features().split(',').includes('gmRolls') && hello.data.features.rolls.gmRolls === true
    && features().split(',').includes('gmRollMessages') && hello.data.features.rolls.gmRollMessages === true,
    `module 0.25.0's hello says it makes the Gamemaster's rolls as a character, each result listing the messages it made, and the app keeps that (${features()})`)
}

// A fight: the goblin has gone, and it's Thorin's turn, Balin after him.
const fight = combat('fight1')
combatant(fight, 'cbGoblin', goblin, { name: 'Goblin', initiative: 15, token: goblinToken })
combatant(fight, 'cbThorin', thorin, { initiative: 12 })
combatant(fight, 'cbBalin', balin, { initiative: 10 })
fight.started = true
fight.round = 1
fight.turn = 1
Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight1'), configurable: true })
await Hooks.callAll('createCombat', fight)
await until(() => sql('select count(*) from combat') === '1', 'the app to hear of the fight', 15_000)

/** A page on a browser of this size, for Alice or Bob, or no one. */
async function browse({ width, height, who, scheme = 'light' }) {
  const view = await browser.newContext({ viewport: { width, height }, isMobile: width < 1024, hasTouch: width < 1024, colorScheme: scheme })
  if (who) await view.addCookies([who])
  await view.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '' }))
  const page = await view.newPage()
  page.on('pageerror', e => problems.push(`${width} pageerror: ${e.message}`))
  return { view, page }
}
/** What the page is: the sheet, the tray, the table's tabs, and a roll made at the table. */
function sheetOf(page) {
  const sheet = page.getByRole('region', { name: 'Character' })
  const tray = page.getByRole('region', { name: 'Your rolls' })
  const status = tray.getByRole('status')
  const nav = page.getByRole('navigation', { name: 'Table' })
  const tabs = sheet.getByRole('tablist', { name: 'Character sheet' })
  /** Tap it, and once a request is sent and the game has made it, what the tray says. */
  const rollAtTable = async (tap, what) => {
    const before = requests()
    await tap()
    await until(() => requests() > before, `${what} to be sent`)
    const request = rollRow()
    await until(() => ['done', 'failed'].includes(rollRow(request.id).status), `${what} to be made`)
    await status.getByText(/At the table|Rolled at the table|Not made at the table/).waitFor({ timeout: 30_000 })
    return { request, made: rollRow(request.id), text: await status.textContent() }
  }
  return { sheet, tray, status, nav, tabs, rollAtTable }
}
/** Each message in the chat by this speaker, oldest first: whether it has the GM pill. */
const pillsBy = (page, speaker) => page.getByRole('region', { name: 'Chat' }).locator('ol[aria-label="Chat log"] > li').evaluateAll((items, speaker) => items
  .filter(item => item.querySelector('header .font-semibold')?.textContent === speaker)
  .map(item => item.querySelector('[title="Rolled by the Gamemaster"]')?.textContent ?? null), speaker)
/** The d20 the app throws next, or Math.random again. */
const forceD20 = (page, value) => page.evaluate(v => { globalThis.__random ??= Math.random; Math.random = () => (v - 0.5) / 20 }, value)
const unforce = page => page.evaluate(() => { if (globalThis.__random) Math.random = globalThis.__random })
/** What the app answers a request from this page, as JSON where it is. */
const call = (page, path, { method = 'GET', body } = {}) => page.evaluate(async ({ path, method, body }) => {
  const response = await fetch(path, { method, ...(body && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), redirect: 'manual' })
  const text = await response.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: response.status, text, json }
}, { path, method, body })
const overflow = page => page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth)
const gmPath = (campaign, actor) => `/campaigns/${campaign}/characters/${actor}`
const gmApi = (campaign, actor) => `/api/campaigns/${campaign}/characters/${actor}`
const GM_REACH = 'Checks, saves, attacks, spells and hit dice you roll, cast or spend here are made in your game too, with the same dice.'

// ---- Skew: module 0.22.0 can't mark the Gamemaster's rolls, so they stay in the app ----
if (SKEW) {
  await wait(6_000)
  const pending = rollRow('gm-pending-e2e')
  check(['pending', 'expired', 'failed'].includes(pending.status) && pending.claimToken === null && !fetchedCommand('gm-pending-e2e')
    && !messages.contents.some(m => JSON.stringify(m.flags ?? {}).includes('gm-pending-e2e')),
    `the Gamemaster's roll left pending from before is never handed to module 0.22.0, nor made (${pending.status})`)
  const { view, page } = await browse({ width: 768, height: 1024, who: ALICE })
  await page.goto(`${BASE}${gmPath(A, 'balin')}`)
  const { sheet, status } = sheetOf(page)
  await sheet.getByRole('button', { name: /^Perception check/ }).waitFor({ timeout: 20_000 })
  const note = "You're at Balin's sheet as the Gamemaster. Your rolls stay here: update Sending Stone in Foundry to 0.23.0 to make them in your game as Balin's."
  check(await page.getByText(note).isVisible(), `Balin's sheet tells Alice her rolls stay in the app until the module is updated: "${note}"`)
  const before = requests()
  await sheet.getByRole('button', { name: /^Perception check/ }).click()
  await status.getByText('Perception check').waitFor({ timeout: 25_000 })
  await wait(1_500)
  check(requests() === before && !/At the table|Sending/.test(await status.textContent()), `her Perception check is rolled in the app only: "${await status.textContent()}"`)
  const posting = await call(page, `${gmApi(A, 'balin')}/rolls`, { method: 'POST', body: PAYLOAD })
  check(posting.status === 409 && posting.json?.reason === 'unavailable' && requests() === before, `a Gamemaster's roll posted all the same is refused 409 (${posting.text})`)
  await shoot(page, 'gm-sheet-tablet')
  await view.close()
  console.log('problems:', problems)
  check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors, and the app took everything the module sent')
  await browser.close()
  process.exit(0)
}

// ---- Bob plays Thorin: he follows the campaign's invite and chooses him ----
await setup.reload()
const inviteUrl = await setup.getByRole('article', { name: 'Ashlands' }).locator('code').first().textContent()
const { view: bobView, page: bobPage } = await browse({ width: 390, height: 844, who: BOB })
await bobPage.goto(inviteUrl)
await bobPage.getByRole('radio', { name: /^Thorin/ }).check()
await bobPage.getByRole('button', { name: 'Join as this character' }).click()
await bobPage.waitForURL(/\/characters\/[\w]+$/)
const bobCharacter = new URL(bobPage.url()).pathname.split('/').at(-1)
const bobId = sql(`select "userId" from character where id = '${bobCharacter}'`)
check(sql(`select "actorId" from character where id = '${bobCharacter}'`) === 'thorin' && bobId && bobId !== 'e2e-user', 'Bob claims Thorin; Balin stays unclaimed')
const bobs = sheetOf(bobPage)
await bobs.sheet.getByRole('button', { name: /^Perception check/ }).waitFor({ timeout: 20_000 })
await setup.close()

// ---- E1, E2: on a tablet, Alice opens Balin's sheet from her campaign card ----
const tablet = await browse({ width: 768, height: 1024, who: ALICE })
let page = tablet.page
await page.goto(`${BASE}/campaigns`)
const card = page.getByRole('article', { name: 'Ashlands' })
await card.waitFor()
const links = await card.getByRole('link', { name: /^Open .*'s sheet$/ }).evaluateAll(all => all.map(a => [a.getAttribute('aria-label'), new URL(a.href).pathname]))
check(same(links.sort(), [["Open Balin's sheet", gmPath(A, 'balin')], ["Open Thorin's sheet", gmPath(A, 'thorin')]].sort())
  && await card.getByText('Open one to see its sheet and roll as it.').isVisible(),
  `the campaign card links each character, claimed or not, to its sheet, saying so (${JSON.stringify(links)})`)
check(await overflow(page) <= 0, 'at 768, /campaigns scrolls not sideways')
await card.getByRole('link', { name: "Open Balin's sheet" }).click()
await page.waitForURL(`${BASE}${gmPath(A, 'balin')}`)
let alice = sheetOf(page)
await alice.sheet.getByRole('button', { name: /^Perception check/ }).waitFor({ timeout: 20_000 })
const MADE = "You're at Balin's sheet as the Gamemaster. What you roll here is made in your game as Balin's, marked as yours."
const back = page.getByRole('link', { name: 'Your campaigns' })
check(await page.getByRole('heading', { level: 1, name: 'Balin', exact: true }).isVisible() && (await page.locator('h1 + span').textContent()) === 'GM, Gamemaster view'
  && await page.getByText(MADE).isVisible() && await page.getByRole('button', { name: 'Delete Balin' }).count() === 0
  && await back.getAttribute('href') === '/campaigns' && await page.getByRole('banner').count() === 0,
  "Balin's sheet: his name with a GM pill, a note that Alice's rolls are made in her game as his, marked hers, no Delete, a way back to her campaigns, no app bar")
await alice.tray.getByText(GM_REACH).waitFor({ timeout: 15_000 })
check(true, `the tray says where her rolls go, in her words: "${GM_REACH}"`)
check(await overflow(page) <= 0, "at 768, Balin's sheet scrolls not sideways")
await shoot(page, 'gm-sheet-tablet')

// ---- E3: Balin's Perception, as the Gamemaster ----
let { request, made, text } = await alice.rollAtTable(() => alice.sheet.getByRole('button', { name: /^Perception check/ }).click(), "Balin's Perception")
const perceptionId = request.id
check(request.role === 'gm' && request.characterId === null && request.requestedById === 'e2e-user' && request.kind === 'skill' && made.status === 'done',
  `the app keeps it as the Gamemaster's, for no player's character (${JSON.stringify({ role: request.role, characterId: request.characterId, requestedById: request.requestedById })})`)
check(fetchedCommand(perceptionId)?.by === 'gm' && fetchedCommand(perceptionId).actorId === 'balin', "the module fetches it saying it's the Gamemaster's")
let message = messageFor(perceptionId)
check(message && same(ownFlags(message), { request: perceptionId, by: 'gm' }) && message.author.id === 'gm' && message.speaker.actor === 'balin',
  `the game makes it as Balin's, flagged as the Gamemaster's; no player owns him, so its author is the Gamemaster (${JSON.stringify(ownFlags(message))})`)
check(new RegExp(`At the table: ${message.rolls[0].total}`).test(text), `the tray shows what the game made of it: "${text}"`)

/** The badge the module puts on a message's card in Foundry, drawn as Foundry draws a chat card. */
const { markAppRoll } = await import(`${MODULE}/scripts/command-rolls.mjs`)
const cardPage = await foundryContext.newPage()
await cardPage.goto(`${GAME}/game`)
const moduleStyles = readFileSync(`${MODULE}/styles/sending-stone.css`, 'utf8')
async function badgeOn(message, shot) {
  const dom = new JSDOM(`<ol id="chat-log"><li class="chat-message"><header class="message-header"><h4 class="message-sender">${message.speaker.alias ?? message.speaker.actor}</h4><span class="message-metadata"><time>Now</time></span></header><div class="message-content">${message.content ?? ''}</div></li></ol>`)
  const held = { document: globalThis.document, HTMLElement: globalThis.HTMLElement }
  Object.assign(globalThis, { document: dom.window.document, HTMLElement: dom.window.HTMLElement })
  try { markAppRoll(message, dom.window.document.querySelector('li')) } finally { Object.assign(globalThis, held) }
  const badge = dom.window.document.querySelector('.sending-stone-badge')
  if (shot) {
    await cardPage.evaluate(({ html, css }) => { document.body.innerHTML = `<style>${css} body{font:14px sans-serif;background:#e8e2d4;padding:16px;width:320px} .message-header{display:flex;gap:8px;align-items:baseline} .message-metadata{margin-left:auto;display:flex;gap:4px} .chat-message{list-style:none;background:#fff;border:1px solid #999;padding:6px}</style>${html}` }, { html: dom.window.document.body.innerHTML, css: moduleStyles })
    await shoot(cardPage, shot, { clip: { x: 0, y: 0, width: 360, height: 140 } })
  }
  return badge && { className: badge.className, label: badge.getAttribute('aria-label'), tooltip: badge.dataset.tooltip, text: badge.textContent }
}
const GM_BADGE = { className: 'sending-stone-badge sending-stone-gm', label: 'Rolled on Sending Stone by the Gamemaster', tooltip: 'Rolled on Sending Stone by the Gamemaster', text: 'GM' }
let badge = await badgeOn(message, 'gm-foundry-card')
check(same(badge, GM_BADGE), `Foundry's card carries the GM badge: ${JSON.stringify(badge)}`)
await until(() => byGm(message.id) === 't', 'the app to mark the message', 15_000)
check(posted.some(p => p.type === 'chat.message.created' && p.data.message.id === message.id && p.data.message.gmRoll === perceptionId),
  "the module tells the app the message is for the Gamemaster's roll, which the app checks and keeps")
check(await lists(perceptionId, [message.id]), `${LISTED}: Balin's Perception's (${JSON.stringify(resultOf(perceptionId).messages)})`)
await alice.nav.getByRole('button', { name: /^Chat/ }).click()
await until(async () => (await pillsBy(page, 'Balin')).at(-1) === 'GM, rolled by the Gamemaster', 'the pill', 15_000)
check(true, "Alice's chat shows the GM pill on Balin's roll")
await alice.nav.getByRole('button', { name: /^Character/ }).click()

// ---- An attack as Balin, at the goblin ----
await alice.tabs.getByRole('tab', { name: 'Actions' }).click()
const mattock = page.getByRole('dialog', { name: 'Mattock attack' })
await forceD20(page, 15)
await alice.sheet.getByRole('tabpanel').getByRole('button', { name: 'Mattock attack, +5' }).click()
await mattock.waitFor()
;({ request, made, text } = await alice.rollAtTable(() => mattock.getByRole('button', { name: 'Goblin' }).click(), "Balin's attack"))
await unforce(page)
const balinAttack = request.id
let card1 = messageFor(balinAttack, 'use')
let roll1 = messageFor(balinAttack)
check(request.kind === 'attack' && request.role === 'gm' && made.status === 'done' && made.result.attack?.outcome === 'hit' && fetchedCommand(balinAttack)?.by === 'gm',
  `Balin's mattock attack at the goblin is the Gamemaster's, made in the game: a hit (${JSON.stringify(made.result.attack)})`)
check(same(cardFlags(card1), { use: balinAttack, by: 'gm' }) && same(ownFlags(roll1), { request: balinAttack, by: 'gm' }) && roll1.flags.dnd5e.originatingMessage === card1.id,
  `its card and its attack roll are both flagged as the Gamemaster's (${JSON.stringify([cardFlags(card1), ownFlags(roll1)])})`)
badge = await badgeOn(card1, 'gm-foundry-attack-card')
check(same(badge, GM_BADGE) && /At the table: 20 · Hit/.test(text), `the attack's card carries the GM badge, and the tray says "${text}"`)
await until(() => byGm(card1.id) === 't' && byGm(roll1.id) === 't', 'the app to mark both', 15_000)
check(await lists(balinAttack, [card1.id, roll1.id]), `${LISTED}: the attack's card and roll (${JSON.stringify(resultOf(balinAttack).messages)})`)
await alice.tabs.getByRole('tab', { name: 'Character' }).click()
await tablet.view.close()

// ---- E4: on a phone, Alice opens Thorin's sheet, claimed by Bob, and rolls his Dexterity save ----
const phone = await browse({ width: 390, height: 844, who: ALICE })
page = phone.page
await page.goto(`${BASE}/campaigns`)
await page.getByRole('article', { name: 'Ashlands' }).getByRole('link', { name: "Open Thorin's sheet" }).click()
await page.waitForURL(`${BASE}${gmPath(A, 'thorin')}`)
alice = sheetOf(page)
await alice.sheet.getByRole('button', { name: /^Dexterity saving throw/ }).waitFor({ timeout: 20_000 })
check(await page.getByRole('heading', { level: 1, name: 'Thorin', exact: true }).isVisible() && await page.getByText(MADE.replaceAll('Balin', 'Thorin')).isVisible()
  && await page.getByRole('button', { name: 'Delete Thorin' }).count() === 0, "on a phone, Thorin's sheet, though Bob's, opens for Alice with the GM pill and note")
await bobPage.reload()
await bobs.sheet.getByRole('button', { name: /^Perception check/ }).waitFor({ timeout: 20_000 })
const readAt = () => sql(`select coalesce("chatReadAt"::text, '') from character where id = '${bobCharacter}'`)
// Bob reads the chat as it is, Balin's rolls in it, and turns back to Thorin: his place is saved.
await bobs.nav.getByRole('button', { name: /^Chat/ }).click()
await until(() => readAt() > '1971', "Bob's place in the chat", 10_000)
await bobs.nav.getByRole('button', { name: /^Character/ }).click()
await wait(1_000)
const bobReadAt = readAt()
;({ request, made, text } = await alice.rollAtTable(() => alice.sheet.getByRole('button', { name: /^Dexterity saving throw/ }).click(), "Thorin's Dexterity save"))
const thorinSave = request.id
const saveMadeAt = realNow()
message = messageFor(thorinSave)
check(request.role === 'gm' && request.characterId === null && made.status === 'done' && same(ownFlags(message), { request: thorinSave, by: 'gm' })
  && message.author.id === 'bob' && message.speaker.actor === 'thorin',
  `the game makes it as Thorin's, by Bob, his player, as his own save would be, flagged as the Gamemaster's (${JSON.stringify(ownFlags(message))}, author ${message.author.id})`)
check(same(await badgeOn(message), GM_BADGE), "its card in Foundry carries the GM badge, though Bob is its author")
await until(() => byGm(message.id) === 't', 'the app to mark it', 15_000)
check(await lists(thorinSave, [message.id]), `${LISTED}: Thorin's save's (${JSON.stringify(resultOf(thorinSave).messages)})`)
await alice.nav.getByRole('button', { name: /^Chat/ }).click()
await until(async () => (await pillsBy(page, 'Thorin')).at(-1) === 'GM, rolled by the Gamemaster', "the pill on Alice's chat", 15_000)
await wait(3_000)
check(readAt() === bobReadAt, `while Alice has the chat open, Bob's place in it doesn't move (${bobReadAt || 'none'})`)
await shoot(page, 'gm-sheet-phone')
check(await overflow(page) <= 0, "at 390, Thorin's sheet scrolls not sideways")
await bobs.nav.getByRole('button', { name: /^Chat\s*1\s*unread/ }).waitFor({ timeout: 15_000 })
// Since this round his banner shows it, as one of his rolls, marked as the Gamemaster's (#156).
const bobsBanner = bobs.tray.locator(`[data-gm-roll="gm:${thorinSave}"]`)
await bobsBanner.waitFor({ timeout: 15_000 })
const bannerText = await bobsBanner.textContent()
check(bannerText.includes(`At the table: ${message.rolls[0].total}`) && bannerText.includes('Rolled by your Gamemaster')
  && await bobsBanner.locator('[title="Rolled by your Gamemaster"]').textContent() === 'GM, rolled by your Gamemaster'
  && await bobs.tray.getByRole('button', { name: /Roll damage/ }).count() === 0,
  `Bob's phone counts it unread, though it's Thorin's, and his banner shows it as his latest roll, marked GM, with the game's total, nothing to roll after it: "${bannerText}"`)
await bobs.nav.getByRole('button', { name: /^Chat/ }).click()
await until(async () => (await pillsBy(bobPage, 'Thorin')).at(-1) === 'GM, rolled by the Gamemaster', "the pill on Bob's chat", 15_000)
check(true, "Bob's chat shows the GM pill on it")
// Bob copies the save's flags onto a message of his own as Thorin, from his browser, at once. The
// module can't tell it from the save's and sends it claiming the roll, but the roll's result doesn't
// list it, so the app gives it no pill. From module 0.24.0, whose results list nothing, the app
// keeps its rule from before: the character's message while the roll is recent, so it gets one.
const copy = Object.assign(Object.create(Object.getPrototypeOf(message)), message, {
  id: 'copiedThorinSav1', uuid: 'ChatMessage.copiedThorinSav1', timestamp: Date.now(), author: users.get('bob'),
  _source: { author: 'bob' }, content: '<p>The Gamemaster rolled this for me</p>', flags: JSON.parse(JSON.stringify(message.flags)),
})
messages.set(copy.id, copy)
const thorinsBefore = (await pillsBy(bobPage, 'Thorin')).length
const copiedAfter = realNow() - saveMadeAt
await Hooks.callAll('createChatMessage', copy, {}, 'bob')
await until(() => posted.some(p => p.type === 'chat.message.created' && p.data.message.id === copy.id), 'the copy to reach the app', 15_000)
await until(async () => (await pillsBy(bobPage, 'Thorin')).length > thorinsBefore, "the copy in Bob's chat", 15_000)
const copyPost = posted.find(p => p.type === 'chat.message.created' && p.data.message.id === copy.id)
const copyPills = await pillsBy(bobPage, 'Thorin')
check(copyPost.status < 300 && copyPost.data.message.gmRoll === thorinSave && copiedAfter < 60_000 && byGm(message.id) === 't'
  && byGm(copy.id) === (OLD_RULE ? 't' : 'f') && same(copyPills.slice(-2), ['GM, rolled by the Gamemaster', OLD_RULE ? 'GM, rolled by the Gamemaster' : null]),
  OLD_RULE
    ? `a message of Bob's as Thorin, the save's flags copied ${Math.round(copiedAfter / 1000)} s after it, claims the roll and, with module 0.24.0, gets the pill by the rule from before (${JSON.stringify(copyPills.slice(-2))})`
    : `a message of Bob's as Thorin, the save's flags copied ${Math.round(copiedAfter / 1000)} s after it, claims the roll but isn't among its result's messages, so it gets no pill; the save keeps its own (${JSON.stringify(copyPills.slice(-2))})`)
await shoot(bobPage, 'gm-player-chat-phone')
await bobs.nav.getByRole('button', { name: /^Character/ }).click()
await alice.nav.getByRole('button', { name: /^Character/ }).click()

// ---- An attack as Thorin ----
await alice.tabs.getByRole('tab', { name: 'Actions' }).click()
const longsword = page.getByRole('dialog', { name: 'Longsword attack' })
await forceD20(page, 15)
await alice.sheet.getByRole('tabpanel').getByRole('button', { name: 'Longsword attack, +6' }).click()
await longsword.waitFor()
const offered = await longsword.getByRole('listitem').allTextContents()
;({ request, made, text } = await alice.rollAtTable(() => longsword.getByRole('button', { name: 'Goblin' }).click(), "Thorin's attack"))
await unforce(page)
card1 = messageFor(request.id, 'use')
roll1 = messageFor(request.id)
check(offered.includes('Goblin') && !offered.includes('Thorin') && request.kind === 'attack' && request.role === 'gm' && made.result.attack?.outcome === 'hit',
  `as Thorin, Alice's longsword asks whom to attack, Thorin left out, and hits the goblin (${JSON.stringify(offered)}): "${text}"`)
check(same(cardFlags(card1), { use: request.id, by: 'gm' }) && same(ownFlags(roll1), { request: request.id, by: 'gm' })
  && card1.author.id === 'bob' && roll1.author.id === 'bob' && same(await badgeOn(card1), GM_BADGE),
  `its card and roll are made by Bob, as his own attack's would be, flagged and badged as the Gamemaster's (${JSON.stringify([cardFlags(card1), ownFlags(roll1), card1.author.id, roll1.author.id])})`)
await until(() => byGm(card1.id) === 't' && byGm(roll1.id) === 't', 'the app to mark both', 15_000)
check(await lists(request.id, [card1.id, roll1.id]), `${LISTED}: Thorin's attack's card and roll, both pilled (${JSON.stringify(resultOf(request.id).messages)})`)
await alice.tabs.getByRole('tab', { name: 'Character' }).click()

// ---- E5: one of Thorin's hit dice, spent by the Gamemaster ----
const hpBefore = thorin.system.attributes.hp.value
;({ request, made, text } = await alice.rollAtTable(() => alice.sheet.getByRole('button', { name: 'Use a d10 hit die, 3 of 5 left' }).click(), "Thorin's hit die"))
message = messageFor(request.id)
check(request.kind === 'hitDie' && request.role === 'gm' && made.status === 'done' && same(ownFlags(message), { request: request.id, by: 'gm' }) && thorin.system.attributes.hp.value > hpBefore,
  `the hit die heals Thorin, ${hpBefore} to ${thorin.system.attributes.hp.value}, its card flagged as the Gamemaster's`)
check(await lists(request.id, [message.id]), `${LISTED}: the hit die's card (${JSON.stringify(resultOf(request.id).messages)})`)
await Hooks.callAll('updateActor', thorin, { system: { attributes: { hp: { value: thorin.system.attributes.hp.value } } } })
const hpShown = () => bobs.sheet.getByRole('term').filter({ hasText: /^Hit points$/ }).locator('xpath=..').textContent()
await until(async () => (await hpShown()).includes(`${thorin.system.attributes.hp.value}`), "Bob's sheet to follow", 15_000)
check(true, `Bob's sheet follows, at ${thorin.system.attributes.hp.value} hit points`)

// ---- E6: Bob's own roll is his, unmarked ----
let bobBody = null
bobPage.on('request', req => { if (req.method() === 'POST' && req.url().endsWith(`/api/characters/${bobCharacter}/rolls`)) bobBody ??= req.postDataJSON() })
;({ request, made } = await bobs.rollAtTable(() => bobs.sheet.getByRole('button', { name: /^Perception check/ }).click(), "Bob's Perception"))
message = messageFor(request.id)
const bobCommand = fetchedCommand(request.id)
check(request.role === 'player' && request.characterId === bobCharacter && request.requestedById === bobId && same(ownFlags(message), { request: request.id })
  && bobCommand && !('by' in bobCommand) && message.author.id === 'bob',
  `Bob's own Perception is his: flagged as before, no "by" in what the module fetched (${JSON.stringify(ownFlags(message))})`)
await until(() => posted.some(p => p.type === 'chat.message.created' && p.data.message.id === message.id), 'its chat message', 15_000)
check(!('gmRoll' in posted.find(p => p.type === 'chat.message.created' && p.data.message.id === message.id).data.message) && byGm(message.id) === 'f', "and its message isn't the Gamemaster's, there or in the app")
await until(() => resultOf(request.id), "his roll's result", 15_000)
check(resultOf(request.id).status === 'done' && !('messages' in resultOf(request.id)), `and its result, a player's, lists no messages (${JSON.stringify(Object.keys(resultOf(request.id)))})`)
// Someone takes the mark off Balin's Perception in Foundry: the app keeps what it knows.
const perception = messageFor(perceptionId)
delete perception.flags['sending-stone'].by
await perception.update({ flags: { 'sending-stone': { request: perceptionId } } })
await until(() => posted.some(p => p.type === 'chat.message.updated' && p.data.message.id === perception.id), 'the update to reach the app', 15_000)
const update = posted.findLast(p => p.type === 'chat.message.updated' && p.data.message.id === perception.id)
check(update.status < 300 && !('gmRoll' in update.data.message) && byGm(perception.id) === 't', 'with "by" taken off its flags in Foundry, Balin\'s Perception stays the Gamemaster\'s in the app')

// ---- E7: a save the game asks for, answered by the Gamemaster ----
const asked = await requestCard({ abilities: ['dex'], dc: 12 })
const promptRow = id => JSON.parse(sql(`select row_to_json(p)::text from (select "closedAt" is not null as closed, "closedReason" as reason from roll_prompt where "promptId" = '${id}') p`) || 'null')
await until(() => promptRow(`${asked.id}-thorin`) && promptRow(`${asked.id}-balin`), 'the prompts', 15_000)
const balinPage = (await browse({ width: 390, height: 844, who: ALICE })).page
await balinPage.goto(`${BASE}${gmPath(A, 'balin')}`)
const atBalin = sheetOf(balinPage)
const gmAsks = balinPage.getByRole('region', { name: 'Your game asks' })
await gmAsks.waitFor({ timeout: 15_000 })
;({ request, made } = await atBalin.rollAtTable(() => gmAsks.getByRole('button', { name: /^Roll Dexterity saving throw/ }).click(), "Balin's answer"))
message = messageFor(request.id)
check(request.payload.prompt === `${asked.id}-balin` && request.role === 'gm' && same(ownFlags(message), { request: request.id, by: 'gm' }) && message.flags.dnd5e.originatingMessage === asked.id,
  `Alice answers the save asked of Balin from her own banner, made on the card that asked, flagged as hers (${JSON.stringify(ownFlags(message))})`)
await until(() => promptRow(`${asked.id}-balin`).reason === 'answered', 'the prompt to close', 15_000)
const bobAsks = bobPage.getByRole('region', { name: 'Your Gamemaster asks' })
await bobAsks.waitFor({ timeout: 15_000 })
const askedOfThorin = page.getByRole('region', { name: 'Your game asks' })
await askedOfThorin.waitFor({ timeout: 15_000 })
;({ request, made } = await alice.rollAtTable(() => askedOfThorin.getByRole('button', { name: /^Roll Dexterity saving throw/ }).click(), "Thorin's answer"))
check(request.payload.prompt === `${asked.id}-thorin` && request.role === 'gm' && same(ownFlags(messageFor(request.id)), { request: request.id, by: 'gm' }), "she answers Thorin's from his sheet, as the Gamemaster")
await until(async () => await bobAsks.count() === 0, "Bob's banner to close", 15_000)
const late = await call(bobPage, `/api/characters/${bobCharacter}/rolls`, { method: 'POST', body: { ...bobBody, kind: 'save', key: 'dex', prompt: `${asked.id}-thorin` } })
check(late.status === 422 && late.json?.reason === 'prompt' && promptRow(`${asked.id}-thorin`).reason === 'answered', `Bob's banner closes, and his answer, sent all the same, is refused 422 (${late.text})`)

// ---- E8: Balin down, a natural 20 on his death save ----
balin.system.attributes.hp.value = 0
await Hooks.callAll('updateActor', balin, { system: { attributes: { hp: { value: 0 } } } })
const deathSave = atBalin.sheet.getByRole('button', { name: 'Death saving throw' })
await deathSave.waitFor({ timeout: 15_000 })
await forceD20(balinPage, 20)
;({ request, made, text } = await atBalin.rollAtTable(() => deathSave.click(), "Balin's death save"))
await unforce(balinPage)
const deathRoll = messageFor(request.id)
const outcome = messageFor(request.id, 'outcome')
check(request.kind === 'death' && request.payload.dice[0].results[0] === 20 && balin.system.attributes.hp.value === 1
  && same(ownFlags(deathRoll), { request: request.id, by: 'gm' }) && same(ownFlags(outcome), { outcome: request.id, by: 'gm' }),
  `a natural 20 brings Balin to 1 hit point; the roll, and dnd5e 5.3's message of what came of it, are both flagged as the Gamemaster's (${JSON.stringify([ownFlags(deathRoll), ownFlags(outcome)])})`)
await until(() => byGm(deathRoll.id) === 't' && byGm(outcome.id) === 't', 'the app to mark both', 15_000)
check(await lists(request.id, [deathRoll.id, outcome.id]), `${LISTED}: the death save's roll and dnd5e 5.3's message of its outcome (${JSON.stringify(resultOf(request.id).messages)})`)
await atBalin.nav.getByRole('button', { name: /^Chat/ }).click()
await until(async () => (await pillsBy(balinPage, 'Balin')).slice(-2).every(pill => pill === 'GM, rolled by the Gamemaster'), 'both pills', 15_000)
check(true, 'both are pilled GM in the app')
await atBalin.nav.getByRole('button', { name: /^Character/ }).click()

// ---- E10: what a player can't say, what the Gamemaster can't end, and whose fetch takes what ----
let count = requests()
const claimed = await call(bobPage, `/api/characters/${bobCharacter}/rolls`, { method: 'POST', body: { ...bobBody, by: 'gm' } })
check(claimed.status === 400 && requests() === count, `Bob's roll saying it's the Gamemaster's is refused 400, nothing kept (${claimed.status})`)
const ending = await call(balinPage, `${gmApi(A, 'balin')}/rolls`, { method: 'POST', body: { kind: 'endEnchantment', mode: 0, explicit: false, extras: [], dice: [], enchantment: { item: 'mattock', effect: 'flameEffect00001' } } })
check(ending.status === 409 && ending.json?.reason === 'unavailable' && requests() === count, `the Gamemaster ending an enchantment is refused 409 (${ending.text})`)
sql(`update campaign set "helloSession" = 'stale' where id = '${A}'`)
await atBalin.sheet.getByRole('button', { name: /^Perception check/ }).click()
await until(() => requests() > count, "Alice's roll to be sent")
const stale = rollRow()
count = requests()
await bobs.sheet.getByRole('button', { name: /^Perception check/ }).click()
await until(() => requests() > count, "Bob's roll to be sent")
const fresh = rollRow()
await until(() => rollRow(fresh.id).status === 'done', "Bob's roll to be made")
// The app answers the next event from a session whose hello it doesn't hold, such as the result of
// Bob's roll or a heartbeat, asking for the hello again.
const { heartbeat } = await import(`${MODULE}/scripts/heartbeat.mjs`)
Date.now = () => realNow() + 31_000
heartbeat()
Date.now = realNow
await until(() => rollRow(stale.id).status === 'done', "Alice's roll to be made once the hello is sent again", 25_000)
const order = sql(`select concat_ws('|', (a."createdAt" < b."createdAt"), (a."claimToken" is distinct from b."claimToken"), (a."claimedAt" > b."claimedAt"))
  from roll_request a, roll_request b where a.id = '${stale.id}' and b.id = '${fresh.id}'`)
check(stale.role === 'gm' && fresh.role === 'player' && order === 't|t|t',
  `with the app holding another session's hello, the fetch that takes Bob's roll leaves Alice's, though older, pending; a later one takes it (${order})`)
check(same(ownFlags(messageFor(stale.id)), { request: stale.id, by: 'gm' }), 'once the module sends its hello again, it takes and makes hers, flagged as hers')

// ---- E9: nobody but Ashlands' Gamemaster reaches its Gamemaster's pages; nor does she Mirkwood's ----
// Mirkwood, Bob's own campaign, made here as a hello and its sheet would make it: Balin in its
// roster under another name, with his sheet, a description, a whisper to him, and a roll of Bob's.
const B = 'camp-b-e2e'
sql(`insert into campaign (id, origin, "foundryId", title, "ownerId", characters, "rollsEnabled", "rollKinds", "rollFeatures", "helloSession", "lastSeenAt", "updatedAt")
  select '${B}', 'https://mirkwood-e2e.forge-vtt.com', 'camp-mirk', 'Mirkwood', '${bobId}',
    jsonb_build_array((select e from jsonb_array_elements(characters::jsonb) e where e->>'id' = 'balin') || '{"name": "Balin of Mirkwood"}'),
    true, "rollKinds", "rollFeatures", 'mirkwood-session', now(), now() from campaign where id = '${A}'`)
sql(`insert into actor_sheet (id, "campaignId", "actorId", data, "updatedAt")
  select 'sheet-b-e2e', '${B}', 'balin', jsonb_set(data::jsonb, '{name}', '"Balin of Mirkwood"'), now() from actor_sheet where "campaignId" = '${A}' and "actorId" = 'balin'`)
sql(`insert into sheet_text (id, "campaignId", hash, html, "updatedAt") values ('text-b-e2e', '${B}', 'abcdef01234567', '<p>The lore of Mirkwood</p>', now())`)
sql(`insert into chat_message (id, "campaignId", "messageId", "sentAt", public, readers, data, "updatedAt")
  select 'chat-b-e2e', '${B}', 'mirkwood-message', now(), false, '{balin}',
    jsonb_set(jsonb_set(data::jsonb, '{text}', '"Mirkwood secret"'), '{content}', '"<p>Mirkwood secret</p>"'), now()
  from chat_message where "campaignId" = '${A}' and "messageId" = '${deathRoll.id}'`)
sql(`insert into roll_request (id, "campaignId", "characterId", role, "requestedById", "actorId", kind, payload, status, "updatedAt")
  values ('roll-b-e2e', '${B}', null, 'gm', '${bobId}', 'balin', 'skill', '${JSON.stringify(PAYLOAD)}', 'pending', now())`)
check(sql(`select count(*) from campaign where id = '${B}' and "ownerId" = '${bobId}'`) === '1', 'Bob is the Gamemaster of Mirkwood, which has a Balin of its own')
const NOT_HERE = "This sheet isn't open here. Its character may have left the campaign."
const refusedPage = async (who, path) => {
  const { view, page } = await browse({ width: 390, height: 844, who })
  const response = await page.goto(`${BASE}${path}`)
  await page.getByRole('heading', { name: NOT_HERE }).waitFor({ timeout: 15_000 })
  const shown = { status: response.status(), sheet: await page.getByRole('region', { name: 'Character' }).count(), back: await page.getByRole('link', { name: 'Your campaigns' }).getAttribute('href') }
  return { view, page, shown }
}
/** What the four Gamemaster's APIs answer this page for a character's sheet: its table, a roll posted, a roll, a description. */
const apis = async (page, campaign, actor, rollId, hash) => [
  (await call(page, `${gmApi(campaign, actor)}/table`)).status,
  (await call(page, `${gmApi(campaign, actor)}/rolls`, { method: 'POST', body: PAYLOAD })).status,
  (await call(page, `${gmApi(campaign, actor)}/rolls/${rollId}`)).status,
  (await call(page, `${gmApi(campaign, actor)}/texts/${hash}`)).status,
]
// A description's hash as the module makes them, 14 hexadecimal digits: these characters have none.
const ashlandsHash = '0123456789abcd'
count = requests()
for (const [who, name, campaign, actor, rollId, hash] of [
  [BOB, "Bob, Thorin's player and Mirkwood's Gamemaster, at Ashlands' Thorin", A, 'thorin', thorinSave, ashlandsHash],
  [ALICE, "Alice, Ashlands' Gamemaster, at Mirkwood's Balin", B, 'balin', 'roll-b-e2e', 'abcdef01234567'],
]) {
  const { view, page, shown } = await refusedPage(who, gmPath(campaign, actor))
  const answers = await apis(page, campaign, actor, rollId, hash)
  check(shown.status === 404 && shown.sheet === 0 && shown.back === '/campaigns' && same(answers, [404, 404, 404, 404]),
    `${name}: the page says only that the sheet isn't open here, answering 404, and so do its table, rolls, roll and description (${JSON.stringify({ ...shown, answers })})`)
  await view.close()
}
check(requests() === count, 'and nothing is kept of the rolls they posted')
const own = await call(balinPage, `${gmApi(A, 'nobody')}/table`)
const view = await call(balinPage, `${gmApi(A, 'balin')}/table`)
const crossed = [(await call(balinPage, `${gmApi(A, 'balin')}/rolls/roll-b-e2e`)).status, (await call(balinPage, `${gmApi(A, 'balin')}/texts/abcdef01234567`)).status]
check(own.status === 404 && view.status === 200 && !/Balin of Mirkwood|Mirkwood secret|The lore of Mirkwood/.test(view.text) && same(crossed, [404, 404]),
  `Alice's own campaign has no "nobody" (404); her Balin's view holds nothing of Mirkwood's Balin, and Mirkwood's roll and description aren't found through it (${JSON.stringify([own.status, view.status, crossed])})`)
{
  const { view, page } = await browse({ width: 390, height: 844 })
  await page.goto(`${BASE}${gmPath(A, 'balin')}`)
  await page.waitForURL(/\/login\?next=/)
  const next = new URL(page.url()).searchParams.get('next')
  const answers = await Promise.all(['table', 'rolls/x', `texts/${ashlandsHash}`].map(async path => (await call(page, `${gmApi(A, 'balin')}/${path}`)).status))
  check(next === gmPath(A, 'balin') && same(answers, [401, 401, 401]), `signed out, the page sends to the login page and back (${next}), and the APIs answer 401`)
  await view.close()
}

// ---- E12: nothing scrolls sideways ----
await page.goto(`${BASE}/campaigns`)
await page.getByRole('article', { name: 'Ashlands' }).waitFor()
check(await overflow(page) <= 0 && await overflow(balinPage) <= 0, 'at 390, neither /campaigns nor a Gamemaster\'s sheet scrolls sideways')
await shoot(page, 'gm-campaigns-phone')

// ---- E13: Bob sees Alice's rolls as Thorin as his own, with the module's chat events off ----
// Chat events off, as they are by default, none of the rolls' messages reaches the app. Bob's phone
// shows rolls as toasts, his tablet in the banner, both open before Alice rolls. Each of her rolls
// pops up on his phone once the game has made it, never while it's on its way, and is his tablet's
// latest roll: marked GM, in her page's words, with the game's result and nothing to roll after it.
// Her own page shows her rolls as before, none of them twice.
const hellosBefore = posted.filter(p => p.type === 'bridge.hello').length
await game.settings.set('sending-stone', 'chatEvents', false)
await until(() => posted.filter(p => p.type === 'bridge.hello').length > hellosBefore, 'the hello saying chat events are off', 15_000)
const toastsAt = await browse({ width: 390, height: 844, who: BOB })
await toastsAt.view.addInitScript(() => {
  try { localStorage.setItem('sending-stone:roll-toasts', 'on') } catch {}
  // Every toast as it first pops up: which roll's, and what it says then.
  const met = new WeakSet()
  globalThis.__toasts = []
  new MutationObserver(() => {
    for (const toast of document.querySelectorAll('[data-roll-toast]')) {
      if (met.has(toast)) continue
      met.add(toast)
      // And its line from the game: whether it's kept to so many lines, or cut short; and any list.
      const line = [...toast.querySelectorAll('p')].find(p => p.textContent.includes('At the table'))
      globalThis.__toasts.push({
        id: toast.dataset.rollToast, gm: toast.dataset.gm, text: toast.textContent, buttons: toast.querySelectorAll('button').length,
        line: line && { text: line.textContent, clamped: /line-clamp/.test(line.className), cut: line.scrollHeight > line.clientHeight + 1 },
        lists: toast.querySelectorAll('[role=list], ul, ol').length,
      })
    }
  }).observe(document, { childList: true, subtree: true })
})
const bannerAt = await browse({ width: 768, height: 1024, who: BOB })
for (const { page: at } of [toastsAt, bannerAt]) {
  await at.goto(`${BASE}/characters/${bobCharacter}`)
  await sheetOf(at).sheet.getByRole('button', { name: /^Perception check/ }).waitFor({ timeout: 20_000 })
}
const toastsOf = async id => (await toastsAt.page.evaluate(() => globalThis.__toasts)).filter(toast => toast.id === `gm:${id}`)
const bannerTray = sheetOf(bannerAt.page).tray
await page.goto(`${BASE}${gmPath(A, 'thorin')}`)
alice = sheetOf(page)
await alice.sheet.getByRole('button', { name: /^Perception check/ }).waitFor({ timeout: 20_000 })
const chatPosts = () => posted.filter(p => p.type.startsWith('chat.')).length
const chatBefore = chatPosts()
const chatRows = ids => sql(`select count(*) from chat_message where "messageId" in (${ids.map(id => `'${id}'`).join(', ')})`)
/** What Bob is shown of one of Alice's rolls: as a toast on his phone, then in his tablet's banner. */
async function shownToBob(id, what, shot) {
  await until(async () => (await toastsOf(id)).length > 0, `${what}'s toast on Bob's phone`, 15_000)
  await shoot(toastsAt.page, `${shot}-toast-phone`)
  const [toast] = await toastsOf(id)
  const banner = bannerTray.locator(`[data-gm-roll="gm:${id}"]`)
  await banner.waitFor({ timeout: 15_000 })
  await shoot(bannerAt.page, `${shot}-banner-tablet`)
  return {
    toast,
    banner: await banner.textContent(),
    bannerPill: await banner.locator('[title="Rolled by your Gamemaster"]').textContent(),
    bannerDamage: await bannerTray.getByRole('button', { name: /Roll damage/ }).count(),
  }
}

;({ request, made, text } = await alice.rollAtTable(() => alice.sheet.getByRole('button', { name: /^Perception check/ }).click(), "Thorin's Perception, chat events off"))
const offCheck = request.id
message = messageFor(offCheck)
const checkLabel = sql(`select coalesce(label, '') from roll_request where id = '${offCheck}'`)
check(request.role === 'gm' && made.status === 'done' && same(ownFlags(message), { request: offCheck, by: 'gm' }) && /Perception/.test(checkLabel)
  && chatPosts() === chatBefore && chatRows([message.id]) === '0',
  `with chat events off, Alice's Perception check as Thorin is made in the game, its message never sent to the app, and the app keeps the label her page showed, "${checkLabel}"`)
let atBob = await shownToBob(offCheck, "Thorin's Perception", 'gm-player-check')
const checkTotal = `At the table: ${message.rolls[0].total}`
check(atBob.toast.gm === 'true' && atBob.toast.text.includes(checkLabel) && atBob.toast.text.includes('GM, rolled by your Gamemaster') && atBob.toast.text.includes('Rolled by your Gamemaster')
  && atBob.toast.text.includes(checkTotal) && atBob.toast.buttons === 0 && (await toastsOf(offCheck)).length === 1,
  `at 390, Bob's toast pops up once the game has made it, marked GM, with the game's total, and no button (${JSON.stringify(atBob.toast)})`)
check(atBob.banner.includes(checkLabel) && atBob.bannerPill === 'GM, rolled by your Gamemaster' && atBob.banner.includes('Rolled by your Gamemaster') && atBob.banner.includes(checkTotal) && atBob.bannerDamage === 0,
  `at 768, it's the latest roll in Bob's banner, marked GM, with the game's total, nothing to roll after it: "${atBob.banner}"`)
const shown = await call(bannerAt.page, `/api/characters/${bobCharacter}/table`)
const viewed = shown.json?.gmRolls?.find(roll => roll.id === offCheck)
const SHOWN_FIELDS = ['id', 'kind', 'label', 'at', 'status', 'reason', 'visible', 'total', 'attack', 'outcome', 'healed', 'spent', 'enchantment', 'd20', 'healing']
check(shown.status === 200 && viewed && viewed.label === checkLabel && viewed.status === 'done' && viewed.total === message.rolls[0].total
  && Object.keys(viewed).every(key => SHOWN_FIELDS.includes(key)) && !shown.json.gmRolls.some(roll => [perceptionId, balinAttack, 'roll-b-e2e'].includes(roll.id)),
  `Bob's table view lists it among Thorin's rolls by the Gamemaster, with its label, status and the game's total, and no more; none of Balin's, nor Mirkwood's (${JSON.stringify(viewed)})`)

await alice.tabs.getByRole('tab', { name: 'Actions' }).click()
await forceD20(page, 15)
await alice.sheet.getByRole('tabpanel').getByRole('button', { name: 'Longsword attack, +6' }).click()
await longsword.waitFor()
;({ request, made, text } = await alice.rollAtTable(() => longsword.getByRole('button', { name: 'Goblin' }).click(), "Thorin's attack, chat events off"))
await unforce(page)
const offAttack = request.id
card1 = messageFor(offAttack, 'use')
roll1 = messageFor(offAttack)
const attackLabel = sql(`select coalesce(label, '') from roll_request where id = '${offAttack}'`)
const attackTotal = `At the table: ${roll1.rolls[0].total} · Hit`
check(request.kind === 'attack' && made.result.attack?.outcome === 'hit' && /Longsword/.test(attackLabel)
  && chatPosts() === chatBefore && chatRows([card1.id, roll1.id]) === '0',
  `Alice's longsword attack as Thorin hits the goblin, its card and roll never sent to the app, labelled "${attackLabel}": "${text}"`)
atBob = await shownToBob(offAttack, "Thorin's attack", 'gm-player-attack')
check(atBob.toast.gm === 'true' && atBob.toast.text.includes(attackLabel) && atBob.toast.text.includes('GM, rolled by your Gamemaster')
  && atBob.toast.text.includes(attackTotal) && atBob.toast.buttons === 0 && !/Roll damage/.test(atBob.toast.text),
  `at 390, Bob's toast says the attack hit, marked GM, with no Roll damage, nor any button (${JSON.stringify(atBob.toast)})`)
check(atBob.banner.includes(attackLabel) && atBob.bannerPill === 'GM, rolled by your Gamemaster' && atBob.banner.includes(attackTotal) && atBob.bannerDamage === 0
  && await bannerTray.locator(`[data-gm-roll="gm:${offCheck}"]`).count() === 0,
  `at 768, the attack is Bob's latest roll in the banner, a hit, marked GM, with no Roll damage: "${atBob.banner}"`)
check(await page.locator('[data-gm-roll], [data-roll-toast^="gm:"]').count() === 0 && (await alice.status.textContent()).includes(attackTotal),
  "on Alice's own page, her tray shows her attack as before, and nothing of hers twice")
check(await overflow(toastsAt.page) <= 0 && await overflow(bannerAt.page) <= 0, "at 390 and 768, Bob's sheet scrolls not sideways")
await alice.tabs.getByRole('tab', { name: 'Character' }).click()

// ---- E14: her area attack says whom it hit, by the names Bob's own view of the fight gives them ----
// The Gamemaster shares Gamemaster-only information now, so the app holds every combatant, one
// hidden from players too, which it shows no player. Three bandits and a lurker join the fight,
// Bandit 2 in plate, the rest in leather; their ids say nothing of their names.
let hellosNow = posted.filter(p => p.type === 'bridge.hello').length
await game.settings.set('sending-stone', 'gmContent', true)
await until(() => posted.filter(p => p.type === 'bridge.hello').length > hellosNow, 'the hello saying Gamemaster-only information is sent', 15_000)
const FOES = [['cbFoe1', 'Bandit 1', 13, 8], ['cbFoe2', 'Bandit 2', 30, 7], ['cbFoe3', 'Bandit 3', 13, 6], ['cbFoe4', 'Lurker', 13, 5]]
const foeName = Object.fromEntries(FOES.map(([id, name]) => [id, name]))
const foes = {}
for (const [id, name, ac, initiative] of FOES) {
  const actorId = id.slice(2).toLowerCase()
  const foe = new Actor5e({ id: actorId, name, mods: {}, hp: { value: 20, max: 20, temp: 0 } })
  foe.type = 'npc'
  actors.set(actorId, foe)
  equip(foe, { ac })
  const token = { id: `tok${actorId}`, name, uuid: `Scene.scene.Token.tok${actorId}`, actor: foe, hidden: false }
  token.object = { id: token.id, name, document: token, actor: foe }
  placeables.set(token.id, token.object)
  foes[id] = combatant(fight, id, foe, { name, initiative, token })
  await Hooks.callAll('createCombatant', foes[id], {}, 'gm')
}
const namesIn = async (at, path) => ((await call(at, path)).json?.combat?.combatants ?? []).map(({ name }) => name)
const FOE_NAMES = FOES.map(([, name]) => name)
await until(async () => {
  const [bobs, alices] = [await namesIn(bannerAt.page, `/api/characters/${bobCharacter}/table`), await namesIn(page, `${gmApi(A, 'thorin')}/table`)]
  return FOE_NAMES.every(name => bobs.includes(name) && alices.includes(name))
}, "the foes in Bob's and Alice's views of the fight", 15_000)
await alice.tabs.getByRole('tab', { name: 'Actions' }).click()
const breath = page.getByRole('dialog', { name: 'Breath Weapon attack' })
await forceD20(page, 15)
await alice.sheet.getByRole('tabpanel').getByRole('button', { name: 'Breath Weapon attack, +6' }).click()
await breath.waitFor()
for (const name of FOE_NAMES) await breath.getByRole('checkbox', { name: new RegExp(`^${name}`) }).click()
await shoot(page, 'gm-area-pick-phone')
;({ request, made, text } = await alice.rollAtTable(() => breath.getByRole('button', { name: 'Attack 4 targets' }).click(), "Thorin's breath at four"))
await unforce(page)
const areaId = request.id
const areaTotal = messageFor(areaId).rolls[0].total
const said = made.result.attack?.targets ?? []
const picked = (request.payload.targets ?? []).map(({ combatantId }) => combatantId)
const hitNames = said.filter(({ outcome }) => outcome === 'hit').map(({ combatantId }) => foeName[combatantId])
const areaLine = `At the table: ${areaTotal} · Hit 3 of 4: ${hitNames.join(', ')}`
const alicesList = await alice.status.getByRole('list', { name: 'Targets' }).getByRole('listitem').allTextContents()
check(request.kind === 'attack' && request.role === 'gm' && made.status === 'done' && same([...picked].sort(), FOES.map(([id]) => id).sort())
  && same(said.map(({ combatantId }) => combatantId), picked) && same(said.map(({ outcome }) => outcome), picked.map(id => (id === 'cbFoe2' ? 'miss' : 'hit')))
  && same([...hitNames].sort(), ['Bandit 1', 'Bandit 3', 'Lurker']) && text.includes(`At the table: ${areaTotal} · Hit 3 of 4`) && alicesList.length === 4,
  `Alice's breath as Thorin at all four is one roll, ${areaTotal}: it hits the bandits in leather and the lurker and misses Bandit 2 in plate, told in the order they were picked; her own tray lists each (${JSON.stringify(said)}; ${JSON.stringify(alicesList)})`)
atBob = await shownToBob(areaId, "Thorin's breath", 'gm-player-area')
check(atBob.toast.gm === 'true' && atBob.toast.line?.text === areaLine && !atBob.toast.line.clamped && !atBob.toast.line.cut && atBob.toast.lists === 0
  && atBob.toast.buttons === 0 && (await toastsOf(areaId)).length === 1,
  `at 390, Bob's toast says whom it hit, by the names his view of the fight gives them, in the order picked, said whole, with no list: "${atBob.toast.line?.text}"`)
check(atBob.banner.includes(areaLine) && atBob.bannerPill === 'GM, rolled by your Gamemaster' && atBob.bannerDamage === 0,
  `at 768, Bob's banner says it the same: "${atBob.banner}"`)
// The Gamemaster hides the lurker in Foundry. The app keeps it, hidden; Bob's view drops it, so his
// pages can't name it and count it instead.
foes.cbFoe4.hidden = true
await Hooks.callAll('updateCombatant', foes.cbFoe4, { hidden: true }, {}, 'gm')
const heldHidden = () => sql(`select count(*) from combat, jsonb_array_elements(data::jsonb->'combatants') c where c->>'name' = 'Lurker' and c->>'hidden' = 'true'`)
await until(() => heldHidden() === '1', 'the app to hold the lurker, hidden', 15_000)
const counted = `At the table: ${areaTotal} · Hit 3 of 4: ${hitNames.filter(name => name !== 'Lurker').join(', ')} and 1 more`
const bannerNow = () => bannerTray.locator(`[data-gm-roll="gm:${areaId}"]`).textContent()
await until(async () => (await bannerNow()).includes(counted), "Bob's banner to count the lurker", 15_000)
check(!(await bannerNow()).includes('Lurker'), `hidden, at 768, Bob's banner counts the lurker, never naming it: "${await bannerNow()}"`)
await shoot(bannerAt.page, 'gm-player-area-hidden-banner-tablet')
await until(async () => await toastsAt.page.locator(`[data-roll-toast="gm:${areaId}"]`).count() === 0, "the breath's toast to go", 15_000)
const bobsRolls = toastsAt.page.getByRole('dialog', { name: 'Your rolls' })
await toastsAt.page.getByRole('button', { name: /^Your rolls/ }).click()
await bobsRolls.waitFor()
await until(async () => (await bobsRolls.getByRole('status').textContent()).includes(counted), "Bob's Rolls popover to count the lurker", 15_000)
await shoot(toastsAt.page, 'gm-player-area-hidden-popover-phone')
const bobsView = await call(bannerAt.page, `/api/characters/${bobCharacter}/table`)
const areaView = bobsView.json?.gmRolls?.find(roll => roll.id === areaId)
const onPages = await Promise.all([toastsAt.page, bannerAt.page].map(at => at.evaluate(() => document.body.textContent.includes('Lurker'))))
check(bobsView.status === 200 && !bobsView.text.includes('Lurker') && same(onPages, [false, false])
  && same(areaView?.attack?.targets?.map(target => Object.keys(target).sort()), FOES.map(() => ['combatId', 'combatantId', 'outcome']))
  && !bobsView.json.combat.combatants.some(({ id }) => id === 'cbFoe4') && heldHidden() === '1',
  `at 390, his Rolls popover counts it too; the lurker's name is on neither of his pages, nor in his view, which gives the attack's targets by id and outcome alone, though the app holds it, hidden (${JSON.stringify(areaView?.attack)})`)
await toastsAt.page.keyboard.press('Escape')
await alice.tabs.getByRole('tab', { name: 'Character' }).click()
await toastsAt.view.close()
await bannerAt.view.close()

await bobView.close()
console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors, and the app took everything the module sent')
await browser.close()
process.exit(0)
