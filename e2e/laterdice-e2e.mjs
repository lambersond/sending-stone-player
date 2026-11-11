// The dice the game rolls later, asked of a player typing in theirs (module 0.44.0, item 11, its
// PROTOCOL's "Dice the game rolls later", and the app's dice asks), end to end, in the world of
// world-030.mjs, with dnd5e 5.3.3's real dice classes or, with DND5E6=1, 6.0.5's. Alice plays Thorin,
// Trusted, so Make Manual Rolls is hers, on a phone (390×844) and a wide page (1280×800) at once; Bob
// plays Vex, Trusted too, but rolls with the app's 3D dice, his switch left off; the campaign rolls,
// attacks and asks in the app, allows players to type their dice, and Manual Dice is on. The hello
// says diceAsks, diceAsksReason null, "dice" last of the kinds, the app answers diceAsks: 1 and keeps
// it. Thorin's Wild Sparks, a 1d6x formula, typed 6 on the phone, explodes: the game asks for the die
// it throws again, one d6, its dialog opening by itself on the phone, the device the roll came from,
// "Your die exploded", and only a banner on the wide page; the Gamemaster's Foundry shows "Waiting for
// Thorin's player" with Roll it now; typed 2, the card's dice are 6 and 2, the banner gone. "Let the
// game roll": Foundry's computer 6 explodes again into a 1, never asked. Rolled from the wide page,
// the dialog opens there and the phone has the banner; typed in from the phone's banner, the wide
// page's dialog closes by itself, sending nothing. Rolled from the wide page with Spells' search field
// focused as the ask comes: no dialog there, the banner, focus and what was typed kept; Type in from
// the banner. The Gamemaster's Roll it now in Foundry: the phone's dialog closes by itself, nothing
// sent from either page, Foundry's die, the banners gone within a poll. The die more, the tray
// meanwhile "Waiting for your dice…", typed 6 at 40 s: it explodes again and is asked again, one die
// at a time; that ask left a minute, the dialog counts down and closes by itself, nothing sent from
// either page, the ask expired at its 60 s, Foundry's die rolled and the banners gone, the roll held
// past its own minute and never timed out, in the module's result nor the app's view. Nothing is
// asked of Bob's 3D roll, whose die explodes on Foundry's computer dice, nor of the Gamemaster's own
// roll from their page, nor shown to another player or the Gamemaster's page. MIDI=1 with Midi-QOL's
// other activity "auto": a copy of dnd5e's Ice Knife's activities (as its spells24 pack has them: an
// attack of 1d10 piercing and Shard Explosion, 2d6 cold), its d20 and 1d10 typed, Shard Explosion's
// 2d6 asked within the damage, on the phone, typed 3 and 5, Midi's other damage 8; and the dagger's
// damage on the wide page with a Sneak Attack bonus damage macro, its 2d6 piercing asked, typed 4
// and 4. DND5E6=1: the hello says diceAsks false, diceAsksReason "system", no "dice" kind, and Wild
// Sparks' typed 6 explodes on Foundry's die, nothing asked. SKEW=042 with MODULE=module-0.42.0: no
// diceAsks in the hello, the app keeps nothing new, and the typed 6's die more is Foundry's, nothing
// asked nor shown. Synthetic characters only. Run with
// --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import {
  BOB, DND5E6, MIDI, SKEW042, W, actors, browse, character, check, faces, finish, foundryTab, foundryWorld, launch, manualDice,
  newCampaign, note, npc, part, postsOf, same, settled, shootBoth, sideways, sql, startFetching, startModule, stopFetching,
  until, wait,
} from './world-030.mjs'
import { combat, combatant } from './fvtt/stub.mjs'

const GAME = 'https://rime-hollow.forge-vtt.com'
const SECRET = 'rime-hollow-later-45'
const TITLE = 'Rime Hollow'
/** Module 0.44.0 under dnd5e 5: the game asks for its later dice. */
const ASKS = !SKEW042 && !DND5E6
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: TITLE, address: 'rime-hollow.forge-vtt.com', secret: SECRET })
await foundryWorld({ dice6: DND5E6 })
manualDice('active')
// Both players Trusted, whom Make Manual Rolls is given to out of the box: Bob may type too, but rolls
// with the app's 3D dice.
game.users.get('alice').role = 2
game.users.get('bob').role = 2

