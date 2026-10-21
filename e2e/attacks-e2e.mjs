// Players' attacks from the app, end to end: the real module, in a stand-in Foundry with dnd5e
// 5.3.3's real dice classes (D20Roll, DamageRoll) and its attack activities ported
// (fvtt/activity5e.mjs), fetches from the production app, from a browser on the game's page. Alice
// attacks from Thorin's sheet on her phone, picks her target, sees whether she hit, and rolls the
// damage, all made in the game with her dice; a natural 20 with his greataxe throws its critical
// damage and his Savage Attacks' die more too, as the game's preview says, and changed in the tray,
// more of its own die and never of its critical damage's; his unarmed strike's, a number and its
// critical damage's die, has no die of its own to throw more of, which the app won't take either.
// Under Reduce's - 1d4, damage's die it takes away is never the one changed, nor is such damage
// rolled at its highest. MIDI=1 puts the stand-in
// Midi-QOL workflow in the world (fvtt/midi-fake.mjs), with Midi's rules for a critical hit's damage
// (fvtt/midi-critical.mjs), the Gamemaster's "Double Rolled Damage" and the players' dnd5e's: since
// module 0.32.0 (decision 5) an app roll's critical is dnd5e's whatever Midi's say, so the longsword's
// natural 20 shows and rolls 2d8 + 3, never 1d8mx2 + 3. Run with --import ./fvtt/unref-timers.mjs
// --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import { combat, combatant, settings, user, users, actors } from './fvtt/stub.mjs'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'
import { DND5E5 } from './fvtt/paths.mjs'

const DND5E = `${DND5E5}/module/dice`
const GAME = 'https://lonely-mountain.forge-vtt.com'
const SECRET = 'ashlands-secret-123'
const SHOTS = process.env.SHOTS
const MIDI = !!process.env.MIDI
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
  await page.screenshot({ path: `${SHOTS}/${name}${MIDI ? '-midi' : ''}.png` })
}

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

// ---- Foundry, with dnd5e's dice, items and attacks ----
// The Gamemaster's tab is in view, so Dice So Nice would show Midi's rolls.
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
  defaultAbilities: { initiative: 'dex' },
  spellcasting: { spell: { exclusive: { spells: false, slots: false } } },
  damageTypes: { slashing: { label: 'Slashing' }, piercing: { label: 'Piercing' }, bludgeoning: { label: 'Bludgeoning' }, fire: { label: 'Fire' } },
  healingTypes: { healing: { label: 'Healing' } },
  activityActivationTypes: { action: { label: 'Action', header: 'Actions' } },
}
settings.set('messageMode', 'public')
settings.set('criticalDamageModifiers', false)
settings.set('criticalDamageMaxDice', false)
// Players see whether they hit, but not their targets' armor class.
settings.set('attackRollVisibility', 'hideAC')

const { Actor5e } = await import('./fvtt/actor5e.mjs')
const { AttackActivity, equip } = await import('./fvtt/activity5e.mjs')
const { midi, placeables, installMidi } = await import('./fvtt/midi-fake.mjs')
globalThis.dnd5e = {
  settings: { rulesVersion: 'modern' },
  // As dnd5e publishes its dice when its script loads (dnd5e.mjs:38-43), before any module's init.
  dice: { DamageRoll },
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

users.activeGM = user('gm', 'Gamemaster', true)
users.get('gm').targets = new Set()
const alice = user('alice', 'Alice')
if (MIDI) installMidi()

// Thorin, with a longsword: +6 to hit (Strength +3, proficiency +3), 1d8 + 3 slashing; a greataxe,
// 1d12 + 3, to which a critical hit adds its critical damage, 1d6 (attack-data.mjs:326-328); and his
// unarmed strike, 1 + 3, no die of its own, to which a critical hit adds 1d4.
const thorin = new Actor5e({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, dex: 1, con: 3, wis: 2 } })
thorin.system.details = { level: 5 }
actors.set('thorin', thorin)
alice.character = thorin
equip(thorin, {
  ac: 18,
  items: [{
    id: 'longsword', name: 'Longsword', type: 'weapon',
    system: { properties: [], quantity: 1, attackType: 'melee', equipped: true },
    activities: [{
      id: 'swing', damage: [{ number: 1, denomination: 8, bonus: '@mod', types: ['slashing'] }],
      labels: { modifier: '+6', damage: [{ formula: '1d8 + 3', damageType: 'slashing', label: '1d8 + 3 Slashing' }] },
    }],
  }, {
    id: 'greataxe', name: 'Greataxe', type: 'weapon',
    system: { properties: ['hvy', 'two'], quantity: 1, attackType: 'melee', equipped: true },
    activities: [{
      id: 'cleave', criticalBonus: '1d6', damage: [{ number: 1, denomination: 12, bonus: '@mod', types: ['slashing'] }],
      labels: { modifier: '+6', damage: [{ formula: '1d12 + 3', damageType: 'slashing', label: '1d12 + 3 Slashing' }] },
    }],
  }, {
    id: 'unarmed', name: 'Unarmed Strike', type: 'weapon',
    system: { properties: [], quantity: 1, attackType: 'melee', equipped: true },
    activities: [{
      id: 'punch', criticalBonus: '1d4', damage: [{ number: 0, bonus: '1 + @mod', types: ['bludgeoning'] }],
      labels: { modifier: '+6', damage: [{ formula: '1 + 3', damageType: 'bludgeoning', label: '1 + 3 Bludgeoning' }] },
    }],
  }, {
    // An attack at an area: a cone of fire, at everyone caught in it.
    id: 'breath', name: 'Breath Weapon', type: 'feat', system: { properties: [] },
    activities: [{
      id: 'breathBlast', template: 'cone', damage: [{ number: 2, denomination: 6, types: ['fire'] }],
      labels: { modifier: '+6', damage: [{ formula: '2d6', damageType: 'fire', label: '2d6 Fire' }] },
    }],
  }],
})

// The foes, with their tokens on the Gamemaster's canvas.
const foe = (id, name, ac) => {
  const actor = new Actor5e({ id, name, mods: {}, hp: { value: 30, max: 30, temp: 0 } })
  actor.type = 'npc'
  actors.set(id, actor)
  equip(actor, { ac })
  const token = { id: `tok${id}`, name, uuid: `Scene.scene.Token.tok${id}`, actor, hidden: false }
  const placeable = { id: token.id, name, document: token, actor }
  token.object = placeable
  placeables.set(token.id, placeable)
  return { actor, token }
}
const goblin = foe('goblin', 'Goblin', 13)
const ogre = foe('ogre', 'Ogre', 30)
if (MIDI) canvas.scene.tokens.size = placeables.size
// The Gamemaster had the ogre targeted before any attack.
const gmTargets = new Set([ogre.token.object])
users.get('gm').targets = gmTargets

