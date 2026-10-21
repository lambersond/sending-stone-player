// Big parties and smaller sheets (module 0.22.0), end to end: the real module, in a stand-in Foundry
// with dnd5e 5.3.3's real dice classes and its activities ported (fvtt/activity5e.mjs), tells the
// production app, from a browser on the game's page, of a party of nine synthetic wizards, each with
// a spellbook of 150 spells, whose sheets in the full shape come to more than a megabyte between
// them, as a pre-0.22.0 hello would have carried them (never the Ashlands data: every character,
// spell and description here is made up). The hello is small and lists the party without sheets;
// each sheet follows in a post of its own, slim; every character is on the roster, and each sheet
// renders on Alice's phone and rolls, its checks made in the game. Then the Gamemaster gives Garrick
// a hoard of 14,000 gems, which makes his sheet larger than the app takes: it's withheld, the
// Gamemaster is warned, and the player's page says it was too large to send, the other eight
// untouched; once the hoard is gone it goes again. A later hello, one sheet after it lost, removes
// no character and keeps the sheet the app held. Last, the app's answers stop saying slimSheets, as
// an app rolled back would: the module sends every sheet full, which the app takes and keeps as it
// kept them slim. Run with --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs.
// Screenshots to SHOTS.
import { readFileSync } from 'node:fs'
import { settings, user, users, actors } from './fvtt/stub.mjs'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'
import { DND5E5 } from './fvtt/paths.mjs'

const DND5E = `${DND5E5}/module/dice`
const GAME = 'https://greyhawk-party.forge-vtt.com'
const SECRET = 'big-party-secret-123'
const TITLE = 'The Nine'
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
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
// How far in each part starts, for a run that's slow.
const began = Date.now()
const part = name => console.log(`# ${name}, at ${((Date.now() - began) / 1000).toFixed(1)} s`)
const bytes = text => Buffer.byteLength(text)

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
// Every post the module makes, with its size as sent and the app's answer. A post `lose` matches is
// answered 400 here, never reaching the app, as a post lost on the way would be; and `answerAs`
// changes what the module is told of the app's answer, as an app rolled back would answer.
const posted = []
const relay = { lose: null, answerAs: null }
let fetches = 0
let inFlight = 0
let lastActivity = Date.now()
globalThis.fetch = async (url, init) => {
  inFlight++
  try {
    const sent = JSON.parse(init.body)
    if (relay.lose?.(sent)) {
      posted.push({ url: String(url), type: sent.type ?? 'fetch', data: sent.data, bytes: bytes(init.body), status: 400, body: '', lost: true })
      return { ok: false, status: 400, statusText: 'Bad Request', headers: new Headers(), json: async () => ({}), text: async () => '' }
    }
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
    const told = (relay.answerAs && body && sent.type) ? relay.answerAs(body) : body
    posted.push({ url: String(url), type: sent.type ?? 'fetch', data: sent.data, bytes: bytes(init.body), status, body, told })
    if (status >= 300) problems.push(`${sent.type ?? url} → ${status}`)
    return {
      ok: status >= 200 && status < 300, status, statusText,
      headers: new Headers(type ? { 'content-type': type } : {}),
      json: async () => JSON.parse(told), text: async () => told,
    }
  } finally {
    inFlight--
    lastActivity = Date.now()
  }
}
/** Until no event has been posted for a while, the long-poll for commands aside. */
const settled = async (quiet = 600) => {
  await wait(50)
  const events = () => posted.filter(p => p.type !== 'fetch').length
  let count = events()
  let since = Date.now()
  while (Date.now() - since < quiet) {
    await wait(50)
    if (events() !== count) { count = events(); since = Date.now() }
  }
}
const events = () => posted.filter(p => p.type !== 'fetch')

