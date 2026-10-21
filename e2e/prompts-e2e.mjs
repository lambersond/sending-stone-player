// The saving throws the game asks of players' characters, end to end: the real module, in a
// stand-in Foundry with dnd5e 5.3.3's real dice classes and dnd5e's concentration and chat cards,
// tells the production app, from a browser on the game's page, what the game asks of Thorin; Alice
// answers on her phone, and the game makes each save on the card that asked, with her dice. MIDI=1
// adds Midi-QOL's settings, its concentration card and its concentration hook. Run with
// --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import { settings, user, users, actors } from './fvtt/stub.mjs'
import { JSDOM } from 'jsdom'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'
import { DND5E5 } from './fvtt/paths.mjs'

const DND5E = `${DND5E5}/module/dice`
const GAME = 'https://lonely-mountain.forge-vtt.com'
const SECRET = 'ashlands-secret-123'
const MIDI = Boolean(process.env.MIDI)
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

// ---- Foundry, with dnd5e's dice, its concentration and its cards, and Thorin ----
globalThis.DOMParser = new JSDOM('').window.DOMParser
const { messages } = await import('./fvtt/dice-core.mjs')
const { default: BasicDie } = await import(`${DND5E}/basic-die.mjs`)
const { default: BasicRoll } = await import(`${DND5E}/basic-roll.mjs`)
const { default: D20Die } = await import(`${DND5E}/d20-die.mjs`)
const { default: D20Roll } = await import(`${DND5E}/d20-roll.mjs`)
Object.assign(CONFIG.Dice, { BasicDie, BasicRoll, D20Die, D20Roll })
CONFIG.Dice.terms.d = BasicDie
const ABILITIES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
CONFIG.DND5E = {
  skills: { prc: { label: 'Perception', ability: 'wis' } },
  tools: {},
  abilities: Object.fromEntries(Object.entries(ABILITIES).map(([id, label]) => [id, { label, abbreviation: id }])),
  defaultAbilities: { initiative: 'dex', concentration: 'con' },
}
globalThis.dnd5e = { settings: { rulesVersion: 'modern' } }
settings.set('challengeVisibility', 'player')
const { Character, saveCard, requestCard, midiConcentrationCard, deleteMessage } = await import('./fvtt/dnd5e-cards.mjs')
globalThis.fromUuidSync = uuid => {
  const [type, id, embedded, embeddedId] = String(uuid).split('.')
  if (type !== 'Actor') return null
  const actor = actors.get(id) ?? null
  return embedded === 'Item' ? (actor?.items?.get(embeddedId) ?? null) : actor
}

// Midi-QOL, when asked for: its settings, and its hook ending concentration after a failed check.
const midiSettings = { autoCheckSaves: 'none', doConcentrationCheck: 'chatOnly', removeConcentration: true }
if (MIDI) {
  game.modules.set('midi-qol', { active: true })
  globalThis.MidiQOL = { configSettings: () => midiSettings }
  Hooks.on('dnd5e.rollConcentration', (rolls, { subject }) => {
    if (midiSettings.removeConcentration && rolls.some(roll => roll.isFailure)) subject.endConcentration()
  })
}

users.activeGM = user('gm', 'Gamemaster', true)
const alice = user('alice', 'Alice')
const thorin = new Character({
  id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 4, dex: 1, con: 3, wis: 2 },
  skills: { prc: { ability: 'wis' } },
})
// What the sheet shows, as dnd5e prepares it.
thorin.system.skills.prc.total = 5
thorin.system.skills.prc.passive = 15
thorin.system.attributes.init.total = 1
thorin.system.attributes.ac = { value: 18 }
thorin.system.details = { level: 5 }
actors.set('thorin', thorin)
alice.character = thorin
const goblin = new Character({ id: 'goblin', name: 'Goblin Shaman' })
const burningHands = { id: 'burning', name: 'Burning Hands', img: 'burning.webp', uuid: 'Actor.goblin.Item.burning' }
goblin.items.set('burning', burningHands)
actors.set('goblin', goblin)

await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-ash': SECRET })
settings.set('chatEvents', true)
const campaigns = prompts => [{ id: 'camp-ash', title: 'Ashlands', characters: ['thorin'], rolls: true, prompts }]
settings.set('campaigns', campaigns(true))
await Hooks.callAll('ready')
await until(() => posted.some(p => p.url.endsWith('/api/bridge/commands')), "the module's first fetch")
const features = () => sql(`select array_to_string("rollFeatures", ',') from campaign where title = 'Ashlands'`)
// From module 0.21.0 the hello also says check activities' checks are made (dnd5e 5) and that more
// dice change only a die damage adds, wherever players' rolls are made.
check(features() === 'prompts,activityChecks,signedDice,gmRolls,gmRollMessages', `the app keeps that the game asks its players for their saves (${features()})`)