await import(`${MODULE}/scripts/module.mjs`)
// Midi-QOL's rules for critical hits, as Midi wraps dnd5e's at its init, after the module's scripts
// load and before the module sets up its dice plans at ready: "Double Rolled Damage" for the
// Gamemaster's client, the bridge, and dnd5e's own for the players' (decision 5).
if (MIDI) {
  const { installMidiCritical, midiCritical } = await import('./fvtt/midi-critical.mjs')
  installMidiCritical(DamageRoll)
  Object.assign(midiCritical, { gm: 'doubleDice', player: 'default' })
}
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-ash': SECRET })
settings.set('chatEvents', true)
settings.set('combatEvents', true)
const campaignWith = attacks => [{ id: 'camp-ash', title: 'Ashlands', characters: ['thorin'], rolls: true, attacks }]
settings.set('campaigns', campaignWith(true))
await Hooks.callAll('ready')
await until(() => posted.some(p => p.url.endsWith('/api/bridge/commands')), "the module's first fetch")
const stored = () => sql(`select "rollsEnabled", array_to_string("rollKinds", ','), "bridgePolledAt" is not null from campaign where title = 'Ashlands'`)
await until(() => stored().includes('attack'), 'the app to hear the game takes attacks', 10_000)
// From module 0.21.0, ending an enchantment with them.
// From module 0.29.0, ending a concentration, wherever players' rolls are made; and spending
// charges and Heroic Inspiration, wherever they may attack and cast.
check(stored() === 't|skill,tool,ability,save,death,initiative,hitDie,hitDice,formula,endConcentration,attack,use,damage,endEnchantment,spend,inspiration,textRoll,textDamage|t', `the app keeps that the game takes players' attacks, spells and features, and their damage (${stored()})`)
check(sql(`select array_to_string("rollFeatures", ',') from campaign where title = 'Ashlands'`).split(',').includes('areaAttacks'), 'and that it makes area attacks at the targets players pick')
// From module 0.21.0, changing only a die damage adds, never one it takes away.
check(sql(`select array_to_string("rollFeatures", ',') from campaign where title = 'Ashlands'`).split(',').includes('signedDice'), 'and that it changes only a die damage adds, never one it takes away')

// The Gamemaster's card says so.
await gm.reload()
const card = gm.getByRole('article', { name: 'Ashlands' })
await card.getByText("Players' rolls").waitFor()
check(/death saves, attacks and spells your players roll and cast here are made in your game too/.test(await card.textContent()), "the Gamemaster's campaign card says players' attacks and spells reach the game")
await shoot(gm, 'gm-card-attacks')

// A fight: Thorin, a goblin and an ogre.
const fight = combat('fight1')
combatant(fight, 'cbGoblin', goblin.actor, { name: 'Goblin', initiative: 15, token: goblin.token })
combatant(fight, 'cbOgre', ogre.actor, { name: 'Ogre', initiative: 9, token: ogre.token })
combatant(fight, 'cbThorin', thorin, { initiative: 12 })
fight.started = true
fight.round = 1
Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight1'), configurable: true })
await Hooks.callAll('createCombat', fight)
await until(() => sql('select count(*) from combat') === '1', 'the app to hear of the fight', 15_000)

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
// In a fight too, the phone opens on Thorin's sheet; the combat is a tab away.
const characterTab = page.getByRole('navigation', { name: 'Table' }).getByRole('button', { name: 'Character' })
await page.getByRole('tablist', { name: 'Character sheet' }).waitFor()
check(await characterTab.getAttribute('aria-current') === 'page'
  && await page.getByRole('navigation', { name: 'Table' }).getByRole('button', { name: /^Combat/ }).getAttribute('aria-current') === null,
  "in a fight, the phone opens on Thorin's sheet, the combat a tab away")
await characterTab.click()
await page.getByRole('tab', { name: 'Actions' }).click()
const panel = page.getByRole('tabpanel')
const tray = page.getByRole('region', { name: 'Your rolls' })
const swing = panel.getByRole('button', { name: 'Longsword attack, +6' })
await swing.waitFor()
await tray.getByText('Checks, saves, attacks, spells and hit dice you roll, cast or spend here are made in your Gamemaster’s game too, with the same dice.').waitFor({ timeout: 15_000 })
check(true, "Thorin's longsword is on his Actions tab, and the tray says his attacks go to the game")

/** The d20 the app throws next, or Math.random again. */
const forceD20 = value => page.evaluate(v => { globalThis.__random ??= Math.random; Math.random = () => (v - 0.5) / 20 }, value)
const unforce = () => page.evaluate(() => { if (globalThis.__random) Math.random = globalThis.__random })
const latestRequest = () => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, payload, "useId", result from roll_request order by "createdAt" desc limit 1) r`) || 'null')
const requests = () => Number(sql('select count(*) from roll_request'))
const useCard = id => game.messages.contents.find(m => m.flags?.['sending-stone']?.use === id)
const madeFor = id => game.messages.contents.find(m => m.flags?.['sending-stone']?.request === id)
const status = tray.getByRole('status')
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const sum = values => values.reduce((total, value) => total + value, 0)

/** Send what a tap rolls, and wait until the game has made it. */
async function sent(tap, what) {
  const before = requests()
  await tap()
  await until(() => requests() > before, `${what} to be sent`)
  const request = latestRequest()
  await until(() => ['done', 'failed'].includes(latestRequest().status), `${what} to be made`)
  return { request, made: latestRequest() }
}

// ---- An attack at the goblin: a hit ----
const picker = page.getByRole('dialog', { name: 'Longsword attack' })
await forceD20(15)
await swing.click()
await picker.waitFor()
const listed = await picker.getByRole('listitem').allTextContents()
// Since this round "No target" is a button after the list, not the list's last row.
check(JSON.stringify(listed) === JSON.stringify(['Goblin', 'Ogre']) && await picker.getByRole('button', { name: 'No target' }).isVisible(),
  `tapping the attack, in a fight, asks whom to attack, Thorin left out: ${JSON.stringify(listed)}, and No target`)
await shoot(page, 'phone-pick-target')
let { request, made } = await sent(() => picker.getByRole('button', { name: 'Goblin' }).click(), 'the attack')
await unforce()
check(request.kind === 'attack' && request.payload.item === 'longsword' && request.payload.activity === 'swing'
  && request.payload.target?.combatId === 'fight1' && request.payload.target?.combatantId === 'cbGoblin',
  `the app sends the attack with the longsword, at the goblin (${JSON.stringify(request.payload)})`)
check(made.status === 'done' && made.result.attack?.outcome === 'hit' && made.result.damage?.rolls?.[0]?.dice?.[0]?.faces === 8,
  `the game makes it: a hit, its damage 1d8 to roll (${JSON.stringify(made.result.attack)}, ${JSON.stringify(made.result.damage)})`)
const use = useCard(request.id)
// Midi rolls the attack on the item's card; dnd5e posts it apart, linked to the card.
const attackMessage = MIDI ? use : madeFor(request.id)
check(use && attackMessage, "the game posts the longsword's card, with the attack")
const attackRoll = MIDI ? midi.made.at(-1).attackRoll : attackMessage.rolls[0]
check(attackRoll.dice[0].results[0].result === 15 && attackRoll.total === 21, `with Alice's d20, 15, for 21 (${attackRoll.formula} = ${attackRoll.total})`)
if (MIDI) {
  check(use.author.id === 'gm' && madeFor(request.id) === undefined, "Midi rolls it on its card, which the Gamemaster's client authors")
  check(midi.made.at(-1).targets.has(goblin.token.object) && midi.made.at(-1).hitTargets.has(goblin.token.object), "Midi's workflow is at the goblin, and hits it")
  check([...users.get('gm').targets].length === 1 && users.get('gm').targets.has(ogre.token.object), "the Gamemaster's own target is theirs again")
} else {
  check(use.author.id === 'alice' && attackMessage.author.id === 'alice' && attackMessage.flags.dnd5e.originatingMessage === use.id, 'dnd5e posts both as Alice, the attack linked to the card')
  check(attackMessage.flags.dnd5e.targets?.[0]?.name === 'Goblin', 'at the goblin, as dnd5e marks its target')
}
await status.getByText('At the table: 21 · Hit').waitFor({ timeout: 30_000 })
const rollDamage = tray.getByRole('button', { name: 'Roll damage' })
await rollDamage.waitFor()
check(true, 'the tray says what the game made of it, a hit, and offers its damage')
await shoot(page, 'phone-hit')

