// Players typing in what their own dice show (module 0.32.0 and the app, its contract §9.2), end to end,
// in the world of world-030.mjs, with dnd5e 5.3.3's real dice classes or, with DND5E6=1, 6.0.5's. Alice
// plays Thorin, his assigned Character in Foundry, with the Trusted role, which Make Manual Rolls is
// given to by default; Bob plays Vex with the Player role, which it isn't. The campaign rolls, attacks
// and asks in the app and allows players to enter their dice results, and Manual Dice is on: the hello
// says Thorin's player may and Vex's may not, so Thorin's cog has the switch, Vex's and the
// Gamemaster's page's don't. Turned on at 390, a 768 page follows. Then every roll Thorin makes with
// his own dice asks for them, a box each, typed on the dialog's keypad: a Perception check (no dice
// thrown, the toast at once, `typed: true` on the request and the keyboard badge on Foundry's card);
// advantage and disadvantage from the menu, and from Modify Roll, the first box focused once it closes;
// Elven Accuracy's third d20 on the rapier (a finesse weapon, Dexterity over Strength), two on the
// greataxe; Modify Roll's +1d4 its own box, and Bless's d4 Foundry's; the rapier's damage after a hit,
// a typed natural 20 asking for the game's doubled 2d8, its card 2d8 + 3 (under Midi-QOL's "Double
// Rolled Damage" for the Gamemaster too), more dice and another die changing the boxes, maximum asking
// for none; Fireball at two foes, its damage offered and waiting for a tap, eight boxes, the tap made
// from the Combat tab at 390 and at 768, the dialog over the page and not in the hidden sheet; hit
// dice, a d10's 0 typed as 10, and three of two sizes at once; Light's 1d4, a description's 1d100 typed
// 00 and its damage as a critical, and its save link; a death save and initiative; a save the game asks
// for, its time left shown. A d6 typed 7 says what a d6 shows, Done with a box empty says to type every
// die; Escape cancels, posting nothing, the damage still offered; with Send to the table off, nothing
// posted. Make Manual Rolls taken away, the switch goes within a poll and the next roll is thrown and
// sent untyped, the choice kept; given back, it's on again. The dialog at 360×640, 390×844, 768×1024,
// 1280×800 and 844×390 in both themes, and with 40 boxes at 390×844 and 844×390, scrolled, the keypad
// and Done kept flush in view. Since module 0.33.0's feedback: no "Next die" on a single die's keypad
// nor on the last box, back again on an earlier one; Enter on it, from the keyboard at 1280, focusing
// the last box; and the keypad a row shorter with no gap at 390×844 (two dice, and 40 that scroll), the
// compact one the same height with Delete four keys wide at 844×390. The Gamemaster's page throws its dice. MIDI=1: Midi-QOL's prompt, its
// 5 s shown and closing the dialog by itself, and a prompt rolled in Foundry closing it; the rapier's
// attack through Midi's workflow takes the three typed d20s. DND5E6=1: the check, Elven Accuracy,
// damage (Modify damage and Maximum offered, as under 5.3.3), the use's damage and hit dice under dnd5e
// 6.0.5's dice. SKEW=031 with MODULE=module-0.31.0: no switch for anyone, two d20s thrown for Elven
// Accuracy, and a crafted `typed` taken (202) and stripped. Synthetic characters only. Run with
// --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import {
  BOB, DND5E6, MIDI, MODULE, SHOTS, SHOTS_033, SKEW031, VARIANT, W, actors, browse, call, character, check, faces, finish, foundryWorld,
  launch, manualDice, midiCritical, newCampaign, note, npc, part, posted, postsOf, same, setPermissions, settings, settled, shoot,
  sideways, sql, startModule, theme, until, wait,
} from './world-030.mjs'
import { combat, combatant, user } from './fvtt/stub.mjs'

const GAME = 'https://dice-hollow.forge-vtt.com'
const SECRET = 'dice-hollow-typed-32'
const TITLE = 'Dice Hollow'
const NEW = !SKEW031
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: TITLE, address: 'dice-hollow.forge-vtt.com', secret: SECRET })
await foundryWorld({ dice6: DND5E6 })
manualDice('active')
// Thorin's player is Trusted, whom Make Manual Rolls is given to out of the box; Vex's a Player.
game.users.get('alice').role = 2
game.users.get('bob').role = 1

// ---- The world ----
const capital = text => text.charAt(0).toUpperCase() + text.slice(1)
const hits = (formula, type) => ({ formula, damageType: type, label: `${formula} ${capital(type)}` })
// dnd5e 5.3.3's enriched links, as fvtt/texts.mjs and links-e2e.mjs have them: an inline roll, a
// damage link and a save link.
const ICON = '<i class="fa-solid fa-dice-d20" inert=""></i>'
const wrap = html => `<enriched-content data-enricher-id="dnd5e-enricher">${html}</enriched-content>`
const INLINE_ROLL = formula => `<a class="inline-roll roll" data-mode="roll" data-flavor="" data-formula="${formula}"><i class="fas fa-dice-d20"></i>${formula}</a>`
const DAMAGE_LINK = (formula, type, label) => `<a class="roll-link-group" data-action="roll" data-type="damage" data-formulas="${formula}" data-damage-types="${type}" data-roll-type="damage"><span class="roll-link">${ICON}${formula}</span> ${label}</a>`
const SAVE_LINK = (ability, dc, label) => `<span class="roll-link-group" data-type="save" data-ability="${ability}" data-dc="${dc}"><a class="roll-link" data-action="roll">${ICON}${label}</a></span>`
const JOURNAL = `<p>The page burns: roll ${INLINE_ROLL('1d100')} on the table, take ${wrap(DAMAGE_LINK('2d6', 'fire', 'Fire'))} damage, or make a ${SAVE_LINK('dex', 13, 'DC 13 Dexterity')} saving throw.</p>`
const spell = (id, name, level, activity, system = {}) => ({
  id, name, type: 'spell', system: { level, method: 'spell', prepared: 1, canPrepare: true, properties: [], duration: { units: 'inst' }, ...system }, activities: [activity],
})
// Thorin, an elf with Elven Accuracy: Dexterity +3 over Strength +1, Wisdom +2; a ranger and a
// cleric, three d10 hit dice and one d8; hurt.
const thorin = character({
  id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 1, dex: 3, con: 2, wis: 2 }, flags: { elvenAccuracy: true },
  skills: { prc: { ability: 'wis' } }, hp: { value: 20, max: 40, temp: 0 },
  classes: [{ identifier: 'ranger', denomination: 'd10', levels: 3 }, { identifier: 'cleric', denomination: 'd8', levels: 1 }],
}, {
  ac: 15,
  spells: {
    spell1: { value: 2, max: 2, level: 1 }, spell2: { value: 2, max: 2, level: 2 }, spell3: { value: 2, max: 2, level: 3 },
    ...Object.fromEntries([4, 5, 6, 7, 8, 9].map(level => [`spell${level}`, { value: 0, max: 0, level }])),
  },
  items: [
    // dnd5e's attack ability "" (attack-data.mjs:51-63): a finesse weapon's best of Strength and
    // Dexterity, his Dexterity, which Elven Accuracy is for. Blessed: the game adds a d4 of its own
    // to its attacks, as Bless adds one (the stand-in's magic bonus, a part of the attack's formula).
    {
      id: 'rapier', name: 'Rapier', type: 'weapon', system: { properties: ['fin'], quantity: 1, attackType: 'melee', equipped: true },
      activities: [{ id: 'lunge', attack: { ability: '' }, magic: '1d4', damage: [{ number: 1, denomination: 8, bonus: '@mod', types: ['piercing'] }], labels: { modifier: '+6', damage: [hits('1d8 + 3', 'piercing')] } }],
    },
    // Strength's, so no Elven Accuracy.
    {
      id: 'greataxe', name: 'Greataxe', type: 'weapon', system: { properties: ['hvy', 'two'], quantity: 1, attackType: 'melee', equipped: true },
      activities: [{ id: 'cleave', attack: { ability: 'str' }, damage: [{ number: 1, denomination: 12, bonus: '@mod', types: ['slashing'] }], labels: { modifier: '+4', damage: [hits('1d12 + 1', 'slashing')] } }],
    },
    // A falling star's 20d6, whose critical hit's 40 dice fill the dialog.
    {
      id: 'starfall', name: 'Starfall', type: 'feat', system: { properties: [] },
      activities: [{ id: 'fall', damage: [{ number: 20, denomination: 6, types: ['fire'] }], labels: { modifier: '+6', damage: [hits('20d6', 'fire')] } }],
    },
    spell('fireball', 'Fireball', 3, {
      id: 'blast', type: 'save', template: 'sphere', affects: 'creature', save: ['dex'], dc: 15,
      damage: [{ number: 8, denomination: 6, types: ['fire'], scaling: 1 }], labels: { damage: [hits('8d6', 'fire')] },
    }),
    // Light, whose glow rolls a formula of its own.
    spell('light', 'Light', 0, { id: 'glow', type: 'utility', affects: '', formula: '1d4', rollName: 'Glow' }),
    { id: 'journal', name: 'Burning Journal', type: 'equipment', system: { quantity: 1, equipped: false, description: { value: JOURNAL } } },
  ],
})
thorin.system.details = { level: 4 }
thorin.system.attributes.spellcasting = 'wis'
thorin.system.attributes.spell = { dc: 13, attack: 5, mod: 2 }
Object.assign(thorin.system.skills.prc, { total: 5, passive: 15 })
thorin.system.attributes.init.total = 3
// dnd5e 5.3.3 and 6.0.5 give Elven Accuracy to attacks alone (attack.mjs:97-98, d20-roll.mjs:53):
// the stand-in's skill and tool checks pass the flag on as well, so they're told it isn't theirs.
for (const method of ['rollSkill', 'rollToolCheck']) {
  const roll = thorin[method].bind(thorin)
  thorin[method] = (config = {}, ...rest) => roll({ elvenAccuracy: false, ...config }, ...rest)
}
// His classes, as dnd5e lists them among his items' types, for his hit dice.
{
  const types = Object.getOwnPropertyDescriptor(thorin, 'itemTypes').get
  Object.defineProperty(thorin, 'itemTypes', { configurable: true, get: () => ({ ...types.call(thorin), class: thorin._classes }) })
  for (const cls of thorin._classes) {
    const update = cls.update?.bind(cls)
    if (update) cls.update = async changes => { await update(changes); await Hooks.callAll('updateActor', thorin, {}, {}, 'gm') }
  }
}
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { wis: 3 }, hp: { value: 24, max: 30, temp: 0 } }, { ac: 14, items: [] })
vex.system.details = { level: 4 }
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
const goblin = npc('goblin', 'Goblin', 12)
const ogre = npc('ogre', 'Ogre', 11)
// The tokens on the Gamemaster's canvas, and a fight.
const tokenOf = {}
for (const actor of [thorin, vex, goblin, ogre]) {
  const token = { id: `tok-${actor.id}`, name: actor.name, uuid: `Scene.scene.Token.tok-${actor.id}`, actor, hidden: false, isLinked: true, disposition: actor.type === 'npc' ? -1 : 1 }
  const placeable = { id: token.id, name: actor.name, document: token, actor }
  token.object = placeable
  W.placeables.set(token.id, placeable)
  actor.speakerToken = placeable
  tokenOf[actor.id] = token
}
if (MIDI) canvas.scene.tokens.size = W.placeables.size
W.gm.targets = new Set()
Object.defineProperty(actors, 'party', { get: () => null, configurable: true })
let midiSaves = null
if (MIDI) {
  const saves = await import('./fvtt/midi-saves.mjs')
  saves.installMidiSaves({ actorClasses: [W.Actor5e], concentrationClass: W.cards.Character })
  midiSaves = saves
  Object.assign(W.midi.settings, { autoCheckSaves: 'all', requiresTargets: 'none', gmAutoFastForward: ['save'] })
}
await startModule({
  campaigns: [{ id: 'camp-dice', title: TITLE, characters: ['thorin', 'vex'], groups: [], rolls: true, attacks: true, prompts: true, manualDice: true }],
  secrets: { 'camp-dice': SECRET },
  midiCritical: { gm: 'doubleDice', player: 'default' },
})
await settled()
const fight = combat('fight')
combatant(fight, 'cbGoblin', goblin, { name: 'Goblin', initiative: 18, token: tokenOf.goblin })
const thorinTurn = combatant(fight, 'cbThorin', thorin, { initiative: null, token: tokenOf.thorin })
combatant(fight, 'cbOgre', ogre, { name: 'Ogre', initiative: 6, token: tokenOf.ogre })
fight.getCombatantsByActor = actor => fight.combatants.filter(cb => cb.actor?.id === actor.id)
const { rollCombatInitiative } = await import('./fvtt/actor5e.mjs')
fight.rollInitiative = rollCombatInitiative
fight.started = true
fight.round = 1
Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight'), configurable: true })
await Hooks.callAll('createCombat', fight)
await until(() => sql('select count(*) from combat') === '1', 'the app to hear of the fight', 15_000)

