// Damage on its own and recharges (module 0.36.0 and the app, its contract §3, §9, §13.3, §20 items
// 1-3), end to end, in the world of world-030.mjs. Alice plays Thorin in Ashlands, whose game rolls,
// attacks and lets players type their dice: his longsword, Burning Hands (a save spell, two slots),
// Second Wind (a heal), Chromatic Orb (a kind to choose), Withering Touch (damage that takes a die
// away), Fire Breath (a save, DEX 14, 2d6 fire, one use, Recharge 5–6, spent) and Twin Bolts (two
// uses, Recharge 6, one spent). The Gamemaster has the goblin targeted. The hello takes `itemDamage`
// and `recharge`; the cog's "Damage on its own", Send to the table's child, off until turned on, and
// disabled with Send off; off, a damage chip is rolled here only; on, it goes to the table as dnd5e's
// own damage or healing card, naming no target though the Gamemaster has one, flagged `alone`, the
// tray, the toast and the app's chat saying so; a critical hit's, the maximum and modified damage
// from the chip's menu; a save's and a heal's chips sending only their damage or healing, nothing
// spent, the save chip still casting; the kind menu first where it offers kinds; due damage still
// following its attack; typed dice marked; the Gamemaster's own switch and words; Fire Breath's
// Recharge chip left of its uses, rolled with a 5 and a 3, Twin Bolts' on a 6, refused at full.
// MIDI=1: no workflow made, dnd5e's card. DND5E6=1: dnd5e 6.0.5's typed card, `system.targets` [].
// SKEW=035 with MODULE=module-0.35.0: no switch, chips rolled here as before, no Recharge chip.
// Since module 0.41.0 (its contract §8.4.1, its weapons' steps from v1's §8.4.1), part 17, damage on
// its own with its choices: the hello's and the app's aloneChoices; the use picker before a chip
// that has anything to choose or spend, its At level chips, a battleaxe's modes, a longbow's
// ammunition and the Spend switch, remembered per device for the character; Foundry's card at the
// level, in the mode and with the ammunition picked, saying what was spent, and what dnd5e spends:
// a spell slot, a Potion of Healing's use, an arrow; the kind menu and typed dice after the picker;
// the Gamemaster's seat; the app's own refusals; under MIDI=1 Midi-QOL's Bonus Action refusing a
// spend. Steps 6-8 open the picker first. SKEW=040 with MODULE=module-0.40.0: no choices, the chip
// rolled at once. Every width in both themes. Synthetic characters only. Run with --import ./fvtt/unref-timers.mjs
// --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import { JSDOM } from 'jsdom'
import {
  BASE, DND5E6, MIDI, MODULE, SHOTS_041, SKEW035, SKEW040, W, browse, call, character, check, escapeRe, finish, foundryWorld, launch,
  manualDice, newCampaign, note, npc, part, posted, same, sameJson, settled, shoot, shootBoth, sideways, sql, startModule, theme, until,
  wait,
} from './world-030.mjs'

const GAME = 'https://ashlands-alone.forge-vtt.com'
const SECRET = 'ashlands-alone-36'
const TITLE = 'Ashlands'
const NEW = !SKEW035
/** The game takes damage on its own's choices, from module 0.41.0. */
const CHOICES = NEW && !SKEW040
await launch(GAME)
const { id: A } = await newCampaign({ title: TITLE, address: 'ashlands-alone.forge-vtt.com', secret: SECRET })
await foundryWorld({ dice6: DND5E6 })
const { Activity, HealActivity, SaveActivity, port } = await import('./fvtt/activity5e.mjs')
// Changed on purpose (round 0.41.0 §8.4): the module's own version.
game.modules.get('sending-stone').version = SKEW035 ? '0.35.0' : (SKEW040 ? '0.40.0' : '0.41.0')
manualDice('active')
// Thorin's player is Trusted, whom Make Manual Rolls is given to out of the box.
game.users.get('alice').role = 2
// A use's and a roll's card name the Gamemaster's targets, as dnd5e's do: so a card naming none says
// the module took them away.
port.targets = true
const { mergeObject, isEmpty } = foundry.utils
// An item's update as Foundry's: written, then `updateItem` on every client, as a recharge rolled in
// Foundry tells it, so the module sends the sheet again.
{
  const update = W.Item5e.prototype.update
  W.Item5e.prototype.update = async function (changes = {}) {
    await update.call(this, changes)
    await Hooks.callAll('updateItem', this, foundry.utils.expandObject(changes), {}, 'gm')
    return this
  }
}

if (DND5E6) {
  /**
   * dnd5e 6.0.5's damage card (D6 mixin.mjs:857-914, heal.mjs:69-74), as the module's harness ports
   * it (test/fvtt/alone.mjs): typed `damage`, or `healing` for a heal, its activity and item and the
   * Gamemaster's targets in its own data, no dnd5e flags.
   */
  const sources = activity => ({
    activity: { id: activity.id, name: activity.name, type: activity.type, uuid: activity.uuid },
    item: { id: activity.item.id, name: activity.item.name, type: activity.item.type, uuid: activity.item.uuid },
  })
  const descriptors = () => [...(game.user?.targets ?? [])].map(target => {
    const token = target.document ?? target
    return { actor: token.actor?.uuid, ac: token.actor?.system?.attributes?.ac?.value ?? null, name: token.name, token: token.uuid }
  })
  Activity.prototype.rollDamage = async function (config = {}, dialog = {}, message = {}) {
    const rollConfig = this.getDamageConfig(config)
    rollConfig.hookNames = [...(config.hookNames ?? []), 'damage']
    rollConfig.subject = this
    const messageConfig = mergeObject({
      create: true,
      data: {
        flavor: `${this.item.name} - ${this.damageFlavor}`,
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        system: { ...sources(this), targets: descriptors() },
        type: 'damage',
      },
    }, message)
    const rolls = await CONFIG.Dice.DamageRoll.build(rollConfig, mergeObject({ options: {} }, dialog), messageConfig)
    if (!rolls?.length) return
    const lastDamageTypes = rolls.reduce((obj, roll, index) => (roll.options.type ? { ...obj, [index]: roll.options.type } : obj), {})
    if (!isEmpty(lastDamageTypes) && this.actor?.items.has(this.item.id)) {
      await this.actor.items.get(this.item.id).setFlag('dnd5e', `last.${this.id}.damageType`, lastDamageTypes)
    }
    Hooks.callAll('dnd5e.rollDamage', rolls, { subject: this })
    Hooks.callAll('dnd5e.rollDamageV2', rolls, { subject: this })
    return rolls
  }
  delete SaveActivity.prototype.rollDamage
  HealActivity.prototype.rollDamage = function (config = {}, dialog = {}, message = {}) {
    return Activity.prototype.rollDamage.call(this, config, dialog, mergeObject({ 'data.type': 'healing' }, message))
  }
}

// ---- The world ----
const capital = text => text.charAt(0).toUpperCase() + text.slice(1)
const hits = (formula, type) => ({ formula, damageType: type, label: `${formula} ${capital(type)}` })
const recharge = (spent, formula = '5', max = 1) => ({ max, spent, recovery: [{ period: 'recharge', type: 'recoverAll', formula }] })
const ACTION = { type: 'action', value: 1 }
// Thorin, a fighter who casts a little: Strength +4, Wisdom +2, two 1st-level slots.
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 4, dex: 1, con: 2, wis: 2 }, hp: { value: 30, max: 44, temp: 0 } }, {
  ac: 18,
  spells: {
    spell1: { value: 2, max: 2, level: 1 },
    ...Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9].map(level => [`spell${level}`, { value: 0, max: 0, level }])),
  },
  items: [
    {
      id: 'longsword', name: 'Longsword', type: 'weapon', system: { properties: [], quantity: 1, attackType: 'melee', equipped: true },
      activities: [{ id: 'swing', attack: { ability: 'str' }, damage: [{ number: 1, denomination: 8, bonus: '@mod', types: ['slashing'] }], labels: { modifier: '+6', damage: [hits('1d8 + 4', 'slashing')] } }],
    },
    {
      id: 'hands', name: 'Burning Hands', type: 'spell',
      system: { level: 1, method: 'spell', prepared: 1, canPrepare: true, properties: [], duration: { units: 'inst' } },
      activities: [{
        id: 'flames', type: 'save', template: 'cone', affects: 'creature', save: ['dex'], dc: 13,
        damage: [{ number: 3, denomination: 6, types: ['fire'], scaling: 1 }], labels: { damage: [hits('3d6', 'fire')] },
      }],
    },
    {
      id: 'wind', name: 'Second Wind', type: 'feat', system: { properties: [], uses: { max: 1, spent: 0, recovery: [{ period: 'sr' }] } },
      activities: [{
        id: 'breather', type: 'heal', affects: 'self', range: 'self', activation: { type: 'bonus', value: 1 },
        consumption: [{ type: 'itemUses', value: 1 }],
        healing: { number: 1, denomination: 10, bonus: '5', types: ['healing'] }, labels: { damage: [hits('1d10 + 5', 'healing')] },
      }],
    },
    {
      id: 'orb', name: 'Chromatic Orb', type: 'spell',
      system: { level: 1, method: 'spell', prepared: 1, canPrepare: true, properties: [], duration: { units: 'inst' } },
      activities: [{
        id: 'orbCast', ability: 'wis', damage: [{ number: 3, denomination: 8, types: ['fire', 'cold'], scaling: 1 }],
        labels: { modifier: '+4', damage: [{ formula: '3d8', label: '3d8 Fire or Cold' }] },
      }],
    },
    // Damage that takes a die away, which can't be at its highest.
    {
      id: 'wither', name: 'Withering Touch', type: 'feat', system: { properties: [] },
      activities: [{ id: 'withered', type: 'damage', activation: ACTION, damage: [{ custom: '-1d4 + 2d6', types: ['cold'] }], labels: { damage: [hits('-1d4 + 2d6', 'cold')] } }],
    },
    {
      id: 'breath', name: 'Fire Breath', type: 'feat', system: { properties: [], uses: recharge(1) },
      activities: [{
        id: 'exhale', type: 'save', activation: ACTION, template: 'cone', affects: 'creature', save: ['dex'], dc: 14,
        damage: [{ number: 2, denomination: 6, types: ['fire'] }], labels: { damage: [hits('2d6', 'fire')] },
      }],
    },
    {
      id: 'bolts', name: 'Twin Bolts', type: 'feat', system: { properties: [], uses: recharge(1, '6', 2) },
      activities: [{ id: 'loose', type: 'damage', activation: ACTION, damage: [{ number: 1, denomination: 10, types: ['thunder'] }], labels: { damage: [hits('1d10', 'thunder')] } }],
    },
    // Module 0.41.0 (its contract §8.4.1): a Potion of Healing, a Bonus Action, its one use destroying
    // it, two of them; a versatile Battleaxe; and a Longbow, with Arrows and Arrows of Fire.
    {
      id: 'potion', name: 'Potion of Healing', type: 'consumable', system: { properties: [], quantity: 2, type: { value: 'potion' }, uses: { max: 1, spent: 0, autoDestroy: true } },
      activities: [{
        id: 'quaff', type: 'heal', activation: { type: 'bonus', value: 1 }, consumption: [{ type: 'itemUses', value: '1' }],
        healing: { number: 2, denomination: 4, bonus: '2', types: ['healing'] }, labels: { damage: [hits('2d4 + 2', 'healing')] },
      }],
    },
    {
      id: 'axe', name: 'Battleaxe', type: 'weapon', system: { properties: ['ver'], quantity: 1, attackType: 'melee', equipped: true },
      activities: [{ id: 'chop', attack: { ability: 'str' }, versatile: 10, damage: [{ number: 1, denomination: 8, bonus: '@mod', types: ['slashing'] }], labels: { modifier: '+6', damage: [hits('1d8 + 4', 'slashing')] } }],
    },
    {
      id: 'bow', name: 'Longbow', type: 'weapon', system: { properties: ['amm'], quantity: 1, attackType: 'ranged', equipped: true },
      activities: [{ id: 'shot', attack: { ability: 'dex' }, damage: [{ number: 1, denomination: 8, bonus: '@mod', types: ['piercing'] }], labels: { modifier: '+3', damage: [hits('1d8 + 1', 'piercing')] } }],
    },
    { id: 'arrows', name: 'Arrows', type: 'consumable', system: { type: { value: 'ammo' }, quantity: 20, properties: [] }, activities: [] },
    {
      id: 'firearrows', name: 'Arrows of Fire', type: 'consumable',
      system: { type: { value: 'ammo' }, quantity: 5, properties: [], damage: { base: { number: 1, denomination: 4, types: ['fire'] } } }, activities: [],
    },
  ],
})
thorin.system.details = { level: 5 }
thorin.system.attributes.spellcasting = 'wis'
thorin.system.attributes.spell = { dc: 13, attack: 4, mod: 2 }
game.users.get('alice').character = thorin
const goblin = npc('goblin', 'Goblin', 12)
// The goblin's token on the Gamemaster's canvas, targeted.
const goblinToken = { id: 'tok-goblin', name: 'Goblin', uuid: 'Scene.scene.Token.tok-goblin', actor: goblin, hidden: false, isLinked: true, disposition: -1 }
const goblinPlaceable = { id: goblinToken.id, name: 'Goblin', document: goblinToken, actor: goblin }
goblinToken.object = goblinPlaceable
W.placeables.set(goblinToken.id, goblinPlaceable)
goblin.speakerToken = goblinPlaceable
if (MIDI) canvas.scene.tokens.size = W.placeables.size
W.gm.targets = new Set([goblinPlaceable])
const campaign = { id: 'camp-ash', title: TITLE, characters: ['thorin'], groups: [], rolls: true, attacks: true, prompts: false, manualDice: true }
await startModule({ campaigns: [campaign], secrets: { 'camp-ash': SECRET } })
await settled()
// A fight, so that the longsword asks whom it attacks.
const { combat, combatant } = await import('./fvtt/stub.mjs')
const fight = combat('fight')
combatant(fight, 'cbGoblin', goblin, { name: 'Goblin', initiative: 12, token: goblinToken, tokenId: goblinToken.id })
combatant(fight, 'cbThorin', thorin, { initiative: 15 })
fight.getCombatantsByActor = actor => fight.combatants.filter(cb => cb.actor?.id === actor.id)
fight.started = true
fight.round = 1
fight.turn = 0
Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight'), configurable: true })
await Hooks.callAll('createCombat', fight)
await until(() => sql('select count(*) from combat') === '1', 'the app to hear of the fight', 15_000)