// ---- Its damage, from the tray ----
const attackId = request.id
let damage
;({ request: damage, made } = await sent(() => rollDamage.click(), 'the damage'))
check(damage.kind === 'damage' && damage.useId === attackId && damage.payload.dice.length === 1 && damage.payload.dice[0].faces === 8,
  `the app sends the damage of that attack, with the d8 it threw (${JSON.stringify(damage.payload.dice)})`)
const d8 = damage.payload.dice[0].results[0]
check(made.status === 'done' && made.result.rolls.length === 1, 'the game rolls it')
if (MIDI) {
  const workflow = midi.made.at(-1)
  check(workflow.damageRolls?.[0]?.dice[0].results[0].result === d8 && workflow.currentAction === workflow.WorkflowState_Completed, "Midi's workflow goes on with Alice's d8, to its end")
  check(goblin.actor.system.attributes.hp.value === 30 - (d8 + 3) && midi.applied.at(-1).amount === d8 + 3, `and applies it to the goblin: ${d8 + 3}`)
} else {
  const damageMessage = madeFor(damage.id)
  check(damageMessage && damageMessage.flags.dnd5e.originatingMessage === use.id && damageMessage.rolls[0].dice[0].results[0].result === d8,
    `dnd5e rolls it on the card, with Alice's d8: ${d8}`)
}
await status.getByText(`At the table: ${d8 + 3}`).waitFor({ timeout: 30_000 })
check(await tray.getByRole('button', { name: /damage/ }).count() === 0, `the tray shows its total there, ${d8 + 3}, and offers it no more`)
await shoot(page, 'phone-damage')

// ---- A critical hit, its damage from the damage chip ----
// Module 0.33.0 (its decisions): only a critical hit's dice are doubled, never its numbers,
// even with dnd5e's Critical Damage Modifiers on, which 0.32.0 followed (2d8 + 6): on for this one.
settings.set('criticalDamageModifiers', true)
await forceD20(20)
await swing.click()
await picker.waitFor()
check((await picker.getByRole('listitem').first().textContent()).startsWith('GoblinLast target'), 'the goblin, last attacked, comes first')
;({ request, made } = await sent(() => picker.getByRole('button', { name: /^Goblin/ }).click(), 'the critical hit'))
await unforce()
check(made.result.attack?.critical === true && made.result.damage?.critical === true && made.result.damage.rolls[0].dice[0].number === 2,
  `a natural 20 is a critical hit, its damage two d8 (${JSON.stringify(made.result.damage)})`)
await status.getByText('At the table: 26 · Critical hit').waitFor({ timeout: 30_000 })
await tray.getByRole('button', { name: 'Roll critical damage' }).waitFor()
check(true, 'the tray says so, and offers critical damage')
await shoot(page, 'phone-critical')
// Decision 5: dnd5e's critical, its die doubled, whatever Midi-QOL's rule for the Gamemaster says.
{
  const preview = made.result.damage.rolls[0]
  check(preview.formula === '2d8 + 3' && preview.dice[0].faces === 8 && preview.dice[0].number === 2,
    `the game's preview of its critical damage is 2d8 + 3, two d8, its 3 not doubled under Critical Damage Modifiers${MIDI ? ', under Midi\'s "Double Rolled Damage" for the Gamemaster too' : ''} (${JSON.stringify(preview)})`)
  const longswordMenu = page.getByRole('menu', { name: 'Longsword damage 2d8 + 3' })
  await tray.getByRole('button', { name: 'Roll critical damage' }).click({ button: 'right' })
  await longswordMenu.waitFor({ timeout: 10_000 })
  const shown = await page.evaluate(() => document.body.innerText)
  check(await longswordMenu.isVisible() && !/mx\d|\dx\d/.test(shown),
    `its menu is titled "Longsword damage 2d8 + 3", and nothing on the page says mx2 or x2`)
  await page.keyboard.press('Escape')
  await longswordMenu.waitFor({ state: 'hidden' })
}
const critId = request.id
;({ request: damage, made } = await sent(() => panel.getByRole('button', { name: 'Longsword damage, 1d8 + 3' }).click(), 'the critical damage'))
check(damage.useId === critId && damage.payload.dice[0].faces === 8 && damage.payload.dice[0].results.length === 2,
  `the damage chip rolls the waiting attack's damage, two d8 as the game said (${JSON.stringify(damage.payload.dice)})`)
const [a, b] = damage.payload.dice[0].results
const critRoll = MIDI ? midi.made.at(-1).damageRolls?.[0] : madeFor(damage.id)?.rolls[0]
check(critRoll?.options.isCritical === true && JSON.stringify(critRoll.dice[0].results.map(r => r.result)) === JSON.stringify([a, b]) && critRoll.total === a + b + 3,
  `the game rolls it critical, with both of Alice's d8: ${a} and ${b}, for ${a + b + 3}`)
{
  // dnd5e's damage card is posted as it's made; Midi-QOL's workflow adds the damage to its own card.
  await until(() => posted.some(p => ['chat.message.created', 'chat.message.updated'].includes(p.type) && (p.data?.message?.rolls ?? []).some(r => r.formula === '2d8 + 3')),
    'the card with the critical damage, as the app is told of it', 15_000).catch(() => {})
  const card = posted.filter(p => ['chat.message.created', 'chat.message.updated'].includes(p.type)).map(p => p.data.message)
    .findLast(m => (m?.rolls ?? []).some(r => r.total === a + b + 3 && /d8/.test(r.formula ?? '')))
  const formulas = (card?.rolls ?? []).map(r => r.formula)
  check(critRoll.formula === '2d8 + 3' && formulas.includes('2d8 + 3') && !formulas.some(f => /mx\d|\dx\d/.test(f)),
    `its card in Foundry's chat, as the app is told of it, says 2d8 + 3, total the dice and 3 (${critRoll.formula}; ${JSON.stringify(formulas)})`)
}
await status.getByText(`At the table: ${a + b + 3}`).waitFor({ timeout: 30_000 })
check(/2d8 \(\d, \d\) \+3/.test(await status.textContent()), `the tray shows the two d8 thrown, not doubled again: "${await status.textContent()}"`)
check(critRoll.options.critical?.multiplyNumeric === false && !/2d8 \(\d, \d\) \+6/.test(await status.textContent()),
  `under Critical Damage Modifiers the roll says multiplyNumeric false and the tray shows 2d8 +3, never +6 (module 0.33.0)`)
settings.set('criticalDamageModifiers', false)

// ---- A miss, at the ogre ----
await forceD20(4)
await swing.click()
await picker.waitFor()
;({ request, made } = await sent(() => picker.getByRole('button', { name: 'Ogre' }).click(), 'the miss'))
await unforce()
check(made.result.attack?.outcome === 'miss', 'an attack under the ogre’s armor class misses')
await status.getByText('At the table: 10 · Miss').waitFor({ timeout: 30_000 })
if (MIDI) {
  check(made.result.damage === null && await tray.getByRole('button', { name: /damage/ }).count() === 0, "Midi's workflow ends on a miss, so no damage is offered")
} else {
  check(await tray.getByRole('button', { name: 'Roll damage' }).count() === 1, "dnd5e's card still offers its damage, and so does the tray")
}