// ---- The Gamemaster sets up the campaign in the app ----
const context = await browser.newContext()
await context.addCookies([cookie])
const gm = await context.newPage()
await gm.goto(`${BASE}/campaigns`)
await gm.getByRole('button', { name: 'New campaign' }).click()
const modal = gm.getByRole('dialog', { name: 'New campaign' })
await modal.getByLabel('Campaign title').fill(TITLE)
await modal.getByLabel('Forge game address').fill('greyhawk-party.forge-vtt.com')
await modal.getByLabel('Secret', { exact: true }).fill(SECRET)
await modal.getByRole('button', { name: 'Set up campaign' }).click()
await modal.getByRole('button', { name: 'Done' }).click()

// ---- Foundry, with dnd5e's dice and spells ----
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
const TYPES = ['acid', 'cold', 'fire', 'lightning', 'poison', 'force', 'radiant', 'necrotic', 'psychic', 'thunder']
const capital = text => text.charAt(0).toUpperCase() + text.slice(1)
const ordinal = n => ['Cantrips', '1st Level', '2nd Level', '3rd Level', '4th Level', '5th Level'][n] ?? `${n}th Level`
const leveled = {
  key: 'spell', slots: true, cantrips: true, prepares: true, order: 20, exclusive: { spells: false, slots: false },
  getAvailableLevels: actor => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(l => (actor.system.spells[`spell${l}`]?.max ?? 0) > 0),
  getSpellSlotKey: level => `spell${level}`, getLabel: ({ level }) => ordinal(level),
}
CONFIG.DND5E = {
  skills: { arc: { label: 'Arcana', ability: 'int' } },
  tools: {},
  abilities: Object.fromEntries(Object.entries(ABILITIES).map(([id, label]) => [id, { label, abbreviation: id }])),
  defaultAbilities: { initiative: 'dex' },
  spellcasting: { spell: leveled },
  damageTypes: Object.fromEntries(TYPES.map(type => [type, { label: capital(type) }])),
  healingTypes: { healing: { label: 'Healing' }, temphp: { label: 'Temporary HP' } },
  activityActivationTypes: {
    action: { label: 'Action', header: 'Actions' }, bonus: { label: 'Bonus Action', header: 'Bonus Actions' },
    reaction: { label: 'Reaction', header: 'Reactions' },
  },
}
settings.set('messageMode', 'public')
settings.set('criticalDamageModifiers', false)
settings.set('criticalDamageMaxDice', false)
// Foundry's enrichment hands a description on as it is: these have nothing to enrich.
foundry.applications.ux.TextEditor = { implementation: { async enrichHTML(html) { return html } } }

// The module's English, for what it tells the Gamemaster.
const english = JSON.parse(readFileSync(`${MODULE}/lang/en.json`, 'utf8'))
const lookup = text => String(text).split('.').reduce((o, part) => (o && typeof o === 'object') ? o[part] : undefined, english)
// And dnd5e's names for the inventory's sections.
const translations = { 'TYPES.Item.weaponPl': 'Weapons', 'TYPES.Item.consumablePl': 'Consumables', 'TYPES.Item.lootPl': 'Loot', 'DND5E.Items': 'Items' }
game.i18n.localize = text => translations[text] ?? (typeof lookup(text) === 'string' ? lookup(text) : text)
game.i18n.format = (text, data = {}) => game.i18n.localize(text).replace(/{[^}]+}/g, match => data[match.slice(1, -1)] ?? match)
const warnings = []
ui.notifications.warn = message => warnings.push(message)
ui.notifications.info = () => {}

const { Actor5e } = await import('./fvtt/actor5e.mjs')
const { AttackActivity, SaveActivity, DamageActivity, HealActivity, Collection, Item5e, equip } = await import('./fvtt/activity5e.mjs')
Collection.prototype.getByType ??= function (type) { return this.contents.filter(activity => activity.type === type) }
globalThis.dnd5e = {
  settings: { rulesVersion: 'modern' },
  documents: { activity: { AttackActivity, SaveActivity, DamageActivity, HealActivity } },
  registry: { messages: { get: () => [] } },
}
globalThis.Item = { implementation: class { constructor(data) { Object.assign(this, data); this.system ??= {} } } }