// ---- The world ----
const capital = text => text.charAt(0).toUpperCase() + text.slice(1)
const hits = (formula, type) => ({ formula, damageType: type, label: `${formula} ${capital(type)}` })
const spell = (id, name, level, activities, system = {}) => ({
  id, name, type: 'spell', system: { level, method: 'spell', prepared: 1, canPrepare: true, properties: [], duration: { units: 'inst' }, ...system }, activities,
})
const plain = id => ({ id, type: 'utility', affects: '' })
// A formula whose die explodes (as typed-e2e's), which no feature rerolls.
const SPARKS = spell('sparks', 'Wild Sparks', 0, [{ id: 'burst', type: 'utility', affects: '', formula: '1d6x', rollName: 'Burst' }])
// Thorin, a cleric: Wisdom +3 his spellcasting; six spells, so that Spells has its search field.
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 1, dex: 3, con: 2, wis: 3 }, hp: { value: 30, max: 40, temp: 0 } }, {
  ac: 15,
  spells: {
    spell1: { value: 4, max: 4, level: 1 },
    ...Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9].map(level => [`spell${level}`, { value: 0, max: 0, level }])),
  },
  items: [
    SPARKS,
    spell('light', 'Light', 0, [plain('glow')]),
    spell('mageHand', 'Mage Hand', 0, [plain('hand')]),
    spell('shield', 'Shield', 1, [plain('ward')]),
    spell('sleep', 'Sleep', 1, [plain('drowse')]),
    // A copy of dnd5e's Ice Knife's activities, made here as its spells24 pack has them
    // (1st-level/ice-knife.yml, identical at release-5.3.3 and 6.0.5), nothing read from the pack:
    // its attack, 1d10 piercing, and its save, Shard Explosion, 2d6 cold, 1d6 more a level above
    // 1st, spending no slot, which Midi-QOL pairs with the attack as its other activity.
    spell('iceKnife', 'Ice Knife', 1, [
      { id: 'iceAttack', name: 'Ice Knife', attack: { ability: 'spellcasting' }, damage: [{ number: 1, denomination: 10, types: ['piercing'] }],
        labels: { modifier: '+5', damage: [hits('1d10', 'piercing')] } },
      { id: 'iceBurst', name: 'Shard Explosion', type: 'save', save: ['dex'], dc: 13, onSave: 'none', spellSlot: false,
        damage: [{ number: 2, denomination: 6, types: ['cold'], scaling: 1 }], labels: { damage: [hits('2d6', 'cold')] } },
    ]),
    // A rogue's dagger, for Midi-QOL's Sneak Attack bonus damage.
    {
      id: 'dagger', name: 'Dagger', type: 'weapon', system: { properties: ['fin'], quantity: 1, attackType: 'melee', equipped: true },
      activities: [{ id: 'stab', attack: { ability: '' }, damage: [{ number: 1, denomination: 4, bonus: '@mod', types: ['piercing'] }], labels: { modifier: '+5', damage: [hits('1d4 + 3', 'piercing')] } }],
    },
  ],
})
thorin.system.details = { level: 4 }
thorin.system.attributes.spellcasting = 'wis'
thorin.system.attributes.spell = { dc: 13, attack: 5, mod: 3 }
// Vex, Bob's, with Wild Sparks of his own.
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { wis: 3 }, hp: { value: 24, max: 30, temp: 0 } }, {
  ac: 14, items: [{ ...SPARKS, id: 'vexSparks', activities: [{ id: 'vexBurst', type: 'utility', affects: '', formula: '1d6x', rollName: 'Burst' }] }],
})
vex.system.details = { level: 4 }
vex.system.attributes.spellcasting = 'wis'
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
const goblin = npc('goblin', 'Goblin', 12)
// The tokens on the Gamemaster's canvas, and a fight.
const tokenOf = {}
for (const actor of [thorin, vex, goblin]) {
  const token = { id: `tok-${actor.id}`, name: actor.name, uuid: `Scene.scene.Token.tok-${actor.id}`, actor, hidden: false, isLinked: true, disposition: actor.type === 'npc' ? -1 : 1 }
  const placeable = { id: token.id, name: actor.name, document: token, actor }
  token.object = placeable
  W.placeables.set(token.id, placeable)
  actor.speakerToken = placeable
  tokenOf[actor.id] = token
}
if (MIDI) {
  canvas.scene.tokens.size = W.placeables.size
  // Midi-QOL's own default for an attack's other activity, "auto", as dnd5e's Ice Knife is paired.
  Object.assign(W.midi.settings, { autoCheckSaves: 'none', requiresTargets: 'none', defaultOtherActivity: 'auto' })
}
W.gm.targets = new Set()
Object.defineProperty(actors, 'party', { get: () => null, configurable: true })
const CAMPAIGN = { id: 'camp-later', title: TITLE, characters: ['thorin', 'vex'], groups: [], rolls: true, attacks: true, prompts: true, manualDice: true }
await startModule({ campaigns: [CAMPAIGN], secrets: { 'camp-later': SECRET } })
await settled()
const fight = combat('fight')
combatant(fight, 'cbGoblin', goblin, { name: 'Goblin', initiative: 18, token: tokenOf.goblin })
combatant(fight, 'cbThorin', thorin, { initiative: 12, token: tokenOf.thorin })
combatant(fight, 'cbVex', vex, { initiative: 6, token: tokenOf.vex })
fight.getCombatantsByActor = actor => fight.combatants.filter(cb => cb.actor?.id === actor.id)
fight.started = true
fight.round = 1
Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight'), configurable: true })
await Hooks.callAll('createCombat', fight)
await until(() => sql('select count(*) from combat') === '1', 'the app to hear of the fight', 15_000)

// ---- The Gamemaster's Foundry: the module's waiting window, drawn on the game's page ----
// Foundry 14's DialogV2, as far as the module draws one [core, unverified]: drawn on the game's page
// in the browser, its buttons pressed there as the Gamemaster would, each calling its callback, which
// closes it as DialogV2 does.
const windows = []
const gmTab = foundryTab()
await gmTab.exposeFunction('sendingStoneDialogAction', async (n, action) => {
  const win = windows[n]
  await win?.options.buttons?.find(button => button.action === action)?.callback?.()
  await win?.close()
})
foundry.applications.api.DialogV2 = class {
  constructor(options) { Object.assign(this, { options, rendered: false, closed: false, n: windows.push(this) - 1 }) }
  async render() {
    this.rendered = true
    const { n, options } = this
    await gmTab.evaluate(({ n, title, content, buttons }) => {
      const el = document.createElement('section')
      el.id = `dialog-${n}`
      el.setAttribute('role', 'dialog')
      el.setAttribute('aria-label', title)
      el.style.cssText = 'font:14px sans-serif;width:360px;border:1px solid #666;background:#f0ece2;padding:8px;margin:8px'
      el.innerHTML = `<header><strong>${title}</strong></header><div class="window-content">${content}</div><footer>${buttons.map(b => `<button type="button" data-action="${b.action}">${b.label}</button>`).join('')}</footer>`
      for (const button of el.querySelectorAll('button')) button.addEventListener('click', () => globalThis.sendingStoneDialogAction(n, button.dataset.action))
      document.body.append(el)
    }, { n, title: options.window?.title ?? '', content: options.content ?? '', buttons: (options.buttons ?? []).map(({ action, label }) => ({ action, label })) })
    return this
  }
  async close() {
    this.closed = true
    await gmTab.evaluate(n => document.getElementById(`dialog-${n}`)?.remove(), this.n).catch(() => {})
    return this
  }
  get element() { return null }
}
const gmWindow = () => gmTab.getByRole('dialog', { name: "Waiting for a player's dice" })