// ---- What's posted, kept and made ----
const hello = () => posted.filter(p => p.type === 'bridge.hello').at(-1)
const stored = () => sql(`select array_to_string("rollKinds", ',') from campaign where id = '${A}'`)
const requests = () => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}'`))
const rollRow = id => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, role, payload, "useId", result from roll_request ${id ? `where id = '${id}'` : `where "campaignId" = '${A}' order by "createdAt" desc limit 1`}) r`) || 'null')
const madeFor = id => W.messages.contents.find(m => m.flags?.['sending-stone']?.request === id)
const useCard = id => W.messages.contents.find(m => m.flags?.['sending-stone']?.use === id)
const messages = () => W.messages.size
const workflows = () => (MIDI ? W.midi.made.length : 0)
/** Wait for room under the app's limit of 20 rolls a minute from a seat. */
const paced = () => until(() => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}' and "createdAt" > now() - interval '1 minute'`)) < 15, 'room under the rate limit', 70_000)
/** Send what a tap rolls, and wait until the game has made it. */
async function sent(tap, what) {
  await paced()
  const before = requests()
  await tap()
  await until(() => requests() > before, `${what} to be sent`, 30_000)
  const request = rollRow()
  await until(() => ['done', 'failed'].includes(rollRow(request.id).status), `${what} to be made`, 30_000)
  return { request, made: rollRow(request.id) }
}
/** The face the app's next dice of `sides` show, or Math.random again. */
const force = (who, sides, value) => who.page.evaluate(([s, v]) => { globalThis.__random ??= Math.random; Math.random = () => (v - 0.5) / s }, [sides, value])
const unforce = who => who.page.evaluate(() => { if (globalThis.__random) Math.random = globalThis.__random })
/** A damage card's targets: dnd5e 5's flags, or dnd5e 6's own data. */
const targetsOf = message => (DND5E6 ? message?.system?.targets : message?.flags?.dnd5e?.targets)
/** A damage card's kind: dnd5e 5's roll type, or dnd5e 6's message type. */
const kindOf = message => (DND5E6 ? message?.type : message?.flags?.dnd5e?.roll?.type)
/** The badge the module puts on a message's card in Foundry, as Foundry draws a chat card. */
const { markAppRoll } = await import(`${MODULE}/scripts/command-rolls.mjs`)
function badgeOn(message) {
  const dom = new JSDOM(`<ol id="chat-log"><li class="chat-message"><header class="message-header"><h4 class="message-sender">Thorin</h4><span class="message-metadata"><time>Now</time></span></header><div class="message-content">${message.content ?? ''}</div></li></ol>`)
  const held = { document: globalThis.document, HTMLElement: globalThis.HTMLElement }
  Object.assign(globalThis, { document: dom.window.document, HTMLElement: dom.window.HTMLElement })
  try { markAppRoll(message, dom.window.document.querySelector('li')) } finally { Object.assign(globalThis, held) }
  return dom.window.document.querySelector('.sending-stone-badge')?.getAttribute('aria-label') ?? null
}

// ---- Alice plays Thorin ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const API = '/api/characters/sheet-thorin'
// The banner's page: Alice at 390, her results in the tray.
const alice = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin', toasts: false })
await alice.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const panelOf = who => who.page.getByRole('tabpanel').first()
const trayOf = who => who.page.getByRole('region', { name: 'Your rolls' })
const statusOf = who => trayOf(who).getByRole('status')
const toastLog = who => who.page.getByRole('log', { name: 'Roll results' })
// The posts each page makes of its rolls, as sent.
const sentBy = new Map()
const watchPosts = who => {
  sentBy.set(who, [])
  who.page.on('request', request => {
    if (request.method() === 'POST' && /\/rolls$/.test(request.url())) sentBy.get(who).push(request.postDataJSON())
  })
}
watchPosts(alice)
const postsBy = who => sentBy.get(who)
/** Each POST of a roll a page's refused, noted, for a failure's report. */
function watchRefusals(who) {
  who.page.on('response', async response => {
    if (response.request().method() === 'POST' && /\/rolls$/.test(response.url()) && response.status() !== 202) note(`refused: ${response.url().replace(BASE, '')} ${response.status()} ${await response.text().catch(() => '')} for ${response.request().postData()}`)
  })
}
watchRefusals(alice)

/** The page's cog, opened: its switches by their labels. */
async function cog(who) {
  const dialog = who.page.getByRole('dialog', { name: 'Settings' })
  if (!(await dialog.isVisible())) {
    await who.page.getByRole('button', { name: 'Settings', exact: true }).click()
    await dialog.waitFor()
  }
  return {
    dialog,
    send: dialog.getByRole('switch', { name: 'Send to the table', exact: true }),
    alone: dialog.getByRole('switch', { name: 'Damage on its own', exact: true }),
    manual: dialog.getByRole('switch', { name: 'Enter dice results manually', exact: true }),
  }
}
async function closeCog(who) {
  const dialog = who.page.getByRole('dialog', { name: 'Settings' })
  if (await dialog.isVisible()) {
    await who.page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
  }
}
/** Checks made at the end, of what was seen earlier, so that the steps after it run whatever it found. */
const deferred = []
const later = (cond, msg) => deferred.push([cond, msg])
/** A switch flipped as a finger does it: on its label, the input itself being drawn by the track. */
const flip = input => input.locator('xpath=ancestor::label[1]').click()
/** What a switch shows: checked, disabled, its hint, its block's classes and its label's. */
const switchLook = input => input.evaluate(el => {
  const label = el.closest('label')
  const block = label.parentElement
  const hint = document.getElementById(el.getAttribute('aria-describedby'))
  return {
    checked: el.checked, disabled: el.disabled, hint: hint?.textContent ?? null, block: block.className, label: label.className,
    height: label.getBoundingClientRect().height,
  }
})
/** The labels of the cog's switches and settings, in order. */
const cogOrder = dialog => dialog.evaluate(el => [...el.querySelectorAll('input[role=switch]')].map(input => input.closest('label').textContent.trim()))
/** A chip on the Actions tab, by its accessible name. */
const chip = (who, name) => panelOf(who).getByRole('button', { name, exact: true })
/** The menu a right-click on a chip opens, by its title. */
async function menuOf(who, button, title) {
  await button.scrollIntoViewIfNeeded()
  await button.click({ button: 'right' })
  const menu = who.page.getByRole('menu', { name: title })
  await menu.waitFor({ timeout: 10_000 })
  return menu
}
const menuItems = menu => menu.getByRole('menuitem').allTextContents()
/** The use picker damage on its own opens first, from module 0.41.0, by its title: the action's name. */
const pickerOf = (who, title) => who.page.getByRole('dialog', { name: title })
/**
 * What the picker shows: its lead; each row of chips by its legend, each chip's name, text, whether
 * it's picked or disabled, and its height; the Spend switch's name, state, hint and height; what its
 * live region says; its buttons' names; and what has focus.
 */
const pickerLook = dialog => dialog.evaluate(el => {
  const nameOf = node => node.getAttribute('aria-label') ?? node.textContent.replace(/\s+/g, ' ').trim()
  const rows = Object.fromEntries([...el.querySelectorAll('fieldset')].map(set => [set.querySelector('legend')?.textContent.trim(),
    [...set.querySelectorAll('[role=radio]')].map(chip => ({
      name: nameOf(chip), text: chip.textContent.replace(/\s+/g, ' ').trim(), checked: chip.getAttribute('aria-checked') === 'true',
      disabled: chip.disabled, height: chip.getBoundingClientRect().height,
    }))]))
  const input = el.querySelector('input[role=switch]')
  const label = input?.closest('label')
  const active = document.activeElement
  return {
    lead: [...el.querySelectorAll('p')].find(p => /^Its /.test(p.textContent.trim()))?.textContent.trim() ?? null,
    rows,
    spend: input ? {
      name: label.textContent.trim(), checked: input.checked, hint: document.getElementById(input.getAttribute('aria-describedby'))?.textContent ?? null,
      height: label.getBoundingClientRect().height,
    } : null,
    live: el.querySelector('[aria-live=polite]')?.textContent ?? null,
    buttons: [...el.querySelectorAll('button:not([role=radio])')].map(nameOf),
    focused: active === document.body ? 'body' : (active?.getAttribute('role') === 'switch' ? `switch ${active.closest('label')?.textContent.trim()}` : nameOf(active)),
  }
})
/** The picker's Spend switch set on or off, as a finger does it: on its label. */
async function setSpend(dialog, on) {
  const input = dialog.getByRole('switch')
  await input.waitFor({ state: 'attached', timeout: 10_000 })
  if ((await input.isChecked()) === on) return
  await input.locator('xpath=ancestor::label[1]').click()
  await until(async () => (await input.isChecked()) === on, `the Spend switch ${on ? 'on' : 'off'}`, 5_000)
}
/**
 * A chip's picker, opened once the page's sheet has what it's to show (`ready`, of its look), as the
 * page hears of a change in Foundry at its next poll: closed and opened again until then.
 */
async function openPicker(who, rowChip, title, ready = () => true) {
  const picker = pickerOf(who, title)
  const end = Date.now() + 20_000
  for (;;) {
    await rowChip.click()
    await picker.waitFor({ timeout: 10_000 })
    if (ready(await pickerLook(picker)) || Date.now() > end) return picker
    await who.page.keyboard.press('Escape')
    await picker.waitFor({ state: 'hidden', timeout: 10_000 })
    await wait(1000)
  }
}
/** What has focus on a page, by its accessible name. */
const focusedName = who => who.page.evaluate(() => {
  const el = document.activeElement
  return el === document.body ? 'body' : (el?.getAttribute('aria-label') ?? el?.textContent?.replace(/\s+/g, ' ').trim() ?? null)
})
const GAME_WORDS = 'your Gamemaster’s game'
// Changed on purpose (round 0.41.0 §8.4): from module 0.41.0 the hint says its choices are made as
// it's rolled.
const CHOOSING = CHOICES ? ' You choose a spell’s level, a weapon’s mode and its ammunition as you roll, and whether to spend what it uses.' : ''
const HINT = `Damage you roll goes to ${GAME_WORDS} with no attack or saving throw made there, for your Gamemaster to apply.${CHOOSING}`
const GM_HINT = `Damage you roll goes to your game with no attack or saving throw made there, for you to apply.${CHOOSING}`