users.activeGM = user('gm', 'Gamemaster', true)
users.get('gm').targets = new Set()
const alice = user('alice', 'Alice')

// ---- The party: nine wizards of the same school, each with a spellbook of 150 spells ----
// Synthetic, every one: names, spells and descriptions are made up here. A third of each book is
// spell attacks, a third saves and a third utilities, from cantrips to 5th level, each with a
// description of its own; those that deal damage are among their actions too, as Tidy 5e lists
// them, which in the full shape repeats each.
const hits = (formula, type) => ({ formula, damageType: type, label: `${formula} ${capital(type)}` })
const SCHOOLS = ['abj', 'con', 'div', 'enc', 'evo', 'ill', 'nec', 'trs']
const WORDS = ['Arcane', 'Blazing', 'Crimson', 'Dread', 'Ember', 'Frozen', 'Gleaming', 'Hollow', 'Iron', 'Jade', 'Keening', 'Lunar', 'Mirrored', 'Nether', 'Opal', 'Prismatic']
const NOUNS = ['Lance', 'Ward', 'Veil', 'Spiral', 'Torrent', 'Chain', 'Bloom', 'Shard', 'Pulse', 'Gate']
const SPELLS = 150
const spellName = (n, i) => `${WORDS[(i + n) % WORDS.length]} ${NOUNS[i % NOUNS.length]} ${Math.floor(i / 10) + 1}`
function spellbook(n) {
  const spells = []
  for (let i = 0; i < SPELLS; i++) {
    const level = i % 6
    const type = TYPES[(i + n) % TYPES.length]
    const name = spellName(n, i)
    const id = `sp${n}x${i}`
    const number = 1 + (i % 4)
    const denomination = [4, 6, 8, 10][i % 4]
    const formula = `${number}d${denomination}`
    const damage = [{ number, denomination, types: [type], scaling: 1 }]
    const activity = [
      { id: `${id}a`, ability: 'int', damage, labels: { modifier: '+7', damage: [hits(formula, type)] } },
      { id: `${id}a`, type: 'save', affects: 'creature', count: 1, save: ['dex'], dc: 15, damage, labels: { damage: [hits(formula, type)] } },
      { id: `${id}a`, type: 'utility', affects: 'ally', count: 1 + (i % 3), range: '60' },
    ][i % 3]
    spells.push({
      id, name, type: 'spell',
      system: {
        level, school: SCHOOLS[i % SCHOOLS.length], method: 'spell', prepared: 1, canPrepare: true,
        properties: ['vocal', 'somatic'], duration: { units: 'inst' },
        description: { value: `<p>${name}: a spell of the ${capital(SCHOOLS[i % SCHOOLS.length])} tome, the ${i + 1}th of ${n}'s book.</p>` },
      },
      activities: [activity],
    })
  }
  return spells
}
const NAMES = ['Aldric', 'Brina', 'Corvin', 'Dessa', 'Eamon', 'Fenna', 'Garrick', 'Hesper', 'Ilsa']
const party = NAMES.map((name, at) => {
  const n = at + 1
  const hero = new Actor5e({ id: `pc${n}`, name, owners: ['alice'], mods: { str: 0, dex: 2, con: 1, int: 4, wis: 1, cha: 0 }, hp: { value: 50, max: 60, temp: 0 } })
  hero.documentName = 'Actor'
  hero.system.details = { level: 11, biography: { value: `<p>${name}, the ${n}th of the Nine.</p>` } }
  hero.system.attributes.spellcasting = 'int'
  hero.system.attributes.spell = { dc: 15, attack: 7, mod: 4 }
  hero.spellcastingClasses = { wizard: { name: 'Wizard', spellcasting: { ability: 'int', save: 15, attack: 7 } } }
  actors.set(hero.id, hero)
  equip(hero, {
    spells: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => [`spell${l}`, { value: l <= 5 ? 2 : 0, max: l <= 5 ? 3 : 0, level: l }])),
    items: spellbook(n),
  })
  return hero
})
alice.character = party[0]