// ---- What's posted, kept and made ----
const hello = () => postsOf('bridge.hello').at(-1)
const requests = () => Number(sql('select count(*) from roll_request'))
const rollRow = id => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, payload, result from roll_request ${id ? `where id = '${id}'` : 'order by "createdAt" desc limit 1'}) r`) || 'null')
const settledRow = row => ['done', 'failed'].includes(row?.status)
/** The message a request made: by the module's flag, or else by the id its result names. */
const madeFor = id => W.messages.contents.find(m => m.flags?.['sending-stone']?.request === id)
  ?? W.messages.get(rollRow(id)?.result?.messageId ?? '')
const madeAllFor = id => W.messages.contents.filter(m => m.flags?.['sending-stone']?.request === id)
const d20sOf = roll => roll?.dice?.[0]?.results.map(r => r.result)
const roster = () => JSON.parse(sql(`select characters::text from campaign where id = '${A}'`)).map(c => [c.id, c.manualDice])
const stored = () => sql(`select "manualDice" from "character" where id = 'sheet-thorin'`)

part('1. the gate')
check(same(hello().data.characters.map(c => [c.id, c.manualDice]), NEW ? [['thorin', true], ['vex', false]] : [['thorin', false], ['vex', false]])
  && hello().data.features.rolls.manualDice === true,
  `the hello says ${NEW ? "Thorin's player may enter his dice results, Vex's may not" : 'no one may, as module 0.31.0 says of everyone'} (${JSON.stringify(hello().data.characters.map(c => [c.id, c.manualDice]))})`)
await until(() => same(roster(), NEW ? [['thorin', true], ['vex', false]] : [['thorin', false], ['vex', false]]), 'the roster as the hello says', 15_000)

// ---- Alice plays Thorin; Bob, Vex ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const alice = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin' })
await alice.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const bob = await browse({ width: 390, height: 844, scheme: 'dark', who: BOB })
await bob.page.goto(invite)
await bob.page.getByRole('radio', { name: /^Vex/ }).check()
await bob.page.getByRole('button', { name: 'Join as this character' }).click()
await bob.page.waitForURL(/\/characters\/[\w-]+$/)
await bob.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })

const MANUAL = 'Enter dice results manually'
const HINT = 'Type in what your own dice show, instead of rolling here.'
/** The page's cog, opened: its manual dice switch, if any. */
async function cog(who) {
  const dialog = who.page.getByRole('dialog', { name: 'Settings' })
  if (!(await dialog.isVisible())) {
    await who.page.getByRole('button', { name: 'Settings', exact: true }).click()
    await dialog.waitFor()
  }
  return { dialog, manual: dialog.getByRole('switch', { name: MANUAL, exact: true }) }
}
const closeCog = async who => {
  const dialog = who.page.getByRole('dialog', { name: 'Settings' })
  if (await dialog.isVisible()) {
    await who.page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
  }
}
// The posts each page makes of its rolls, as sent.
const sentBy = new Map()
const watchPosts = who => {
  sentBy.set(who, [])
  who.page.on('request', request => {
    if (request.method() === 'POST' && /\/rolls$/.test(request.url())) sentBy.get(who).push(request.postDataJSON())
  })
  who.page.on('response', async response => {
    if (response.request().method() === 'POST' && /\/rolls$/.test(response.url()) && response.status() !== 202) note(`refused: ${response.status()} ${await response.text().catch(() => '')}`)
  })
}
watchPosts(alice)

{
  const { manual: aliceSwitch } = await cog(alice)
  const { manual: bobSwitch } = await cog(bob)
  if (NEW) await aliceSwitch.waitFor({ timeout: 15_000 })
  check((await aliceSwitch.count()) === (NEW ? 1 : 0) && (await bobSwitch.count()) === 0,
    NEW ? "Thorin's cog has the switch, and Vex's, whose player may not, doesn't" : "with module 0.31.0, neither Thorin's cog nor Vex's has it")
  await closeCog(bob)
}
const gmPage = await browse({ width: 390, height: 844, path: `/campaigns/${A}/characters/thorin` })
await gmPage.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
{
  const { manual } = await cog(gmPage)
  await wait(500)
  check(await manual.count() === 0, "the Gamemaster's page for Thorin has none")
  await closeCog(gmPage)
}

// ---- The dice entry dialog, as the page shows it ----
const SUBTITLE = 'Type in what your dice show'
const entryOf = who => who.page.getByRole('dialog').filter({ hasText: SUBTITLE })
/** Each term's group in the dialog: its name, and its boxes' names. */
const groupsOf = dialog => dialog.evaluate(el => [...el.querySelectorAll('[role=group][aria-labelledby]')].map(group => ({
  name: document.getElementById(group.getAttribute('aria-labelledby'))?.textContent.trim(),
  boxes: [...group.querySelectorAll('input')].map(input => input.getAttribute('aria-label')),
})))
const keypad = dialog => dialog.getByRole('group', { name: 'Keypad' })
/** Keys tapped on the dialog's keypad, as a finger does. */
async function keys(dialog, ...pressed) {
  for (const key of pressed) await keypad(dialog).getByRole('button', { name: key === 'delete' ? 'Delete' : key, exact: true }).click()
}
const totalOf = async dialog => (await dialog.locator('output').first().textContent()).trim()
/** The keypad's Next die (module 0.33.0's feedback: not on the last box). */
const nextDie = dialog => keypad(dialog).getByRole('button', { name: 'Next die', exact: true })
/** The box typed into: the one marked current. */
const currentBox = dialog => dialog.evaluate(el => el.querySelector('input[aria-current="true"]')?.getAttribute('aria-label') ?? null)
/**
 * The keypad as drawn: its box and each key's, by its data-key; the gap from its foot to the button
 * row's top; Done's box and whether it's the row's last button; the 5 key's box; and the grid's gap.
 */
const keypadLook = dialog => dialog.evaluate(el => {
  const rect = node => { const b = node.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height } }
  const pad = el.querySelector('[aria-label="Keypad"]')
  const keys = [...pad.querySelectorAll('button')].map(k => ({ key: k.dataset.key, ...rect(k) }))
  const done = [...el.querySelectorAll('button')].find(b => b.textContent === 'Done')
  const row = done.parentElement
  const scroller = el.querySelector('form').parentElement
  return {
    pad: rect(pad), keys, next: keys.some(k => k.key === 'next'), gap: row.getBoundingClientRect().top - pad.getBoundingClientRect().bottom,
    done: rect(done), doneLast: [...row.querySelectorAll('button')].at(-1) === done, five: keys.find(k => k.key === '5'),
    columnGap: parseFloat(getComputedStyle(pad).columnGap), scrolls: scroller.scrollHeight > scroller.clientHeight,
  }
})
const near = (a, b, by = 1) => Math.abs(a - b) <= by
const sameBox = (a, b, by = 1) => !!a && !!b && ['x', 'y', 'w', 'h'].every(k => near(a[k], b[k], by))
/** Every key the same size as the first, ± 1 px. */
const keysAlike = look => look.keys.every(k => near(k.w, look.keys[0].w) && near(k.h, look.keys[0].h))
/** Three columns on the last box: a row shorter (a key and its gap, 50 px), no gap where it was, Done the row's last. */
const lostARow = (before, after) => before.next && !after.next && after.keys.length === 12 && near(before.pad.h - after.pad.h, 50)
  && keysAlike(after) && sameBox({ ...after.keys[0], x: 0, y: 0 }, { ...before.keys[0], x: 0, y: 0 }) && near(after.gap, before.gap) && after.doneLast
const moved = (before, after) => ({ five: Math.round(after.five.y - before.five.y), done: Math.round(after.done.y - before.done.y) })
const focusedBox = dialog => dialog.evaluate(el => {
  const active = document.activeElement
  return el.contains(active) ? (active.getAttribute('aria-label') ?? active.textContent.trim()) : null
})
/** Until the dialog's first box takes focus, a frame after it opens. */
const firstFocused = async (dialog, name) => {
  await until(async () => (await focusedBox(dialog)) === name, `the first box, ${name}, focused`, 5_000).catch(() => {})
  return focusedBox(dialog)
}
/** The Combat tab of a phone's or tablet's table, the sheet's pane hidden behind it. */
async function combatTab(who) {
  await who.nav.getByRole('button', { name: /^Combat/ }).click()
  await until(() => who.page.evaluate(() => getComputedStyle(document.getElementById('character-pane')).display === 'none'),
    'the sheet hidden behind the Combat tab', 5_000)
}
/**
 * Whether the dialog is what a tap meets: its first box and Done each the element at its own
 * centre; and whether the sheet's pane is hidden, and the dialog inside it.
 */
const meets = dialog => dialog.evaluate(el => {
  const hits = node => {
    const b = node?.getBoundingClientRect()
    return !!b && b.width > 0 && document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) === node
  }
  const pane = document.getElementById('character-pane')
  return {
    box: hits(el.querySelector('input')),
    done: hits([...el.querySelectorAll('button')].find(b => b.textContent === 'Done')),
    paneHidden: !!pane && getComputedStyle(pane).display === 'none',
    inPane: !!pane?.contains(el),
  }
})
/**
 * Many dice scrolled half way, then to the end: at each, whether the keypad and Done are inside the
 * scroller's box, and how far the block holding them sits from the scroller's edge it sticks to,
 * its bottom or, on a short screen, where it's beside the dice, its top. A gap there would show
 * the dice scrolling by in a strip beyond the block.
 */
const scrolledLook = dialog => dialog.evaluate(async el => {
  const form = el.querySelector('form')
  const scroller = form.parentElement
  const block = form.lastElementChild
  const pad = el.querySelector('[aria-label="Keypad"]')
  const done = [...el.querySelectorAll('button')].find(b => b.textContent === 'Done')
  const short = getComputedStyle(form).gridTemplateColumns.split(' ').length === 2
  const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const at = []
  for (const share of [0.5, 1]) {
    scroller.scrollTop = Math.round((scroller.scrollHeight - scroller.clientHeight) * share)
    await frames()
    const s = scroller.getBoundingClientRect()
    const inside = node => { const b = node.getBoundingClientRect(); return b.width > 0 && b.top >= s.top - 0.5 && b.bottom <= s.bottom + 0.5 }
    const b = block.getBoundingClientRect()
    at.push({ share, scrollTop: Math.round(scroller.scrollTop), keypad: inside(pad), done: inside(done), gap: Math.round((short ? b.top - s.top : s.bottom - b.bottom) * 10) / 10 })
  }
  return { sticky: getComputedStyle(block).position === 'sticky' && block.contains(pad) && block.contains(done), short, at }
})
const stuckWell = look => look.sticky && look.at.length === 2 && look.at.every(a => a.scrollTop > 0 && a.keypad && a.done && Math.abs(a.gap) <= 1)
/**
 * Whether the 3D dice were thrown in the next moment and a half: the renderer shows its container
 * (opacity 1) for each throw and hides it again once the dice settle (3d-dice-core's dice-renderer).
 */
const diceShown = who => who.page.evaluate(async () => {
  for (let i = 0; i < 15; i++) {
    if ([...document.querySelectorAll('[id^=dice-canvas-threejs]')].some(el => el.style.opacity === '1')) return true
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return false
})
const toasts = who => who.page.getByRole('log', { name: 'Roll results' }).locator('[data-roll-toast]')
const tray = who => who.page.getByRole('region', { name: 'Your rolls' })
/** The posts a page made since a count, and the last. */
const postsSince = (who, from) => sentBy.get(who).slice(from)
/**
 * Until the page's roll toasts have gone (4 s each): they're drawn over the top of the sheet, where
 * a tap on what they cover would reach them.
 */
const clearToasts = who => until(async () => (await toasts(who).count()) === 0, 'the toasts to clear', 15_000)
/**
 * Roll results as toasts or in the banner, chosen in the cog: a toast that waits on the player, as
 * an attack's whose damage is due, stays over the top of the sheet until it's rolled.
 */
async function resultsAs(who, label) {
  const { dialog } = await cog(who)
  await dialog.getByRole('radiogroup', { name: 'Roll results' }).getByRole('radio', { name: label }).click()
  await closeCog(who)
}
/** Tap what asks for dice: the dialog, and how many requests and posts there were before. */
/** Wait for room under the app's limit of 20 rolls a minute from a player. */
const lastMinute = () => Number(sql(`select count(*) from roll_request where "createdAt" > now() - interval '1 minute'`))
const paced = () => until(() => lastMinute() < 17, 'room under the rate limit', 70_000)
async function asked(who, tap, what, { clear = true } = {}) {
  await paced()
  if (clear) await clearToasts(who)
  const before = { requests: requests(), posts: sentBy.get(who)?.length ?? 0 }
  await tap()
  const dialog = entryOf(who)
  await dialog.waitFor({ timeout: 15_000 })
  return { dialog, before, what }
}
/** Done, and the request it sent once the game made it. */
async function done(who, { dialog, before, what }, { toast } = {}) {
  const at = Date.now()
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  // How soon its toast shows, where asked, watched from the tap.
  let toastIn = null
  if (toast) {
    await toasts(who).filter({ hasText: toast }).first().waitFor({ timeout: 5_000 })
    toastIn = Date.now() - at
  }
  await dialog.waitFor({ state: 'hidden', timeout: 5_000 })
  await until(() => requests() > before.requests, `${what} to be sent`)
  const request = rollRow()
  await until(() => settledRow(rollRow(request.id)), `${what} to be made`, 30_000)
  return { request, made: rollRow(request.id), message: madeFor(request.id), at, toastIn, body: sentBy.get(who)[before.posts] }
}

/** The badge the module puts on a message's card in Foundry, drawn as Foundry draws a chat card. */
const { markAppRoll } = await import(`${MODULE}/scripts/command-rolls.mjs`)
const cardPage = await (await browse({ width: 400, height: 300 })).view.newPage()
const moduleStyles = readFileSync(`${MODULE}/styles/sending-stone.css`, 'utf8')
async function badgeOn(message, shot) {
  const dom = new JSDOM(`<ol id="chat-log"><li class="chat-message"><header class="message-header"><h4 class="message-sender">${message.speaker?.alias ?? 'Thorin'}</h4><span class="message-metadata"><time>Now</time></span></header><div class="message-content">${message.content ?? ''}</div></li></ol>`)
  const held = { document: globalThis.document, HTMLElement: globalThis.HTMLElement }
  Object.assign(globalThis, { document: dom.window.document, HTMLElement: dom.window.HTMLElement })
  try { markAppRoll(message, dom.window.document.querySelector('li')) } finally { Object.assign(globalThis, held) }
  const badge = dom.window.document.querySelector('.sending-stone-badge')
  if (shot && SHOTS) {
    await cardPage.setContent(`<!doctype html><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"><style>${moduleStyles} body{font:14px sans-serif;background:#e8e2d4;padding:16px;width:320px} .message-header{display:flex;gap:8px;align-items:baseline} .message-metadata{margin-left:auto;display:flex;gap:4px} .chat-message{list-style:none;background:#fff;border:1px solid #999;padding:6px}</style>${dom.window.document.body.innerHTML}`)
    await cardPage.waitForTimeout(300)
    await cardPage.screenshot({ path: `${SHOTS}/${shot}${VARIANT}.png`, clip: { x: 0, y: 0, width: 360, height: 120 } })
  }
  return badge && { className: badge.className, label: badge.getAttribute('aria-label'), tooltip: badge.dataset.tooltip, icon: !!badge.querySelector('i.fa-keyboard') }
}
const TYPED_BADGE = { className: 'sending-stone-badge sending-stone-typed', label: 'Entered by hand on Sending Stone', tooltip: 'Entered by hand on Sending Stone', icon: true }