if (SKEW035) {
  // =================================================================================================
  // 16. Module 0.35.0
  // =================================================================================================
  part('16. module 0.35.0')
  const features = hello().data.features ?? {}
  const kinds = features.rolls?.kinds ?? []
  check(!kinds.includes('itemDamage') && !kinds.includes('recharge') && !('companions' in features),
    `module 0.35.0's hello takes neither damage on its own nor recharges (${JSON.stringify(kinds)})`)
  await alice.tab('Actions')
  await chip(alice, 'Longsword attack, +6').waitFor({ timeout: 15_000 })
  const { dialog, send, alone } = await cog(alice)
  await send.waitFor({ timeout: 15_000 })
  await wait(1500)
  check(await alone.count() === 0 && !(await dialog.textContent()).includes('Damage on its own'), 'the cog has no "Damage on its own"')
  await closeCog(alice)
  const before = requests()
  const longsword = chip(alice, 'Longsword damage, 1d8 + 4')
  await longsword.click()
  await wait(3000)
  check(await longsword.isVisible() && requests() === before && postsBy(alice).length === 0,
    'the longsword\'s damage chip is named as before, and rolled here only: nothing is posted')
  check(await panelOf(alice).getByRole('button', { name: /recharge/i }).count() === 0, 'and Fire Breath\'s row has no Recharge chip')
  for (const width of [360, 1280]) {
    const view = await browse({ width, height: width < 1024 ? 780 : 800, path: '/characters/sheet-thorin', toasts: false })
    await view.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
    check(await sideways(view.page) === 0, `no horizontal scroll at ${width}`)
    await view.view.close()
  }
  await finish()
}

if (SKEW040) {
  // =================================================================================================
  // 18. Module 0.40.0 (round 0.41.0 §8.4.1)
  // =================================================================================================
  part('18. module 0.40.0')
  const rolls = hello().data.features.rolls
  check(rolls.kinds.includes('itemDamage') && !('aloneChoices' in rolls) && !('companionPrompts' in rolls),
    `module 0.40.0's hello takes damage on its own and says nothing of its choices (${JSON.stringify(Object.keys(rolls))})`)
  await until(() => stored().includes('itemDamage'), 'the app to keep the kinds', 15_000)
  const features = sql(`select array_to_string("rollFeatures", ',') from campaign where id = '${A}'`).split(',')
  check(!features.includes('aloneChoices') && JSON.parse(hello().body ?? '{}').features?.aloneChoices === 1,
    `the app keeps no aloneChoices, though it answers aloneChoices: 1 (${features.join(',')}; ${hello().body})`)
  await alice.tab('Actions')
  await chip(alice, 'Longsword attack, +6').waitFor({ timeout: 15_000 })
  const plan = (await call(alice.page, `${API}/table`)).json?.sheet?.actions?.flatMap(section => section.actions)
    .find(action => action.id === 'hands' && action.tableDamage)?.tableDamage
  check(!!plan && !('choices' in plan) && !('spends' in plan), `Burning Hands' plan as 0.40.0 sends it, without choices or spends (${JSON.stringify(Object.keys(plan ?? {}))})`)
  {
    const { alone } = await cog(alice)
    await alone.waitFor({ timeout: 15_000 })
    check((await switchLook(alone)).hint === HINT, `the cog's hint without its choices: "${(await switchLook(alone)).hint}"`)
    await flip(alone)
    await until(async () => (await switchLook(alone)).checked, 'the switch on', 5_000)
    await closeCog(alice)
  }
  const hands = chip(alice, 'Burning Hands damage, 3d6, goes to the table on its own')
  await hands.waitFor({ timeout: 10_000 })
  await force(alice, 6, 3)
  const { request, made } = await sent(() => hands.click(), 'Burning Hands\' damage alone')
  await unforce(alice)
  const card = madeFor(request.id)
  check(await alice.page.getByRole('dialog').count() === 0 && request.kind === 'itemDamage' && !('slot' in request.payload) && !('consume' in request.payload)
    && made.status === 'done' && card?.rolls[0].formula === '3d6' && thorin.system.spells.spell1.value === 2,
    `Burning Hands' chip rolls 3d6 at once: no picker, nothing named, nothing spent (${JSON.stringify(request.payload)}; ${card?.rolls[0].formula})`)
  await paced()
  const crafted = await call(alice.page, `${API}/rolls`, { method: 'POST', body: { kind: 'itemDamage', item: 'hands', activity: 'flames', slot: 'spell1', mode: 0, explicit: false, extras: [], dice: [{ faces: 6, results: [3, 3, 3] }] } })
  check(crafted.status === 409 && crafted.json?.reason === 'unavailable', `a crafted itemDamage naming a slot → 409 unavailable (${crafted.status} ${crafted.text})`)
  await finish()
}

// =================================================================================================
// 1. Offered
// =================================================================================================
part('1. offered')
{
  const kinds = hello().data.features.rolls.kinds
  check(kinds.includes('itemDamage') && kinds.includes('recharge'), `the hello takes damage on its own and recharges (${JSON.stringify(kinds)})`)
  await until(() => stored().includes('itemDamage') && stored().includes('recharge'), 'the app to keep the kinds', 15_000)
  check(true, `the app keeps them (${stored()})`)
}
await alice.tab('Actions')
await chip(alice, 'Longsword attack, +6').waitFor({ timeout: 15_000 })
{
  const { dialog, send, alone, manual } = await cog(alice)
  await alone.waitFor({ timeout: 15_000 })
  await manual.waitFor({ timeout: 15_000 })
  const order = await cogOrder(dialog)
  const at = order.findIndex(label => label.startsWith('Damage on its own'))
  check(order[at - 1]?.startsWith('Send to the table') && order[at + 1]?.startsWith('Enter dice results manually'),
    `"Damage on its own" right after "Send to the table" and before "Enter dice results manually" (${JSON.stringify(order)})`)
  const look = await switchLook(alone)
  check(/\bml-1\b/.test(look.block) && /\bborder-l\b/.test(look.block) && !/\bborder-t\b/.test(look.block),
    `as its child: set in with a rule at its left, none at its top (${look.block})`)
  check(!look.checked && !look.disabled && look.hint === HINT, `off out of the box, hinted "${look.hint}"`)
  check(look.height >= 44 && /\bmin-h-11\b/.test(look.label) && (await switchLook(send)).height >= 44, `its label a 44 px target, as Send's (${look.height})`)
  await shootBoth(alice, 'alone-cog-off', dialog)
  await flip(send)
  await until(async () => (await switchLook(alone)).disabled, 'the switch disabled with Send off', 5_000)
  const off = await switchLook(alone)
  check(off.disabled && !off.checked && off.hint === 'Turn on Send to the table first.' && /cursor-not-allowed/.test(off.label),
    `with Send to the table off it's disabled, drawn and announced off, hinted "${off.hint}"`)
  await shootBoth(alice, 'alone-cog-disabled', dialog)
  await flip(send)
  await until(async () => !(await switchLook(alone)).disabled, 'the switch enabled again', 5_000)
  const back = await switchLook(alone)
  check(!back.disabled && !back.checked && back.hint === HINT, 'Send back on: as it was, off, its hint again')
  await closeCog(alice)
}

// =================================================================================================
// 2. Off
// =================================================================================================
part('2. off')
{
  const longsword = chip(alice, 'Longsword damage, 1d8 + 4')
  await longsword.waitFor()
  const before = requests()
  const posts = postsBy(alice).length
  await longsword.click()
  await statusOf(alice).getByText(/Longsword damage/).waitFor({ timeout: 15_000 })
  await wait(2500)
  check(requests() === before && postsBy(alice).length === posts,
    'switched off, the longsword\'s damage chip, "Longsword damage, 1d8 + 4", with no attack, is rolled here only: nothing is posted')
}

// =================================================================================================
// 3. On
// =================================================================================================
part('3. on')
{
  const { alone, dialog } = await cog(alice)
  await flip(alone)
  await until(async () => (await switchLook(alone)).checked, 'the switch on', 5_000)
  await shootBoth(alice, 'alone-cog-on', dialog)
  await closeCog(alice)
}
const ALONE = ', goes to the table on its own'
const longsword = chip(alice, `Longsword damage, 1d8 + 4${ALONE}`)
await longsword.waitFor({ timeout: 10_000 })
{
  const look = await longsword.evaluate(el => ({ title: el.getAttribute('title'), icons: el.querySelectorAll('svg').length, classes: el.className }))
  check(look.title === '1d8 + 4' || look.title === null || !/own/.test(look.title ?? ''), `on, the chip is named "Longsword damage, 1d8 + 4${ALONE}", its title still its formula (${look.title})`)
  note(`its look: ${JSON.stringify(look)}`)
}
let aloneTotal
{
  const flows = workflows()
  await force(alice, 8, 6)
  const { request, made } = await sent(() => longsword.click(), 'the longsword\'s damage on its own')
  await unforce(alice)
  check(request.kind === 'itemDamage' && sameJson(request.payload, { kind: 'itemDamage', item: 'longsword', activity: 'swing', mode: 0, explicit: false, extras: [], dice: [{ faces: 8, results: [6] }] })
    && !request.useId, `the app sends it as damage on its own, the longsword's swing, with the d8 thrown here (${JSON.stringify(request.payload)})`)
  const card = madeFor(request.id)
  check(made.status === 'done' && card && kindOf(card) === 'damage' && (DND5E6 || card.flags.dnd5e.messageType === 'roll'),
    `Foundry gets dnd5e's damage card (${DND5E6 ? `type ${card?.type}` : `messageType ${card?.flags?.dnd5e?.messageType}, roll.type ${card?.flags?.dnd5e?.roll?.type}`})`)
  check(same(targetsOf(card), []) && W.gm.targets.size === 1, `naming no target, though the Gamemaster has the goblin targeted (${JSON.stringify(targetsOf(card))})`)
  check(card.author?.id === 'alice' && !(card.whisper?.length) && card.flags['sending-stone']?.alone === true,
    `authored as Alice, public, flagged alone (${JSON.stringify(card.flags['sending-stone'])})`)
  check(card.rolls[0].dice[0].results.map(r => r.result).join() === '6' && card.rolls[0].total === 10, `with Alice's d8, a 6, for 10 (${card.rolls[0].formula} = ${card.rolls[0].total})`)
  if (MIDI) check(workflows() === flows, `no Midi-QOL workflow made (${workflows()} as before)`)
  aloneTotal = card.rolls[0].total
  await statusOf(alice).getByText(`At the table: ${aloneTotal} · on its own, for your Gamemaster to apply`).waitFor({ timeout: 30_000 })
  check(true, `the tray: "At the table: ${aloneTotal} · on its own, for your Gamemaster to apply"`)
  await shootBoth(alice, 'alone-alone-tray', trayOf(alice))
}
// The same on a page with toasts.
const toasting = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin' })
await toasting.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await toasting.page.evaluate(key => { try { localStorage.setItem(key, 'on') } catch {} }, 'sending-stone:send-damage')
await toasting.page.reload()
await toasting.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await toasting.tab('Actions')
{
  const toastChip = chip(toasting, `Longsword damage, 1d8 + 4${ALONE}`)
  await toastChip.waitFor({ timeout: 15_000 })
  check(true, 'the switch is the device\'s: another page in the same browser has it on too')
  await force(toasting, 8, 3)
  const { request } = await sent(() => toastChip.click(), 'the toast page\'s damage on its own')
  await unforce(toasting)
  const toast = toastLog(toasting).locator('[data-roll-toast]').filter({ hasText: 'At the table: 7' })
  await toast.waitFor({ timeout: 30_000 })
  const text = await toast.textContent()
  check(request.kind === 'itemDamage' && text.includes('Longsword damage') && !text.includes('Longsword damage damage') && text.includes('on its own'),
    `the toast titled "Longsword damage", never "Longsword damage damage": "${text}"`)
  await shootBoth(toasting, 'alone-alone-toast', toast)
}
// The app's chat: the card with its note, on Alice's side.
{
  await alice.chat()
  const bubble = alice.log.locator('[data-side]').filter({ hasText: 'On its own, for the Gamemaster to apply' }).first()
  await bubble.waitFor({ timeout: 30_000 }).catch(async () => {
    const seen = (await call(alice.page, `${API}/table`)).json?.messages?.map(m => ({ alone: m.alone, damage: m.damage?.length, text: (m.text ?? '').slice(0, 40), flavor: m.flavor }))
    const sentAlone = posted.filter(p => p.type?.startsWith('chat.message')).map(p => p.data?.message).filter(m => m?.alone !== undefined).length
    note(`the app's messages: ${JSON.stringify(seen)}; the module's messages marked alone: ${sentAlone}`)
  })
  const side = await bubble.getAttribute('data-side')
  const view = (await call(alice.page, `${API}/table`)).json
  const message = view.messages.find(m => m.alone === true)
  check(side === 'me' && message && (message.damage?.length ?? 0) > 0,
    `the app's chat shows the damage card with "On its own, for the Gamemaster to apply" under it, on Alice's side (data-side ${side})`)
  await shootBoth(alice, 'alone-alone-chat', bubble)
  await alice.character()
  await alice.tab('Actions')
}