await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-nine': SECRET })
settings.set('chatEvents', true)
settings.set('combatEvents', true)
settings.set('campaigns', [{ id: 'camp-nine', title: TITLE, characters: party.map(hero => hero.id), rolls: true }])
await Hooks.callAll('ready')
await until(() => posted.filter(p => p.type === 'character.updated').length >= 9, 'the nine sheets after the hello', 60_000)
await settled()
const stored = () => sql(`select "rollsEnabled", array_to_string("rollKinds", ','), "bridgePolledAt" is not null from campaign where title = '${TITLE}'`)
await until(() => stored().endsWith('|t'), 'the module to fetch rolls', 15_000)

// ---- 1. The hello: small, the party without sheets ----
part('1')
const first = events()
const helloAt = first.findIndex(p => p.type === 'bridge.hello')
const hello = first[helloAt]
const answer = JSON.parse(hello.body)
check(helloAt === 0 && hello.status === 200 && hello.data.sheetsApart === true && hello.bytes < 10_000
  && same(hello.data.characters.map(c => c.id), party.map(hero => hero.id)) && hello.data.characters.every(c => !('sheet' in c)),
  `the hello comes first, ${hello.bytes} bytes, listing the nine in order without a sheet among them`)
check(answer.features?.slimSheets === 1 && answer.features?.maxBytes === 4_000_000 && answer.features?.commands === true,
  `the app answers it saying it expands slim sheets and takes posts of up to 4,000,000 bytes (${hello.body})`)

// ---- 2. Each sheet in a post of its own, slim, after its descriptions ----
part('2')
const sheetPosts = first.filter(p => p.type === 'character.updated')
check(same(sheetPosts.map(p => p.data.character.id), party.map(hero => hero.id))
  && sheetPosts.every(p => first.indexOf(p) > helloAt && p.status === 200 && JSON.parse(p.body).features?.slimSheets === 1),
  'each of the nine sheets follows the hello in a post of its own, in the order it listed them, each taken and answered with what the app takes')
check(sheetPosts.every(p => p.data.character.sheet?.slim === 1 && !('sheetWithheld' in p.data.character)
  && p.data.character.sheet.actions.flatMap(section => section.actions).every(action => action.ref === true)),
  'every sheet slim, each action by reference to its spell')
const slimBytes = Object.fromEntries(sheetPosts.map(p => [p.data.character.id, p.bytes]))
check(Object.values(slimBytes).every(size => size < 100_000), `each post well within what the app takes: ${Object.values(slimBytes).join(', ')} bytes`)
// Every description goes before the first sheet that refers to it.
const textsSent = new Set()
let early = 0
for (const p of first) {
  if (p.type === 'character.texts') for (const hash of Object.keys(p.data.texts)) textsSent.add(hash)
  if (p.type === 'character.updated') {
    const refs = JSON.stringify(p.data.character.sheet).match(/"(?:text|biography)":"([0-9a-f]{14})"/g) ?? []
    early += refs.map(ref => ref.slice(-15, -1)).filter(hash => !textsSent.has(hash)).length
  }
}
check(early === 0 && textsSent.size >= SPELLS * 9 && first.filter(p => p.type === 'character.texts').every(p => p.status === 204 && p.bytes <= 400_000 + 2_000),
  `each sheet's descriptions go before it, ${textsSent.size} of them, in posts of at most 400,000 bytes of descriptions`)
check(problems.length === 0 && warnings.length === 0, `nothing refused, and the Gamemaster isn't warned (${problems.concat(warnings).join('; ')})`)