const sheet = who => who.page.getByRole('region', { name: 'Character', exact: true })
const perception = who => sheet(who).getByRole('button', { name: /^Perception check/ }).first()
const panel = who => who.page.getByRole('tabpanel')

if (SKEW031) {
  // =================================================================================================
  // Module 0.31.0: no gate, so no one types; three d20s are never sent, and `typed` is stripped
  // =================================================================================================
  part('21. module 0.31.0')
  await setPermissions([1, 2, 3, 4])
  await wait(4000)
  const { manual } = await cog(alice)
  check(await manual.count() === 0 && same(roster(), [['thorin', false], ['vex', false]]), 'given Make Manual Rolls by every role, the app still shows no switch, as the module never says he may')
  await closeCog(alice)
  await alice.tab('Actions')
  await panel(alice).getByRole('button', { name: 'Rapier attack, +6' }).click({ button: 'right' })
  const menu = alice.page.getByRole('menu')
  await menu.waitFor()
  const before = { requests: requests(), posts: sentBy.get(alice).length }
  await menu.getByRole('menuitem', { name: 'Roll with advantage' }).click()
  const picker = alice.page.getByRole('dialog', { name: 'Rapier attack' })
  await picker.waitFor()
  await picker.getByRole('button', { name: /^Goblin/ }).click()
  await until(() => requests() > before.requests, 'the attack to be sent')
  const attack = rollRow()
  await until(() => settledRow(rollRow(attack.id)), 'the attack to be made', 30_000)
  check(attack.payload.dice[0].faces === 20 && attack.payload.dice[0].results.length === 2 && !('typed' in attack.payload) && await entryOf(alice).count() === 0,
    `the rapier with advantage throws two of the app's d20s, Elven Accuracy's third Foundry's, no dialog and nothing typed (${JSON.stringify(attack.payload.dice)})`)
  const crafted = await call(alice.page, '/api/characters/sheet-thorin/rolls', { method: 'POST', body: { kind: 'skill', key: 'prc', mode: 0, explicit: false, extras: [], dice: [{ faces: 20, results: [12] }], typed: true } })
  await until(() => settledRow(rollRow()), 'the crafted roll to be made', 30_000)
  const kept = rollRow()
  check(crafted.status === 202 && !('typed' in kept.payload) && kept.status === 'done',
    `a crafted check with typed: true is taken (${crafted.status}), and stored without it (${JSON.stringify(kept.payload)})`)
  await finish()
}