// =================================================================================================
// 4. Critical hit
// =================================================================================================
part('4. critical hit')
{
  const menu = await menuOf(alice, longsword, 'Longsword damage 1d8 + 4')
  const items = await menuItems(menu)
  check(same(items, ['Roll critical damage', 'Roll maximum damage', 'Modify damage…']), `the chip's menu: ${JSON.stringify(items)}`)
  await force(alice, 8, 5)
  const { request, made } = await sent(() => menu.getByRole('menuitem', { name: 'Roll critical damage' }).click(), 'a critical hit\'s damage on its own')
  await unforce(alice)
  const card = madeFor(request.id)
  check(request.payload.critical === true && same(request.payload.dice, [{ faces: 8, results: [5, 5] }]),
    `sent critical, its dice the plan's critical: the d8 twice (${JSON.stringify(request.payload)})`)
  check(made.status === 'done' && card?.rolls[0].options.isCritical === true && card.rolls[0].total === 14 && same(targetsOf(card), []),
    `the card critical: ${card?.rolls[0].formula} = ${card?.rolls[0].total}`)
}

// =================================================================================================
// 5. Maximum and Modify damage
// =================================================================================================
part('5. maximum and modify')
{
  let menu = await menuOf(alice, longsword, 'Longsword damage 1d8 + 4')
  const { request, made } = await sent(() => menu.getByRole('menuitem', { name: 'Roll maximum damage' }).click(), 'the maximum')
  const card = madeFor(request.id)
  check(same(request.payload.modifiers, { maximize: true }) && made.status === 'done' && card?.rolls[0].total === 12,
    `Maximum: sent with maximize, made so: ${card?.rolls[0].formula} = ${card?.rolls[0].total}`)
  menu = await menuOf(alice, longsword, 'Longsword damage 1d8 + 4')
  await menu.getByRole('menuitem', { name: 'Modify damage…' }).click()
  const modify = alice.page.getByRole('dialog', { name: 'Modify damage' })
  await modify.waitFor()
  const critical = await modify.getByRole('checkbox', { name: /critical/i }).count() + await modify.getByRole('switch', { name: /critical/i }).count()
  check(critical === 1, 'Modify damage offers a critical hit for the longsword')
  const more = modify.getByRole('button', { name: /^(One d8 more|A die more|One die more)/ }).first()
  if (await more.count()) await more.click()
  else await modify.getByRole('spinbutton').first().fill('2')
  await force(alice, 8, 2)
  const done = modify.getByRole('button', { name: /^Roll/ }).last()
  const modified = await sent(() => done.click(), 'the modified damage')
  await unforce(alice)
  const modifiedCard = madeFor(modified.request.id)
  check(modified.request.kind === 'itemDamage' && (modified.request.payload.modifiers?.extraDice ?? modified.request.payload.modifiers?.dice ?? modified.request.payload.modifiers) && modified.made.status === 'done',
    `Modify damage: sent changed and made so (${JSON.stringify(modified.request.payload.modifiers)}; ${modifiedCard?.rolls[0].formula})`)
  // Withering Touch takes a die away: never at its highest.
  const withering = chip(alice, `Withering Touch damage, -1d4 + 2d6${ALONE}`)
  await withering.waitFor()
  const witherMenu = await menuOf(alice, withering, 'Withering Touch damage -1d4 + 2d6')
  const ways = await menuItems(witherMenu)
  check(!ways.includes('Roll maximum damage') && ways.includes('Modify damage…'), `Maximum not offered on a formula that takes a die away (${JSON.stringify(ways)})`)
  await alice.page.keyboard.press('Escape')
}

// =================================================================================================
// 6. Burning Hands
// =================================================================================================
part('6. burning hands')
{
  const slots = () => thorin.system.spells.spell1.value
  const hands = chip(alice, `Burning Hands damage, 3d6${ALONE}`)
  await hands.waitFor()
  const before = messages()
  await force(alice, 6, 4)
  // Changed on purpose (round 0.41.0 §8.4): from module 0.41.0 its chip opens the use picker first,
  // its Spend switch alone with one pool of slots, turned off here, so nothing is spent.
  let look = null
  const { request, made } = await sent(async () => {
    await hands.click()
    if (!CHOICES) return
    const picker = pickerOf(alice, 'Burning Hands')
    await picker.waitFor({ timeout: 10_000 })
    await setSpend(picker, false)
    look = await pickerLook(picker)
    await picker.getByRole('button', { name: 'Roll damage' }).click()
  }, 'Burning Hands\' damage alone')
  await unforce(alice)
  if (CHOICES) {
    check(same(look?.rows, {}) && look.spend?.name === 'Spend a 1st-level spell slot' && !look.spend.checked && request.payload.slot === 'spell1' && !('consume' in request.payload),
      `its chip opens the picker first: no chips with one pool of slots, "Spend a 1st-level spell slot" turned off; sent at its slot, spending nothing (${JSON.stringify({ look, payload: request.payload })})`)
  }
  const card = madeFor(request.id)
  check(request.kind === 'itemDamage' && request.payload.item === 'hands' && request.payload.activity === 'flames' && made.status === 'done' && kindOf(card) === 'damage',
    `Burning Hands' damage chip sends its damage alone (${JSON.stringify(request.payload)})`)
  check(!useCard(request.id) && messages() === before + 1 && slots() === 2, `no usage card, and 2 of 2 slots still (${slots()})`)
  const menu = await menuOf(alice, hands, 'Burning Hands damage 3d6')
  const ways = await menuItems(menu)
  check(!ways.includes('Roll critical damage'), `its menu offers no critical hit (${JSON.stringify(ways)})`)
  if (ways.includes('Modify damage…')) {
    await menu.getByRole('menuitem', { name: 'Modify damage…' }).click()
    const modify = alice.page.getByRole('dialog', { name: 'Modify damage' })
    await modify.waitFor()
    const critical = await modify.getByRole('checkbox', { name: /critical/i }).count() + await modify.getByRole('switch', { name: /critical/i }).count()
    check(critical === 0, 'nor does its Modify damage')
    await alice.page.keyboard.press('Escape')
    await modify.waitFor({ state: 'hidden' })
  } else {
    check(true, 'nor does its Modify damage, not offered')
    await alice.page.keyboard.press('Escape')
  }
  const save = chip(alice, 'Burning Hands, DEX saving throw DC 13')
  await save.click()
  const picker = alice.page.getByRole('dialog', { name: 'Burning Hands' })
  await picker.waitFor({ timeout: 10_000 })
  await picker.getByRole('checkbox', { name: 'Goblin', exact: true }).click()
  const cast = await sent(() => picker.getByRole('button', { name: 'Cast at 1 target' }).click(), 'Burning Hands cast from its save chip')
  check(cast.request.kind === 'use' && cast.made.status === 'done' && !!useCard(cast.request.id) && slots() === 1,
    `its save chip still casts it: a usage card, 1 of 2 slots left (${cast.request.kind}, ${slots()})`)
  // Its damage then rolls on its use, as a cast's does, not on its own.
  const followed = () => JSON.parse(sql(`select coalesce(json_agg(r)::text, '[]') from (select kind, status from roll_request where "useId" = '${cast.request.id}') r`))
  await until(() => followed().some(r => ['done', 'failed'].includes(r.status)), 'the cast\'s damage to follow it', 30_000)
  check(same(followed().map(r => r.kind), ['damage']), `and its damage follows on the cast's use, as damage (${JSON.stringify(followed())})`)
}

// =================================================================================================
// 7. Second Wind
// =================================================================================================
part('7. second wind')
{
  const wind = chip(alice, `Second Wind healing, 1d10 + 5${ALONE}`)
  await wind.waitFor()
  const spent = thorin.items.get('wind').system.uses.spent
  // Changed on purpose (round 0.41.0 §8.4): the picker first, its switch spending a use, turned off.
  let look = null
  const { request, made } = await sent(async () => {
    await wind.click()
    if (!CHOICES) return
    const picker = pickerOf(alice, 'Second Wind')
    await picker.waitFor({ timeout: 10_000 })
    await setSpend(picker, false)
    look = await pickerLook(picker)
    await picker.getByRole('button', { name: 'Roll healing' }).click()
  }, 'Second Wind\'s healing alone')
  if (CHOICES) {
    check(same(look?.rows, {}) && look.spend?.name === 'Spend a use of Second Wind' && !look.spend.checked && !look.buttons.includes('Roll damage') && !('consume' in request.payload),
      `the picker first: "Spend a use of Second Wind", turned off, and "Roll healing" (${JSON.stringify(look)})`)
  }
  const card = madeFor(request.id)
  check(request.kind === 'itemDamage' && made.status === 'done' && kindOf(card) === 'healing' && card.flags['sending-stone']?.alone === true,
    `"Second Wind healing, 1d10 + 5${ALONE}" makes a healing card (${kindOf(card)})`)
  check(thorin.items.get('wind').system.uses.spent === spent && same(targetsOf(card), []), 'no use spent, no target named')
}

// =================================================================================================
// 8. A kind to choose
// =================================================================================================
part('8. a kind to choose')
{
  const orb = chip(alice, `Chromatic Orb damage, 3d8${ALONE}`)
  await orb.waitFor()
  await orb.click()
  // Changed on purpose (round 0.41.0 §8.4): the picker first, its switch off, then the kind menu.
  if (CHOICES) {
    const picker = pickerOf(alice, 'Chromatic Orb')
    await picker.waitFor({ timeout: 10_000 })
    await setSpend(picker, false)
    const look = await pickerLook(picker)
    check(same(look.rows, {}) && look.spend?.name === 'Spend a 1st-level spell slot' && !look.spend.checked,
      `the picker first, "Spend a 1st-level spell slot" turned off (${JSON.stringify(look)})`)
    await picker.getByRole('button', { name: 'Roll damage' }).click()
  }
  const menu = alice.page.getByRole('menu').filter({ hasText: /Roll fire damage/i })
  await menu.waitFor({ timeout: 10_000 })
  const items = (await menuItems(menu)).map(t => t.trim())
  check(items.some(t => /^Roll fire damage$/i.test(t)) && items.some(t => /^Roll cold damage$/i.test(t)) && requests() > 0,
    `the kind menu first, opened from the chip: ${JSON.stringify(items)}`)
  const { request, made } = await sent(() => menu.getByRole('menuitem', { name: /^Roll cold damage$/i }).click(), 'the orb\'s cold damage alone')
  const card = madeFor(request.id)
  check(request.kind === 'itemDamage' && same(request.payload.types, ['cold']) && made.status === 'done' && card?.rolls[0].options.type === 'cold',
    `the card's damage of the kind chosen, cold (${JSON.stringify(request.payload.types)}, ${card?.rolls[0].options.type})`)
}

// =================================================================================================
// 9. Due damage still follows its attack
// =================================================================================================
part('9. due damage follows its attack')
{
  const picker = alice.page.getByRole('dialog', { name: 'Longsword attack' })
  await alice.page.evaluate(() => { globalThis.__random ??= Math.random; Math.random = () => (15 - 0.5) / 20 })
  await chip(alice, 'Longsword attack, +6').click()
  await picker.waitFor()
  const attack = await sent(() => picker.getByRole('button', { name: /^Goblin/ }).click(), 'the attack')
  await unforce(alice)
  check(attack.made.status === 'done' && attack.made.result.damage?.rolls?.[0]?.dice?.[0]?.faces === 8,
    `an attack at the goblin, made, its damage due (${JSON.stringify(attack.made.result.damage?.rolls?.[0]?.formula)})`)
  const due = chip(alice, 'Longsword damage, 1d8 + 4')
  await due.waitFor({ timeout: 30_000 })
  check(await chip(alice, `Longsword damage, 1d8 + 4${ALONE}`).count() === 0, 'while its damage is due, the chip is named without "goes to the table on its own"')
  const { request, made } = await sent(() => due.click(), 'the due damage')
  check(request.kind === 'damage' && request.useId === attack.request.id && made.status === 'done', `its tap sends damage on its use, not itemDamage (${request.kind})`)
  await longsword.waitFor({ timeout: 15_000 })
  check(true, 'and once rolled, the chip goes to the table on its own again')
}