// ---- 3. The roster, and the sheets the app keeps ----
part('3')
const roster = () => sql(`select string_agg(c->>'name', ',' order by ord) from campaign, jsonb_array_elements(characters) with ordinality as t(c, ord) where title = '${TITLE}'`)
const campaignId = sql(`select id from campaign where title = '${TITLE}'`)
check(roster() === NAMES.join(','), `the campaign's roster has all nine: ${roster()}`)
const sheetsHeld = () => Object.fromEntries(sql(`select "actorId" || '=' || md5(data::text) from actor_sheet where "campaignId" = '${campaignId}'`).split('\n').filter(Boolean).map(line => line.split('=')))
const firstSheets = sheetsHeld()
check(Object.keys(firstSheets).sort().join() === party.map(hero => hero.id).sort().join(), 'and the app keeps each of their sheets')
const spellsHeld = sql(`select string_agg((select count(*) from jsonb_array_elements(data->'spells') s, jsonb_array_elements(s->'spells'))::text, ',') from actor_sheet where "campaignId" = '${campaignId}'`)
check(spellsHeld.split(',').every(count => Number(count) === SPELLS), `each with its whole spellbook, put back from the slim sheet: ${spellsHeld}`)
const actionsHeld = sql(`select count(*) from actor_sheet, jsonb_array_elements(data->'actions') s, jsonb_array_elements(s->'actions') a where "campaignId" = '${campaignId}' and a ? 'ref'`)
check(actionsHeld === '0' && sql(`select count(*) from actor_sheet where "campaignId" = '${campaignId}' and data ? 'slim'`) === '0', 'kept whole, as the module built it: no reference or slim mark left in what it keeps')
await gm.reload()
const card = gm.getByRole('article', { name: TITLE })
await card.getByText(NAMES[8]).waitFor({ timeout: 15_000 })
const listed = async () => (await card.getByRole('heading', { name: 'Characters' }).locator('xpath=..').locator('li').allTextContents()).map(text => text.replace(/Not chosen yet$/, ''))
check(same(await listed(), NAMES), `the Gamemaster's campaign card lists the nine: ${(await listed()).join(', ')}`)
await shoot(gm, 'sync-gm-card')