// =================================================================================================
// 2. Turned on
// =================================================================================================
part('2. on')
const tablet = await browse({ width: 768, height: 1024, path: '/characters/sheet-thorin' })
await tablet.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const { manual: tabletSwitch } = await cog(tablet)
await tabletSwitch.waitFor({ timeout: 15_000 })
{
  const { dialog, manual } = await cog(alice)
  check(!(await manual.isChecked()) && await manual.evaluate(el => document.getElementById(el.getAttribute('aria-describedby'))?.textContent) === HINT,
    `at 390, "${MANUAL}" is off, said of as "${HINT}"`)
  await dialog.locator('label').filter({ hasText: MANUAL }).tap()
  await until(() => manual.isChecked(), 'the switch on', 5_000)
  await until(() => stored() === 't', 'the choice stored', 10_000)
  await shoot(alice, 'typed-switch', dialog)
  check(await manual.isChecked() && stored() === 't', 'turned on at 390, it shows on and is kept on her seat')
  const at = Date.now()
  await until(() => tabletSwitch.isChecked(), 'the tablet to follow', 10_000)
  check(await tabletSwitch.isChecked(), `her 768 page shows it on within a poll (${((Date.now() - at) / 1000).toFixed(1)} s)`)
  await closeCog(alice)
  await closeCog(tablet)
}

// =================================================================================================
// 3. A skill check
// =================================================================================================
part('3. a skill check')
await alice.tab('Character')
let entry = await asked(alice, () => perception(alice).click(), 'the Perception check')
{
  const { dialog } = entry
  const title = await dialog.getByRole('heading').first().textContent()
  const groups = await groupsOf(dialog)
  const focused = await firstFocused(dialog, 'd20')
  check(/^Perception/.test(title) && same(groups, [{ name: 'd20', boxes: ['d20'] }]) && focused === 'd20' && await dialog.getByText(SUBTITLE).isVisible(),
    `tapped, Perception asks for its d20: "${title}", "${SUBTITLE}", one box, d20, focused (${JSON.stringify(groups)})`)
  check(await nextDie(dialog).count() === 0 && await keypad(dialog).getByRole('button').count() === 12 && await dialog.getByRole('button', { name: 'Done', exact: true }).isVisible(),
    'a single die\'s keypad has no "Next die", its 12 other keys and Done there')
  await keys(dialog, '1', '7')
  const total = await totalOf(dialog)
  check(total === 'Total 22' && (await focusedBox(dialog)) === 'Done', `typed 1, 7: "${total}" before Done, Perception's +5 on the 17, and Done focused after the 7`)
  await shoot(alice, 'typed-dialog-phone', dialog)
}
const thrownAfterDone = diceShown(alice)
let made = await done(alice, entry, { toast: 'Perception' })
{
  const toast = toasts(alice).filter({ hasText: 'Perception' }).first()
  const thrown = await thrownAfterDone
  check(made.toastIn < 1000 && (await toast.textContent()).includes('22') && !thrown, `Done: the toast shows 22 within ${made.toastIn} ms, and no dice are thrown on the screen`)
  check(made.body?.typed === true && same(made.body?.dice, [{ faces: 20, results: [17] }]) && made.request.payload.typed === true,
    `the post has typed: true and its d20, 17 (${JSON.stringify(made.body)}), and the app keeps it typed`)
  const badge = await badgeOn(made.message, 'typed-badge')
  check(same(d20sOf(made.message?.rolls[0]), [17]) && made.message.rolls[0].total === 22 && made.message.flags['sending-stone'].typed === true && same(badge, TYPED_BADGE),
    `Foundry's card has the d20, 17, flagged typed, with the keyboard badge "Entered by hand on Sending Stone" (${JSON.stringify(badge)})`)
}

// From here the rolls show in the banner, where those that wait on Alice don't cover the sheet.
await resultsAs(alice, 'Banner')

// ---- 4. Advantage and disadvantage, from the menu and from Modify Roll ----
part('4. advantage')
async function fromMenu(who, button, item) {
  await button.click({ button: 'right' })
  const menu = who.page.getByRole('menu')
  await menu.waitFor()
  await menu.getByRole('menuitem', { name: item }).click()
}
entry = await asked(alice, () => fromMenu(alice, perception(alice), 'Roll with advantage'), 'Perception with advantage')
{
  const groups = await groupsOf(entry.dialog)
  const focused = await firstFocused(entry.dialog, 'd20 1 of 2')
  check(same(groups, [{ name: 'd20, advantage', boxes: ['d20 1 of 2', 'd20 2 of 2'] }]) && focused === 'd20 1 of 2',
    `the menu's advantage asks for two, "d20, advantage", the first box focused once the menu closes (${JSON.stringify(groups)}, ${focused})`)
  // Module 0.33.0's feedback: Next die on the first box, gone on the last, back on the first.
  const firstCurrent = await currentBox(entry.dialog)
  const nextFirst = await nextDie(entry.dialog).count()
  await keys(entry.dialog, '4')
  const lastCurrent = await currentBox(entry.dialog)
  const nextLast = await nextDie(entry.dialog).count()
  check(firstCurrent === 'd20 1 of 2' && nextFirst === 1 && lastCurrent === 'd20 2 of 2' && nextLast === 0,
    `"Next die" with the first box current; a 4 typed there, the second, the last, is current and "Next die" is gone (${JSON.stringify([firstCurrent, nextFirst, lastCurrent, nextLast])})`)
  await entry.dialog.getByRole('textbox', { name: 'd20 1 of 2', exact: true }).click()
  check(await currentBox(entry.dialog) === 'd20 1 of 2' && await nextDie(entry.dialog).count() === 1, 'a click on the first box makes it current, and "Next die" is back')
  await entry.dialog.getByRole('textbox', { name: 'd20 2 of 2', exact: true }).click()
  await keys(entry.dialog, '1', '5')
  check(await totalOf(entry.dialog) === 'Total 20', `4 and 15: ${await totalOf(entry.dialog)}, the higher kept`)
}
made = await done(alice, entry)
check(same(made.request.payload.dice[0].results, [4, 15]) && made.request.payload.mode === 1 && same(d20sOf(made.message?.rolls[0]), [4, 15]) && made.message.rolls[0].total === 20,
  `sent as [4, 15], with advantage; the game keeps 15 (${JSON.stringify(made.request.payload)}; ${made.message?.rolls[0].formula} ${JSON.stringify(d20sOf(made.message?.rolls[0]))} = ${made.message?.rolls[0].total})`)
entry = await asked(alice, () => fromMenu(alice, perception(alice), 'Roll with disadvantage'), 'Perception with disadvantage')
await keys(entry.dialog, '4', '1', '5')
check(same(await groupsOf(entry.dialog), [{ name: 'd20, disadvantage', boxes: ['d20 1 of 2', 'd20 2 of 2'] }]) && await totalOf(entry.dialog) === 'Total 9',
  `disadvantage: "d20, disadvantage", 4 and 15 keep the 4 (${await totalOf(entry.dialog)})`)
made = await done(alice, entry)
check(made.request.payload.mode === -1 && made.message.rolls[0].total === 9, `and the game keeps the 4: ${made.message?.rolls[0].total}`)
// Modify Roll: advantage, and a d4 more, its own box.
await clearToasts(alice)
await perception(alice).click({ button: 'right' })
await alice.page.getByRole('menu').getByRole('menuitem', { name: 'Modify roll…' }).click()
const modifyRoll = alice.page.getByRole('dialog', { name: 'Modify roll' })
await modifyRoll.waitFor()
await modifyRoll.getByText('Advantage', { exact: true }).click()
await modifyRoll.getByLabel('Extra dice or modifiers').fill('1d4')
entry = await asked(alice, () => modifyRoll.getByRole('button', { name: /^Roll/ }).last().click(), 'Perception, modified')
{
  const groups = await groupsOf(entry.dialog)
  const focused = await firstFocused(entry.dialog, 'd20 1 of 2')
  check(groups[0]?.name === 'd20, advantage' && groups.some(g => g.name === '+1d4' && same(g.boxes, ['d4'])) && focused === 'd20 1 of 2',
    `Modify Roll's Roll leaves the first box focused, and its +1d4 a box of its own beside the d20s (${JSON.stringify(groups)}, ${focused})`)
  await keys(entry.dialog, '9', '1', '2', '3')
}
made = await done(alice, entry)
check(same(made.request.payload.dice, [{ faces: 20, results: [9, 12] }, { faces: 4, results: [3] }]) && made.message?.rolls[0].dice[1]?.results[0]?.result === 3,
  `sent as d20s [9, 12] and the d4 3, which the game adds (${made.message?.rolls[0].formula} = ${made.message?.rolls[0].total})`)