// The Gamemaster's card says so.
await gm.reload()
const card = gm.getByRole('article', { name: 'Ashlands' })
await card.getByText("Players' rolls").waitFor()
check(/its player is asked here to roll it/.test(await card.textContent()), "the Gamemaster's campaign card says players are asked for the saves the game asks of them")

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
const banner = page.getByRole('region', { name: 'Your Gamemaster asks' })
const tray = page.getByRole('region', { name: 'Your rolls' })
await sheet.getByRole('button', { name: /^Perception check/ }).waitFor()
check(await banner.count() === 0, 'nothing is asked of Thorin yet')

/** The roll Alice's latest request asked for, and the prompt it answered. */
const latestRequest = () => JSON.parse(sql(`select row_to_json(r)::text from (select id, status, payload, result from roll_request order by "createdAt" desc limit 1) r`) || 'null')
const promptRow = id => JSON.parse(sql(`select row_to_json(p)::text from (select "closedAt" is not null as closed, "closedReason" as reason from roll_prompt where "promptId" = '${id}') p`) || 'null')
const requests = () => Number(sql('select count(*) from roll_request'))
const messageFor = id => messages.contents.find(m => m.flags['sending-stone']?.request === id)

async function answer(button, what) {
  const before = requests()
  await button.click()
  await until(() => requests() > before, `${what} to be sent`)
  const request = latestRequest()
  await until(() => ['done', 'failed'].includes(latestRequest().status), `${what} to be made`)
  const made = latestRequest()
  const status = tray.getByRole('status')
  await status.getByText(/At the table|Not made at the table/).waitFor({ timeout: 30_000 })
  return { request, made, message: messageFor(request.id), text: await status.textContent() }
}

// ---- dnd5e's concentration check ----
thorin.concentrateOn('Bless')
let asked = await thorin.challengeConcentration({ dc: 12 })
let promptId = `${asked.id}-thorin`
await banner.waitFor({ timeout: 15_000 })
let text = await banner.textContent()
check(/Concentration check/.test(text) && /Bless/.test(text) && !/DC 12/.test(text), `the phone asks Alice for Thorin's concentration check, naming Bless, its DC hidden as dnd5e hides a Gamemaster's: "${text}"`)
check(promptRow(promptId)?.closed === false, 'the app keeps the prompt open')
await shoot(page, 'phone-prompt-concentration')

// The Character tab marks it while she reads the chat.
await page.getByRole('navigation', { name: 'Table' }).getByRole('button', { name: 'Chat' }).click()
await page.getByRole('navigation', { name: 'Table' }).getByRole('button', { name: 'Character , your Gamemaster asks for a roll' }).waitFor()
check(true, 'the Character tab is marked while the game asks for a roll')
await page.getByRole('navigation', { name: 'Table' }).getByRole('button', { name: /^Character/ }).click()

let { request, made, message, text: said } = await answer(banner.getByRole('button', { name: /^Roll Concentration check/ }), 'the concentration check')
check(request.payload.kind === 'save' && request.payload.key === 'con' && request.payload.prompt === promptId, `the phone sends the save, answering the prompt (${JSON.stringify(request.payload)})`)
check(made.status === 'done' && message?.flags.dnd5e.originatingMessage === asked.id && message.rolls[0].options.target === 12, 'the game makes it on the card that asked, against its DC')
check(message.rolls[0].dice[0].results[0].result === request.payload.dice[0].results[0], `with the d20 Alice rolled: ${request.payload.dice[0].results[0]}`)
const failedCheck = message.rolls[0].total < 12
check(failedCheck ? (thorin.ended.includes('Bless') && thorin.concentration.effects.size === 0) : thorin.concentration.effects.size === 1, `${failedCheck ? 'failed, it ends Thorin\'s concentration' : 'made, Thorin keeps concentrating'}${MIDI ? ', as Midi does' : ''} (total ${message.rolls[0].total})`)
check(said.includes(`At the table: ${message.rolls[0].total}`) && !/Saved|Failed/.test(said), `the tray shows the game's total, not whether he saved, which dnd5e hides: "${said}"`)
await until(async () => (await banner.count()) === 0, 'the banner to go once answered', 15_000)
check(promptRow(promptId).reason === 'answered', 'the prompt closes, answered')
await shoot(page, 'phone-prompt-answered')