// =================================================================================================
// 10. Typed dice
// =================================================================================================
part('10. typed dice')
{
  const { manual } = await cog(alice)
  await flip(manual)
  await until(async () => (await switchLook(manual)).checked, 'manual dice on', 5_000)
  await closeCog(alice)
  await longsword.click()
  const entry = alice.page.getByRole('dialog').filter({ hasText: 'Type in what your dice show' })
  await entry.waitFor({ timeout: 10_000 })
  await entry.locator('input').first().fill('7')
  const { request, made } = await sent(() => entry.getByRole('button', { name: 'Done' }).click(), 'typed damage alone')
  const card = madeFor(request.id)
  check(request.kind === 'itemDamage' && request.payload.typed === true && same(request.payload.dice, [{ faces: 8, results: [7] }]) && made.status === 'done',
    `typed, the request says so (${JSON.stringify(request.payload)})`)
  check(badgeOn(card) === 'Entered by hand on Sending Stone', `the card marked "Entered by hand" (${badgeOn(card)})`)
  const { manual: again } = await cog(alice)
  await flip(again)
  await until(async () => !(await switchLook(again)).checked, 'manual dice off', 5_000)
  await closeCog(alice)
}

// =================================================================================================
// 11. The Gamemaster's seat
// =================================================================================================
part('11. the gamemaster')
const gm = { ...alice, page: await alice.view.newPage() }
gm.page.on('pageerror', e => note(`gm pageerror: ${e.message}`))
await gm.page.goto(`${BASE}/campaigns/${A}/characters/thorin`)
await gm.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
gm.nav = gm.page.getByRole('navigation', { name: 'Table' })
gm.log = gm.page.getByRole('list', { name: 'Chat log' })
gm.tab = name => gm.page.getByRole('tablist', { name: 'Character sheet' }).getByRole('tab', { name: new RegExp(`^${name}\\b`) }).click()
await gm.tab('Actions')
{
  const { alone, dialog } = await cog(gm)
  await alone.waitFor({ timeout: 15_000 })
  const look = await switchLook(alone)
  check(!look.checked && look.hint === GM_HINT, `its own switch, off though Alice's is on in this browser, hinted "${look.hint}"`)
  await flip(alone)
  await until(async () => (await switchLook(alone)).checked, 'the Gamemaster\'s switch on', 5_000)
  await shootBoth(gm, 'alone-cog-gm', dialog)
  await closeCog(gm)
  const gmChip = gm.page.getByRole('tabpanel').first().getByRole('button', { name: `Longsword damage, 1d8 + 4${ALONE}`, exact: true })
  await gmChip.waitFor({ timeout: 10_000 })
  const { request, made } = await sent(() => gmChip.click(), 'the Gamemaster\'s damage alone')
  const card = madeFor(request.id)
  check(request.role === 'gm' && made.status === 'done' && card?.author?.id === 'alice' && card.flags['sending-stone']?.alone === true
    && badgeOn(card) === 'Rolled on Sending Stone by the Gamemaster', `on, the card marked the Gamemaster's, authored as Alice (${badgeOn(card)})`)
  await gm.page.getByRole('region', { name: 'Your rolls' }).getByRole('status').getByText(/ · on its own, for you to apply$/).waitFor({ timeout: 30_000 }).catch(() => {})
  const gmStatus = await gm.page.getByRole('region', { name: 'Your rolls' }).getByRole('status').textContent().catch(() => '')
  const toastText = await gm.page.getByRole('log', { name: 'Roll results' }).textContent().catch(() => '')
  check(/on its own, for you to apply/.test(gmStatus) || /on its own, for you to apply/.test(toastText), `the Gamemaster's tray: "… · on its own, for you to apply"`)
  await gm.nav.getByRole('button', { name: /^Chat/ }).click()
  const bubble = gm.log.locator('[data-side]').filter({ hasText: 'On its own, for you to apply' }).first()
  await bubble.waitFor({ timeout: 30_000 })
  check(await bubble.isVisible(), 'and its chat note: "On its own, for you to apply"')
  await gm.page.close()
}

// =================================================================================================
// 12. Recharge
// =================================================================================================
part('12. recharge')
const BREATH_CHIP = 'Roll Fire Breath’s recharge: 5 or more on a d6'
/** A row on the Actions tab, by its name: the li holding its name's button. */
const rowOf = (who, name) => panelOf(who).locator('li').filter({ has: who.page.getByRole('button', { name: new RegExp(`^${escapeRe(name)}\\b`) }) }).last()
const breathRow = rowOf(alice, 'Fire Breath')
const breathChip = breathRow.getByRole('button', { name: BREATH_CHIP, exact: true })
await breathChip.waitFor({ timeout: 15_000 })
{
  const look = await breathRow.evaluate(row => {
    const chipEl = [...row.querySelectorAll('button')].find(b => /recharge/.test(b.getAttribute('aria-label') ?? ''))
    const box = chipEl.parentElement
    const shown = [...box.children].map(el => (el.getAttribute('aria-label') ?? el.textContent).trim())
    return { shown, title: chipEl.getAttribute('title'), height: chipEl.getBoundingClientRect().height, text: row.textContent }
  })
  check(/Recharge 5–6/.test(look.text), `its detail line says "Recharge 5–6" (${look.text})`)
  const at = look.shown.indexOf(BREATH_CHIP)
  check(at >= 0 && /^0\/1|0 of 1/.test(look.shown[at + 1] ?? '') , `its chips in order: Recharge, then 0/1 (${JSON.stringify(look.shown)})`)
  check(look.shown.slice(at + 2).some(t => /DEX/.test(t)) && look.shown.slice(at + 2).some(t => /2d6/.test(t)), 'then DEX 14 and 2d6')
  check(look.height >= 44 && look.title === 'Roll a d6 to recharge it', `the chip 44 px tall (${look.height}), titled "${look.title}"`)
  await shootBoth(alice, 'alone-recharge-row', breathRow)
}
{
  const { send } = await cog(alice)
  await flip(send)
  await closeCog(alice)
  await breathChip.waitFor({ state: 'detached', timeout: 10_000 })
  check(await breathChip.count() === 0, 'with Send to the table off, no Recharge chip')
  const { send: on } = await cog(alice)
  await flip(on)
  await closeCog(alice)
  await breathChip.waitFor({ timeout: 10_000 })
}
let firstRecharge
{
  await breathChip.focus()
  // Where focus is as the chip goes, for the report should it go astray.
  await alice.page.evaluate(() => {
    globalThis.__focusTrail = []
    const chipEl = document.activeElement
    const id = setInterval(() => {
      const el = document.activeElement
      const said = `${el === document.body ? 'body' : `${el?.tagName} ${(el?.getAttribute('aria-label') ?? el?.textContent ?? '').slice(0, 40)}`}, the chip ${chipEl.isConnected ? 'there' : 'gone'}`
      if (globalThis.__focusTrail.at(-1) !== said) globalThis.__focusTrail.push(said)
    }, 20)
    setTimeout(() => clearInterval(id), 30_000)
  })
  await force(alice, 6, 5)
  const { request, made } = await sent(() => alice.page.keyboard.press('Enter'), 'Fire Breath\'s recharge')
  await unforce(alice)
  firstRecharge = request
  check(request.kind === 'recharge' && sameJson(request.payload, { kind: 'recharge', item: 'breath', mode: 0, explicit: false, extras: [], dice: [{ faces: 6, results: [5] }] }),
    `tapped with a 5: sent as a recharge (${JSON.stringify(request.payload)})`)
  check(made.status === 'done' && thorin.items.get('breath').system.uses.spent === 0, 'Foundry recharges it: its uses 1/1')
  await statusOf(alice).getByText('At the table: 5 · recharged').waitFor({ timeout: 30_000 })
  check(true, 'the tray: "At the table: 5 · recharged"')
  await shootBoth(alice, 'alone-recharge-done', trayOf(alice))
  await breathChip.waitFor({ state: 'detached', timeout: 15_000 })
  const focused = await alice.page.evaluate(() => {
    const el = document.activeElement
    return el === document.body ? { tag: 'BODY' } : { tag: el?.tagName, name: el?.getAttribute('aria-label') ?? el?.textContent?.trim().slice(0, 40), row: el?.closest('li')?.textContent?.slice(0, 40) }
  })
  const trail = await alice.page.evaluate(() => globalThis.__focusTrail)
  // Checked last, so that every step after it runs whatever it finds.
  later(/Fire Breath/.test(focused.row ?? '') && focused.tag === 'BUTTON',
    `the chip gone once full, focus on the row's uses count or name (${JSON.stringify(focused)}; focus as it went: ${JSON.stringify(trail)})`)
}
// Spent again in Foundry, and a 3.
{
  await thorin.items.get('breath').update({ 'system.uses.spent': 1 })
  await Hooks.callAll('updateActor', thorin, {}, {}, 'gm')
  await breathChip.waitFor({ timeout: 30_000 })
  await force(alice, 6, 3)
  const { made } = await sent(() => breathChip.click(), 'Fire Breath\'s second recharge')
  await unforce(alice)
  check(made.status === 'done' && thorin.items.get('breath').system.uses.spent === 1, 'a 3: it didn\'t recharge, still spent')
  await statusOf(alice).getByText('At the table: 3 · didn’t recharge').waitFor({ timeout: 30_000 })
  check(true, 'the tray: "At the table: 3 · didn’t recharge"')
  await shootBoth(alice, 'alone-recharge-failed', trayOf(alice))
  // The earlier rolls' list.
  const earlier = trayOf(alice).getByRole('listitem').filter({ hasText: 'Fire Breath recharged' }).first()
  await earlier.waitFor({ timeout: 10_000 }).catch(async () => {
    const more = trayOf(alice).getByRole('button', { name: /earlier|more|rolls/i }).first()
    if (await more.count()) await more.click()
  })
  const text = await trayOf(alice).textContent()
  check(/Fire Breath recharged/.test(text) && /· table 5, recharged/.test(text) && !/table 5, saved/.test(text),
    `in the rolls' history the first reads "Fire Breath recharged" with "· table 5, recharged", never saved`)
}
// Twin Bolts: one of two, Recharge 6.
{
  const bolts = rowOf(alice, 'Twin Bolts').getByRole('button', { name: 'Roll Twin Bolts’s recharge: a 6 on a d6', exact: true })
  await bolts.waitFor({ timeout: 10_000 })
  await force(alice, 6, 6)
  const { made } = await sent(() => bolts.click(), 'Twin Bolts\' recharge')
  await unforce(alice)
  check(made.status === 'done' && thorin.items.get('bolts').system.uses.spent === 0, 'Twin Bolts (1 of 2) shows "Roll Twin Bolts’s recharge: a 6 on a d6", and recharges on a 6')
}
// Charged already: a POST, and the chip tapped once Foundry has recharged it alone.
{
  // Once the app has Twin Bolts' sheet as full, the app itself refuses one.
  await rowOf(alice, 'Twin Bolts').getByRole('button', { name: /recharge/ }).waitFor({ state: 'detached', timeout: 30_000 })
  await paced()
  const posted_ = await call(alice.page, `${API}/rolls`, { method: 'POST', body: { kind: 'recharge', item: 'bolts', mode: 0, explicit: false, extras: [], dice: [{ faces: 6, results: [4] }] } })
  check(posted_.status === 422 && posted_.json?.reason === 'charged', `a POST of a recharge at full → refused "charged" (${posted_.status}, ${posted_.text})`)
  // Spent in the app's sheet, recharged in Foundry alone: the chip's tap is refused.
  await thorin.items.get('breath').update({ 'system.uses.spent': 1 })
  await Hooks.callAll('updateActor', thorin, {}, {}, 'gm')
  await breathChip.waitFor({ timeout: 30_000 })
  // The sheet those hooks send gone out first, spent, as the chip may show from an earlier one: a
  // send still settling would read it full once recharged below, and the app would refuse the tap
  // itself, as the POST above.
  await settled()
  thorin.items.get('breath').updateSource({ 'system.uses.spent': 0 })
  const postsBefore = postsBy(alice).length
  const refused = await sent(() => breathChip.click(), 'a recharge at full').catch(async error => {
    note(`posted since: ${JSON.stringify(postsBy(alice).slice(postsBefore))}; tray: ${await statusOf(alice).textContent().catch(() => null)}`)
    throw error
  })
  check(refused.made.status === 'failed' && refused.made.result?.reason === 'charged', 'the chip tapped once Foundry has it charged: refused')
  await statusOf(alice).getByText('Not made at the table: it’s charged already').waitFor({ timeout: 30_000 })
  check(true, 'the tray: "Not made at the table: it’s charged already"')
  await shootBoth(alice, 'alone-refusals', trayOf(alice))
  await Hooks.callAll('updateActor', thorin, {}, {}, 'gm')
}