// ---- 5. Elven Accuracy ----
part('5. elven accuracy')
const sentSheet = () => postsOf('character.updated').filter(p => p.data.character.id === 'thorin').at(-1)?.data.character.sheet
  ?? hello().data.characters.find(c => c.id === 'thorin').sheet
const actionOf = (sheet, item) => JSON.stringify(sheet ?? {}).includes('"elvenAccuracy":true')
check(actionOf(sentSheet(), 'rapier'), "the sheet says the rapier's attack has Elven Accuracy")
await alice.tab('Actions')
const rapier = panel(alice).getByRole('button', { name: 'Rapier attack, +6' })
const rapierPicker = alice.page.getByRole('dialog', { name: 'Rapier attack' })
// Bless's d4, which the game throws itself: 3.
faces.push(3)
entry = await asked(alice, async () => {
  await fromMenu(alice, rapier, 'Roll with advantage')
  await rapierPicker.waitFor()
  await rapierPicker.getByRole('button', { name: /^Goblin/ }).click()
}, 'the rapier with advantage')
check(same(await groupsOf(entry.dialog), [{ name: 'd20, advantage (Elven Accuracy)', boxes: ['d20 1 of 3', 'd20 2 of 3', 'd20 3 of 3'] }]),
  `the rapier with advantage asks for three, "d20, advantage (Elven Accuracy)", and nothing for Bless's d4 (${JSON.stringify(await groupsOf(entry.dialog))})`)
await keys(entry.dialog, '3', '1', '8', '7')
made = await done(alice, entry)
{
  const roll = MIDI ? W.midi.made.at(-1)?.attackRoll : made.message?.rolls[0]
  const d4 = roll?.dice?.find(d => d.faces === 4)?.results.map(r => r.result)
  check(same(made.request.payload.dice[0].results, [3, 18, 7]) && same(d20sOf(roll), [3, 18, 7]) && roll.dice[0].total === 18 && same(d4, [3]),
    `the card's d20s are [3, 18, 7], 18 kept${MIDI ? ', through Midi-QOL\'s workflow' : ''}, and Bless's d4 is Foundry's own, 3 (${roll?.formula} = ${roll?.total})`)
}
const greataxe = panel(alice).getByRole('button', { name: 'Greataxe attack, +4' })
entry = await asked(alice, async () => {
  await fromMenu(alice, greataxe, 'Roll with advantage')
  const picker = alice.page.getByRole('dialog', { name: 'Greataxe attack' })
  await picker.waitFor()
  await picker.getByRole('button', { name: /^Goblin/ }).click()
}, 'the greataxe with advantage')
check(same(await groupsOf(entry.dialog), [{ name: 'd20, advantage', boxes: ['d20 1 of 2', 'd20 2 of 2'] }]), 'the greataxe, with Strength, asks for two')
await keys(entry.dialog, '6', '5')
made = await done(alice, entry)
check(same(made.request.payload.dice[0].results, [6, 5]), 'and sends two')

// ---- 7. Damage after a hit ----
part('7. damage')
const rollDamage = name => tray(alice).getByRole('button', { name })
// A hit: typed 15.
entry = await asked(alice, async () => {
  await rapier.click()
  await rapierPicker.waitFor()
  await rapierPicker.getByRole('button', { name: /^Goblin/ }).click()
}, 'the rapier')
await keys(entry.dialog, '1', '5')
made = await done(alice, entry)
await rollDamage('Roll damage').waitFor({ timeout: 30_000 })
entry = await asked(alice, () => rollDamage('Roll damage').click(), "the rapier's damage")
check(same(await groupsOf(entry.dialog), [{ name: '1d8 Piercing', boxes: ['d8'] }]), `its damage asks for "1d8 Piercing", one box (${JSON.stringify(await groupsOf(entry.dialog))})`)
await keys(entry.dialog, '5')
made = await done(alice, entry)
check(made.request.payload.typed === true && same(made.request.payload.dice, [{ faces: 8, results: [5] }]), 'sent typed with the d8')
// A natural 20, typed: the game's doubled dice.
entry = await asked(alice, async () => {
  await rapier.click()
  await rapierPicker.waitFor()
  await rapierPicker.getByRole('button', { name: /^Goblin/ }).click()
}, 'the critical hit')
await keys(entry.dialog, '2', '0')
made = await done(alice, entry)
check(made.made?.result?.attack?.critical === true && made.made.result.damage?.rolls?.[0]?.formula === '2d8 + 3',
  `a typed 20 is a critical hit, the game's preview of its damage 2d8 + 3 (${JSON.stringify(made.made?.result?.damage?.rolls?.[0])})`)
await rollDamage('Roll critical damage').waitFor({ timeout: 30_000 })
entry = await asked(alice, () => rollDamage('Roll critical damage').click(), 'the critical damage')
check(same(await groupsOf(entry.dialog), [{ name: '2d8 Piercing', boxes: ['d8 1 of 2', 'd8 2 of 2'] }]), `the critical's damage asks for the game's 2d8, two boxes (${JSON.stringify(await groupsOf(entry.dialog))})`)
await keys(entry.dialog, '4', '6')
made = await done(alice, entry)
{
  const roll = MIDI ? W.midi.made.at(-1)?.damageRolls?.[0] : made.message?.rolls[0]
  check(roll?.formula === '2d8 + 3' && same(roll.dice[0].results.map(r => r.result), [4, 6]) && roll.total === 13,
    `the card's formula is 2d8 + 3${MIDI ? ' under Midi-QOL\'s "Double Rolled Damage" for the Gamemaster too' : ''}, the typed 4 and 6, 13 (${roll?.formula})`)
}
// More dice and another die, from Modify damage: the game lets players change their damage under
// dnd5e 6.0.5's dice as under 5.3.3's, now that the module marks the critical damage dnd5e 6 adds
// unmarked (its load self-test failed on it before, and took Modify damage and Maximum away).
const modifies = sql(`select array_to_string("rollFeatures", ',') from campaign where id = '${A}'`).split(',').includes('modifiers')
check(modifies, `the game lets players change their damage${DND5E6 ? ", under dnd5e 6.0.5's dice too" : ''}: the hello's rolls have modifiers, so Modify damage and Maximum are offered`)
{
entry = await asked(alice, async () => {
  await rapier.click()
  await rapierPicker.waitFor()
  await rapierPicker.getByRole('button', { name: /^Goblin/ }).click()
}, 'another hit')
await keys(entry.dialog, '1', '6')
await done(alice, entry)
await rollDamage('Roll damage').waitFor({ timeout: 30_000 })
await clearToasts(alice)
await rollDamage('Roll damage').click({ button: 'right' })
await alice.page.getByRole('menu').getByRole('menuitem', { name: 'Modify damage…' }).click()
const modifyDamage = alice.page.getByRole('dialog', { name: 'Modify damage' })
await modifyDamage.waitFor()
await modifyDamage.getByRole('button', { name: 'One die more' }).click()
await modifyDamage.getByText('d10', { exact: true }).click()
entry = await asked(alice, () => modifyDamage.getByRole('button', { name: 'Roll', exact: true }).click(), 'the damage, modified')
check(same(await groupsOf(entry.dialog), [{ name: '2d10 Piercing', boxes: ['d10 1 of 2', 'd10 2 of 2'] }]), `a die more, a d10 for its d8: "2d10 Piercing", two boxes (${JSON.stringify(await groupsOf(entry.dialog))})`)
await keys(entry.dialog, '0', '7')
made = await done(alice, entry)
check(same(made.request.payload.dice, [{ faces: 10, results: [10, 7] }]), `a d10's 0 arrives as 10 (${JSON.stringify(made.request.payload.dice)})`)
// Maximum asks for nothing.
entry = null
await paced()
await clearToasts(alice)
await rapier.click()
await rapierPicker.waitFor()
{
  const before = requests()
  const typedBefore = sentBy.get(alice).length
  await rapierPicker.getByRole('button', { name: /^Goblin/ }).click()
  const dialog = entryOf(alice)
  await dialog.waitFor()
  await keys(dialog, '1', '4')
  await dialog.getByRole('button', { name: 'Done' }).click()
  await until(() => requests() > before && settledRow(rollRow()), 'a third hit')
  await rollDamage('Roll damage').waitFor({ timeout: 30_000 })
  await clearToasts(alice)
  await rollDamage('Roll damage').click({ button: 'right' })
  await alice.page.getByRole('menu').getByRole('menuitem', { name: 'Roll maximum damage' }).click()
  await until(() => requests() > before + 1, 'the maximum damage to be sent')
  await wait(500)
  const max = rollRow()
  check(await entryOf(alice).count() === 0 && same(max.payload.modifiers, { maximize: true }) && !('typed' in max.payload) && sentBy.get(alice).length === typedBefore + 2,
    `its maximum opens no dialog, and sends it untyped, the game's every die at its highest (${JSON.stringify(max.payload)})`)
  await until(() => settledRow(rollRow(max.id)), 'the maximum damage to be made')
}
}