// ---- What's posted, kept and made ----
const hello = () => postsOf('bridge.hello').at(-1)
const rollFeatures = () => sql(`select array_to_string("rollFeatures", ',') from campaign where id = '${A}'`).split(',')
const rollKinds = () => sql(`select array_to_string("rollKinds", ',') from campaign where id = '${A}'`).split(',')
const rollRow = id => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, role, "actorId", payload, result from roll_request where id = '${id}') r`) || 'null')
const settledRow = row => ['done', 'failed'].includes(row?.status)
const latestOf = (kind, actorId) => sql(`select coalesce((select id from roll_request where kind = '${kind}' and "actorId" = '${actorId}' order by "createdAt" desc limit 1), '')`)
const diceRequests = () => Number(sql("select count(*) from roll_request where kind = 'dice'"))
/** The asks the app keeps, oldest first: each its module's id, actor, roll, what it asks, and how it closed. */
const askRows = () => JSON.parse(sql(`select coalesce(json_agg(r order by r."askedAt")::text, '[]') from (select "askId", "actorId", "commandId", data, "askedAt", "expiresAt", "closedAt", "closedReason" from dice_ask where "campaignId" = '${A}') r`))
/** The module's asks and closes, as posted. */
const asked = () => postsOf('roll.dice.asked').map(p => p.data.ask)
const closes = () => postsOf('roll.dice.closed').map(p => p.data)
const closeOf = id => closes().find(entry => entry.id === id)
/** How an ask closed, once the module says so: its reason, or null after 15 s. */
async function closedAs(id) {
  await until(() => closeOf(id), 'the ask to close', 15_000).catch(() => {})
  return closeOf(id)?.reason ?? null
}
const askedFor = command => asked().filter(ask => ask.command === command)
/** The message a request made: by the module's flag, or else by the id its result names. */
const madeFor = id => W.messages.contents.find(m => m.flags?.['sending-stone']?.request === id) ?? W.messages.get(rollRow(id)?.result?.messageId ?? '')
const resultsOf = roll => roll?.dice?.[0]?.results.map(r => r.result)
const workflowOf = id => W.midi.made.find(w => w.workflowOptions?.sendingStone === id)

// ---- Alice plays Thorin, on a phone and on a wide page; Bob, Vex; the Gamemaster's page ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const phone = await browse({ width: 390, height: 844, toasts: false, path: '/characters/sheet-thorin' })
const desk = await browse({ width: 1280, height: 800, scheme: 'dark', toasts: false, path: '/characters/sheet-thorin' })
for (const who of [phone, desk]) await who.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const bob = await browse({ width: 390, height: 844, scheme: 'dark', who: BOB, toasts: false })
await bob.page.goto(invite)
await bob.page.getByRole('radio', { name: /^Vex/ }).check()
await bob.page.getByRole('button', { name: 'Join as this character' }).click()
await bob.page.waitForURL(/\/characters\/[\w-]+$/)
await bob.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const gm = await browse({ width: 1280, height: 800, toasts: false, path: `/campaigns/${A}/characters/thorin` })
await gm.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })

// The posts each page makes of its rolls, as sent.
const sentBy = new Map()
for (const who of [phone, desk, bob, gm]) {
  sentBy.set(who, [])
  who.page.on('request', request => {
    if (request.method() === 'POST' && /\/rolls$/.test(request.url())) sentBy.get(who).push(request.postDataJSON())
  })
  who.page.on('response', async response => {
    if (response.request().method() === 'POST' && /\/rolls$/.test(response.url()) && response.status() !== 202) note(`refused: ${response.status()} ${await response.text().catch(() => '')}`)
  })
}
/** The dice answers a page posted. */
const answersBy = who => sentBy.get(who).filter(body => body?.kind === 'dice')

// ---- The dialogs and the banner, as each page shows them ----
const SUBTITLE = 'Type in what your dice show'
const ASK_SUBTITLE = 'The game asks for these dice'
const EXPLODED = 'Your die exploded: roll it again and type in what it shows.'
const entryOf = who => who.page.getByRole('dialog').filter({ hasText: SUBTITLE })
const askOf = who => who.page.getByRole('dialog').filter({ hasText: ASK_SUBTITLE })
const bannerOf = who => who.page.getByRole('region', { name: 'The game asks for your dice' })
/** Each row of the banner: what rolls, its dice, and the time left or that the game rolls them. */
const bannerRows = who => bannerOf(who).getByRole('listitem').evaluateAll(items => items.map(li => [...li.querySelectorAll('p')].map(p => p.textContent.replace(/\s+/g, ' ').trim())))
/** Each term's group in a dialog: its name, and its boxes' names. */
const groupsOf = dialog => dialog.evaluate(el => [...el.querySelectorAll('[role=group][aria-labelledby]')].map(group => ({
  name: document.getElementById(group.getAttribute('aria-labelledby'))?.textContent.trim(),
  boxes: [...group.querySelectorAll('input')].map(input => input.getAttribute('aria-label')),
})))
const keypad = dialog => dialog.getByRole('group', { name: 'Keypad' })
async function keys(dialog, ...pressed) {
  for (const key of pressed) await keypad(dialog).getByRole('button', { name: key, exact: true }).click()
}
const titleOf = dialog => dialog.getByRole('heading').first().textContent().then(text => text.trim())
/** What has focus on a page: its name and, for a text field, what's in it. */
const focusOf = who => who.page.evaluate(() => {
  const el = document.activeElement
  return el === document.body ? { name: 'body' } : { name: el?.getAttribute('aria-label') ?? el?.textContent?.trim() ?? null, value: el?.value ?? null }
})
const panel = who => who.page.getByRole('tabpanel')
const tray = who => who.page.getByRole('region', { name: 'Your rolls' })
const WAITING = 'Waiting for your dice…'
/** The tray's latest roll as shown, each line of it. */
const trayLatest = who => tray(who).getByRole('status').first().evaluate(el => ({
  lines: [...el.querySelectorAll('p')].map(p => p.textContent.replace(/\s+/g, ' ').trim()),
}))
/** Until neither of Alice's pages shows the banner, as within a poll of an ask's close. */
const bannersGone = () => until(async () => await bannerOf(phone).count() === 0 && await bannerOf(desk).count() === 0, 'the banners to go', 15_000).catch(() => {})
/** How many dice answers each of Alice's pages posted. */
const answerCounts = () => [answersBy(phone).length, answersBy(desk).length]
const SPARKS_CHIP = 'Roll Wild Sparks: Burst, 1d6x'
/** Wait for room under the app's limit of 20 rolls a minute from a player. */
const lastMinute = () => Number(sql(`select count(*) from roll_request where "createdAt" > now() - interval '1 minute' and kind <> 'dice'`))
const paced = () => until(() => lastMinute() < 16, 'room under the rate limit', 70_000)
/** 3D dice, thrown as this many-sided die showing this face: the page's Math.random held. */
const force = (who, sides, value) => who.page.evaluate(([s, v]) => { globalThis.__random ??= Math.random; Math.random = () => (v - 0.5) / s }, [sides, value])
const unforce = who => who.page.evaluate(() => { if (globalThis.__random) Math.random = globalThis.__random })

/**
 * Thorin's Wild Sparks from a page of Alice's, its d6 typed: the formula's request once sent. With
 * `meanwhile`, called once the dialog is done, before the next look, as a focus moved.
 */
async function sparks(who, typed = '6') {
  await paced()
  const before = latestOf('formula', 'thorin')
  await who.tab('Spells')
  await panel(who).getByRole('button', { name: SPARKS_CHIP }).click()
  const dialog = entryOf(who)
  await dialog.waitFor({ timeout: 15_000 })
  await keys(dialog, typed)
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 5_000 })
  await until(() => latestOf('formula', 'thorin') !== before, 'the 1d6x to be sent', 15_000)
  return latestOf('formula', 'thorin')
}
/** A request once the game made it: its row and its card. */
async function madeOf(id, what) {
  await until(() => settledRow(rollRow(id)), `${what} to be made`, 30_000)
  return { row: rollRow(id), card: madeFor(id) }
}
/** The next ask the module made for a request, once the app keeps it too. */
async function nextAsk(command, count = 0) {
  await until(() => askedFor(command).length > count, 'the game to ask', 30_000)
  const ask = askedFor(command)[count]
  await until(() => askRows().some(row => row.askId === ask.id), 'the app to keep the ask', 15_000)
  return ask
}
/** No ask, dialog or banner on these pages for a moment. */
async function nothingShown(pages, ms = 4000) {
  const end = Date.now() + ms
  let seen = []
  while (Date.now() < end) {
    seen = []
    for (const who of pages) {
      if (await askOf(who).count() > 0) seen.push(`${who.width} dialog`)
      if (await bannerOf(who).count() > 0) seen.push(`${who.width} banner`)
    }
    if (seen.length) return seen
    await wait(250)
  }
  return seen
}

// =================================================================================================
// 1. The hello, and what the app keeps
// =================================================================================================
part('1. the hello')
{
  const rolls = hello().data.features.rolls
  const keys = Object.keys(rolls)
  const answered = JSON.parse(hello().body ?? '{}').features?.diceAsks
  if (ASKS) {
    check(rolls.diceAsks === true && rolls.diceAsksReason === null && same(keys.slice(keys.indexOf('keptRerolls')), ['keptRerolls', 'diceAsks', 'diceAsksReason'])
      && rolls.kinds.at(-1) === 'dice' && hello().data.features.companions.kinds.at(-1) === 'dice' && same(hello().data.diceAsks, []),
      `the hello says diceAsks true, diceAsksReason null, last after keptRerolls; "dice" last of the rolls' and companions' kinds; and no asks open (${JSON.stringify(keys.slice(-4))}, ${rolls.kinds.at(-1)})`)
    await until(() => rollFeatures().includes('diceAsks') && rollKinds().includes('dice'), 'the app to keep diceAsks', 15_000).catch(() => {})
    check(answered === 1 && rollFeatures().includes('diceAsks') && rollKinds().includes('dice'),
      `the app answers diceAsks: 1, and keeps diceAsks and the "dice" kind (${rollFeatures().join(',')})`)
  } else if (DND5E6) {
    check(rolls.diceAsks === false && rolls.diceAsksReason === 'system' && !rolls.kinds.includes('dice') && !hello().data.features.companions.kinds.includes('dice') && same(hello().data.diceAsks, []),
      `under dnd5e 6.0.5 the hello says later dice are off: diceAsks false, diceAsksReason "system", no "dice" kind, no asks (${JSON.stringify({ diceAsks: rolls.diceAsks, reason: rolls.diceAsksReason })})`)
    check(answered === 1 && !rollFeatures().includes('diceAsks') && !rollKinds().includes('dice'),
      `the app answers diceAsks: 1 all the same, and keeps neither diceAsks nor the "dice" kind (${rollFeatures().join(',')})`)
  } else {
    check(!('diceAsks' in rolls) && !('diceAsksReason' in rolls) && !rolls.kinds.includes('dice') && !('diceAsks' in hello().data) && rolls.keptRerolls === true,
      `module 0.42.0's hello says nothing of dice asks: no diceAsks nor diceAsksReason, no "dice" kind, no list (${JSON.stringify(keys)})`)
    check(answered === 1 && !rollFeatures().includes('diceAsks') && !rollKinds().includes('dice'),
      `the app answers diceAsks: 1 all the same, which module 0.42.0 ignores, and keeps neither diceAsks nor the "dice" kind (${rollFeatures().join(',')})`)
  }
}