// ---- An area attack, at the goblin and the ogre ----
const breath = panel.getByRole('button', { name: 'Breath Weapon attack, +6' })
const area = page.getByRole('dialog', { name: 'Breath Weapon attack' })
await forceD20(15)
await breath.click()
await area.waitFor()
check(await area.getByText('Tick who is caught in the area.').count() === 1 && await area.getByRole('checkbox').count() === 2, 'an area attack asks who is caught in its area, a box each')
await area.getByRole('checkbox', { name: /^Goblin/ }).click()
await area.getByRole('checkbox', { name: /^Ogre/ }).click()
await shoot(page, 'phone-area-attack')
;({ request, made } = await sent(() => area.getByRole('button', { name: 'Attack 2 targets' }).click(), 'the area attack'))
await unforce()
check(request.payload.item === 'breath' && request.payload.activity === 'breathBlast' && !('target' in request.payload)
  && JSON.stringify(request.payload.targets) === JSON.stringify([{ combatId: 'fight1', combatantId: 'cbGoblin' }, { combatId: 'fight1', combatantId: 'cbOgre' }]),
  `the app sends it at both, with no single target (${JSON.stringify(request.payload)})`)
check(made.status === 'done' && (made.result.attack?.targets ?? []).map(t => `${t.combatId}/${t.combatantId}:${t.outcome}`).join() === 'fight1/cbGoblin:hit,fight1/cbOgre:miss'
  && made.result.attack.outcome === null, `one roll, 21, hits the goblin and misses the ogre (${JSON.stringify(made.result.attack)})`)
const blast = MIDI ? midi.made.at(-1) : madeFor(request.id)
if (MIDI) {
  check([...blast.targets].map(t => t.id).join() === 'tokgoblin,tokogre' && blast.hitTargets.has(goblin.token.object) && !blast.hitTargets.has(ogre.token.object), "Midi's workflow is at both, and hits the goblin alone")
} else {
  check(blast.flags.dnd5e.targets.map(t => t.name).join() === 'Goblin,Ogre' && blast.rolls[0].options.target == null, "dnd5e's attack names both, against no one armor class")
}
await status.getByText('At the table: 21 · Hit 1 of 2').waitFor({ timeout: 30_000 })
const outcomes = await status.getByRole('list', { name: 'Targets' }).getByRole('listitem').allTextContents()
check(JSON.stringify(outcomes) === JSON.stringify(['Goblin: Hit', 'Ogre: Miss']), `the tray says whom it hit: ${JSON.stringify(outcomes)}`)
await shoot(page, 'phone-area-attack-made')
const goblinHp = goblin.actor.system.attributes.hp.value
const ogreHp = ogre.actor.system.attributes.hp.value
;({ request, made } = await sent(() => tray.getByRole('button', { name: 'Roll damage' }).click(), "the area attack's damage"))
check(request.kind === 'damage' && request.payload.dice[0].faces === 6 && request.payload.dice[0].results.length === 2 && made.status === 'done', `its damage, 2d6, is rolled in the game with Alice's dice (${JSON.stringify(request.payload.dice)})`)
if (MIDI) {
  await until(() => goblin.actor.system.attributes.hp.value < goblinHp, 'Midi to apply the damage')
  check(ogre.actor.system.attributes.hp.value === ogreHp, 'Midi applies it to the goblin it hit, not the ogre it missed')
}

// ---- A critical hit with the greataxe: what it adds ----
// Thorin's Savage Attacks, a die more of a melee weapon's on a critical hit, for this alone
// (attack-data.mjs:410-413): the game's preview of a natural 20 throws the greataxe's die twice and
// one more, and its critical damage's die after, marked added; the phone throws them all, in that
// order, and the game makes the critical hit's damage with them.
thorin.flags.dnd5e.meleeCriticalDamageDice = 1
const axeSwing = panel.getByRole('button', { name: 'Greataxe attack, +6' })
const axePicker = page.getByRole('dialog', { name: 'Greataxe attack' })
await forceD20(20)
await axeSwing.click()
await axePicker.waitFor()
;({ request, made } = await sent(() => axePicker.getByRole('button', { name: /^Goblin/ }).click(), "the greataxe's critical hit"))
await unforce()
const axePreview = made.result.damage?.rolls?.[0]
check(request.payload.item === 'greataxe' && request.payload.activity === 'cleave' && made.result.attack?.critical === true && made.result.damage?.critical === true
  && axePreview?.formula === '3d12 + 3 + 1d6' && axePreview.perDie === 2
  && same(axePreview.dice.map(({ faces, number, added }) => [faces, number, added === true]), [[12, 3, false], [6, 1, true]]),
  `a natural 20 with the greataxe at the goblin: its damage 3d12 + 3 + 1d6, its die twice and Thorin's die more, its critical damage's die marked added (${JSON.stringify(made.result.damage)})`)
await tray.getByRole('button', { name: 'Roll critical damage' }).waitFor({ timeout: 30_000 })
check(true, 'the tray offers its critical damage')
const axeCrit = request.id
;({ request: damage, made } = await sent(() => panel.getByRole('button', { name: 'Greataxe damage, 1d12 + 3' }).click(), "the greataxe's critical damage"))
const [twelves = [], sixes = []] = damage.payload.dice.map(({ results }) => results)
check(damage.kind === 'damage' && damage.useId === axeCrit && same(damage.payload.dice.map(({ faces, results }) => [faces, results.length]), [[12, 3], [6, 1]]),
  `the damage chip throws three d12, then the d6, as the game said (${JSON.stringify(damage.payload.dice)})`)
const axeRoll = MIDI ? midi.made.at(-1).damageRolls?.[0] : madeFor(damage.id)?.rolls[0]
const axeTotal = sum(twelves) + sum(sixes) + 3
check(made.status === 'done' && axeRoll?.options.isCritical === true && axeRoll.formula === '3d12 + 3 + 1d6'
  && same(axeRoll.dice.map(die => die.results.map(r => r.result)), [twelves, sixes]) && axeRoll.total === axeTotal,
  `the game rolls it critical, 3d12 + 3 + 1d6, with Alice's dice (${twelves}; ${sixes}): ${axeRoll?.total}`)
const cdp = await phone.newCDPSession(page)
/**
 * Hold a finger on a button, as long as a long-press takes and more; then lift it. Whether its menu
 * was open while the finger was down.
 */
async function longPress(button, itsMenu) {
  await button.scrollIntoViewIfNeeded()
  const { x, y, width, height } = await button.boundingBox()
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x + width / 2, y: y + height / 2 }] })
  await wait(750)
  const opened = await itsMenu.isVisible()
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await wait(300)
  return opened
}
/** Wait until the tray shows a roll the game made, by its label and the game's total; what it says. */
async function trayShows(label, total) {
  await until(async () => {
    const text = await status.textContent()
    return text.includes(label) && text.includes(`At the table: ${total}`)
  }, `the tray to show ${label}, ${total} at the table`, 30_000)
  return status.textContent()
}
let axeTray = await trayShows('Greataxe damage', axeTotal)
check(axeTray.includes(`3d12 (${twelves.join(', ')}) +3 +1d6 (${sixes.join(', ')}) Slashing · Critical hit`),
  `the tray shows the dice the phone threw, its critical damage's after, and the game's total, ${axeTotal}: "${axeTray}"`)
await shoot(page, 'phone-greataxe-critical')