// ---- 4. Alice plays each of them: every sheet renders, and rolls ----
part('4')
for (const hero of party) {
  sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
    values ('sheet-${hero.id}', '${hero.name}', '${GAME}', '${TITLE}', '${campaignId}', '${hero.id}', 'e2e-user', now())`)
}
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'dark' })
await phone.addCookies([cookie])
await phone.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '' }))
const page = await phone.newPage()
page.on('pageerror', e => problems.push(`pageerror: ${e.message}`))
const panel = page.getByRole('tabpanel')
const tray = page.getByRole('region', { name: 'Your rolls' })
const status = tray.getByRole('status')
const latestRequest = () => JSON.parse(sql(`select row_to_json(r)::text from (select id, status, payload, result, "characterId" from roll_request order by "createdAt" desc limit 1) r`) || 'null')
const requests = () => Number(sql('select count(*) from roll_request'))
const madeFor = id => game.messages.contents.find(m => m.flags?.['sending-stone']?.request === id)
const LEVELS = [0, 1, 2, 3, 4, 5].map(ordinal)
/** Each spellbook section's spells on the Spells tab, as many as it lists. */
const spellCounts = async () => {
  const counts = []
  for (const level of LEVELS) counts.push(await panel.getByRole('region', { name: level, exact: true }).locator(':scope > ul > li').count())
  return counts
}
/** A hero's page, and its sheet once it's there, unless it's to have none. */
async function open(hero, { sheet = true } = {}) {
  await page.goto(`${BASE}/characters/sheet-${hero.id}`)
  await page.getByRole('heading', { level: 1, name: hero.name }).waitFor({ timeout: 20_000 })
  if (sheet) await page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
}
/** Whether a hero's page shows their sheet, its Spells tab listing their whole spellbook. */
async function rendersSpellbook(hero) {
  await page.getByRole('tab', { name: 'Spells' }).click()
  await panel.getByRole('heading', { name: '5th Level' }).waitFor({ timeout: 15_000 })
  const counts = await spellCounts()
  const named = await panel.getByText(spellName(Number(hero.id.slice(2)), SPELLS - 1), { exact: true }).count()
  return counts.reduce((a, b) => a + b, 0) === SPELLS && named === 1
}
for (const [at, hero] of party.entries()) {
  const n = at + 1
  await open(hero)
  // His Intelligence check, made in the game with Alice's d20.
  const before = requests()
  await page.getByRole('button', { name: 'Intelligence check, +4' }).click()
  await until(() => requests() > before, `${hero.name}'s check to be sent`)
  await until(() => ['done', 'failed'].includes(latestRequest().status), `${hero.name}'s check to be made`)
  const made = latestRequest()
  const d20 = made.payload.dice?.[0]?.results?.[0]
  const message = madeFor(made.id)
  await status.getByText(`At the table: ${d20 + 4}`).waitFor({ timeout: 30_000 })
  check(made.status === 'done' && made.characterId === `sheet-${hero.id}` && made.payload.kind === 'ability' && message?.speaker?.actor === hero.id && message.rolls[0].total === d20 + 4,
    `${hero.name}'s sheet renders, and their Intelligence check is made in the game with Alice's d20: ${d20} + 4`)
  check(await rendersSpellbook(hero), `${hero.name}'s Spells tab lists their whole spellbook, ${SPELLS} spells (${(await spellCounts()).join(', ')})`)
  // A cantrip's attack, rolled on her phone: attacks aren't made in the game here.
  const cantrip = spellName(n, 0)
  const rolled = requests()
  await panel.getByRole('button', { name: `${cantrip} attack, +7` }).click()
  await status.getByText(`${cantrip} attack`).waitFor({ timeout: 20_000 })
  check(requests() === rolled && /d20 \d+/.test(await status.textContent()), `and their ${cantrip} rolls on her phone: "${await status.textContent()}"`)
  if (n === 1) await shoot(page, 'sync-phone-spells')
}

// ---- 5. A hoard too large to send: withheld, the Gamemaster warned, the player told ----
part('5')
const hoarder = party[6]
const others = party.filter(hero => hero !== hoarder)
const othersBefore = sheetsHeld()
let from = events().length
const HOARD = 14_000
for (let i = 0; i < HOARD; i++) {
  hoarder.items.set(`gem${i}`, new Item5e(hoarder, {
    id: `gem${i}`, name: `Gem of the drowned vault, facet ${i}, ${'cut and polished '.repeat(10)}`, type: 'loot',
    system: { quantity: 1 + (i % 5), weight: { value: 0.1, units: 'lb' }, price: { value: 50 + i, denomination: 'gp' } },
  }))
}
await Hooks.callAll('updateActor', hoarder, {})
await until(() => events().slice(from).some(p => p.type === 'character.updated'), "the hoarder's update", 60_000)
await settled()
const withheld = events().slice(from).filter(p => p.type === 'character.updated')
const held = withheld[0]?.data.character
check(withheld.length === 1 && held.id === hoarder.id && held.sheet === null && held.sheetWithheld?.reason === 'tooLarge'
  && held.sheetWithheld.limit === 4_000_000 && held.sheetWithheld.bytes > 4_000_000 && withheld[0].bytes < 2_000 && withheld[0].status === 200,
  `his sheet, ${held?.sheetWithheld?.bytes} bytes slim, more than the app takes, is withheld: the post says so in ${withheld[0]?.bytes} bytes, with no sheet (${JSON.stringify(held?.sheetWithheld)})`)