// ---- 8. A use's damage: offered, waiting for a tap ----
part('8. a use')
await resultsAs(alice, 'Toasts')
await alice.tab('Spells')
await panel(alice).getByRole('button', { name: /^Fireball, DEX saving throw/ }).click()
const fireballPicker = alice.page.getByRole('dialog', { name: 'Fireball' })
await fireballPicker.waitFor()
for (const name of [/^Goblin/, /^Ogre/]) await fireballPicker.getByRole('checkbox', { name }).check()
{
  const before = requests()
  await fireballPicker.getByRole('button', { name: /^Cast at 2 targets/ }).click()
  await until(() => requests() > before && settledRow(rollRow()), 'Fireball to be cast', 30_000)
  const cast = rollRow()
  const fireToast = toasts(alice).filter({ hasText: 'Fireball' }).first()
  const offered = fireToast.getByRole('button', { name: /^Roll damage/ })
  await offered.waitFor({ timeout: 30_000 })
  await wait(5000)
  check(await entryOf(alice).count() === 0 && requests() === before + 1 && await offered.isVisible(),
    `Fireball cast at both (${cast.status}): no dialog opens by itself, nothing more is sent, and its toast stays past 4 s, its damage offered`)
  await shoot(alice, 'typed-use-offered')
  // Tapped from the Combat tab, where the sheet's pane is hidden: the dialog shows over the page
  // all the same, never inside the hidden pane, where it would show nothing and leave the page inert.
  await combatTab(alice)
  entry = await asked(alice, () => offered.click(), "Fireball's damage", { clear: false })
  {
    const look = await meets(entry.dialog)
    const focused = await firstFocused(entry.dialog, 'd6 1 of 8')
    check(look.paneHidden && !look.inPane && look.box && look.done && focused === 'd6 1 of 8',
      `at 390, from the Combat tab, the toast's Roll damage opens the dialog over the page, out of the hidden sheet: its first box and Done are what a tap meets, the first box focused (${JSON.stringify(look)}, ${focused})`)
  }
  check(same(await groupsOf(entry.dialog), [{ name: '8d6 Fire', boxes: Array.from({ length: 8 }, (_, i) => `d6 ${i + 1} of 8`) }]), "a tap opens 8 boxes of 8d6 Fire")
  await keys(entry.dialog, '1', '2', '3', '4', '5', '6', '1', '2')
  check(await totalOf(entry.dialog) === 'Total 24', `eight keys fill them: ${await totalOf(entry.dialog)}`)
  made = await done(alice, entry)
  const roll = MIDI ? W.midi.made.at(-1)?.damageRolls?.[0] : madeAllFor(made.request.id).at(-1)?.rolls[0]
  check(made.body?.typed === true && made.request.payload.typed === true && same(made.request.payload.dice, [{ faces: 6, results: [1, 2, 3, 4, 5, 6, 1, 2] }]) && same(roll?.dice[0].results.map(r => r.result), [1, 2, 3, 4, 5, 6, 1, 2]),
    "Done posts them typed, and the card's dice are those eight")
  await alice.character()
}
// The same at 768, from the tablet's Combat tab: Fireball at the goblin alone, its damage tapped in
// its toast there.
watchPosts(tablet)
await tablet.tab('Spells')
await panel(tablet).getByRole('button', { name: /^Fireball, DEX saving throw/ }).click()
{
  const picker = tablet.page.getByRole('dialog', { name: 'Fireball' })
  await picker.waitFor()
  await picker.getByRole('checkbox', { name: /^Goblin/ }).check()
  await paced()
  const before = requests()
  await picker.getByRole('button', { name: /^Cast at 1 target/ }).click()
  await until(() => requests() > before && settledRow(rollRow()), 'Fireball to be cast from the tablet', 30_000)
  const offered = toasts(tablet).filter({ hasText: 'Fireball' }).first().getByRole('button', { name: /^Roll damage/ })
  await offered.waitFor({ timeout: 30_000 })
  await combatTab(tablet)
  entry = await asked(tablet, () => offered.click(), "Fireball's damage at 768", { clear: false })
  const look = await meets(entry.dialog)
  const focused = await firstFocused(entry.dialog, 'd6 1 of 8')
  check(look.paneHidden && !look.inPane && look.box && look.done && focused === 'd6 1 of 8',
    `at 768, from the Combat tab, the same: the dialog over the page, its first box and Done what a tap meets, the first box focused (${JSON.stringify(look)}, ${focused})`)
  await keys(entry.dialog, '6', '5', '4', '3', '2', '1', '6', '5')
  made = await done(tablet, entry)
  check(made.body?.typed === true && made.request.payload.typed === true && same(made.request.payload.dice, [{ faces: 6, results: [6, 5, 4, 3, 2, 1, 6, 5] }]),
    `and Done posts the eight typed (${JSON.stringify(made.body?.dice)})`)
  await tablet.character()
}
await resultsAs(alice, 'Banner')

// ---- 9. Hit dice ----
part('9. hit dice')
await alice.tab('Character')
entry = await asked(alice, () => sheet(alice).getByRole('button', { name: /^Use a d10 hit die/ }).click(), 'a hit die')
check(same(await groupsOf(entry.dialog), [{ name: '1d10', boxes: ['d10'] }]), `a d10 hit die asks for its 1d10, one box (${JSON.stringify(await groupsOf(entry.dialog))})`)
await keys(entry.dialog, '0')
made = await done(alice, entry)
check(made.request.payload.kind === 'hitDie' && same(made.request.payload.dice, [{ faces: 10, results: [10] }]) && made.message?.rolls[0].dice[0].results[0].result === 10,
  `typed 0, it arrives as 10, and the game spends it so (${made.message?.rolls[0].formula} = ${made.message?.rolls[0].total})`)
thorin.system.attributes.hp.value = 10
await Hooks.callAll('updateActor', thorin, { system: { attributes: { hp: { value: 10 } } } })
await clearToasts(alice)
await sheet(alice).getByRole('button', { name: /^Use a d8 hit die/ }).click({ button: 'right' })
const hitDicePopover = alice.page.getByRole('dialog', { name: 'Use hit dice' })
await hitDicePopover.waitFor()
await hitDicePopover.getByRole('button', { name: 'One d10 more' }).click()
await hitDicePopover.getByRole('button', { name: 'One d10 more' }).click()
entry = await asked(alice, () => hitDicePopover.getByRole('button', { name: /^Use 3 hit dice/ }).click(), 'three hit dice')
check(same((await groupsOf(entry.dialog)).map(g => [g.name, g.boxes.length]), [['2d10', 2], ['+1d8', 1]]), `two d10s and the d8 at once: groups "2d10" and "+1d8" (${JSON.stringify(await groupsOf(entry.dialog))})`)
await keys(entry.dialog, '6', '3', '5')
const healTotal = await totalOf(entry.dialog)
made = await done(alice, entry)
check(made.request.payload.kind === 'hitDice' && same(made.request.payload.dice, [{ faces: 10, results: [6, 3] }, { faces: 8, results: [5] }]),
  `sent as typed (${JSON.stringify(made.request.payload.dice)}); the dialog said "${healTotal}"`)
if (DND5E6) {
  note('DND5E6=1: the check, Elven Accuracy, damage, Modify damage, a use\'s damage and hit dice made under dnd5e 6.0.5\'s dice')
  await finish()
}

// ---- 10. A formula, and descriptions ----
part('10. formulas and descriptions')
await alice.tab('Spells')
entry = await asked(alice, () => panel(alice).getByRole('button', { name: 'Roll Light: Glow, 1d4' }).click(), "Light's formula")
check(same((await groupsOf(entry.dialog)).map(g => [g.name, g.boxes.length]), [['1d4', 1]]), "Light's glow asks for its 1d4")
await keys(entry.dialog, '2')
made = await done(alice, entry)
check(made.request.payload.typed === true && same(made.request.payload.dice, [{ faces: 4, results: [2] }]), 'sent typed')
await alice.tab('Inventory')
const journalRow = panel(alice).locator('li', { has: alice.page.locator('summary', { hasText: 'Burning Journal' }) })
await journalRow.locator('summary').first().click()
const journal = journalRow.locator('.sheet-text')
await journal.getByRole('button').first().waitFor({ timeout: 15_000 })
entry = await asked(alice, () => journal.getByRole('button', { name: '1d100, roll it' }).click(), 'the 1d100')
check(same(await groupsOf(entry.dialog), [{ name: '1d100', boxes: ['d100'] }]), 'the inline 1d100 asks for one d100 box')
await keys(entry.dialog, '00')
check(await totalOf(entry.dialog) === 'Total 100', `00 typed: ${await totalOf(entry.dialog)}`)
made = await done(alice, entry)
check(same(made.request.payload.dice, [{ faces: 100, results: [100] }]), 'and it arrives as 100')
await clearToasts(alice)
await journal.getByRole('button', { name: '2d6 Fire, roll damage' }).click({ button: 'right' })
entry = await asked(alice, () => alice.page.getByRole('menu').getByRole('menuitem', { name: 'Roll critical damage' }).click(), "the journal's critical damage")
// A description's damage is named by its link's type as written, as the tray and Modify damage name it.
check(same(await groupsOf(entry.dialog), [{ name: '4d6 fire', boxes: Array.from({ length: 4 }, (_, i) => `d6 ${i + 1} of 4`) }]), `the description's damage as a critical hit's, by the world's rule: 4d6, four boxes (${JSON.stringify(await groupsOf(entry.dialog))})`)
await keys(entry.dialog, '6', '5', '4', '3')
made = await done(alice, entry)
check(made.request.payload.critical === true && made.message?.rolls[0].formula === '4d6' && made.message.rolls[0].total === 18, `the game makes it 4d6, 18 (${made.message?.rolls[0].formula})`)
await clearToasts(alice)
await journal.getByRole('button', { name: 'DC 13 Dexterity', exact: true }).click()
entry = await asked(alice, () => alice.page.getByRole('menu').getByRole('menuitem', { name: /^Roll my Dexterity save/ }).click(), 'the save link')
await keys(entry.dialog, '1', '1')
made = await done(alice, entry)
check(made.request.payload.kind === 'save' && same(made.request.payload.dice, [{ faces: 20, results: [11] }]), `its save link asks for the d20 too (${made.request.payload.kind})`)

// ---- 11. A death save, and initiative ----
part('11. death and initiative')
await alice.tab('Character')
entry = await asked(alice, () => sheet(alice).getByRole('button', { name: /^Initiative, \+3, to roll/ }).click(), 'initiative')
check(same(await groupsOf(entry.dialog), [{ name: 'd20', boxes: ['d20'] }]), 'initiative asks for one d20')
await keys(entry.dialog, '1', '2')
made = await done(alice, entry)
check(made.request.payload.kind === 'initiative' && thorinTurn.initiative === 15, `the game gives Thorin initiative ${thorinTurn.initiative}, the typed 12 and his +3`)
await Hooks.callAll('updateCombatant', thorinTurn, { initiative: thorinTurn.initiative })
thorin.system.attributes.hp.value = 0
await Hooks.callAll('updateActor', thorin, { system: { attributes: { hp: { value: 0 } } } })
await sheet(alice).getByRole('button', { name: 'Death saving throw' }).waitFor({ timeout: 15_000 })
entry = await asked(alice, () => sheet(alice).getByRole('button', { name: 'Death saving throw' }).click(), 'a death save')
check(same(await groupsOf(entry.dialog), [{ name: 'd20', boxes: ['d20'] }]), 'a death save asks for one d20')
await keys(entry.dialog, '1', '3')
made = await done(alice, entry)
check(made.request.payload.kind === 'death' && same(made.request.payload.dice, [{ faces: 20, results: [13] }]), 'and sends it typed')
thorin.system.attributes.hp.value = 20
thorin.system.attributes.death.success = 0
await Hooks.callAll('updateActor', thorin, { system: { attributes: { hp: { value: 20 } } } })