// =================================================================================================
// 2. Alice types in her dice: turned on at 390, the wide page follows
// =================================================================================================
part('2. on')
const MANUAL = 'Enter dice results manually'
async function cog(who) {
  const dialog = who.page.getByRole('dialog', { name: 'Settings' })
  if (!(await dialog.isVisible())) {
    await who.page.getByRole('button', { name: 'Settings', exact: true }).click()
    await dialog.waitFor()
  }
  return { dialog, manual: dialog.getByRole('switch', { name: MANUAL, exact: true }) }
}
async function closeCog(who) {
  const dialog = who.page.getByRole('dialog', { name: 'Settings' })
  if (await dialog.isVisible()) {
    await who.page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
  }
}
{
  const { manual: deskSwitch } = await cog(desk)
  await deskSwitch.waitFor({ timeout: 15_000 })
  const { dialog, manual } = await cog(phone)
  await dialog.locator('label').filter({ hasText: MANUAL }).tap()
  await until(() => manual.isChecked(), 'the switch on', 5_000)
  await until(() => sql(`select "manualDice" from "character" where id = 'sheet-thorin'`) === 't', 'the choice stored', 10_000)
  await until(() => deskSwitch.isChecked(), 'the wide page to follow', 10_000)
  const { manual: bobSwitch } = await cog(bob)
  await bobSwitch.waitFor({ timeout: 15_000 })
  check(await manual.isChecked() && await deskSwitch.isChecked() && !(await bobSwitch.isChecked()),
    "Alice types in her dice: turned on at 390, her wide page follows; Bob's switch is there, off: he rolls with the app's 3D dice")
  for (const who of [phone, desk, bob]) await closeCog(who)
}