check(!events().slice(from).some(p => p.type === 'character.texts'), "and none of his descriptions go with it")
const warned = warnings.filter(text => text.includes(hoarder.name))
check(warned.length === 1 && warned[0] === `Sending Stone can't send ${hoarder.name}'s sheet to ${TITLE}: it came to ${(Math.ceil(held.sheetWithheld.bytes / 100_000) / 10).toFixed(1)} MB, more than the 4.0 MB the app takes. Its player is told.`,
  `the Gamemaster is warned: "${warned.join(' | ')}"`)
check(sql(`select count(*) from actor_sheet where "campaignId" = '${campaignId}' and "actorId" = '${hoarder.id}'`) === '0'
  && sql(`select c->'sheetWithheld'->>'reason' from campaign, jsonb_array_elements(characters) c where title = '${TITLE}' and c->>'id' = '${hoarder.id}'`) === 'tooLarge'
  && roster() === NAMES.join(','),
  'the app drops the sheet it held of him, keeps why on its roster, and keeps him on it')
const othersAfter = sheetsHeld()
check(others.every(hero => othersAfter[hero.id] === othersBefore[hero.id]), 'the other eight sheets are untouched')
await open(hoarder, { sheet: false })
const tooLarge = page.getByText(`${hoarder.name}'s sheet is too large to send`)
await tooLarge.waitFor({ timeout: 20_000 }).catch(async () => { await page.reload(); await tooLarge.waitFor({ timeout: 20_000 }) })
const said = await page.getByText(/^It came to/).textContent()
check(said === `It came to ${(Math.ceil(held.sheetWithheld.bytes / 100_000) / 10).toFixed(1)} MB, more than the 4.0 MB this app takes. Your Gamemaster has been told.`,
  `his player's page says it was too large to send: "${said}"`)
await shoot(page, 'sync-phone-too-large')
await open(others[7])
check(await rendersSpellbook(others[7]), `${others[7].name}'s page is as it was`)

// Once the hoard is spent, his sheet fits, and goes.
from = events().length
for (let i = 0; i < HOARD; i++) hoarder.items.delete(`gem${i}`)
await Hooks.callAll('updateActor', hoarder, {})
await until(() => events().slice(from).some(p => p.type === 'character.updated'), "the hoarder's sheet", 30_000)
await settled()
const fits = events().slice(from).filter(p => p.type === 'character.updated')
check(fits.length === 1 && fits[0].data.character.sheet?.slim === 1 && !('sheetWithheld' in fits[0].data.character) && fits[0].status === 200,
  'once the hoard is gone, the sheet fits, and goes')
check(sheetsHeld()[hoarder.id] === firstSheets[hoarder.id]
  && sql(`select count(*) from campaign, jsonb_array_elements(characters) c where title = '${TITLE}' and c ? 'sheetWithheld'`) === '0',
  'the app keeps it as it first did, and no longer says it was withheld')
await open(hoarder)
check(await rendersSpellbook(hoarder), `${hoarder.name}'s page shows his sheet again`)
check(warnings.filter(text => text.includes(hoarder.name)).length === 1, 'the Gamemaster is warned no more')

// ---- 6. A later hello, one sheet after it lost: no character removed ----
part('6')
const lostHero = party[2]
const beforeHello = sheetsHeld()
from = events().length
relay.lose = envelope => envelope.type === 'character.updated' && envelope.data?.character?.id === lostHero.id
const { announce } = await import(`${MODULE}/scripts/bridge.mjs`)
announce({ campaignId: 'camp-nine' })
await until(() => events().slice(from).filter(p => p.type === 'character.updated').length >= 9, 'the sheets after the later hello', 60_000)
await settled()
relay.lose = null
const later = events().slice(from)
const laterHello = later.find(p => p.type === 'bridge.hello')
check(laterHello?.status === 200 && laterHello.data.characters.length === 9 && laterHello.data.characters.every(c => !('sheet' in c))
  && later.findIndex(p => p.type === 'character.updated') > later.indexOf(laterHello)
  && same(later.filter(p => p.type === 'character.updated').map(p => `${p.data.character.id}${p.lost ? ' lost' : ''}`), party.map(hero => `${hero.id}${hero === lostHero ? ' lost' : ''}`)),
  `a later hello lists the nine again, and their sheets follow, ${lostHero.name}'s lost on the way`)