// ---- A spell's save, its DC shown ----
settings.set('challengeVisibility', 'all')
asked = await saveCard({ by: goblin, item: burningHands, dc: 13, targets: [thorin] })
promptId = `${asked.id}-thorin`
await banner.waitFor({ timeout: 15_000 })
text = await banner.textContent()
check(/Dexterity saving throw/.test(text) && /DC 13 · Burning Hands/.test(text), `the phone asks for the save Burning Hands calls for, with its DC, as the game shows it: "${text}"`)
;({ request, made, message, text: said } = await answer(banner.getByRole('button', { name: /^Roll Dexterity saving throw/ }), 'the Dexterity save'))
const saved = message.rolls[0].total >= 13
check(message.flags.dnd5e.originatingMessage === asked.id && message.flags.dnd5e.roll.type === 'save', 'the game makes the save on the spell\'s card')
check(said.includes(`At the table: ${message.rolls[0].total} · ${saved ? 'Saved' : 'Failed'}`), `the tray says whether he saved: "${said}"`)
await shoot(page, 'phone-prompt-saved')
settings.set('challengeVisibility', 'player')

// ---- A request in chat, rolled in Foundry instead ----
// Another phone has the toasts, the default (toasts3): while the game asks, they start 8 pixels below
// its prompts, whose buttons stay tappable, as the tab row's do; once it no longer asks, below the row.
const toasting = await newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light' })
await toasting.addCookies([cookie])
await toasting.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '' }))
const toastPage = await toasting.newPage()
toastPage.on('pageerror', e => problems.push(`toasts pageerror: ${e.message}`))
await toastPage.goto(`${BASE}/characters/sheet-thorin`)
const toastSheet = toastPage.getByRole('region', { name: 'Character' })
await toastSheet.getByRole('button', { name: /^Perception check/ }).waitFor()
await toastPage.getByRole('log', { name: 'Roll results' }).waitFor({ state: 'attached', timeout: 15_000 })
/**
 * Where the toasts start, against the bottom of the prompts, else of the tab row, rounded up and 8
 * pixels on; and the row's controls and the prompts' buttons not tappable at every point, by
 * elementFromPoint, at their centre and 2 pixels inside each edge.
 */
const toastPlace = () => toastPage.evaluate(async () => {
  await Promise.all([...document.querySelectorAll('[role=log] [data-roll-toast]')].flatMap(el => el.getAnimations().map(a => a.finished.catch(() => {}))))
  const log = document.querySelector('[role=log][aria-label="Roll results"]')
  const asks = document.querySelector('section[aria-labelledby="prompts-heading"]')
  const row = document.querySelector('[role=tablist][aria-label="Character sheet"]').parentElement
  const controls = [...row.querySelectorAll('[role=tab]'), ...row.querySelectorAll('button[title="Your rolls"], button[aria-label="Settings"]'), ...(asks?.querySelectorAll('button') ?? [])]
  const blocked = controls.flatMap(el => {
    const b = el.getBoundingClientRect()
    const [x, y] = [b.left + b.width / 2, b.top + b.height / 2]
    return [[x, y], [b.left + 2, y], [b.right - 2, y], [x, b.top + 2], [x, b.bottom - 2]].flatMap(([px, py]) => {
      const hit = document.elementFromPoint(px, py)
      return hit && (hit === el || el.contains(hit)) ? [] : [`${el.getAttribute('aria-label') || el.title || el.textContent} at ${Math.round(px)},${Math.round(py)}: ${hit?.closest('[data-roll-toast]') ? 'a toast' : hit?.outerHTML.slice(0, 40)}`]
    })
  })
  const under = (asks ?? row).getBoundingClientRect().bottom
  return {
    set: log.parentElement.style.top, want: Math.ceil(under) + 8, under: asks ? 'prompts' : 'row', bottom: Math.round(under),
    card: log.querySelector('[data-roll-toast]')?.getBoundingClientRect().top ?? null, controls: controls.length, prompted: asks?.querySelectorAll('button').length ?? 0, blocked,
  }
})
const startsRight = place => place.set === `${place.want}px` && (place.card === null || Math.abs(place.card - place.want) <= 0.5) && place.blocked.length === 0
asked = await requestCard({ abilities: ['str', 'dex'], dc: 15 })
promptId = `${asked.id}-thorin`
await banner.getByText('Strength or Dexterity saving throw').waitFor({ timeout: 15_000 })
check(await banner.getByRole('button', { name: /^Roll (Strength|Dexterity) saving throw/ }).count() === 2, 'a request offering two abilities offers a roll with each')
await shoot(page, 'phone-prompt-request')
await toastPage.getByRole('region', { name: 'Your Gamemaster asks' }).getByText('Strength or Dexterity saving throw').waitFor({ timeout: 15_000 })
const perceptionAt = requests()
await toastSheet.getByRole('button', { name: /^Perception check/ }).click()
await until(() => requests() > perceptionAt, 'the Perception check from the toasting phone to be sent')
await toastPage.getByRole('log', { name: 'Roll results' }).locator('[data-roll-toast]').filter({ hasText: 'Perception check' }).waitFor({ timeout: 25_000 })
let place = await toastPlace()
check(place.under === 'prompts' && place.prompted === 2 && place.card !== null && place.controls > place.prompted && startsRight(place),
  `on a phone with the toasts, a check's toast starts 8 pixels below the game's prompts (${place.bottom}, toast at ${place.set}), and the prompts' two rolls and the tab row's ${place.controls - place.prompted} controls are all tappable (${place.blocked.join('; ')})`)