// =================================================================================================
// 3. An exploding die, typed: its die more asked, on the device the roll came from
// =================================================================================================
part('3. a typed die explodes')
let id
let ask
if (!ASKS) {
  faces.push(2)
  id = await sparks(phone)
  const { row, card } = await madeOf(id, 'the 1d6x')
  const shown = await nothingShown([phone, desk, bob, gm])
  check(row.status === 'done' && row.payload.typed === true && same(resultsOf(card?.rolls[0]), [6, 2]) && card.rolls[0].total === 8 && faces.length === 0,
    `typed 6, Wild Sparks' 1d6x explodes: its die more Foundry's, a 2, as before 0.44.0 (${card?.rolls[0].formula} = ${card?.rolls[0].total})`)
  check(same(asked(), []) && same(askRows(), []) && diceRequests() === 0 && same(shown, []),
    `nothing asked: no roll.dice.asked, no ask kept, no dice answer, and no dialog or banner on any page (${JSON.stringify(shown)})`)
} else {
  id = await sparks(phone)
  ask = await nextAsk(id)
  const dialog = askOf(phone)
  await dialog.waitFor({ timeout: 15_000 })
  check(ask.purpose === 'again' && ask.again === 'explode' && ask.actorId === 'thorin' && same(ask.rolls.map(roll => roll.terms), [[{ faces: 6, number: 1 }]]) && /^Wild Sparks/.test(ask.label)
    && Date.parse(ask.expiresAt) - Date.parse(ask.askedAt) === 60_000,
    `typed 6, Wild Sparks' 1d6x explodes: the game asks for its die more, purpose again, explode, one d6, "${ask.label}", for a minute`)
  const look = {
    title: await titleOf(dialog), groups: await groupsOf(dialog), note: await dialog.getByText(EXPLODED, { exact: true }).isVisible(),
    chip: await dialog.getByText('Manual Dice', { exact: true }).isVisible(), timer: (await dialog.getByRole('timer').textContent()).trim(),
    cancel: await dialog.getByRole('button', { name: 'Let the game roll', exact: true }).isVisible(),
  }
  check(look.title === ask.label && same(look.groups, [{ name: '1d6', boxes: ['d6'] }]) && look.note && look.chip && /^[01]:\d\d left to answer$/.test(look.timer) && look.cancel,
    `on the phone, which rolled it, its dialog opens by itself: "${look.title}", "${ASK_SUBTITLE}", "${EXPLODED}", one d6 box, "${look.timer}", Let the game roll (${JSON.stringify(look)})`)
  await bannerOf(desk).waitFor({ timeout: 15_000 })
  const rows = await bannerRows(desk)
  check(same(rows.map(row => row.slice(0, 2)), [[ask.label, '1d6']]) && /left$/.test(rows[0][2] ?? '') && await askOf(desk).count() === 0
    && await bannerOf(desk).getByRole('button', { name: `Type in 1d6 for ${ask.label}` }).isVisible()
    && await bannerOf(desk).getByRole('button', { name: `Let the game roll 1d6 for ${ask.label}` }).isVisible(),
    `on the wide page, which didn't, no dialog: the banner "The game asks for your dice", "${ask.label}", "1d6", the time left, Type in and Let the game roll (${JSON.stringify(rows)})`)
  await gmWindow().waitFor({ timeout: 10_000 })
  const waiting = (await gmWindow().textContent()).replace(/\s+/g, ' ').trim()
  check(waiting.includes(`Waiting for Thorin's player: ${ask.label}, 1d6`) && /left, then Foundry rolls them/.test(waiting) && await gmWindow().getByRole('button', { name: 'Roll it now' }).isVisible(),
    `the Gamemaster's Foundry shows the wait, "Waiting for Thorin's player: ${ask.label}, 1d6", the time left, and Roll it now ("${waiting}")`)
  const shown = await nothingShown([bob, gm], 1000)
  check(same(shown, []), `nothing on Bob's page for Vex, another player's, nor on the Gamemaster's page for Thorin (${JSON.stringify(shown)})`)
  await shootBoth(phone, 'laterdice-dialog', dialog)
  await shootBoth(desk, 'laterdice-banner', bannerOf(desk))
  if (process.env.SHOTS) await gmWindow().screenshot({ path: `${process.env.SHOTS}/laterdice-gm-window${MIDI ? '-midi' : ''}.png` })
  check(await sideways(phone.page) === 0 && await sideways(desk.page) === 0, 'no horizontal scroll at 390 nor at 1280')
  await keys(dialog, '2')
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  await dialog.waitFor({ state: 'hidden', timeout: 5_000 })
  const { row, card } = await madeOf(id, 'the 1d6x')
  await until(async () => (await bannerOf(desk).count()) === 0, 'the banner to go', 15_000).catch(() => {})
  check(row.status === 'done' && same(resultsOf(card?.rolls[0]), [6, 2]) && card.rolls[0].total === 8 && (await closedAs(ask.id)) === 'answered'
    && same(answersBy(phone).map(body => [body.diceAsk, body.answer]), [[ask.id, [{ roll: 0, term: 0, results: [2] }]]]) && same(answersBy(desk), []),
    `typed 2: the phone sends it, the ask answered, the card's dice 6 and 2, 8 (${card?.rolls[0].formula} = ${card?.rolls[0].total})`)
  check(await bannerOf(desk).count() === 0 && await gmWindow().count() === 0, "the wide page's banner gone within a poll, and the Gamemaster's window closed")
}