// Its critical damage changed from the tray: a die more of the greataxe's own, two on a critical hit,
// Thorin's die more and its critical damage's die as they are. The game throws the d12s on the
// greataxe's own die, never on its critical damage's (dice-plan.mjs: reshapeDamage).
await forceD20(20)
await axeSwing.click()
await axePicker.waitFor()
;({ request, made } = await sent(() => axePicker.getByRole('button', { name: /^Goblin/ }).click(), "the greataxe's second critical hit"))
await unforce()
check(made.result.damage?.critical === true && made.result.damage.rolls?.[0]?.formula === '3d12 + 3 + 1d6',
  `another natural 20 with the greataxe, its damage 3d12 + 3 + 1d6 again (${JSON.stringify(made.result.damage)})`)
const axeAgain = request.id
const axeDamage = tray.getByRole('button', { name: 'Roll critical damage' })
await axeDamage.waitFor({ timeout: 30_000 })
const axeMenu = page.getByRole('menu', { name: 'Greataxe damage 3d12 + 3 + 1d6' })
let held = await longPress(axeDamage, axeMenu)
const axeWays = await axeMenu.getByRole('menuitem').allTextContents()
check(held && same(axeWays, ['Roll maximum damage', 'Modify damage…']), `a long-press on its damage in the tray offers it at its highest, or changed: ${JSON.stringify(axeWays)}`)
await shoot(page, 'phone-greataxe-critical-menu')
await axeMenu.getByRole('menuitem', { name: 'Modify damage…' }).tap()
const modify = page.getByRole('dialog', { name: 'Modify damage' })
await modify.waitFor()
await modify.getByRole('button', { name: 'One die more' }).tap()
const axeThrow = await modify.getByRole('status').textContent()
check(axeThrow === '5d12 + 3 + 1d6 Slashing', `Modify damage's a die more throws two more d12, the critical hit's, and the d6 as it was: "${axeThrow}"`)
await shoot(page, 'phone-modify-greataxe-critical')
;({ request: damage, made } = await sent(() => modify.getByRole('button', { name: 'Roll' }).tap(), "the greataxe's critical damage, a die more"))
const [moreTwelves = [], moreSixes = []] = damage.payload.dice.map(({ results }) => results)
check(damage.kind === 'damage' && damage.useId === axeAgain && same(damage.payload.modifiers, { extra: 1 })
  && same(damage.payload.dice.map(({ faces, results }) => [faces, results.length]), [[12, 5], [6, 1]]),
  `the app sends it a die more, five d12 and then the d6 (${JSON.stringify(damage.payload)})`)
const moreRoll = MIDI ? midi.made.at(-1).damageRolls?.[0] : madeFor(damage.id)?.rolls[0]
const moreTotal = sum(moreTwelves) + sum(moreSixes) + 3
check(made.status === 'done' && moreRoll?.options.isCritical === true && moreRoll.formula === '5d12 + 3 + 1d6'
  && same(moreRoll.dice.map(die => die.results.map(r => r.result)), [moreTwelves, moreSixes]) && moreRoll.total === moreTotal,
  `the game rolls it critical, 5d12 + 3 + 1d6, the d12s added to the greataxe's own die, with Alice's dice (${moreTwelves}; ${moreSixes}): ${moreRoll?.total}`)
axeTray = await trayShows('Greataxe damage', moreTotal)
check(axeTray.includes(`5d12 (${moreTwelves.join(', ')}) +3 +1d6 (${moreSixes.join(', ')}) Slashing · Critical hit`),
  `the tray shows the five d12 and the d6, and the game's total, ${moreTotal}: "${axeTray}"`)
await shoot(page, 'phone-greataxe-critical-changed')