await shoot(toastPage, 'phone-prompt-toast')
await thorin.rollSavingThrow({ ability: 'str', target: 15 }, { configure: false }, { data: { flags: { dnd5e: { originatingMessage: asked.id } } } })
await until(async () => (await banner.count()) === 0, 'the banner to go once rolled in Foundry', 15_000)
check(promptRow(promptId).reason === 'rolled', 'rolled from the card in Foundry, the prompt closes there too')
await until(async () => (await toastPlace()).under === 'row', 'the prompts to go on the toasting phone', 15_000)
await until(async () => (await toastPlace()).set === `${(await toastPlace()).want}px`, 'the toasts to move up', 2_000).catch(() => {})
place = await toastPlace()
check(place.under === 'row' && startsRight(place), `the prompts gone, the toasts start 8 pixels below the tab row again (${place.bottom}, toast at ${place.set}) (${place.blocked.join('; ')})`)
await toasting.close()

// ---- A card deleted ----
asked = await requestCard({ abilities: ['wis'], dc: 10 })
promptId = `${asked.id}-thorin`
await banner.waitFor({ timeout: 15_000 })
await deleteMessage(asked)
await until(async () => (await banner.count()) === 0, 'the banner to go once its card is deleted', 15_000)
check(promptRow(promptId).reason === 'gone', 'its card deleted, the prompt closes')

if (MIDI) {
  // Midi-QOL's own concentration card, which Midi rolls itself, asks no one.
  thorin.concentrateOn('Hex')
  midiSettings.doConcentrationCheck = 'chat'
  const own = await midiConcentrationCard(thorin, 10)
  await wait(4000)
  check(await banner.count() === 0 && promptRow(`${own.id}-thorin`) === null, "Midi-QOL's own concentration card, which it rolls itself, asks Alice nothing")
  // Nor does a save Midi rolls itself.
  midiSettings.autoCheckSaves = 'allShow'
  const rolled = await saveCard({ by: goblin, item: burningHands, dc: 13, targets: [thorin] })
  await wait(4000)
  check(await banner.count() === 0 && promptRow(`${rolled.id}-thorin`) === null, 'a save Midi-QOL rolls itself asks Alice nothing')
  midiSettings.autoCheckSaves = 'none'
  midiSettings.doConcentrationCheck = 'chatOnly'
}

// ---- Turned off by the Gamemaster ----
asked = await requestCard({ abilities: ['dex'], dc: 10 })
promptId = `${asked.id}-thorin`
await banner.waitFor({ timeout: 15_000 })
await game.settings.set('sending-stone', 'campaigns', campaigns(false))
await until(async () => (await banner.count()) === 0, 'the banner to go once prompts are off', 15_000)
check(promptRow(promptId).reason === 'gone' && features() === 'activityChecks,signedDice,gmRolls,gmRollMessages', `turned off, the game asks no more, and what it asked closes (${features()})`)
await gm.reload()
check(!/its player is asked here/.test(await gm.getByRole('article', { name: 'Ashlands' }).textContent()), "the Gamemaster's card no longer says players are asked")

console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors, and the app took everything the module sent')
await browser.close()
process.exit(0)