if (ASKS) {
  // ===============================================================================================
  // 4. Let the game roll: Foundry's die explodes again, never asked
  // ===============================================================================================
  part("4. a computer die's explosion")
  {
    id = await sparks(phone)
    ask = await nextAsk(id)
    const dialog = askOf(phone)
    await dialog.waitFor({ timeout: 15_000 })
    // Foundry's computer dice: a 6, which explodes, then a 1.
    faces.push(6, 1)
    await dialog.getByRole('button', { name: 'Let the game roll', exact: true }).click()
    await dialog.waitFor({ state: 'hidden', timeout: 5_000 })
    const { row, card } = await madeOf(id, 'the 1d6x')
    await wait(1000)
    check(row.status === 'done' && same(resultsOf(card?.rolls[0]), [6, 6, 1]) && card.rolls[0].total === 13 && faces.length === 0 && (await closedAs(ask.id)) === 'skipped'
      && askedFor(id).length === 1 && same(answersBy(phone).at(-1)?.answer, []),
      `Let the game roll: [] sent, the ask skipped; Foundry's computer 6 explodes into a 1, never asked: one ask for the roll, the card's dice 6, 6 and 1, 13 (${card?.rolls[0].formula} = ${card?.rolls[0].total})`)
  }

  // ===============================================================================================
  // 5. Rolled from the wide page: its dialog there, the banner on the phone, answered from the phone
  // ===============================================================================================
  part('5. from the wide page')
  {
    id = await sparks(desk)
    ask = await nextAsk(id)
    const dialog = askOf(desk)
    await dialog.waitFor({ timeout: 15_000 })
    await bannerOf(phone).waitFor({ timeout: 15_000 })
    check(await askOf(phone).count() === 0 && same((await bannerRows(phone)).map(row => row.slice(0, 2)), [[ask.label, '1d6']]),
      'rolled from the wide page: its dialog opens there by itself, and the phone, which didn\'t roll it, shows the banner, no dialog')
    await bannerOf(phone).getByRole('button', { name: `Type in 1d6 for ${ask.label}` }).click()
    const typing = askOf(phone)
    await typing.waitFor({ timeout: 10_000 })
    await keys(typing, '4')
    const fromDesk = answersBy(desk).length
    await typing.getByRole('button', { name: 'Done', exact: true }).click()
    await typing.waitFor({ state: 'hidden', timeout: 5_000 })
    await dialog.waitFor({ state: 'hidden', timeout: 15_000 })
    const { row, card } = await madeOf(id, 'the 1d6x')
    await wait(1000)
    check(row.status === 'done' && same(resultsOf(card?.rolls[0]), [6, 4]) && (await closedAs(ask.id)) === 'answered' && answersBy(desk).length === fromDesk
      && same(answersBy(phone).at(-1)?.answer, [{ roll: 0, term: 0, results: [4] }]),
      `Type in on the phone's banner opens its dialog; typed 4 there, the ask answered, and the wide page's dialog closes by itself, sending nothing: the card's 6 and 4 (${card?.rolls[0].total})`)
  }

  // ===============================================================================================
  // 6. A text field focused there as the ask comes: no dialog, the banner; focus and words kept
  // ===============================================================================================
  part('6. typing in a text field')
  {
    // The game held a moment, so that the ask comes once the search field is focused.
    await stopFetching()
    id = await sparks(desk)
    const search = panel(desk).getByRole('searchbox', { name: 'Search spells by name' })
    await search.click()
    await desk.page.keyboard.type('spa')
    startFetching()
    ask = await nextAsk(id)
    await bannerOf(desk).waitFor({ timeout: 15_000 })
    await wait(1500)
    const focus = await focusOf(desk)
    check(await askOf(desk).count() === 0 && same(focus, { name: 'Search spells by name', value: 'spa' }) && same((await bannerRows(desk)).map(row => row.slice(0, 2)), [[ask.label, '1d6']]),
      `rolled from the wide page while Spells' search field had focus as the ask came: no dialog there, but the banner, focus and "spa" kept in the field (${JSON.stringify(focus)})`)
    await bannerOf(phone).waitFor({ timeout: 15_000 })
    check(await askOf(phone).count() === 0, 'and on the phone, the banner too')
    await bannerOf(desk).getByRole('button', { name: `Type in 1d6 for ${ask.label}` }).click()
    const dialog = askOf(desk)
    await dialog.waitFor({ timeout: 10_000 })
    await keys(dialog, '5')
    await dialog.getByRole('button', { name: 'Done', exact: true }).click()
    await dialog.waitFor({ state: 'hidden', timeout: 5_000 })
    const { row, card } = await madeOf(id, 'the 1d6x')
    check(row.status === 'done' && same(resultsOf(card?.rolls[0]), [6, 5]) && (await closedAs(ask.id)) === 'answered' && await search.inputValue() === 'spa',
      `Type in from the wide page's banner, typed 5: the card's 6 and 5, and the search field still says "spa" (${card?.rolls[0].total})`)
    await search.fill('')
  }

  // ===============================================================================================
  // 7. The Gamemaster's Roll it now
  // ===============================================================================================
  part('7. roll it now')
  {
    id = await sparks(phone)
    ask = await nextAsk(id)
    const dialog = askOf(phone)
    await dialog.waitFor({ timeout: 15_000 })
    await gmWindow().waitFor({ timeout: 10_000 })
    const answers = diceRequests()
    const posted = answerCounts()
    faces.push(3)
    await gmWindow().getByRole('button', { name: 'Roll it now' }).click()
    await dialog.waitFor({ state: 'hidden', timeout: 15_000 })
    const { row, card } = await madeOf(id, 'the 1d6x')
    await wait(1000)
    await bannersGone()
    check(row.status === 'done' && same(resultsOf(card?.rolls[0]), [6, 3]) && faces.length === 0 && (await closedAs(ask.id)) === 'rolled' && diceRequests() === answers
      && same(answerCounts(), posted) && await gmWindow().count() === 0 && await bannerOf(desk).count() === 0 && await bannerOf(phone).count() === 0,
      `the Gamemaster chooses Roll it now in Foundry: the ask closes "rolled", the phone's dialog closes by itself, nothing sent from either page, and Foundry's die is a 3: the card's 6 and 3, the wide page's banner gone within a poll (${card?.rolls[0].total}; answers posted ${JSON.stringify(answerCounts())})`)
  }

  // ===============================================================================================
  // 8. Its die more typed 6 at 40 s: asked again, one die at a time; then a minute, Foundry's die,
  //    and the roll held past its own minute, never timed out
  // ===============================================================================================
  part('8. again, then a minute')
  {
    id = await sparks(phone)
    const sent = Date.now()
    // What the phone hears of the roll as it follows it, each look's time since it was sent.
    const views = []
    const heard = async response => {
      if (response.request().method() !== 'GET' || !response.url().endsWith(`/rolls/${id}`)) return
      const view = await response.json().catch(() => null)
      views.push({ at: Date.now() - sent, status: view?.status ?? null, diceAsked: view?.diceAsked === true })
    }
    phone.page.on('response', heard)
    const first = await nextAsk(id)
    let dialog = askOf(phone)
    await dialog.waitFor({ timeout: 15_000 })
    // 40 s into the roll's own minute, the first ask still open: the tray still waits for the dice.
    await wait(Math.max(0, sent + 40_000 - Date.now()))
    const held = await trayLatest(phone)
    check(await dialog.isVisible() && held.lines[0] === 'Wild Sparks: Burst' && held.lines.includes(WAITING) && rollRow(id)?.status === 'claimed',
      `40 s on, the phone's dialog still open, its tray's latest, Wild Sparks: Burst, says "${WAITING}", the roll still being made (${JSON.stringify(held.lines)})`)
    await keys(dialog, '6')
    await dialog.getByRole('button', { name: 'Done', exact: true }).click()
    await dialog.waitFor({ state: 'hidden', timeout: 5_000 })
    ask = await nextAsk(id, 1)
    dialog = askOf(phone)
    await dialog.waitFor({ timeout: 15_000 })
    check(ask.purpose === 'again' && ask.again === 'explode' && ask.id !== first.id && same(ask.rolls.map(roll => roll.terms), [[{ faces: 6, number: 1 }]]) && (await closedAs(first.id)) === 'answered'
      && same(answersBy(phone).at(-1)?.answer, [{ roll: 0, term: 0, results: [6] }]) && await dialog.getByText(EXPLODED, { exact: true }).isVisible() && await askOf(desk).count() === 0,
      `typed 6 at 40 s, the die more explodes again: the game asks again, for one more d6, its own dialog by itself on the phone again, "${EXPLODED}"`)
    // Left alone: Foundry's computer dice, past the roll's own minute.
    const answers = diceRequests()
    const posted = answerCounts()
    faces.push(4)
    const timer = (await dialog.getByRole('timer').textContent()).trim()
    const opened = Date.now()
    await dialog.waitFor({ state: 'hidden', timeout: 75_000 })
    const after = (Date.now() - opened) / 1000
    const { row, card } = await madeOf(id, 'the 1d6x')
    await until(() => askRows().find(r => r.askId === ask.id)?.closedReason === 'expired', 'the app to close the ask', 10_000).catch(() => {})
    const kept = askRows().find(r => r.askId === ask.id)
    // Gone from both pages within a poll, before anything else is rolled.
    await bannersGone()
    check(/^[01]:\d\d left to answer$/.test(timer) && after > 45 && (await closedAs(ask.id)) === 'expired' && kept?.closedReason === 'expired'
      && Date.parse(kept.closedAt) >= Date.parse(kept.expiresAt) - 2000 && diceRequests() === answers && same(answerCounts(), posted)
      && await gmWindow().count() === 0 && await bannerOf(phone).count() === 0 && await bannerOf(desk).count() === 0,
      `left alone, the dialog counts down ("${timer}") and closes by itself ${after.toFixed(0)} s later, sending nothing from either page; the ask expired at its minute, the Gamemaster's window closed, and no banner left on either page (answers posted ${JSON.stringify(answerCounts())})`)
    phone.page.off('response', heard)
    const results = postsOf('command.result').filter(p => p.data?.id === id).map(p => p.data.status)
    const late = views.filter(view => view.at > 80_000)
    const took = (Date.now() - sent) / 1000
    check(row.status === 'done' && same(resultsOf(card?.rolls[0]), [6, 6, 4]) && card.rolls[0].total === 16 && faces.length === 0 && took > 90
      && same(results, ['done']) && views.length > 0 && !views.some(view => ['failed', 'lost', 'expired'].includes(view.status)) && late.some(view => view.status === 'rolling' && view.diceAsked),
      `and Foundry's computer die rolled it, a 4: the card's 6, 6 and 4, 16, made ${took.toFixed(0)} s after it was sent, never timed out: the module's one result for it "done", and the app's view of it "rolling", waiting for the dice, past its 75 s (${JSON.stringify({ results, late: late.slice(0, 2), views: views.length })})`)
  }
}