// ---- 12. A save the game asks for: dnd5e's (Midi-QOL's own are step 19's) ----
if (!MIDI) {
part('12. a prompt')
const asks = alice.page.getByRole('region', { name: 'Your Gamemaster asks' })
const shaman = { id: 'hex', name: 'Hex', img: 'hex.webp', uuid: 'Actor.goblin.Item.hex' }
const askedCard = await W.cards.saveCard({ by: goblin, item: shaman, dc: 13, targets: [thorin] })
await asks.waitFor({ timeout: 15_000 })
entry = await asked(alice, () => asks.getByRole('button', { name: /^Roll Dexterity saving throw/ }).click(), 'the asked save')
{
  const timer = await entry.dialog.getByRole('timer').textContent()
  check(/^9:5\d left to answer$/.test(timer.trim()) && await entry.dialog.locator('[aria-live]').filter({ has: entry.dialog.getByRole('timer') }).count() === 0,
    `the dialog shows the time left to answer, a timer, never read out: "${timer.trim()}"`)
  await keys(entry.dialog, '1', '6')
  made = await done(alice, entry)
  check(made.request.payload.prompt === `${askedCard.id}-thorin` && made.request.payload.typed === true && made.message?.flags.dnd5e.originatingMessage === askedCard.id,
    'Done answers it, on the card that asked')
  await until(async () => (await asks.count()) === 0, 'the banner to go once answered', 15_000)
}
}
const banner = alice.page.getByRole('region', { name: 'Your Gamemaster asks' })

// ---- 13. Validation ----
part('13. validation')
await alice.tab('Actions')
// A hit, whose damage stays due, for Escape below.
entry = await asked(alice, async () => {
  await rapier.click()
  await rapierPicker.waitFor()
  await rapierPicker.getByRole('button', { name: /^Goblin/ }).click()
}, 'a hit for its damage')
await keys(entry.dialog, '1', '5')
await done(alice, entry)
await rollDamage('Roll damage').waitFor({ timeout: 30_000 })
// Starfall's 20d6: a d6 box typed 7.
{
  const before = requests()
  entry = await asked(alice, () => panel(alice).getByRole('button', { name: /^Starfall damage/ }).first().click(), "Starfall's damage")
  await keys(entry.dialog, '7')
  const alert = entry.dialog.getByRole('alert').first()
  check(await alert.textContent() === 'A d6 shows 1 to 6.' && await entry.dialog.getByRole('textbox', { name: 'd6 1 of 20' }).getAttribute('aria-invalid') === 'true',
    '7 in a d6 box says at once "A d6 shows 1 to 6.", the box marked invalid')
  await keys(entry.dialog, 'delete', '4')
  await entry.dialog.getByRole('button', { name: 'Done', exact: true }).click()
  await wait(500)
  check(await entry.dialog.getByText('Type in every die first.').isVisible() && await entry.dialog.isVisible() && requests() === before,
    'Done with boxes empty says "Type in every die first." and posts nothing')
  await shoot(alice, 'typed-validation', entry.dialog)
  await entry.dialog.getByRole('button', { name: 'Cancel' }).click()
  await entry.dialog.waitFor({ state: 'hidden' })
}

// ---- 14. Cancel ----
part('14. cancel')
{
  const before = { requests: requests(), toasts: await toasts(alice).count() }
  entry = await asked(alice, () => rollDamage('Roll damage').first().click(), "the rapier's damage")
  await alice.page.keyboard.press('Escape')
  await entry.dialog.waitFor({ state: 'hidden' })
  await wait(1000)
  check(requests() === before.requests && await toasts(alice).count() <= before.toasts && await rollDamage('Roll damage').count() >= 1,
    "Escape on the rapier's damage posts nothing and toasts nothing, and its damage is still offered")
}

// ---- 15. Send to the table off ----
part('15. send off')
{
  const { dialog } = await cog(alice)
  await dialog.locator('label').filter({ hasText: 'Send to the table' }).tap()
  await closeCog(alice)
  await alice.tab('Character')
  const before = requests()
  entry = await asked(alice, () => perception(alice).click(), 'a local Perception check')
  await keys(entry.dialog, '8')
  await entry.dialog.getByRole('button', { name: 'Done', exact: true }).click()
  await entry.dialog.waitFor({ state: 'hidden' })
  await wait(1500)
  const said = await tray(alice).textContent()
  check(requests() === before && said.includes('Perception check') && /Only you see th(is roll|ese rolls)/.test(said),
    `with Send to the table off the dialog still opens, nothing is posted, and the tray marks it Alice's alone: "${said}"`)
  // ---- 17. With 40 boxes: Starfall's critical, doubled here ----
  part('17a. many dice')
  await alice.tab('Actions')
  await clearToasts(alice)
  await panel(alice).getByRole('button', { name: /^Starfall damage/ }).first().click({ button: 'right' })
  entry = await asked(alice, () => alice.page.getByRole('menu').getByRole('menuitem', { name: 'Roll critical damage' }).click(), "Starfall's critical, here")
  const boxes = (await groupsOf(entry.dialog)).flatMap(g => g.boxes)
  const look = await entry.dialog.evaluate(el => {
    const inView = node => { const b = node.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && b.width > 0 }
    const scroller = el.querySelector('form').parentElement
    return { keypad: inView(el.querySelector('[aria-label="Keypad"]')), done: inView([...el.querySelectorAll('button')].find(b => b.textContent === 'Done')), scrolls: scroller.scrollHeight > scroller.clientHeight }
  })
  check(boxes.length === 40 && look.keypad && look.done && look.scrolls, `a local 20d6 critical, doubled: 40 boxes, the groups scroll, and the keypad and Done stay in view (${JSON.stringify(look)})`)
  await shoot(alice, 'typed-many-dice')
  const scrolled = await scrolledLook(entry.dialog)
  check(stuckWell(scrolled) && !scrolled.short,
    `scrolled half way and to the end, the keypad and Done stay inside the scroller, their block flush with its bottom, no dice showing below it (${JSON.stringify(scrolled)})`)
  await entry.dialog.getByRole('button', { name: 'Cancel' }).click()
  await entry.dialog.waitFor({ state: 'hidden' })
  const { dialog: again } = await cog(alice)
  await again.locator('label').filter({ hasText: 'Send to the table' }).tap()
  await closeCog(alice)
}