// =================================================================================================
// 15. Widths and themes
// =================================================================================================
part('15. widths and themes')
/** Fire Breath spent again in Foundry, its sheet sent. */
async function spendBreath() {
  await thorin.items.get('breath').update({ 'system.uses.spent': 1 })
  await Hooks.callAll('updateActor', thorin, {}, {}, 'gm')
}
/** The row of Fire Breath as a list or a table shows it. */
const breathOf = view => rowOf(view, 'Fire Breath').or(panelOf(view).locator('tr').filter({ hasText: 'Fire Breath' })).first()
for (const [width, height] of [[360, 780], [390, 844], [768, 1024], [1280, 800]]) {
  const view = await browse({ width, height, path: '/characters/sheet-thorin', toasts: false })
  await view.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await view.tab('Actions')
  await spendBreath()
  const row = rowOf(view, 'Fire Breath')
  const rowChip = row.getByRole('button', { name: BREATH_CHIP, exact: true })
  await rowChip.waitFor({ timeout: 30_000 })
  check(await sideways(view.page) === 0, `no horizontal page scroll at ${width}`)
  if (width < 768) {
    const wrap = await row.evaluate(li => {
      const name = li.querySelector('button[aria-expanded]') ?? li.querySelector('button')
      const text = name.querySelector('.truncate') ?? name
      const chipEl = [...li.querySelectorAll('button')].find(b => /recharge/.test(b.getAttribute('aria-label') ?? ''))
      return { nameBottom: Math.round(name.getBoundingClientRect().bottom), chipTop: Math.round(chipEl.getBoundingClientRect().top), cut: text.scrollWidth > text.clientWidth }
    })
    check(wrap.chipTop >= wrap.nameBottom - 2 && !wrap.cut, `at ${width} the chips wrap under the name, and the name isn't cut short (${JSON.stringify(wrap)})`)
  }
  if (width !== 390) await shootBoth(view, 'alone-recharge-row', row)
  if (width === 360) {
    await view.view.close()
    continue
  }
  if (width !== 390) {
    // The cog's states, this device's switch off at first.
    const { dialog, send, alone } = await cog(view)
    await alone.waitFor({ timeout: 15_000 })
    await shootBoth(view, 'alone-cog-off', dialog)
    await flip(send)
    await until(async () => (await switchLook(alone)).disabled, 'the switch disabled', 5_000)
    await shootBoth(view, 'alone-cog-disabled', dialog)
    await flip(send)
    await until(async () => !(await switchLook(alone)).disabled, 'the switch enabled', 5_000)
    await flip(alone)
    await until(async () => (await switchLook(alone)).checked, 'the switch on', 5_000)
    await shootBoth(view, 'alone-cog-on', dialog)
    await closeCog(view)
    // A damage roll on its own, in the tray and in the chat.
    const sword = chip(view, `Longsword damage, 1d8 + 4${ALONE}`)
    await sword.waitFor({ timeout: 10_000 })
    const { request } = await sent(() => sword.click(), `the longsword's damage alone at ${width}`)
    const total = madeFor(request.id)?.rolls[0].total
    await statusOf(view).getByText(`At the table: ${total} · on its own, for your Gamemaster to apply`).waitFor({ timeout: 30_000 })
    await shootBoth(view, 'alone-alone-tray', trayOf(view))
    // Its recharge, done and failed, and refused.
    await force(view, 6, 6)
    await sent(() => rowChip.click(), `Fire Breath's recharge at ${width}`)
    await statusOf(view).getByText('At the table: 6 · recharged').waitFor({ timeout: 30_000 })
    await shootBoth(view, 'alone-recharge-done', trayOf(view))
    await spendBreath()
    await rowChip.waitFor({ timeout: 30_000 })
    await force(view, 6, 2)
    await sent(() => rowChip.click(), `Fire Breath's failed recharge at ${width}`)
    await unforce(view)
    await statusOf(view).getByText('At the table: 2 · didn’t recharge').waitFor({ timeout: 30_000 })
    await shootBoth(view, 'alone-recharge-failed', trayOf(view))
    thorin.items.get('breath').updateSource({ 'system.uses.spent': 0 })
    await sent(() => rowChip.click(), `a recharge at full at ${width}`)
    await statusOf(view).getByText('Not made at the table: it’s charged already').waitFor({ timeout: 30_000 })
    await shootBoth(view, 'alone-refusals', trayOf(view))
    await Hooks.callAll('updateActor', thorin, {}, {}, 'gm')
    // The chat's card, with its note.
    if (width < 1024) await view.chat()
    else await view.page.getByRole('tab', { name: /^Chat/ }).click()
    const bubble = view.log.locator('[data-side]').filter({ hasText: 'On its own, for the Gamemaster to apply' }).last()
    await bubble.waitFor({ timeout: 30_000 }).catch(async error => {
      await shoot(view, 'alone-failed-chat')
      note(`the log at ${width}: ${await view.log.count()} logs, ${await view.log.locator('[data-side]').count()} messages, ${await view.log.locator('[data-side]').filter({ hasText: 'On its own' }).count()} with the note`)
      throw error
    })
    await shootBoth(view, 'alone-alone-chat', bubble)
    if (width < 1024) await view.character()
    // The toast, on a page that shows them.
    const toasts = await browse({ width, height, path: '/characters/sheet-thorin' })
    await toasts.page.evaluate(key => { try { localStorage.setItem(key, 'on') } catch {} }, 'sending-stone:send-damage')
    await toasts.page.reload()
    await toasts.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
    await toasts.tab('Actions')
    const toastChip = chip(toasts, `Longsword damage, 1d8 + 4${ALONE}`)
    await toastChip.waitFor({ timeout: 15_000 })
    const made = await sent(() => toastChip.click(), `the toast's damage alone at ${width}`)
    const toast = toastLog(toasts).locator('[data-roll-toast]').filter({ hasText: `At the table: ${madeFor(made.request.id)?.rolls[0].total}` }).first()
    await toast.waitFor({ timeout: 30_000 })
    await shootBoth(toasts, 'alone-alone-toast', toast)
    await toasts.view.close()
    // The Gamemaster's cog.
    const gmView = await browse({ width, height, path: `/campaigns/${A}/characters/thorin`, toasts: false })
    await gmView.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
    await gmView.tab('Actions')
    const gmCog = await cog(gmView)
    await gmCog.alone.waitFor({ timeout: 15_000 })
    await flip(gmCog.alone)
    await shootBoth(gmView, 'alone-cog-gm', gmCog.dialog)
    await gmView.view.close()
  }
  if (width === 1280) {
    const { dialog } = await cog(view)
    await dialog.getByRole('group', { name: 'Actions layout' }).getByRole('button', { name: 'Table' }).click()
    await closeCog(view)
    await spendBreath()
    await view.page.getByRole('button', { name: BREATH_CHIP, exact: true }).waitFor({ timeout: 30_000 })
    const cell = await view.page.evaluate(name => {
      const chipEl = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === name)
      const td = chipEl?.closest('td')
      const box = chipEl?.parentElement
      const shown = box ? [...box.children].map(el => (el.getAttribute('aria-label') ?? el.textContent).trim()) : []
      return { inCell: !!td, shown, last: td === td?.parentElement?.lastElementChild, row: chipEl?.closest('tr')?.textContent?.slice(0, 60) }
    }, BREATH_CHIP)
    check(cell.inCell && cell.last && cell.shown[0] === BREATH_CHIP && /0\/1|0 of 1/.test(cell.shown[1] ?? '') && /Fire Breath/.test(cell.row ?? ''),
      `at 1280 with the Table layout, the chip sits left of the count in the Uses cell (${JSON.stringify(cell)})`)
    await shootBoth(view, 'alone-recharge-table', breathOf(view))
  }
  await view.view.close()
}