// =================================================================================================
// 9. Nothing asked for a 3D player, nor the Gamemaster's own roll
// =================================================================================================
part('9. 3d dice and the gamemaster')
{
  const asks = asked().length
  const kept = askRows().length
  // Bob's Vex, with the app's 3D dice: a 6, which explodes on Foundry's computer dice into a 2.
  await paced()
  await bob.tab('Spells')
  const before = latestOf('formula', 'vex')
  await force(bob, 6, 6)
  faces.push(2)
  await panel(bob).getByRole('button', { name: SPARKS_CHIP }).click()
  await until(() => latestOf('formula', 'vex') !== before, "Bob's Wild Sparks to be sent", 20_000)
  await unforce(bob)
  const bobId = latestOf('formula', 'vex')
  let { row, card } = await madeOf(bobId, "Bob's 1d6x")
  let shown = await nothingShown([phone, desk, bob, gm])
  check(row.status === 'done' && !('typed' in row.payload) && same(resultsOf(card?.rolls[0]), [6, 2]) && faces.length === 0 && asked().length === asks && askRows().length === kept && same(shown, []),
    `Bob rolls Vex's Wild Sparks with the app's 3D dice, untyped: a 6, exploding on Foundry's computer dice into a 2, nothing asked of anyone, nothing shown on any page (${JSON.stringify(shown)})`)
  // The Gamemaster's own roll of Thorin's, from their page: thrown there, by the Gamemaster.
  await paced()
  await gm.tab('Spells')
  const gmBefore = sql(`select coalesce((select id from roll_request where kind = 'formula' and role = 'gm' order by "createdAt" desc limit 1), '')`)
  await force(gm, 6, 6)
  faces.push(1)
  await panel(gm).getByRole('button', { name: SPARKS_CHIP }).click()
  const gmLatest = () => sql(`select coalesce((select id from roll_request where kind = 'formula' and role = 'gm' order by "createdAt" desc limit 1), '')`)
  await until(() => gmLatest() !== gmBefore, "the Gamemaster's Wild Sparks to be sent", 20_000)
  await unforce(gm)
  ;({ row, card } = await madeOf(gmLatest(), "the Gamemaster's 1d6x"))
  shown = await nothingShown([phone, desk, bob, gm])
  check(row.status === 'done' && row.role === 'gm' && row.actorId === 'thorin' && !('typed' in row.payload) && same(resultsOf(card?.rolls[0]), [6, 1]) && faces.length === 0
    && asked().length === asks && askRows().length === kept && same(shown, []),
    `the Gamemaster's own roll of Thorin's Wild Sparks from their page, a 6 exploding on Foundry's computer dice into a 1: nothing asked of Alice or anyone, nothing shown (${JSON.stringify(shown)})`)
}