// ---- 17. The dialog at every size, both themes ----
part('17. layout')
for (const [width, height] of [[360, 640], [390, 844], [768, 1024], [1280, 800], [844, 390]]) {
  const who = await browse({ width, height, path: '/characters/sheet-thorin' })
  await who.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  for (const scheme of ['light', 'dark']) {
    await theme(who, scheme)
    if (width < 1024) await who.character().catch(() => {})
    await who.tab('Character').catch(() => {})
    await perception(who).click({ button: 'right' })
    await who.page.getByRole('menu').getByRole('menuitem', { name: 'Roll with advantage' }).click()
    const dialog = entryOf(who)
    await dialog.waitFor()
    await wait(300)
    const look = await dialog.evaluate(el => {
      const inView = node => { const b = node?.getBoundingClientRect(); return !!b && b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth && b.width > 0 }
      const done = [...el.querySelectorAll('button')].find(b => b.textContent === 'Done')
      const box = done.getBoundingClientRect()
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      const keys = [...el.querySelector('[aria-label="Keypad"]').querySelectorAll('button')]
      const firstRow = keys.filter(k => Math.abs(k.getBoundingClientRect().top - keys[0].getBoundingClientRect().top) < 2).length
      const input = el.querySelector('input')
      const groups = el.querySelector('[role=group][aria-labelledby]').getBoundingClientRect()
      const pad = el.querySelector('[aria-label="Keypad"]').getBoundingClientRect()
      return { onTop: !!hit && el.contains(hit), keypad: inView(el.querySelector('[aria-label="Keypad"]')), done: inView(done), box: inView(input), firstRow, sideBySide: pad.left >= groups.right - 1 }
    })
    const wide = await sideways(who.page)
    const short = height <= 480
    check(wide === 0 && look.onTop && look.keypad && look.done && look.box && look.firstRow === (short ? 5 : 3) && look.sideBySide === short,
      `at ${width}×${height}, ${scheme}: nothing scrolls sideways, the dialog is on top, its keypad, Done and box in view${short ? ', two columns, five keys a row' : ', three keys a row'} (${JSON.stringify(look)})`)
    if (width === 390 || width === 768) await shoot(who, 'typed-dialog')
    if (short) await shoot(who, 'typed-sideways')
    // ---- 17c. Module 0.33.0's feedback: the keypad on the last box, without Next die ----
    if (width === 1280 && scheme === 'light') {
      // From the keyboard: Tab from 00 to Next die, then Enter. Tabbing through the boxes would make
      // the last current, which has none.
      await keypad(dialog).getByRole('button', { name: '00', exact: true }).focus()
      await who.page.keyboard.press('Tab')
      const onNext = await dialog.evaluate(() => document.activeElement?.dataset?.key ?? null)
      await who.page.keyboard.press('Enter')
      await wait(200)
      const focusedNow = await dialog.evaluate(() => (document.activeElement === document.body ? 'body' : document.activeElement?.getAttribute('aria-label')))
      check(onNext === 'next' && focusedNow === 'd20 2 of 2' && await currentBox(dialog) === 'd20 2 of 2' && await nextDie(dialog).count() === 0,
        `at 1280, Tab to "Next die" and Enter: the box "d20 2 of 2" has focus and is current, "Next die" gone, focus not on the page (${JSON.stringify([onNext, focusedNow])})`)
    }
    if ((width === 390 && height === 844) || short) {
      const before = await keypadLook(dialog)
      await keys(dialog, '4')
      await until(async () => !(await keypadLook(dialog)).next, 'Next die to go', 5_000).catch(() => {})
      await wait(300)
      const after = await keypadLook(dialog)
      if (!short) {
        note(`at 390×844, ${scheme}, two dice: as the last box comes, the 5 key moves ${moved(before, after).five} px and Done ${moved(before, after).done} px (keypad ${before.pad.h} → ${after.pad.h} px, gap ${before.gap} → ${after.gap} px)`)
        check(lostARow(before, after) && !after.scrolls,
          `at 390×844, ${scheme}, on the last of two boxes: no "Next die", the keypad 50 ± 1 px shorter, every key the same size, the same gap above the buttons, Done still the row's last (${JSON.stringify({ before: before.pad.h, after: after.pad.h, gap: [before.gap, after.gap], keys: after.keys.length, done: after.doneLast })})`)
        await shoot(who, 'typed-keypad-last', dialog, SHOTS_033)
      } else {
        const one = after.keys.find(k => k.key === '1')
        const del = after.keys.find(k => k.key === 'delete')
        const want = 4 * one.w + 3 * after.columnGap
        check(before.next && !after.next && after.keys.length === 12 && near(after.pad.h, before.pad.h) && near(del.w, want, 2) && near(del.x, before.keys.find(k => k.key === 'delete').x)
          && sameBox(after.done, before.done) && sameBox(after.five, before.five),
          `at 844×390, ${scheme}, on the last box: no "Next die", the compact keypad the same height, Delete four keys and three gaps wide from where it was, Done and the 5 key where they were (${JSON.stringify({ pad: [before.pad.h, after.pad.h], delete: [del.w, want], done: [before.done.y, after.done.y], five: [before.five.y, after.five.y] })})`)
        await shoot(who, 'typed-keypad-last-short', dialog, SHOTS_033)
      }
    }
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await dialog.waitFor({ state: 'hidden' })
    // ---- 17d. 40 dice at 390×844, scrolling: the keypad a row shorter on the last box all the same ----
    if (width === 390 && height === 844 && scheme === 'light') {
      await who.tab('Actions')
      await panel(who).getByRole('button', { name: /^Starfall damage/ }).first().click({ button: 'right' })
      await who.page.getByRole('menu').getByRole('menuitem', { name: 'Roll critical damage' }).click()
      const many = entryOf(who)
      await many.waitFor()
      await wait(300)
      const before = await keypadLook(many)
      const count = await many.locator('input').count()
      // The last box made current: a tap there, as a finger would.
      await many.locator('input').last().evaluate(input => input.focus())
      await until(async () => !(await keypadLook(many)).next, 'Next die to go', 5_000).catch(() => {})
      await wait(300)
      const after = await keypadLook(many)
      note(`at 390×844, ${count} dice scrolling: as the last box comes, the 5 key moves ${moved(before, after).five} px and Done ${moved(before, after).done} px (keypad ${before.pad.h} → ${after.pad.h} px)`)
      check(count === 40 && before.scrolls && lostARow(before, after),
        `at 390×844, with ${count} dice that scroll, on the last box: no "Next die", the keypad 50 ± 1 px shorter, every key the same size, the same gap above the buttons, Done still the row's last (${JSON.stringify({ before: before.pad.h, after: after.pad.h, gap: [before.gap, after.gap], scrolls: before.scrolls })})`)
      await many.getByRole('button', { name: 'Cancel' }).click()
      await many.waitFor({ state: 'hidden' })
      await who.tab('Character')
    }
    // ---- 17b. 40 boxes sideways: Starfall's critical, its dice beside the keypad, scrolled ----
    if (short && scheme === 'light') {
      await who.tab('Actions')
      await panel(who).getByRole('button', { name: /^Starfall damage/ }).first().click({ button: 'right' })
      await who.page.getByRole('menu').getByRole('menuitem', { name: 'Roll critical damage' }).click()
      const many = entryOf(who)
      await many.waitFor()
      await wait(300)
      const count = (await groupsOf(many)).flatMap(g => g.boxes).length
      const scrolled = await scrolledLook(many)
      check(count === 40 && scrolled.short && stuckWell(scrolled),
        `at ${width}×${height}, Starfall's critical asks for 40 boxes; scrolled half way and to the end, the keypad and Done stay inside the scroller, their block flush with its top beside the dice (${JSON.stringify(scrolled)})`)
      await shoot(who, 'typed-many-dice')
      await many.getByRole('button', { name: 'Cancel' }).click()
      await many.waitFor({ state: 'hidden' })
      await who.tab('Character')
    }
  }
  await who.view.close()
}

// ---- 18. The Gamemaster's page throws its dice ----
part('18. the Gamemaster')
{
  const before = requests()
  await gmPage.tab('Character').catch(() => {})
  await paced()
  await perception(gmPage).click()
  const thrown = await diceShown(gmPage)
  await until(() => requests() > before, "the Gamemaster's roll to be sent")
  const row = rollRow()
  await wait(500)
  check(thrown && await entryOf(gmPage).count() === 0 && !('typed' in row.payload), "a roll on the Gamemaster's page opens no dialog: its dice are thrown, and it's sent untyped")
  await until(() => settledRow(rollRow(row.id)), "the Gamemaster's roll to be made")
}

// ---- 16. Make Manual Rolls taken away, live ----
part('16. permission removed')
{
  const { manual } = await cog(alice)
  await setPermissions([3, 4])
  await until(async () => (await manual.count()) === 0, 'the switch to go', 15_000)
  check(stored() === 't' && same(roster().find(([id]) => id === 'thorin'), ['thorin', false]), 'Make Manual Rolls taken from Trusted players: the open cog loses the switch within a poll, the stored choice kept')
  await closeCog(alice)
  const before = { requests: requests(), posts: sentBy.get(alice).length }
  await alice.tab('Character')
  await paced()
  await perception(alice).click()
  const thrown = await diceShown(alice)
  await until(() => requests() > before.requests, 'the untyped check to be sent')
  const row = rollRow()
  check(thrown && await entryOf(alice).count() === 0 && !('typed' in row.payload) && !('typed' in (sentBy.get(alice)[before.posts] ?? {})),
    'the next roll opens no dialog: its dice are thrown here, and it is posted without typed')
  await until(() => settledRow(rollRow(row.id)), 'it to be made')
  await setPermissions([2, 3, 4])
  const { manual: back } = await cog(alice)
  await back.waitFor({ timeout: 15_000 })
  check(await back.isChecked(), 'given back, the switch comes back on')
  await closeCog(alice)
}

if (MIDI) {
  // ---- 19. Midi-QOL's prompts ----
  part('19. Midi-QOL')
  await game.settings.set('sending-stone', 'midiPromptWait', 5_000)
  const opened = () => postsOf('roll.prompt.opened').map(p => p.data.prompt)
  let spells = 0
  const monsterSpell = async () => {
    const slug = `hold${++spells}`
    const item = { id: slug, name: 'Hold Person', type: 'spell', uuid: `Actor.goblin.Item.${slug}`, flags: {}, system: { description: { value: '' } } }
    const workflow = await midiSaves.saveWorkflow({ actor: goblin, item, activity: midiSaves.saveActivity({ item, abilities: ['wis'], dc: 14 }), targets: [tokenOf.thorin.object ?? W.placeables.get('tok-thorin')], token: W.placeables.get('tok-goblin') })
    return { workflow, running: midiSaves.runSaves(workflow) }
  }
  let count = opened().length
  let running = (await monsterSpell()).running
  await until(() => opened().length > count, "Midi's prompt", 15_000)
  const row = banner.getByRole('listitem').filter({ hasText: 'Hold Person' })
  await row.waitFor({ timeout: 15_000 })
  const before = requests()
  entry = await asked(alice, () => row.getByRole('button', { name: /^Roll Wisdom saving throw/ }).click(), "Midi's save")
  const timer = (await entry.dialog.getByRole('timer').textContent()).trim()
  check(/^0:0[0-5] left to answer$/.test(timer), `Midi's prompt, its wait shortened to 5 s, shows "${timer}"`)
  await entry.dialog.waitFor({ state: 'hidden', timeout: 10_000 })
  await row.getByText('Midi rolled it').waitFor({ timeout: 15_000 })
  check(requests() === before, 'left alone, the dialog closes by itself, nothing is posted, and the banner says Midi rolled it')
  await running
  // Asked in Foundry too, and rolled there while the dialog is open.
  await game.settings.set('sending-stone', 'midiPromptWait', 60_000)
  game.users.get('alice').active = true
  W.midi.settings.playerRollSaves = 'chat'
  count = opened().length
  const second = await monsterSpell()
  await until(() => opened().length > count, "Midi's second prompt", 15_000)
  const row2 = banner.getByRole('listitem').filter({ hasText: 'Hold Person' })
  await row2.getByRole('timer').waitFor({ timeout: 15_000 })
  entry = await asked(alice, () => row2.getByRole('button', { name: /^Roll Wisdom saving throw/ }).click(), "Midi's second save")
  await until(() => typeof second.workflow.saveRequests?.['tok-thorin'] === 'function', "Midi's chat request")
  await thorin.rollSavingThrow({ ability: 'wis' }, { configure: false }, {})
  await second.running
  await entry.dialog.waitFor({ state: 'hidden', timeout: 15_000 })
  check(requests() === before, 'rolled in Foundry while the dialog is open: the dialog closes, nothing posted')
  game.users.get('alice').active = false
  W.midi.settings.playerRollSaves = 'none'
}

check(midiCritical === null || midiCritical.gm === 'doubleDice', "Midi-QOL's rule for the Gamemaster stayed Double Rolled Damage throughout")
await finish()