// =================================================================================================
// 17. Choices (module 0.41.0, its contract §8.4.1; the weapons' steps from v1's §8.4.1)
// =================================================================================================
if (CHOICES) {
  part('17. choices')
  const spells = thorin.system.spells
  const slotsOf = level => spells[`spell${level}`].value
  const tableOf = async who => (await call(who.page, `${API}/table`)).json
  const planOf = (view, id) => view?.sheet?.actions?.flatMap(section => section.actions).find(action => action.id === id && action.tableDamage)?.tableDamage
  const formulasOf = preview => preview?.rolls?.map(roll => roll.formula)
  const rollFeatures = () => sql(`select array_to_string("rollFeatures", ',') from campaign where id = '${A}'`).split(',')
  const statusText = who => statusOf(who).textContent().catch(() => '')
  const hands = chip(alice, `Burning Hands damage, 3d6${ALONE}`)
  const handsPicker = pickerOf(alice, 'Burning Hands')
  const potion = chip(alice, `Potion of Healing healing, 2d4 + 2${ALONE}`)
  const potionPicker = pickerOf(alice, 'Potion of Healing')

  // 1. The hello and what the app keeps; Thorin given a 2nd-level slot, his 1st-level ones back.
  {
    const rolls = hello().data.features.rolls
    const keys = Object.keys(rolls)
    check(rolls.aloneChoices === true && keys.indexOf('aloneChoices') === keys.indexOf('midiPrompts') + 1 && JSON.parse(hello().body ?? '{}').features?.aloneChoices === 1,
      `the hello's rolls say aloneChoices, after midiPrompts, and the app answers aloneChoices: 1 (${JSON.stringify(keys)}; ${hello().body})`)
    check(rollFeatures().includes('aloneChoices'), `the app keeps aloneChoices (${rollFeatures().join(',')})`)
    spells.spell1.value = 2
    Object.assign(spells.spell2, { value: 1, max: 1 })
    await Hooks.callAll('updateActor', thorin, {}, {}, 'gm')
    let plan = null
    await until(async () => (plan = planOf(await tableOf(alice), 'hands'))?.choices?.length === 1, "Burning Hands' plan at 2nd in the app", 30_000).catch(() => {})
    check(same(plan?.choices?.map(entry => [entry.level, formulasOf(entry.normal)]), [[2, ['4d6']]]) && same(plan.spends, ['slot']),
      `the module's sheet for Thorin carries Burning Hands' choices, at 2nd 4d6, and what it spends, a slot (${JSON.stringify({ choices: plan?.choices, spends: plan?.spends })})`)
    const view = await tableOf(alice)
    const axe = planOf(view, 'axe')
    const bow = planOf(view, 'bow')
    const potionPlan = planOf(view, 'potion')
    const sword = planOf(view, 'longsword')
    check(same(axe?.choices?.map(entry => [entry.attackMode, formulasOf(entry.normal)]), [['twoHanded', ['1d10 + 4']]]) && same(axe?.spends, [])
      && same(bow?.choices?.map(entry => [entry.ammunition, formulasOf(entry.normal)]), [['firearrows', ['1d8 + 1', '1d4']]]) && same(bow?.spends, ['ammunition'])
      && same(potionPlan?.choices, []) && same(potionPlan?.spends, ['uses']) && same(sword?.choices, []) && same(sword?.spends, []),
      `and the Battleaxe's two-handed 1d10 + 4, spending nothing; the Longbow's with Arrows of Fire, 1d8 + 1 and 1d4, spending ammunition, plain Arrows the same as its own; the Potion spending a use; the Longsword nothing (${JSON.stringify({ axe, bow: bow && { choices: bow.choices?.map(entry => entry.ammunition), spends: bow.spends }, potion: potionPlan && { choices: potionPlan.choices, spends: potionPlan.spends }, sword: sword && { choices: sword.choices, spends: sword.spends } })})`)
  }

  // 2. Burning Hands at 2nd, spent: once the page has Thorin's 2nd-level slot.
  await hands.waitFor({ timeout: 15_000 })
  await openPicker(alice, hands, 'Burning Hands', look => look.rows['At level']?.length === 2)
  {
    const opened = await pickerLook(handsPicker)
    await setSpend(handsPicker, true)
    let look = await pickerLook(handsPicker)
    check(look.lead === `Its damage goes to ${GAME_WORDS} on its own, for your Gamemaster to apply.`, `its damage chip opens the dialog "Burning Hands", led "${look.lead}"`)
    check(same(look.rows['At level']?.map(c => [c.name, c.text, c.checked, c.disabled]), [['1st Level, 2 slots left', '1st · 2 left', true, false], ['2nd Level, 1 slot left', '2nd · 1 left', false, false]])
      && Object.keys(look.rows).length === 1,
      `"At level": "1st · 2 left", picked, and "2nd · 1 left" (${JSON.stringify(look.rows)})`)
    check(look.spend?.name === 'Spend a 1st-level spell slot' && look.spend.checked && look.spend.hint === 'Turn it off where it was spent in Foundry already.'
      && look.buttons.includes('Roll damage'),
      `the switch "Spend a 1st-level spell slot", on, hinted "${look.spend?.hint}"; "Roll damage"`)
    later(/^1st Level/.test(opened.focused ?? ''), `as it opens, focus on the chip picked in its first row (${opened.focused})`)
    check(look.rows['At level'].every(c => c.height >= 44) && look.spend.height >= 44, `at 390 its chips and switch 44 px tall (${JSON.stringify(look.rows['At level'].map(c => c.height))}, ${look.spend.height})`)
    await shootBoth(alice, 'alone-choices-levels', handsPicker, SHOTS_041)
    await handsPicker.getByRole('radio', { name: '2nd Level, 1 slot left' }).click()
    await until(async () => (await pickerLook(handsPicker)).spend?.name === 'Spend a 2nd-level spell slot', 'the switch to name a 2nd-level slot', 5_000).catch(() => {})
    look = await pickerLook(handsPicker)
    check(look.spend?.name === 'Spend a 2nd-level spell slot' && look.live === 'Spend a 2nd-level spell slot',
      `2nd picked: the switch "${look.spend?.name}", and the dialog's live region says so ("${look.live}")`)
    const before = messages()
    await force(alice, 6, 4)
    const { request, made } = await sent(() => handsPicker.getByRole('button', { name: 'Roll damage' }).click(), 'Burning Hands at 2nd, spent').catch(async error => {
      note(`the tray: ${await statusText(alice)}; the picker ${await handsPicker.isVisible() ? 'still open' : 'closed'}; posted: ${JSON.stringify(postsBy(alice).slice(-2))}`)
      throw error
    })
    await unforce(alice)
    await until(() => /spent$/.test(madeFor(request.id)?.flavor ?? ''), 'its card to say what was spent', 10_000).catch(() => {})
    const card = madeFor(request.id)
    check(request.kind === 'itemDamage' && request.payload.slot === 'spell2' && request.payload.consume === true && same(request.payload.dice, [{ faces: 6, results: [4, 4, 4, 4] }]),
      `sent at the 2nd-level slot, to spend it, with four d6 (${JSON.stringify(request.payload)})`)
    check(made.status === 'done' && kindOf(card) === 'damage' && card.rolls[0].formula === '4d6' && card.rolls[0].options.type === 'fire' && same(targetsOf(card), [])
      && card.flavor === 'Burning Hands - Damage Roll · 2nd Level · spell slot spent' && sameJson(card.flags['sending-stone']?.chosen, { level: 2, consume: true, spent: ['slot'] }),
      `Foundry's card: ${card?.rolls[0].formula} ${card?.rolls[0].options.type}, no targets, "${card?.flavor}", chosen ${JSON.stringify(card?.flags['sending-stone']?.chosen)}`)
    check(slotsOf(2) === 0 && slotsOf(1) === 2 && !useCard(request.id) && messages() === before + 1 && same(made.result?.alone, { spent: ['slot'] }),
      `the 2nd-level slot spent, 1 → 0, no usage card; the result's alone ${JSON.stringify(made.result?.alone)}`)
    await statusOf(alice).getByText('At the table: 16 · on its own, for your Gamemaster to apply; spell slot spent').waitFor({ timeout: 30_000 })
    check(true, 'the tray: "At the table: 16 · on its own, for your Gamemaster to apply; spell slot spent"')
    const focused = await focusedName(alice)
    later(focused === `Burning Hands damage, 3d6${ALONE}`, `the picker gone, focus back on the chip (${focused})`)
    await shootBoth(alice, 'alone-choices-tray', trayOf(alice), SHOTS_041)
  }

  // 3. Again, the switch off.
  {
    await hands.click()
    await handsPicker.waitFor({ timeout: 10_000 })
    await setSpend(handsPicker, true)
    let look = await pickerLook(handsPicker)
    const second = look.rows['At level']?.find(c => /^2nd/.test(c.name))
    check(second?.name === '2nd Level, 0 slots left' && second.text === '2nd · 0 left' && second.disabled && /^1st/.test(look.rows['At level'].find(c => c.checked)?.name ?? ''),
      `again, the switch on: "2nd · 0 left" disabled, 1st picked (${JSON.stringify(look.rows)})`)
    await setSpend(handsPicker, false)
    look = await pickerLook(handsPicker)
    check(same(look.rows['At level']?.map(c => [c.name, c.text, c.disabled]), [['1st Level', '1st', false], ['2nd Level', '2nd', false]]) && look.spend?.name === 'Spend a 1st-level spell slot' && !look.spend.checked,
      `the switch off: both enabled, no "· N left" (${JSON.stringify(look.rows)})`)
    await handsPicker.getByRole('radio', { name: '2nd Level' }).click()
    await force(alice, 6, 2)
    const { request, made } = await sent(() => handsPicker.getByRole('button', { name: 'Roll damage' }).click(), 'Burning Hands at 2nd, nothing spent')
    await unforce(alice)
    const card = madeFor(request.id)
    check(request.payload.slot === 'spell2' && !('consume' in request.payload) && made.status === 'done' && card?.rolls[0].formula === '4d6' && slotsOf(2) === 0
      && card.flavor === 'Burning Hands - Damage Roll · 2nd Level · nothing spent' && !made.result?.alone,
      `rolled at 2nd with none left, nothing spent: ${card?.rolls[0].formula}, "${card?.flavor}" (${JSON.stringify(request.payload)})`)
    await statusOf(alice).getByText('At the table: 8 · on its own').waitFor({ timeout: 30_000 })
    const said = await statusText(alice)
    check(/At the table: 8 · on its own, for your Gamemaster to apply/.test(said) && !/spent/.test(said), `the tray says nothing of spending: "${said}"`)
    await alice.page.reload()
    await alice.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
    await alice.tab('Actions')
    await hands.waitFor({ timeout: 15_000 })
    await hands.click()
    await handsPicker.waitFor({ timeout: 10_000 })
    look = await pickerLook(handsPicker)
    check(look.spend?.checked === false, 'the page reloaded, the switch still off for Thorin on this device')
    await alice.page.keyboard.press('Escape')
    await handsPicker.waitFor({ state: 'hidden', timeout: 10_000 })
    const focused = await focusedName(alice)
    later(focused === `Burning Hands damage, 3d6${ALONE}`, `Escape closes the picker, focus back on the chip (${focused})`)
  }

  // 4. The Potion, a use spent.
  {
    await potion.waitFor({ timeout: 10_000 })
    await potion.click()
    await potionPicker.waitFor({ timeout: 10_000 })
    await setSpend(potionPicker, true)
    const look = await pickerLook(potionPicker)
    check(look.lead === `Its healing goes to ${GAME_WORDS} on its own, for your Gamemaster to apply.` && same(look.rows, {})
      && look.spend?.name === 'Spend a use of Potion of Healing' && look.buttons.includes('Roll healing') && !look.buttons.includes('Roll damage'),
      `the Potion's healing chip: "Its healing goes…", "Spend a use of Potion of Healing", "Roll healing" (${JSON.stringify(look)})`)
    const { request, made } = await sent(() => potionPicker.getByRole('button', { name: 'Roll healing' }).click(), 'the Potion of Healing, spent')
    await until(() => /spent$/.test(madeFor(request.id)?.flavor ?? ''), 'its card to say what was spent', 10_000).catch(() => {})
    const card = madeFor(request.id)
    check(request.payload.consume === true && !('slot' in request.payload) && made.status === 'done' && kindOf(card) === 'healing'
      && thorin.items.get('potion')?.system.quantity === 1 && same(made.result?.alone, { spent: ['uses'] }) && / · use spent$/.test(card.flavor ?? ''),
      `a healing card, "${card?.flavor}"; the Potions 2 → ${thorin.items.get('potion')?.system.quantity}; the result's alone ${JSON.stringify(made.result?.alone)}`)
    await statusOf(alice).getByText('; use spent').waitFor({ timeout: 30_000 })
    check(true, `the tray: "${await statusText(alice)}"`)
  }

  // 5. The Longsword: nothing to choose, nothing to spend.
  {
    const { request, made } = await sent(() => longsword.click(), 'the longsword\'s damage alone')
    check(await alice.page.getByRole('dialog').count() === 0 && made.status === 'done' && !['slot', 'attackMode', 'ammunition', 'consume'].some(key => key in request.payload),
      `the Longsword's chip rolls at once, no dialog, naming nothing (${JSON.stringify(request.payload)})`)
  }

  // 5b. The Battleaxe two-handed.
  {
    const axe = chip(alice, `Battleaxe damage, 1d8 + 4${ALONE}`)
    const picker = pickerOf(alice, 'Battleaxe')
    await axe.waitFor({ timeout: 10_000 })
    await axe.click()
    await picker.waitFor({ timeout: 10_000 })
    const look = await pickerLook(picker)
    check(same(look.rows.Mode?.map(c => [c.name, c.checked]), [['One-Handed', true], ['Two-Handed', false]]) && Object.keys(look.rows).length === 1 && look.spend === null,
      `the Battleaxe's: "Mode" chips One-Handed, picked, and Two-Handed; no switch (${JSON.stringify(look)})`)
    later(look.focused === 'One-Handed', `focus on the mode picked (${look.focused})`)
    await picker.getByRole('radio', { name: 'Two-Handed' }).click()
    await shootBoth(alice, 'alone-choices-modes', picker, SHOTS_041)
    const flows = workflows()
    await force(alice, 10, 7)
    const { request, made } = await sent(() => picker.getByRole('button', { name: 'Roll damage' }).click(), 'the Battleaxe two-handed')
    await unforce(alice)
    const card = madeFor(request.id)
    check(request.payload.attackMode === 'twoHanded' && !('consume' in request.payload) && same(request.payload.dice, [{ faces: 10, results: [7] }]) && made.status === 'done'
      && card?.rolls[0].formula === '1d10 + 4' && card.rolls[0].total === 11 && card.flavor === 'Battleaxe - Damage Roll · Two-Handed · nothing spent',
      `two-handed: a d10 thrown, Foundry's card ${card?.rolls[0].formula} = ${card?.rolls[0].total}, "${card?.flavor}" (${JSON.stringify(request.payload)})`)
    if (MIDI) check(workflows() === flows, `under Midi-QOL, no workflow made, the mode kept (${workflows()} as before)`)
  }

  // 5c. The Longbow, an Arrow of Fire spent.
  {
    const bow = chip(alice, `Longbow damage, 1d8 + 1${ALONE}`)
    const picker = pickerOf(alice, 'Longbow')
    await bow.waitFor({ timeout: 10_000 })
    await bow.click()
    await picker.waitFor({ timeout: 10_000 })
    await setSpend(picker, true)
    let look = await pickerLook(picker)
    check(same(look.rows.Ammunition?.map(c => [c.name, c.text, c.checked]), [['Arrows, 20 left', 'Arrows · 20', true], ['Arrows of Fire, 5 left', 'Arrows of Fire · 5', false]])
      && Object.keys(look.rows).length === 1 && look.spend?.name === 'Spend an Arrows',
      `the Longbow's: "Ammunition" chips "Arrows · 20", picked, and "Arrows of Fire · 5"; the switch "${look.spend?.name}" (${JSON.stringify(look.rows)})`)
    await picker.getByRole('radio', { name: 'Arrows of Fire, 5 left' }).click()
    await until(async () => (await pickerLook(picker)).spend?.name === 'Spend an Arrows of Fire', 'the switch to name the Arrows of Fire', 5_000).catch(() => {})
    look = await pickerLook(picker)
    check(look.spend?.name === 'Spend an Arrows of Fire' && look.live === 'Spend an Arrows of Fire', `Arrows of Fire picked: the switch "${look.spend?.name}", the live region "${look.live}"`)
    await shootBoth(alice, 'alone-choices-ammo', picker, SHOTS_041)
    await force(alice, 8, 5)
    const { request, made } = await sent(() => picker.getByRole('button', { name: 'Roll damage' }).click(), 'the Longbow with an Arrow of Fire')
    await unforce(alice)
    await until(() => /spent$/.test(madeFor(request.id)?.flavor ?? ''), 'its card to say what was spent', 10_000).catch(() => {})
    const card = madeFor(request.id)
    check(request.payload.ammunition === 'firearrows' && request.payload.consume === true && !('attackMode' in request.payload) && same(request.payload.dice.map(dice => dice.faces), [8, 4]),
      `sent with the Arrows of Fire, to spend one: a d8 and a d4 (${JSON.stringify(request.payload)})`)
    check(made.status === 'done' && same(card?.rolls.map(roll => roll.formula), ['1d8 + 1', '1d4']) && card.rolls[1].options.type === 'fire'
      && card.flavor === 'Longbow - Damage Roll · Arrows of Fire · ammunition spent',
      `Foundry's card ${JSON.stringify(card?.rolls.map(roll => roll.formula))}, its 1d4 fire, "${card?.flavor}"`)
    check(thorin.items.get('firearrows')?.system.quantity === 4 && thorin.items.get('arrows')?.system.quantity === 20 && same(made.result?.alone, { spent: ['ammunition'] }),
      `the Arrows of Fire 5 → ${thorin.items.get('firearrows')?.system.quantity}, the Arrows 20 still; the result's alone ${JSON.stringify(made.result?.alone)}`)
    await statusOf(alice).getByText('; ammunition spent').waitFor({ timeout: 30_000 })
    check(true, `the tray: "${await statusText(alice)}"`)
  }

  // 6. The kind menu after the picker, from the plan picked.
  {
    const orb = chip(alice, `Chromatic Orb damage, 3d8${ALONE}`)
    const picker = pickerOf(alice, 'Chromatic Orb')
    await orb.click()
    await picker.waitFor({ timeout: 10_000 })
    await setSpend(picker, false)
    await picker.getByRole('radio', { name: '2nd Level' }).click()
    await picker.getByRole('button', { name: 'Roll damage' }).click()
    const menu = alice.page.getByRole('menu', { name: 'Chromatic Orb 4d8' })
    await menu.waitFor({ timeout: 10_000 })
    const items = (await menuItems(menu)).map(text => text.trim())
    check(items.some(text => /^Roll fire damage$/i.test(text)) && items.some(text => /^Roll cold damage$/i.test(text)),
      `Chromatic Orb at 2nd: the picker, then the kind menu "Chromatic Orb 4d8" (${JSON.stringify(items)})`)
    await force(alice, 8, 3)
    const { request, made } = await sent(() => menu.getByRole('menuitem', { name: /^Roll cold damage$/i }).click(), 'the orb at 2nd, cold')
    await unforce(alice)
    const card = madeFor(request.id)
    check(request.payload.slot === 'spell2' && same(request.payload.types, ['cold']) && request.payload.dice[0]?.results.length === 4 && made.status === 'done'
      && card?.rolls[0].formula === '4d8' && card.rolls[0].options.type === 'cold',
      `rolled cold at 2nd: ${card?.rolls[0].formula} ${card?.rolls[0].options.type} (${JSON.stringify(request.payload)})`)
  }

  // 7. Typed dice after the picker.
  {
    const { manual } = await cog(alice)
    await flip(manual)
    await until(async () => (await switchLook(manual)).checked, 'manual dice on', 5_000)
    await closeCog(alice)
    await hands.click()
    await handsPicker.waitFor({ timeout: 10_000 })
    await setSpend(handsPicker, false)
    await handsPicker.getByRole('radio', { name: '2nd Level' }).click()
    await handsPicker.getByRole('button', { name: 'Roll damage' }).click()
    const entry = alice.page.getByRole('dialog').filter({ hasText: 'Type in what your dice show' })
    await entry.waitFor({ timeout: 10_000 })
    const boxes = entry.locator('input')
    const count = await boxes.count()
    check(count === 4, `with Enter dice results manually on, Burning Hands at 2nd asks for four d6 (${count} boxes)`)
    for (let at = 0; at < count; at++) await boxes.nth(at).fill('3')
    const { request, made } = await sent(() => entry.getByRole('button', { name: 'Done' }).click(), 'typed damage at 2nd')
    const card = madeFor(request.id)
    check(request.payload.typed === true && request.payload.slot === 'spell2' && same(request.payload.dice, [{ faces: 6, results: [3, 3, 3, 3] }]) && made.status === 'done'
      && card?.rolls[0].formula === '4d6' && badgeOn(card) === 'Entered by hand on Sending Stone',
      `typed, sent at 2nd and made so, marked entered by hand (${JSON.stringify(request.payload)}; ${badgeOn(card)})`)
    const { manual: again } = await cog(alice)
    await flip(again)
    await until(async () => !(await switchLook(again)).checked, 'manual dice off', 5_000)
    await closeCog(alice)
  }

  // 8. The Gamemaster's seat.
  {
    const gm = { ...alice, page: await alice.view.newPage() }
    gm.page.on('pageerror', e => note(`gm pageerror: ${e.message}`))
    await gm.page.goto(`${BASE}/campaigns/${A}/characters/thorin`)
    await gm.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
    await gm.page.getByRole('tablist', { name: 'Character sheet' }).getByRole('tab', { name: /^Actions\b/ }).click()
    const { alone } = await cog(gm)
    await alone.waitFor({ timeout: 15_000 })
    if (!(await switchLook(alone)).checked) {
      await flip(alone)
      await until(async () => (await switchLook(alone)).checked, 'the Gamemaster\'s switch on', 5_000)
    }
    check((await switchLook(alone)).hint === GM_HINT, `the Gamemaster's cog hints its choices: "${(await switchLook(alone)).hint}"`)
    await closeCog(gm)
    const gmHands = gm.page.getByRole('tabpanel').first().getByRole('button', { name: `Burning Hands damage, 3d6${ALONE}`, exact: true })
    await gmHands.waitFor({ timeout: 10_000 })
    const picker = pickerOf(gm, 'Burning Hands')
    await gmHands.click()
    await picker.waitFor({ timeout: 10_000 })
    await setSpend(picker, true)
    const look = await pickerLook(picker)
    check(look.lead === 'Its damage goes to your game on its own, for you to apply.' && look.rows['At level']?.find(c => c.checked)?.name === '1st Level, 2 slots left'
      && look.spend?.name === 'Spend a 1st-level spell slot' && look.spend.checked,
      `the Gamemaster's page of Thorin: "${look.lead}", 1st picked, "Spend a 1st-level spell slot" on`)
    await shootBoth(gm, 'alone-choices-gm', picker, SHOTS_041)
    const { request, made } = await sent(() => picker.getByRole('button', { name: 'Roll damage' }).click(), 'the Gamemaster\'s Burning Hands, spent')
    check(request.role === 'gm' && request.payload.slot === 'spell1' && request.payload.consume === true && made.status === 'done' && slotsOf(1) === 1 && same(made.result?.alone, { spent: ['slot'] }),
      `made at the Gamemaster's seat at 1st, a 1st-level slot spent, 2 → ${slotsOf(1)} (${JSON.stringify(request.payload)})`)
    await gm.page.close()
    // Alice's page shows the Gamemaster's roll once it hears of it, as its latest, which the next
    // step's tray line is read after.
    if (MIDI) await statusOf(alice).getByText(/Rolled by your Gamemaster/).waitFor({ timeout: 30_000 }).catch(() => {})
  }

  // 9. Crafted: the app's own refusals.
  {
    await until(async () => (await tableOf(alice))?.sheet?.spells?.find(section => section.id === 'spell2')?.slots?.value === 0, 'the app to have the 2nd-level slot spent', 15_000).catch(() => {})
    await paced()
    const body = { kind: 'itemDamage', item: 'hands', activity: 'flames', mode: 0, explicit: false, extras: [], dice: [{ faces: 6, results: [3, 3, 3, 3] }] }
    const nine = await call(alice.page, `${API}/rolls`, { method: 'POST', body: { ...body, slot: 'spell9' } })
    check(nine.status === 422 && nine.json?.reason === 'slot', `a crafted itemDamage at spell9 → 422 slot (${nine.status} ${nine.text})`)
    const none = await call(alice.page, `${API}/rolls`, { method: 'POST', body: { ...body, slot: 'spell2', consume: true } })
    check(none.status === 422 && none.json?.reason === 'slots', `one spending a 2nd-level slot, none left → 422 slots (${none.status} ${none.text})`)
  }

  // 10. Midi-QOL's Enforce bonus actions.
  if (MIDI) {
    Object.assign(W.midi.settings, { enforceBonusActions: 'all' })
    W.midi.usedBonus.add('thorin')
    const marks = W.midi.bonusMarks.length
    const quantity = thorin.items.get('potion')?.system.quantity
    await potion.click()
    await potionPicker.waitFor({ timeout: 10_000 })
    await setSpend(potionPicker, true)
    const refused = await sent(() => potionPicker.getByRole('button', { name: 'Roll healing' }).click(), 'the Potion, its Bonus Action used')
    check(refused.made.status === 'failed' && refused.made.result?.reason === 'bonus-action' && !madeFor(refused.request.id) && thorin.items.get('potion')?.system.quantity === quantity,
      `Enforce bonus actions "all", Thorin in the fight with his Bonus Action used: the Potion with the switch on refused "bonus-action", nothing rolled or spent (${JSON.stringify(refused.made.result)})`)
    await statusOf(alice).getByText(/Not made at the table/).waitFor({ timeout: 30_000 }).catch(() => {})
    const said = await statusText(alice)
    check(/Not made at the table: you’ve used your bonus action/.test(said), `the tray: "Not made at the table: you’ve used your bonus action" ("${said}")`)
    await potion.click()
    await potionPicker.waitFor({ timeout: 10_000 })
    await setSpend(potionPicker, false)
    const rolled = await sent(() => potionPicker.getByRole('button', { name: 'Roll healing' }).click(), 'the Potion, spending nothing')
    check(rolled.made.status === 'done' && kindOf(madeFor(rolled.request.id)) === 'healing' && thorin.items.get('potion')?.system.quantity === quantity && W.midi.bonusMarks.length === marks,
      `the switch off: rolled, nothing spent, nothing marked (${rolled.made.status})`)
    W.midi.usedBonus.delete('thorin')
    W.midi.settings.enforceBonusActions = 'none'
  }

  // 11. Widths and themes.
  for (const [width, height] of [[360, 780], [1280, 800]]) {
    const view = await browse({ width, height, path: '/characters/sheet-thorin', toasts: false })
    await view.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
    await view.tab('Actions')
    const { alone } = await cog(view)
    await alone.waitFor({ timeout: 15_000 })
    if (!(await switchLook(alone)).checked) await flip(alone)
    await until(async () => (await switchLook(alone)).checked, 'the switch on', 5_000)
    await closeCog(view)
    /** The picker of a row, opened from its chip: then whether it fits, and its pictures at 1280. */
    const opened = async (name, title, shot) => {
      const rowChip = chip(view, name)
      await rowChip.waitFor({ timeout: 15_000 })
      await rowChip.click()
      const picker = pickerOf(view, title)
      await picker.waitFor({ timeout: 10_000 })
      if (title === 'Longbow') await setSpend(picker, true)
      const box = await picker.evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom } })
      const look = await pickerLook(picker)
      const least = width < 640 ? 44 : 36
      const heights = [...Object.values(look.rows).flat().map(c => c.height), ...(look.spend ? [look.spend.height] : [])]
      check(box.left >= 0 && box.right <= width && box.top >= 0 && box.bottom <= height && await sideways(view.page) === 0 && heights.every(h => h >= least),
        `at ${width} the ${title} picker fits, nothing sideways, its chips and switch ${least} px tall or more (${JSON.stringify({ box, heights })})`)
      if (shot) await shootBoth(view, shot, picker, SHOTS_041)
      await view.page.keyboard.press('Escape')
      await picker.waitFor({ state: 'hidden', timeout: 10_000 })
    }
    await opened(`Burning Hands damage, 3d6${ALONE}`, 'Burning Hands', width === 1280 && 'alone-choices-levels')
    if (width === 1280) {
      await opened(`Battleaxe damage, 1d8 + 4${ALONE}`, 'Battleaxe', 'alone-choices-modes')
      await opened(`Longbow damage, 1d8 + 1${ALONE}`, 'Longbow', 'alone-choices-ammo')
      await opened(`Potion of Healing healing, 2d4 + 2${ALONE}`, 'Potion of Healing', 'alone-choices-potion')
    }
    await view.view.close()
  }
}

part('deferred checks')
{
  const failed = deferred.filter(([cond, msg]) => (cond ? (check(true, msg), false) : (console.log('FAIL (deferred) -', msg), true)))
  check(failed.length === 0, `every check made at the end holds (${failed.length} not)`)
}
await finish()