// =================================================================================================
// 10. Midi-QOL: Ice Knife's Shard Explosion, and a Sneak Attack bonus damage macro
// =================================================================================================
if (MIDI) {
  part('10. midi-qol')
  const attackFrom = async (who, item, d20) => {
    await paced()
    await who.tab('Actions')
    const before = latestOf('attack', 'thorin')
    await panel(who).getByRole('button', { name: new RegExp(`^${item} attack`) }).first().click()
    const picker = who.page.getByRole('dialog', { name: new RegExp(`^${item}`) })
    await picker.waitFor({ timeout: 10_000 })
    await picker.getByRole('button', { name: /^Goblin/ }).click()
    const dialog = entryOf(who)
    await dialog.waitFor({ timeout: 15_000 })
    await keys(dialog, ...String(d20).split(''))
    await dialog.getByRole('button', { name: 'Done', exact: true }).click()
    await dialog.waitFor({ state: 'hidden', timeout: 5_000 })
    await until(() => latestOf('attack', 'thorin') !== before, `the ${item} attack to be sent`, 15_000)
    const attack = latestOf('attack', 'thorin')
    await madeOf(attack, `the ${item} attack`)
    return attack
  }
  const damageFrom = async (who, typed) => {
    const before = latestOf('damage', 'thorin')
    const button = tray(who).getByRole('button', { name: 'Roll damage' })
    await button.waitFor({ timeout: 30_000 })
    await button.click()
    const dialog = entryOf(who)
    await dialog.waitFor({ timeout: 15_000 })
    const groups = await groupsOf(dialog)
    await keys(dialog, ...typed)
    await dialog.getByRole('button', { name: 'Done', exact: true }).click()
    await dialog.waitFor({ state: 'hidden', timeout: 5_000 })
    await until(() => latestOf('damage', 'thorin') !== before, 'the damage to be sent', 15_000)
    return { id: latestOf('damage', 'thorin'), groups }
  }
  {
    // Ice Knife from the phone: its d20 and 1d10 typed; Shard Explosion's 2d6 cold asked within the damage.
    const attack = await attackFrom(phone, 'Ice Knife', 15)
    const damage = await damageFrom(phone, ['7'])
    ask = await nextAsk(damage.id)
    const dialog = askOf(phone)
    await dialog.waitFor({ timeout: 15_000 })
    const look = { title: await titleOf(dialog), groups: await groupsOf(dialog) }
    check(same(damage.groups, [{ name: '1d10 Piercing', boxes: ['d10'] }]) && ask.purpose === 'damage' && ask.label === 'Ice Knife: Shard Explosion' && ask.critical === false
      && same(ask.rolls.map(roll => [roll.type, roll.terms]), [['cold', [{ faces: 6, number: 2 }]]]) && askedFor(attack).length === 0,
      `Ice Knife's attack typed and hit, its 1d10 typed 7: within the damage the game asks for Shard Explosion's 2d6 cold, purpose damage, "Ice Knife: Shard Explosion" (${JSON.stringify(ask.rolls)})`)
    await bannerOf(desk).waitFor({ timeout: 15_000 })
    check(look.title === 'Ice Knife: Shard Explosion' && same(look.groups, [{ name: '2d6 Cold', boxes: ['d6 1 of 2', 'd6 2 of 2'] }])
      && same((await bannerRows(desk)).map(row => row.slice(0, 2)), [['Ice Knife: Shard Explosion', '2d6 Cold']]) && await askOf(desk).count() === 0,
      `its dialog opens by itself on the phone, "Ice Knife: Shard Explosion", "2d6 Cold", two boxes; the wide page's banner says "Ice Knife: Shard Explosion", "2d6 Cold" (${JSON.stringify(look)})`)
    await gmWindow().waitFor({ timeout: 10_000 })
    check((await gmWindow().textContent()).includes("Waiting for Thorin's player: Ice Knife: Shard Explosion, 2d6 Cold"), "the Gamemaster's window: \"Waiting for Thorin's player: Ice Knife: Shard Explosion, 2d6 Cold\"")
    await shootBoth(phone, 'laterdice-ice-knife', dialog)
    await keys(dialog, '3', '5')
    await dialog.getByRole('button', { name: 'Done', exact: true }).click()
    await dialog.waitFor({ state: 'hidden', timeout: 5_000 })
    const { row } = await madeOf(damage.id, "Ice Knife's damage")
    const workflow = workflowOf(attack)
    await until(() => workflow?.otherDamageRolls?.length, 'the other damage', 10_000).catch(() => {})
    check(row.status === 'done' && same(resultsOf(workflow?.damageRolls?.[0]), [7]) && same(resultsOf(workflow?.otherDamageRolls?.[0]), [3, 5]) && workflow.otherDamageRolls[0].total === 8
      && (await closedAs(ask.id)) === 'answered',
      `typed 3 and 5: Midi-QOL's damage the typed 7, and its other damage, Shard Explosion's, the typed 3 and 5, 8 (${workflow?.otherDamageRolls?.[0]?.formula} = ${workflow?.otherDamageRolls?.[0]?.total})`)
  }
  {
    // The dagger from the wide page, with a Sneak Attack bonus damage macro: its 2d6 asked there.
    W.midi.bonusDamage = [{ formula: '2d6', type: 'piercing', flavor: 'Sneak Attack' }]
    const attack = await attackFrom(desk, 'Dagger', 16)
    const damage = await damageFrom(desk, ['3'])
    ask = await nextAsk(damage.id)
    const dialog = askOf(desk)
    await dialog.waitFor({ timeout: 15_000 })
    const look = { title: await titleOf(dialog), groups: await groupsOf(dialog) }
    await bannerOf(phone).waitFor({ timeout: 15_000 })
    check(ask.purpose === 'bonus' && same(ask.rolls.map(roll => [roll.type, roll.flavor, roll.terms]), [['piercing', 'Sneak Attack', [{ faces: 6, number: 2 }]]])
      && look.title === ask.label && same(look.groups, [{ name: '2d6 Piercing', boxes: ['d6 1 of 2', 'd6 2 of 2'] }]) && await askOf(phone).count() === 0,
      `the dagger's 1d4 typed 3, and Midi's Sneak Attack bonus damage macro: its 2d6 piercing asked, purpose bonus, "${ask.label}", its dialog by itself on the wide page, "2d6 Piercing", the phone's banner (${JSON.stringify(look)})`)
    await shootBoth(desk, 'laterdice-bonus', dialog)
    await keys(dialog, '4', '4')
    await dialog.getByRole('button', { name: 'Done', exact: true }).click()
    await dialog.waitFor({ state: 'hidden', timeout: 5_000 })
    const { row } = await madeOf(damage.id, "the dagger's damage")
    const workflow = workflowOf(attack)
    await until(() => workflow?.bonusDamageRolls?.length, 'the bonus damage', 10_000).catch(() => {})
    W.midi.bonusDamage = null
    check(row.status === 'done' && same(resultsOf(workflow?.bonusDamageRolls?.[0]), [4, 4]) && (await closedAs(ask.id)) === 'answered',
      `typed 4 and 4: Midi-QOL's bonus damage is the typed 4 and 4 (${workflow?.bonusDamageRolls?.[0]?.formula} = ${workflow?.bonusDamageRolls?.[0]?.total}; ${JSON.stringify([row.status, resultsOf(workflow?.bonusDamageRolls?.[0]), await closedAs(ask.id)])})`)
  }
}

const settledAll = async () => await bannerOf(phone).count() === 0 && await bannerOf(desk).count() === 0 && askRows().every(row => row.closedAt)
await until(settledAll, 'every ask closed and every banner gone', 15_000).catch(() => {})
check(await settledAll(), `in the end, no ask open and no banner, within a poll (${JSON.stringify(askRows().filter(row => !row.closedAt).map(row => row.data.label))})`)
await finish()