check(roster() === NAMES.join(','), `the app removes no character: ${roster()}`)
const afterHello = sheetsHeld()
check(Object.keys(afterHello).length === 9 && afterHello[lostHero.id] === beforeHello[lostHero.id] && party.every(hero => afterHello[hero.id] === beforeHello[hero.id]),
  `it keeps the sheet it held of ${lostHero.name}, whose new one never came, and the others, sent again as they were`)
await open(lostHero)
check(await rendersSpellbook(lostHero), `${lostHero.name}'s page still shows his sheet`)
await shoot(page, 'sync-phone-after-hello')

// ---- 7. An app that stops saying slimSheets is sent full sheets ----
part('7')
// As an app rolled back to one before 0.22.0 would answer: its features without slimSheets.
relay.answerAs = text => {
  try {
    const parsed = JSON.parse(text)
    if (parsed?.features) delete parsed.features.slimSheets
    return JSON.stringify(parsed)
  } catch {
    return text
  }
}
const lead = party[0]
from = events().length
lead.system.attributes.hp.value = 33
await Hooks.callAll('updateActor', lead, {})
await until(() => events().slice(from).filter(p => p.type === 'character.updated').length >= 10, 'the sheets sent again', 60_000)
await settled()
const resent = events().slice(from).filter(p => p.type === 'character.updated')
check(resent[0].data.character.id === lead.id && resent[0].data.character.sheet.slim === 1,
  `${lead.name}'s change goes slim, as the app last said it takes them; its answer no longer says it expands them`)
const full = resent.slice(1)
check(same(full.map(p => p.data.character.id), party.map(hero => hero.id))
  && full.every(p => p.status === 200 && !('slim' in p.data.character.sheet) && p.data.character.sheet.actions.flatMap(section => section.actions).every(action => !('ref' in action) && action.name)),
  'so every sheet is sent again, in full: no slim mark, every action whole')
const fullBytes = Object.fromEntries(full.map(p => [p.data.character.id, p.bytes]))
const fullTotal = Object.values(fullBytes).reduce((a, b) => a + b, 0)
check(fullTotal > 1_000_000 && party.every(hero => fullBytes[hero.id] > 2 * slimBytes[hero.id]),
  `in full they come to ${fullTotal} bytes, more than a megabyte, as one hello before 0.22.0 would have carried them; each more than twice its slim post (${party.map(hero => `${slimBytes[hero.id]} → ${fullBytes[hero.id]}`).join(', ')})`)
const fullSheets = sheetsHeld()
check(party.slice(1).every(hero => fullSheets[hero.id] === firstSheets[hero.id]) && fullSheets[lead.id] !== firstSheets[lead.id],
  'the app takes them, and keeps each of the other eight exactly as it kept it from the slim sheet')
check(sql(`select data->'hp'->>'value' from actor_sheet where "campaignId" = '${campaignId}' and "actorId" = '${lead.id}'`) === '33', `and ${lead.name}'s, with his new hit points`)
await open(lead)
check(await rendersSpellbook(lead), `${lead.name}'s full sheet renders as the slim one did`)
await page.getByRole('tab', { name: 'Character' }).click()
await page.waitForFunction(() => [...document.querySelectorAll('dt')].find(dt => dt.textContent === 'Hit points')?.nextElementSibling?.textContent.startsWith('33 / 60'), undefined, { timeout: 15_000 })
check(true, 'with his hit points as they now stand')
await shoot(page, 'sync-phone-full')

check(problems.length === 0, `no page errors, and nothing refused but the post lost on the way (${problems.join('; ')})`)
part('done')
await browser.close()
process.exit(0)