// ---- A critical hit unarmed: a number, and its critical damage's die ----
// dnd5e throws Thorin's die more only on a damage's first die (damage-roll.mjs:167-192), and his
// unarmed strike has none; it adds the critical damage, 1d4, after (219-223). The game's preview
// marks the d4 added; the tray offers no die more of none, and the app refuses one made up; the
// critical hit's damage is made with the d4 alone.
/** What the app answers a roll the phone never offered, sent as the phone sends one: its status and why. */
const forge = body => page.evaluate(async body => {
  const response = await fetch('/api/characters/sheet-thorin/rolls', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { status: response.status, ...(await response.json().catch(() => ({}))) }
}, body)
const punchSwing = panel.getByRole('button', { name: 'Unarmed Strike attack, +6' })
const punchPicker = page.getByRole('dialog', { name: 'Unarmed Strike attack' })
await forceD20(20)
await punchSwing.click()
await punchPicker.waitFor()
;({ request, made } = await sent(() => punchPicker.getByRole('button', { name: /^Goblin/ }).click(), 'the unarmed critical hit'))
await unforce()
const punchPreview = made.result.damage?.rolls?.[0]
check(request.payload.item === 'unarmed' && request.payload.activity === 'punch' && made.result.damage?.critical === true
  && punchPreview?.formula === '1 + 3 + 1d4' && punchPreview.perDie === 2
  && same(punchPreview.dice.map(({ faces, number, added }) => [faces, number, added === true]), [[4, 1, true]]),
  `a natural 20 unarmed: its damage 1 + 3 + 1d4, no die more of Thorin's, its critical damage's d4 marked added (${JSON.stringify(made.result.damage)})`)
const punch = request.id
const punchDamage = tray.getByRole('button', { name: 'Roll critical damage' })
await punchDamage.waitFor({ timeout: 30_000 })
const punchMenu = page.getByRole('menu', { name: 'Unarmed Strike damage 1 + 3 + 1d4' })
held = await longPress(punchDamage, punchMenu)
const punchWays = await punchMenu.getByRole('menuitem').allTextContents()
check(held && same(punchWays, ['Roll maximum damage']), `a long-press on its damage offers it at its highest, and no change, with no die of its own to change: ${JSON.stringify(punchWays)}`)
await shoot(page, 'phone-unarmed-critical-menu')
await page.keyboard.press('Escape')
await punchMenu.waitFor({ state: 'hidden' })
const unforged = requests()
const madeUp = await forge({ kind: 'damage', use: punch, mode: 0, explicit: false, extras: [], dice: [{ faces: 4, results: [1, 2, 3] }], modifiers: { extra: 1 } })
check(same(madeUp, { status: 422, reason: 'dice' }) && requests() === unforged,
  `a die more of it, made up, three d4, is refused for its dice, and nothing reaches the game: ${JSON.stringify(madeUp)}`)
;({ request: damage, made } = await sent(() => punchDamage.click(), 'the unarmed critical damage'))
const [fours = []] = damage.payload.dice.map(({ results }) => results)
const punchRoll = MIDI ? midi.made.at(-1).damageRolls?.[0] : madeFor(damage.id)?.rolls[0]
check(damage.kind === 'damage' && damage.useId === punch && !('modifiers' in damage.payload) && same(damage.payload.dice.map(({ faces, results }) => [faces, results.length]), [[4, 1]])
  && made.status === 'done' && punchRoll?.options.isCritical === true && punchRoll.formula === '1 + 3 + 1d4'
  && same(punchRoll.dice.map(die => die.results.map(r => r.result)), [fours]) && punchRoll.total === sum(fours) + 4,
  `the phone throws the d4 alone, and the game rolls it critical, 1 + 3 + 1d4, with Alice's d4 (${fours}): ${punchRoll?.total}`)
const punchTray = await trayShows('Unarmed Strike damage', sum(fours) + 4)
check(punchTray.startsWith(`${sum(fours) + 4}Unarmed Strike damage1 +3 +1d4 (${fours.join(', ')}) Bludgeoning · Critical hit`),
  `the tray shows the d4 and the game's total, ${sum(fours) + 4}: "${punchTray}"`)
await shoot(page, 'phone-unarmed-critical')
delete thorin.flags.dnd5e.meleeCriticalDamageDice

// ---- Damage that takes a die away (module 0.21.0) ----
// Reduce's - 1d4 on Thorin's melee weapon attacks: dnd5e builds `1d12 - 1d4 + 3`; this port keeps
// `@mod` in the part, so `1d12 + 3 - 1d4`, its dice in the same order. The game's preview marks the
// d4 taken away. The tray changes only the greataxe's own d12, never the d4, nor rolls it at its
// highest, which would take the most away; nor does the app take either made up. His unarmed
// strike's only die is the one it takes away, so it has none to change, and a long-press offers
// nothing.
/** Wait for room under the app's limit of 20 rolls a minute from a player. */
const lastMinute = () => Number(sql(`select count(*) from roll_request where "createdAt" > now() - interval '1 minute'`))
const paced = () => until(() => lastMinute() < 18, 'room under the rate limit', 70_000)
const thrownAs = dice => dice.map(({ faces, results }) => [faces, results.length])
const reduced = thorin.system.bonuses.mwak
thorin.system.bonuses.mwak = { damage: '- 1d4' }
await paced()
await forceD20(15)
await axeSwing.click()
await axePicker.waitFor()
;({ request, made } = await sent(() => axePicker.getByRole('button', { name: /^Goblin/ }).click(), "the greataxe's hit under Reduce"))
await unforce()
const reducedPreview = made.result.damage?.rolls?.[0]
check(request.payload.item === 'greataxe' && made.result.attack?.outcome === 'hit' && made.result.damage?.critical !== true
  && reducedPreview?.formula === '1d12 + 3 - 1d4' && reducedPreview.perDie === 1
  && same(reducedPreview.dice.map(({ faces, number, subtracted }) => [faces, number, subtracted === true]), [[12, 1, false], [4, 1, true]]),
  `a plain hit with the greataxe under Reduce: its damage 1d12 + 3 - 1d4, the d4 marked taken away (${JSON.stringify(made.result.damage)})`)
const reducedHit = request.id
let unforgedReduced = requests()
await paced()
const reducedMadeUp = [
  await forge({ kind: 'damage', use: reducedHit, mode: 0, explicit: false, extras: [], dice: [{ faces: 12, results: [5] }, { faces: 4, results: [1, 2] }], modifiers: { extra: 1 } }),
  await forge({ kind: 'damage', use: reducedHit, mode: 0, explicit: false, extras: [], dice: [{ faces: 12, results: [5] }, { faces: 4, results: [2] }], modifiers: { maximize: true } }),
]
check(same(reducedMadeUp, [{ status: 422, reason: 'dice' }, { status: 422, reason: 'dice' }]) && requests() === unforgedReduced,
  `a die more of the d4 it takes away, or its damage at its highest, made up, is refused for its dice, and nothing reaches the game: ${JSON.stringify(reducedMadeUp)}`)
const reducedDamage = tray.getByRole('button', { name: 'Roll damage' })
await reducedDamage.waitFor({ timeout: 30_000 })
const reducedMenu = page.getByRole('menu', { name: 'Greataxe damage 1d12 + 3 - 1d4' })
held = await longPress(reducedDamage, reducedMenu)
const reducedWays = await reducedMenu.getByRole('menuitem').allTextContents()
check(held && same(reducedWays, ['Modify damage…']), `a long-press on its damage in the tray, named for the game's formula, offers it changed, never at its highest: ${JSON.stringify(reducedWays)}`)
await shoot(page, 'phone-greataxe-reduced-menu')
await reducedMenu.getByRole('menuitem', { name: 'Modify damage…' }).tap()
await modify.waitFor()
const dieHint = await modify.getByText(/^The first die it adds/).textContent()
check(await modify.getByText('Maximum damage', { exact: true }).count() === 0 && dieHint.startsWith('The first die it adds, never one it takes away, such as'),
  `Modify damage offers no maximum, and says its die is the first it adds: "${dieHint}"`)
await modify.getByRole('button', { name: 'One die more' }).tap()
const reducedThrow = await modify.getByRole('status').textContent()
check(reducedThrow === '2d12 + 3 − 1d4 Slashing', `a die more throws another d12, the greataxe's own, and the d4 as it was: "${reducedThrow}"`)
await shoot(page, 'phone-modify-greataxe-reduced')
await paced()
;({ request: damage, made } = await sent(() => modify.getByRole('button', { name: 'Roll' }).tap(), "the greataxe's damage under Reduce, a die more"))
const [reducedTwelves = [], reducedFours = []] = damage.payload.dice.map(({ results }) => results)
check(damage.kind === 'damage' && damage.useId === reducedHit && same(damage.payload.modifiers, { extra: 1 }) && same(thrownAs(damage.payload.dice), [[12, 2], [4, 1]]),
  `the app sends it a die more, two d12 and then the d4 (${JSON.stringify(damage.payload)})`)
const reducedRoll = MIDI ? midi.made.at(-1).damageRolls?.[0] : madeFor(damage.id)?.rolls[0]
const reducedTotal = sum(reducedTwelves) + 3 - sum(reducedFours)
check(made.status === 'done' && reducedRoll?.formula === '2d12 + 3 - 1d4'
  && same(reducedRoll.dice.map(die => die.results.map(r => r.result)), [reducedTwelves, reducedFours]) && reducedRoll.total === reducedTotal,
  `the game rolls it 2d12 + 3 - 1d4, the d12 added to the greataxe's own die, with Alice's dice (${reducedTwelves}; ${reducedFours}): ${reducedRoll?.total}`)
const reducedTray = await trayShows('Greataxe damage', reducedTotal)
check(reducedTray.includes(`2d12 (${reducedTwelves.join(', ')}) +3 −1d4 (${reducedFours.join(', ')}) Slashing`),
  `the tray shows the two d12, the d4 taken away, and the game's total, ${reducedTotal}: "${reducedTray}"`)
await shoot(page, 'phone-greataxe-reduced')

await paced()
await forceD20(15)
await punchSwing.click()
await punchPicker.waitFor()
;({ request, made } = await sent(() => punchPicker.getByRole('button', { name: /^Goblin/ }).click(), 'the unarmed hit under Reduce'))
await unforce()
const reducedPunch = made.result.damage?.rolls?.[0]
check(request.payload.item === 'unarmed' && made.result.attack?.outcome === 'hit' && made.result.damage?.critical !== true
  && reducedPunch?.formula === '1 + 3 - 1d4' && same(reducedPunch.dice.map(({ faces, number, subtracted }) => [faces, number, subtracted === true]), [[4, 1, true]]),
  `a plain hit unarmed under Reduce: its damage 1 + 3 - 1d4, its only die the d4 it takes away (${JSON.stringify(made.result.damage)})`)
const punchHit = request.id
const punchReduced = tray.getByRole('button', { name: 'Roll damage' })
await punchReduced.waitFor({ timeout: 30_000 })
unforgedReduced = requests()
await longPress(punchReduced, page.getByRole('menu'))
await wait(1000)
check(await page.getByRole('menu').count() === 0 && requests() === unforgedReduced, 'a long-press on its damage in the tray offers nothing, with no die to change and none to roll at its highest, and rolls nothing')
await shoot(page, 'phone-unarmed-reduced')
await paced()
const punchMadeUp = [
  await forge({ kind: 'damage', use: punchHit, mode: 0, explicit: false, extras: [], dice: [{ faces: 4, results: [1, 2] }], modifiers: { extra: 1 } }),
  await forge({ kind: 'damage', use: punchHit, mode: 0, explicit: false, extras: [], dice: [{ faces: 4, results: [3] }], modifiers: { maximize: true } }),
]
check(same(punchMadeUp, [{ status: 422, reason: 'dice' }, { status: 422, reason: 'dice' }]) && requests() === unforgedReduced,
  `a die more of it, or it at its highest, made up, is refused for its dice: ${JSON.stringify(punchMadeUp)}`)
await paced()
;({ request: damage, made } = await sent(() => punchReduced.click(), 'the unarmed damage under Reduce'))
const [reducedFour = []] = damage.payload.dice.map(({ results }) => results)
const punchReducedRoll = MIDI ? midi.made.at(-1).damageRolls?.[0] : madeFor(damage.id)?.rolls[0]
const punchReducedTotal = 4 - sum(reducedFour)
check(damage.kind === 'damage' && damage.useId === punchHit && !('modifiers' in damage.payload) && same(thrownAs(damage.payload.dice), [[4, 1]])
  && made.status === 'done' && punchReducedRoll?.formula === '1 + 3 - 1d4'
  && same(punchReducedRoll.dice.map(die => die.results.map(r => r.result)), [reducedFour]) && punchReducedRoll.total === punchReducedTotal,
  `a tap rolls it as it is: the phone throws the d4, and the game rolls 1 + 3 - 1d4 with it (${reducedFour}): ${punchReducedRoll?.total}`)
const punchReducedTray = await trayShows('Unarmed Strike damage', punchReducedTotal)
check(punchReducedTray.startsWith(`${punchReducedTotal}Unarmed Strike damage1 +3 −1d4 (${reducedFour.join(', ')}) Bludgeoning`),
  `the tray shows the d4 taken away, and the game's total, ${punchReducedTotal}: "${punchReducedTray}"`)
thorin.system.bonuses.mwak = reduced

// ---- In Toasts mode: the hit's toast waits, and its damage rolls from it (toasts2) ----
// Toasts are the default; the rest of this suite has the banner, as chosen. On another phone, with
// nothing chosen, a hit pops up a toast that stays, past four seconds, with its Roll damage, below the
// sheet's row of tabs, which stays tappable (toasts3); tapped, the damage is made in the game with
// Alice's d8, the toast goes at once and the damage's own pops up. A miss's toast doesn't wait: it goes
// four seconds after it says so, and the Rolls popover offers its damage where the game does, as
// dnd5e's card does and Midi's workflow, ended by the miss, doesn't.
{
  await paced()
  const toasting = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: 'light' })
  await toasting.addInitScript(() => localStorage.removeItem('sending-stone:roll-toasts'))
  await toasting.addCookies([cookie])
  await toasting.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '' }))
  const view = await toasting.newPage()
  view.on('pageerror', e => problems.push(`toasts pageerror: ${e.message}`))
  await view.goto(`${BASE}/characters/sheet-thorin`)
  await view.getByRole('tablist', { name: 'Character sheet' }).waitFor()
  await view.getByRole('tab', { name: 'Actions' }).click()
  const log = view.getByRole('log', { name: 'Roll results' })
  await log.waitFor({ state: 'attached', timeout: 15_000 })
  check(await view.getByRole('region', { name: 'Your rolls' }).count() === 0 && await view.getByRole('button', { name: /^Your rolls/ }).isVisible(),
    'with nothing chosen, toasts: no banner, but the Rolls button beside the cog')
  const toastSwing = view.getByRole('tabpanel').getByRole('button', { name: 'Longsword attack, +6' })
  const toastPicker = view.getByRole('dialog', { name: 'Longsword attack' })
  await view.evaluate(v => { globalThis.__random ??= Math.random; Math.random = () => (v - 0.5) / 20 }, 15)
  await toastSwing.click()
  await toastPicker.waitFor()
  ;({ request, made } = await sent(() => toastPicker.getByRole('button', { name: /^Goblin/ }).click(), 'the attack in Toasts mode'))
  await view.evaluate(() => { if (globalThis.__random) Math.random = globalThis.__random })
  check(request.payload.item === 'longsword' && made.status === 'done' && made.result.attack?.outcome === 'hit', `the attack from the toasting phone hits the goblin (${JSON.stringify(made.result.attack)})`)
  const waiting = log.locator('[data-roll-toast][data-waits]').filter({ hasText: 'Longsword attack' })
  const toastDamage = waiting.getByRole('button', { name: 'Roll damage' })
  await toastDamage.waitFor({ timeout: 30_000 })
  const waitingId = await waiting.getAttribute('data-roll-toast')
  check(/At the table: 21 · Hit/.test(await waiting.textContent()) && await waiting.getByRole('button', { name: 'Dismiss' }).isVisible(),
    "its toast says it hit, and waits with Roll damage and a ×")
  // It starts 8 pixels below the tab row, and every tab, the Rolls button and the cog are tappable
  // at their centre and each edge, by elementFromPoint.
  await waiting.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))))
  const row = await view.evaluate(() => {
    const tabRow = document.querySelector('[role=tablist][aria-label="Character sheet"]').parentElement
    const controls = [...tabRow.querySelectorAll('[role=tab]'), ...tabRow.querySelectorAll('button[title="Your rolls"], button[aria-label="Settings"]')]
    const blocked = controls.flatMap(el => {
      const b = el.getBoundingClientRect()
      const [x, y] = [b.left + b.width / 2, b.top + b.height / 2]
      return [[x, y], [b.left + 2, y], [b.right - 2, y], [x, b.top + 2], [x, b.bottom - 2]].flatMap(([px, py]) => {
        const hit = document.elementFromPoint(px, py)
        return hit && (hit === el || el.contains(hit)) ? [] : [`${el.title || el.getAttribute('aria-label')} at ${Math.round(px)},${Math.round(py)}: ${hit?.closest('[data-roll-toast]') ? 'a toast' : hit?.outerHTML.slice(0, 40)}`]
      })
    })
    const log = document.querySelector('[role=log][aria-label="Roll results"]')
    return {
      tabs: tabRow.querySelectorAll('[role=tab]').length, controls: controls.length, blocked, bottom: tabRow.getBoundingClientRect().bottom, set: log.parentElement.style.top,
      card: log.querySelector('[data-roll-toast]').getBoundingClientRect().top,
    }
  })
  const rowWant = Math.ceil(row.bottom) + 8
  check(row.tabs >= 2 && row.controls === row.tabs + 2 && row.blocked.length === 0 && row.set === `${rowWant}px` && Math.abs(row.card - rowWant) <= 0.5,
    `the toast starts 8 pixels below the tab row (${Math.round(row.bottom)}, toast at ${row.set}, its card at ${row.card}), and its ${row.tabs} tabs, the Rolls button and the cog are all tappable (${row.blocked.join('; ')})`)
  const stays = async () => await waiting.count() === 1 && await waiting.getAttribute('data-leaving') === null
  /** Whether this holds at every look for `ms`, looked at each 100 ms. */
  const throughout = async (test, ms) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      if (!(await test())) return false
      await wait(100)
    }
    return true
  }
  const held = Date.now()
  check(await throughout(stays, 5_500), `it stays, never fading, ${Date.now() - held} ms and more`)
  await shoot(view, 'phone-toasts-hit')
  const toastAttack = request.id
  ;({ request: damage, made } = await sent(() => toastDamage.click(), "the damage from the attack's toast"))
  const toastD8 = damage.payload.dice[0]?.results[0]
  check(damage.kind === 'damage' && damage.useId === toastAttack && damage.payload.dice.length === 1 && damage.payload.dice[0].faces === 8 && made.status === 'done',
    `the toast's Roll damage sends that attack's damage, with the d8 it threw, and the game makes it (${JSON.stringify(damage.payload.dice)})`)
  if (MIDI) {
    const workflow = midi.made.at(-1)
    check(workflow.damageRolls?.[0]?.dice[0].results[0].result === toastD8 && workflow.currentAction === workflow.WorkflowState_Completed && midi.applied.at(-1).amount === toastD8 + 3,
      `Midi's workflow goes on with Alice's d8, to its end, and applies ${toastD8 + 3} to the goblin`)
  } else {
    const damageMessage = madeFor(damage.id)
    check(damageMessage && damageMessage.flags.dnd5e.originatingMessage === useCard(toastAttack).id && damageMessage.rolls[0].dice[0].results[0].result === toastD8,
      `dnd5e rolls it on the card, with Alice's d8: ${toastD8}`)
  }
  await log.locator(`[data-roll-toast="${waitingId}"]`).waitFor({ state: 'detached', timeout: 2_000 })
  await log.locator('[data-roll-toast]').filter({ hasText: 'Longsword damage' }).getByText(`At the table: ${toastD8 + 3}`).waitFor({ timeout: 30_000 })
  check(await view.getByRole('button', { name: /^Your rolls/ }).textContent() === 'Your rolls', `the waiting toast goes, the damage's own says ${toastD8 + 3}, and nothing is left to roll`)
  await shoot(view, 'phone-toasts-damage')

  // A miss at the ogre: its toast doesn't wait, and goes four seconds after it says so (toasts3).
  await paced()
  // When the miss's toast says so, and when it goes, by the page's clock; and whether it ever waits.
  await view.evaluate(() => {
    const marks = globalThis.__missMarks = {}
    const log = document.querySelector('[role=log][aria-label="Roll results"]')
    const look = () => {
      const now = performance.now()
      const el = marks.id ? log.querySelector(`[data-roll-toast="${marks.id}"]`) : [...log.querySelectorAll('[data-roll-toast]')].find(t => / · Miss$/.test(t.querySelector('p.line-clamp-2')?.textContent ?? ''))
      if (el && !marks.id) Object.assign(marks, { id: el.dataset.rollToast, said: now })
      if (el?.dataset.waits) marks.waited = true
      if (marks.id && !el && !marks.gone) marks.gone = now
    }
    globalThis.__missWatch = new MutationObserver(look)
    globalThis.__missWatch.observe(log, { subtree: true, childList: true, characterData: true, attributes: true })
  })
  await view.evaluate(v => { globalThis.__random ??= Math.random; Math.random = () => (v - 0.5) / 20 }, 4)
  await toastSwing.click()
  await toastPicker.waitFor()
  ;({ request, made } = await sent(() => toastPicker.getByRole('button', { name: /^Ogre/ }).click(), 'the miss in Toasts mode'))
  await view.evaluate(() => { if (globalThis.__random) Math.random = globalThis.__random })
  const toastMiss = request.id
  check(made.status === 'done' && made.result.attack?.outcome === 'miss' && (MIDI ? made.result.damage === null : !!made.result.damage),
    `the attack from the toasting phone misses the ogre, ${MIDI ? "Midi's workflow ending there, with no damage" : "dnd5e's card still offering its damage"}`)
  const missed = log.locator('[data-roll-toast]').filter({ hasText: 'At the table: 10 · Miss' })
  await missed.waitFor({ timeout: 30_000 })
  const rollsButton = view.getByRole('button', { name: /^Your rolls/ })
  check(await missed.getAttribute('data-waits') === null && await missed.getByRole('button').count() === 0 && await rollsButton.textContent() === 'Your rolls',
    "its toast says it missed, and doesn't wait: nothing to tap on it, and no dot on the Rolls button")
  await shoot(view, 'phone-toasts-miss')
  await missed.waitFor({ state: 'detached', timeout: 10_000 })
  const marks = await view.evaluate(() => { globalThis.__missWatch.disconnect(); return globalThis.__missMarks })
  check(marks.said && marks.gone && marks.gone - marks.said >= 3600 && marks.gone - marks.said <= 4600 && !marks.waited,
    `it goes ${Math.round(marks.gone - marks.said)} ms after it says "· Miss", never waiting`)
  await rollsButton.click()
  const popover = view.getByRole('dialog', { name: 'Your rolls' })
  await popover.waitFor()
  const latest = popover.getByRole('status')
  check(/Longsword attack/.test(await latest.textContent()) && /At the table: 10 · Miss/.test(await latest.textContent())
    && await latest.getByRole('button', { name: /damage/ }).count() === (MIDI ? 0 : 1) && await popover.locator('[role=group]').count() === 0,
    `the Rolls popover's latest roll is the miss in full, ${MIDI ? 'with no damage to roll' : 'with its Roll damage'} (${await latest.textContent()})`)
  if (!MIDI) {
    await paced()
    ;({ request: damage, made } = await sent(() => latest.getByRole('button', { name: 'Roll damage' }).click(), "the miss's damage from the popover"))
    check(damage.kind === 'damage' && damage.useId === toastMiss && made.status === 'done' && madeFor(damage.id)?.flags.dnd5e.originatingMessage === useCard(toastMiss).id,
      "which rolls the miss's damage on dnd5e's card")
  }
  await toasting.close()
}

// ---- Out of combat, at no one ----
game.combats.delete('fight1')
await Hooks.callAll('deleteCombat', fight)
await until(() => sql('select count(*) from combat') === '0', 'the fight to end in the app', 15_000)
// The page hears of it when it next asks.
await wait(3500)
;({ request, made } = await sent(() => swing.click(), 'an attack out of combat'))
check(await picker.count() === 0 || !(await picker.isVisible()), 'out of combat, the attack is made at once, with no one to pick')
check(request.payload.target === null && made.status === 'done' && made.result.attack?.outcome === null,
  `at no one, so the game says nothing of a hit (${JSON.stringify(made.result.attack)})`)
// A natural 20 makes it a critical hit, which the tray says after the total.
await status.getByText(/At the table: \d+( · Critical hit)?$/).waitFor({ timeout: 30_000 })
check(true, 'and the tray shows its total')

// ---- Attacks turned off ----
await game.settings.set('sending-stone', 'campaigns', campaignWith(false))
await until(() => !stored().includes('attack'), 'the app to hear attacks are off', 15_000)
await tray.getByText('Checks, saves and hit dice you roll or spend here are made in your Gamemaster’s game too, with the same dice.').waitFor({ timeout: 15_000 })
const count = requests()
await swing.click()
await status.getByText('Longsword attack').waitFor({ timeout: 10_000 })
await wait(1500)
check(requests() === count, 'with attacks off, an attack is rolled in the app only')
await gm.reload()
check(/Their attacks and spells stay here/.test(await gm.getByRole('article', { name: 'Ashlands' }).textContent()), "the Gamemaster's card says players' attacks and spells stay in the app")

console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors, and the app took everything the module sent')
await browser.close()
process.exit(0)
