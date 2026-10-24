// Companions (module 0.36.0 and the app, its contract §2, §8, §13.2, §13.9), end to end, in the
// world of world-030.mjs with scenes and tokens (fvtt/token-core.mjs). Alice plays Thorin in
// Ashlands, with Find Familiar, Summon Dragon and a longsword; Bob plays Vex. Brakka, a linked NPC
// sidekick Alice owns, is listed from the start; two Bats summoned with Find Familiar (their
// template auto-imported, walking 5 ft and flying 30 ft, each with its own hit points) and a Drake
// the Gamemaster summoned with Thorin's Summon Dragon (no CR, no proficiency, in its lair, with
// legendary actions and a spent Recharge 5–6 Fire Breath, a secret in its description) come later.
// The hello lists them and the app answers it reads them; the switcher's tabs, or avatars where
// they don't fit, measured by their own rule at 360, 390, 768 and 1280; Brakka's creature sheet;
// Brakka's attack and a Bat's check made on their own live actors as Alice; switching keeps each
// pane's tray, one dice canvas for all; a hidden pane's damage marked on its tab, popping no toast;
// the character's combat with "Yours", a companion's turn and its tab's link; companions'
// initiative as its own roll and right after Thorin, with dnd5e's Dexterity tiebreaker; the chat;
// the Drake's lair, legendary actions and recharge; Foundry's changes keeping a gone tab marked
// until it's left, and numbers kept; the rights; the Gamemaster's page and card; the keyboard; five
// panes at most; the pane's loading, too-large and gone states; every width in both themes. End
// Turn's screens (§8.11, §13.8) wait for the user's prototype and aren't here. MIDI=1: Brakka's
// attack through Midi-QOL's workflow on its token, and the initiatives. DND5E6=1: dnd5e 6.0.5's
// dice. SKEW=035 with MODULE=module-0.35.0: no companions in the hello, no tablist, every companion
// route 404s, Thorin's sheet and rolls as before. Synthetic characters only. Run with
// --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import {
  BASE, BOB, DND5E6, MIDI, MODULE, SKEW035, W, activeScene, actors, browse, call, character, check, companion,
  finish, foundryWorld, launch, startFetching, stopFetching, newCampaign, note, npc, part, place, posted, postsOf, same, sceneWorld, settings,
  settled, shoot, shootBoth, sideways, sql, startModule, summoned, until, wait,
} from './world-030.mjs'

const GAME = 'https://ashlands.forge-vtt.com'
const SECRET = 'ashlands-companions-36'
const TITLE = 'Ashlands'
const NEW = !SKEW035
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: TITLE, address: 'ashlands.forge-vtt.com', secret: SECRET })
await foundryWorld({ dice6: DND5E6 })
const T = await sceneWorld()
game.modules.get('sending-stone').version = SKEW035 ? '0.35.0' : '0.36.0'
// What an NPC's sheet names, as dnd5e configures it (D5 config.mjs:2407-2430, actorSizes,
// activityActivationTypes:1053-1072): its speeds by kind, their unit, its size, and the legendary
// actions a legendary action spends.
Object.assign(CONFIG.DND5E, {
  movementTypes: { walk: { label: 'DND5E.MOVEMENT.Type.Speed' }, fly: { label: 'DND5E.MOVEMENT.Type.Fly' } },
  movementUnits: { ft: { label: 'Feet', abbreviation: 'DND5E.DistFtAbbr' } },
  actorSizes: { tiny: { label: 'DND5E.SizeTiny' }, med: { label: 'DND5E.SizeMedium' }, lg: { label: 'DND5E.SizeLarge' } },
})
CONFIG.DND5E.activityActivationTypes.legendary = { label: 'Legendary Action', header: 'Legendary Actions', consume: { property: 'resources.legact' } }
// dnd5e's Dexterity tiebreaker (D5 documents/actor/actor.mjs:1818-1820): the ability's score over
// 100 added to every initiative roll, while the setting is on.
settings.set('initiativeDexTiebreaker', true)
Hooks.on('dnd5e.preConfigureInitiative', (actor, config) => {
  if (!settings.get('initiativeDexTiebreaker')) return
  const ability = actor.system.abilities?.[actor.system.attributes?.init?.ability || 'dex']
  if (Number.isFinite(ability?.value)) config.parts.push(String(ability.value / 100))
})
// An item's update as Foundry's: written, then `updateItem` on every client.
{
  const update = W.Item5e.prototype.update
  W.Item5e.prototype.update = async function (changes = {}) {
    await update.call(this, changes)
    await Hooks.callAll('updateItem', this, foundry.utils.expandObject(changes), {}, 'gm')
    return this
  }
}

// ---- The world ----
const capital = text => text.charAt(0).toUpperCase() + text.slice(1)
const hits = (formula, type) => ({ formula, damageType: type, label: `${formula} ${capital(type)}` })
const ACTION = { type: 'action', value: 1 }
const SECRET_TEXT = 'A secret of the Gamemaster’s drake.'
const summonSpell = (id, name, activity) => ({
  id, name, type: 'spell', system: { level: 1, method: 'spell', prepared: 1, canPrepare: true, properties: [], duration: { units: 'hour', value: 1 } },
  activities: [{ id: activity, type: 'summon' }],
})
// Thorin, Alice's: a dwarf fighter with Find Familiar and Summon Dragon, Dexterity 14.
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, dex: 2, con: 2, wis: 1 }, skills: { prc: { ability: 'wis' } }, hp: { value: 30, max: 40, temp: 0 } }, {
  ac: 18,
  items: [
    summonSpell('findFamiliar', 'Find Familiar', 'ff-summon'),
    summonSpell('summonDragon', 'Summon Dragon', 'sd-summon'),
    {
      id: 'longsword', name: 'Longsword', type: 'weapon', system: { properties: [], quantity: 1, attackType: 'melee', equipped: true },
      activities: [{ id: 'swing', attack: { ability: 'str' }, damage: [{ number: 1, denomination: 8, bonus: '@mod', types: ['slashing'] }], labels: { modifier: '+6', damage: [hits('1d8 + 3', 'slashing')] } }],
    },
    { id: 'shield', name: 'Shield', type: 'equipment', system: { quantity: 1, equipped: true, properties: [] }, activities: [] },
  ],
})
thorin.system.details = { level: 5 }
Object.assign(thorin.system.skills.prc, { total: 4, passive: 14 })
thorin.system.attributes.init.total = 2
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { dex: 3, wis: 2 }, hp: { value: 24, max: 30, temp: 0 } }, { ac: 14, items: [] })
vex.system.details = { level: 5 }
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
// The goblin: one point less Dexterity than Thorin.
const goblin = npc('goblin', 'Goblin', 12, { dex: 1 })
goblin.system.abilities.dex.value = 13

// Brakka, a sidekick: linked, Alice's by name, a greataxe and a Battle Cry her foes save against.
const brakka = companion('brakka', 'Brakka', {
  owners: ['alice'], linked: true, ac: 14,
  gear: { items: [
    {
      id: 'greataxe', name: 'Greataxe', type: 'weapon', system: { properties: ['hvy', 'two'], quantity: 1, attackType: 'melee', equipped: true },
      activities: [{ id: 'cleave', attack: { ability: 'str' }, damage: [{ number: 1, denomination: 12, bonus: '@mod', types: ['slashing'] }], labels: { modifier: '+5', damage: [hits('1d12 + 3', 'slashing')] } }],
    },
    {
      id: 'cry', name: 'Battle Cry', type: 'feat', system: { properties: [] },
      activities: [{ id: 'crySave', type: 'save', activation: ACTION, affects: 'creature', count: 1, save: ['dex'], dc: 13, damage: [{ number: 1, denomination: 6, types: ['thunder'] }], labels: { damage: [hits('1d6', 'thunder')] } }],
    },
  ] },
  npc: {
    spec: { mods: { str: 3, dex: 1, con: 2 }, prof: 2, skills: { prc: { ability: 'wis' } }, hp: { value: 30, max: 30, temp: 0 }, npc: { denomination: 8, max: 4, spent: 1 } },
    system: {
      traits: { important: true, size: 'med' },
      details: { cr: 2, type: { value: 'humanoid', label: 'Humanoid' }, alignment: 'Neutral' },
      currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
      // As dnd5e prepares an actor's initiative (D5 data/actor/templates/attributes.mjs): its modifier.
      attributes: { movement: { walk: 30, units: 'ft' }, init: { total: 1 } },
    },
  },
})
// The Bat, Find Familiar's template, auto-imported: tiny, walking 5 ft and flying 30 ft.
const bat = companion('bat', 'Bat', {
  owners: ['alice'], linked: false, ac: 12,
  gear: { items: [{
    id: 'bite', name: 'Bite', type: 'weapon', system: { properties: [], quantity: 1, attackType: 'melee', equipped: true },
    activities: [{ id: 'nip', attack: { ability: 'dex' }, damage: [{ number: 1, denomination: 1, bonus: '0', types: ['piercing'] }], labels: { modifier: '+4', damage: [hits('1', 'piercing')] } }],
  }] },
  npc: {
    flags: { dnd5e: { isAutoImported: true } },
    spec: { mods: { dex: 2, wis: 1 }, prof: 2, skills: { prc: { ability: 'wis' } }, hp: { value: 1, max: 1, temp: 0 } },
    system: { traits: { size: 'tiny' }, details: { cr: 0, type: { value: 'beast', label: 'Beast' }, alignment: 'Unaligned' }, attributes: { movement: { walk: 5, fly: 30, units: 'ft' }, init: { total: 2 } } },
  },
})
// The Drake, Summon Dragon's: no CR and no proficiency, as a 2024 summon's; legendary actions, a
// lair it's in, a spent Fire Breath, and a secret in its description.
const drake = companion('drake', 'Drake', {
  linked: false, ac: 16,
  gear: { items: [
    {
      id: 'breath', name: 'Fire Breath', type: 'feat', system: { properties: [], uses: { max: 1, spent: 1, recovery: [{ period: 'recharge', type: 'recoverAll', formula: '5' }] } },
      activities: [{ id: 'exhale', type: 'save', activation: ACTION, template: 'cone', affects: 'creature', save: ['dex'], dc: 14, damage: [{ number: 2, denomination: 6, types: ['fire'] }], labels: { damage: [hits('2d6', 'fire')] } }],
    },
    {
      id: 'wing', name: 'Wing Attack', type: 'feat', system: { properties: [], description: { value: '<p>The drake beats its wings.</p>' } },
      activities: [{ id: 'wingUse', type: 'utility', activation: { type: 'legendary', value: 2 } }],
    },
  ] },
  npc: {
    spec: { mods: { str: 4, dex: 1, con: 3 }, prof: null, hp: { value: 50, max: 50, temp: 0 } },
    system: {
      traits: { size: 'lg' },
      details: { cr: null, type: { value: 'dragon', label: 'Dragon' }, alignment: 'Neutral', biography: { value: `<p>A young drake.</p><section class="secret"><p>${SECRET_TEXT}</p></section>`, public: '' } },
      resources: { legact: { max: 2, spent: 0 }, lair: { value: true, inside: true, initiative: 20 } },
      attributes: { prof: null, init: { total: 1 } },
    },
  },
})
// npc.mjs:367-377, 444-446: a pool's max with one more in its lair, and what's left of it.
{
  const make = drake.make
  drake.make = () => {
    const made = make()
    const { resources } = made.system
    const lair = Number(Boolean(resources.lair?.value && resources.lair?.inside))
    const pool = resources.legact
    pool.max += lair
    Object.defineProperty(pool, 'value', { configurable: true, enumerable: true, get() { return Math.min(Math.max(this.max - this.spent, 0), this.max) } })
    return made
  }
}

const arena = await activeScene('arena')
const den = T.scene('den')
const tokenOf = {}
for (const actor of [thorin, vex, goblin, brakka]) tokenOf[actor.id] = await place(arena, actor, { id: `tok-${actor.id}`, actorLink: true, tell: false })
W.gm.targets = new Set()
Object.defineProperty(actors, 'party', { get: () => null, configurable: true })
const campaign = changes => ({ id: 'camp-ash', title: TITLE, characters: ['thorin', 'vex'], groups: [], rolls: true, attacks: true, prompts: true, ...changes })
await startModule({ campaigns: [campaign()], secrets: { 'camp-ash': SECRET } })
await settled()

// ---- What's posted, kept and made ----
const hello = () => postsOf('bridge.hello').at(-1)
const listedKeys = () => (postsOf('companions.listed').at(-1)?.data?.companions ?? hello().data.companions ?? []).map(c => c.key)
const requests = () => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}'`))
const rollRow = id => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, role, "actorId", payload, "useId", result from roll_request ${id ? `where id = '${id}'` : `where "campaignId" = '${A}' order by "createdAt" desc limit 1`}) r`) || 'null')
const rowsSince = count => JSON.parse(sql(`select coalesce(json_agg(r order by r."createdAt")::text, '[]') from (select id, kind, status, "actorId", payload, "useId", result, "createdAt" from roll_request where "campaignId" = '${A}' order by "createdAt" offset ${count}) r`))
const madeFor = id => W.messages.contents.find(m => m.flags?.['sending-stone']?.request === id)
const paced = () => until(() => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}' and "createdAt" > now() - interval '1 minute'`)) < 15, 'room under the rate limit', 70_000)
async function sent(tap, what) {
  await paced()
  const before = requests()
  await tap()
  await until(() => requests() > before, `${what} to be sent`, 30_000)
  const request = rowsSince(before)[0]
  await until(() => ['done', 'failed'].includes(rollRow(request.id).status), `${what} to be made`, 30_000)
  return { request, made: rollRow(request.id) }
}
const force = (who, sides, value) => who.page.evaluate(([s, v]) => { globalThis.__random ??= Math.random; Math.random = () => (v - 0.5) / s }, [sides, value])
const unforce = who => who.page.evaluate(() => { if (globalThis.__random) Math.random = globalThis.__random })

sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const API = '/api/characters/sheet-thorin'
const companionApi = key => `${API}/companions/${key}`
const alice = await browse({ width: 1280, height: 800, path: '/characters/sheet-thorin', toasts: false })
await alice.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const bob = await browse({ width: 768, height: 1024, scheme: 'dark', who: BOB, toasts: false })
await bob.page.goto(invite)
await bob.page.getByRole('radio', { name: /^Vex/ }).check()
await bob.page.getByRole('button', { name: 'Join as this character' }).click()
await bob.page.waitForURL(/\/characters\/[\w-]+$/)
await bob.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
/** Which page posted each damage roll, for a failure's report. */
const damagePosts = []
function watchDamage(who, label) {
  who.page.on('request', request => {
    if (request.method() !== 'POST' || !/\/rolls$/.test(request.url())) return
    const body = request.postDataJSON?.() ?? {}
    if (body.kind === 'damage') damagePosts.push(`${label}: ${request.url().replace(BASE, '')}`)
  })
}
/** Each POST of a roll a page's refused, noted, for a failure's report. */
function watchRefusals(who) {
  who.page.on('response', async response => {
    if (response.request().method() === 'POST' && /\/rolls$/.test(response.url()) && response.status() !== 202) note(`refused: ${response.url().replace(BASE, '')} ${response.status()} ${await response.text().catch(() => '')} for ${response.request().postData()}`)
  })
}
watchRefusals(alice)
watchDamage(alice, 'Alice\'s page at 1280')
const BOB_SHEET = sql(`select id from "character" where "actorId" = 'vex' and "campaignId" = '${A}'`)

const SWITCHER = 'Character and companions'
const switcher = who => who.page.getByRole('tablist', { name: SWITCHER })
const tabOf = (who, key) => who.page.locator(`#creature-tab-${key}`)
const panelOf = (who, key) => who.page.locator(`#creature-panel-${key}`)
const sheetTab = (who, key, id) => who.page.locator(`#${key === 'self' ? '' : `creature-${key}-`}sheet-tab-${id}`)
const sheetPanel = (who, key) => who.page.locator(`#${key === 'self' ? '' : `creature-${key}-`}sheet-panel`)
/** The tabs' accessible names, in order. */
const tabNames = who => switcher(who).getByRole('tab').evaluateAll(tabs => tabs.map(tab => tab.getAttribute('aria-label')))
const describedAs = (who, key) => tabOf(who, key).evaluate(tab => document.getElementById(tab.getAttribute('aria-describedby'))?.textContent ?? null)
/** Choose a creature's tab by a click. */
async function choose(who, key) {
  await tabOf(who, key).click()
  await until(async () => (await tabOf(who, key).getAttribute('aria-selected')) === 'true', `${key} chosen`, 5_000)
}
/** A creature's sheet tab, opened in its pane. */
async function openSheetTab(who, key, id) {
  const tab = sheetTab(who, key, id)
  await tab.waitFor({ timeout: 20_000 })
  await tab.click()
}
/**
 * The switcher's rule, as measured on the page: the row, its hidden copy, each tab's box and its
 * kind, and the fades.
 */
const rowLook = who => switcher(who).evaluate(list => {
  const box = list.parentElement
  const ghost = [...box.children].find(el => el.getAttribute('aria-hidden') === 'true' && el.hasAttribute('inert'))
  const row = list.getBoundingClientRect()
  const tabs = [...list.querySelectorAll('[role=tab]')].map(tab => {
    const r = tab.getBoundingClientRect()
    return {
      key: tab.dataset.key, chosen: tab.getAttribute('aria-selected') === 'true', left: r.left, right: r.right, width: r.width, height: r.height,
      named: !!tab.querySelector('.truncate'), icon: !!tab.querySelector('svg'), dot: !!tab.querySelector('.bg-primary.rounded-full'),
    }
  })
  const fades = [...box.children].filter(el => /bg-linear-to-[rl]/.test(el.className)).map(el => (/left-0/.test(el.className) ? 'left' : 'right'))
  return {
    mode: list.dataset.mode, scrollWidth: list.scrollWidth, clientWidth: list.clientWidth, scrollLeft: list.scrollLeft,
    boxWidth: box.clientWidth, ghostWidth: ghost?.offsetWidth ?? null, rowLeft: row.left, rowRight: row.right, tabs, fades,
  }
})
/** The rule itself, whichever mode the row is in (§13.2 step 2b). */
function ruleHolds(look) {
  if (look.mode === 'tabs') {
    return look.scrollWidth <= look.clientWidth && look.ghostWidth <= look.boxWidth
      && look.tabs.every(tab => tab.left >= look.rowLeft - 0.5 && tab.right <= look.rowRight + 0.5 && tab.named)
  }
  const chosen = look.tabs.find(tab => tab.chosen)
  const clear = !chosen || ((chosen.left - look.rowLeft >= 39.5) || look.scrollLeft === 0) && ((look.rowRight - chosen.right >= 39.5) || (look.scrollLeft + look.clientWidth >= look.scrollWidth - 1))
  const fadesRight = (look.fades.includes('left') === (look.scrollLeft > 1)) || look.fades.includes('left') === look.tabs.some(tab => tab.left < look.rowLeft - 0.5)
  return look.ghostWidth > look.boxWidth && look.tabs.every(tab => tab.chosen ? (tab.named && tab.icon !== undefined) : !tab.named) && clear && fadesRight
}
/** Whom a use is made at, in its picker: a box ticked and the use made, or the one target's button. */
async function useAt(picker, name) {
  await picker.waitFor({ timeout: 10_000 })
  const box = picker.getByRole('checkbox', { name })
  if (await box.count()) {
    await box.first().click()
    await picker.getByRole('button', { name: /^(Use|Cast) at 1 target/ }).click()
  } else await picker.getByRole('button', { name }).first().click()
}
/** Checks made at the end, of what was seen earlier, so that the steps after them run whatever they found. */
const deferred = []
const later = (cond, msg) => deferred.push([cond, msg])
/** A tab's avatar as drawn: a portrait that loaded, or initials; a broken image is neither. */
const avatarOf = (who, key) => tabOf(who, key).evaluate(tab => {
  const img = tab.querySelector('img')
  if (img) return img.complete && img.naturalWidth > 0 ? 'portrait' : 'broken image'
  return tab.querySelector('span.rounded-full span')?.textContent ? 'initials' : 'none'
})
const tray = (who, scope = who.page) => scope.getByRole('region', { name: /rolls$/ }).first()
const statusIn = (who, key) => panelOf(who, key).getByRole('region', { name: /rolls$/ }).getByRole('status')

if (SKEW035) {
  // =================================================================================================
  // 18. Module 0.35.0
  // =================================================================================================
  part('18. module 0.35.0')
  check(!('companions' in hello().data) && !('companions' in (hello().data.features ?? {})), `module 0.35.0's hello says nothing of companions (${JSON.stringify(Object.keys(hello().data.features ?? {}))})`)
  await wait(3000)
  check(await switcher(alice).count() === 0, 'Thorin\'s page has no tablist of companions')
  for (const [path, method, body] of [
    [`${companionApi('brakka')}/table`, 'GET'],
    [`${companionApi('brakka')}/rolls`, 'POST', { kind: 'skill', key: 'prc', mode: 0, explicit: false, extras: [], dice: [{ faces: 20, results: [10] }] }],
    [`${companionApi('brakka')}/rolls/never-sent`, 'GET'],
    [`${companionApi('brakka')}/texts/abc`, 'GET'],
  ]) {
    const answer = await call(alice.page, path, { method, body })
    check(answer.status === 404, `${method} ${path.replace(API, '…')} → 404 (${answer.status})`)
  }
  await sheetTab(alice, 'self', 'character').click()
  const perception = alice.page.locator('#sheet-panel').getByRole('button', { name: /^Perception/ }).first()
  await perception.waitFor({ timeout: 15_000 })
  const { request, made } = await sent(() => perception.click(), "Thorin's Perception")
  check(request.kind === 'skill' && made.status === 'done' && request.actorId === 'thorin', `Thorin's sheet and rolls as before: his Perception made (${request.kind}, ${made.status})`)
  check(await sideways(alice.page) === 0, 'no horizontal scroll')
  await finish()
}

// =================================================================================================
// 1. The hello and the answer
// =================================================================================================
part('1. the hello and the answer')
{
  const data = hello().data
  check(same((data.companions ?? []).map(c => [c.key, c.kind, c.name, c.of]), [['brakka', 'owned', 'Brakka', ['thorin']]]),
    `the hello lists Brakka, owned, Thorin's (${JSON.stringify(data.companions)})`)
  const features = data.features.companions
  check(!!features && !features.kinds.includes('inspiration') && !features.kinds.includes('spend') && !features.kinds.includes('endTurn') && features.initiative === 'own',
    `its features.companions: kinds without inspiration, spend or endTurn, initiative "own" (${JSON.stringify(features)})`)
  check(JSON.parse(hello().body ?? '{}').features?.companions === 1, `the app answers companions: 1 (${hello().body})`)
  const order = posted.map(p => `${p.type}:${p.data?.character?.id ?? p.data?.companion?.key ?? ''}`)
  const thorinAt = order.indexOf('character.updated:thorin')
  const brakkaAt = order.indexOf('companion.updated:brakka')
  check(thorinAt >= 0 && brakkaAt > thorinAt, `companion.updated for Brakka after Thorin's character.updated (${thorinAt}, ${brakkaAt})`)
}

// =================================================================================================
// 2. The switcher, two creatures
// =================================================================================================
part('2. the switcher, two creatures')
await switcher(alice).waitFor({ timeout: 20_000 })
check(same(await tabNames(alice), ['Thorin', 'Brakka']), `the tablist "${SWITCHER}" with Thorin and Brakka (${JSON.stringify(await tabNames(alice))})`)
check(await describedAs(alice, 'brakka') === 'Thorin’s companion' && await tabOf(alice, 'brakka').getAttribute('data-kind') === 'owned'
  && await tabOf(alice, 'brakka').locator('svg.lucide-paw-print').count() === 1, 'Brakka\'s tab described "Thorin’s companion", owned, its paw drawn')
const WIDTHS = [[360, 780], [390, 844], [768, 1024], [1280, 800]]
const views = {}
for (const [width, height] of WIDTHS) {
  const view = width === 1280 ? alice : await browse({ width, height, path: '/characters/sheet-thorin', toasts: false })
  await switcher(view).waitFor({ timeout: 20_000 })
  views[width] = view
  if (view !== alice) watchDamage(view, `the page at ${width}`)
  const look = await rowLook(view)
  check(look.mode === 'tabs' && ruleHolds(look), `at ${width} the row's tabs, every one whole (${look.mode}, ${look.scrollWidth} ≤ ${look.clientWidth})`)
  await shootBoth(view, 'companions-switcher-tabs', switcher(view).locator('xpath=..'))
}
check(await switcher(bob).count() === 0, 'Bob, at Vex: no tablist')
{
  // The game's portraits don't load here (the game's address answers no image): initials in their
  // place (§8.3), on a page loaded with the tabs as on one that gained them later.
  const drawn = { self: await avatarOf(alice, 'self'), brakka: await avatarOf(alice, 'brakka') }
  later(drawn.self === 'initials' && drawn.brakka === 'initials', `a portrait that fails to load falls back to initials on the tabs drawn with the page (${JSON.stringify(drawn)})`)
}

// =================================================================================================
// 2b. Tabs or avatars
// =================================================================================================
part('2b. tabs or avatars')
const bat1 = await summoned(arena, bat, thorin, 'findFamiliar', { id: 'bat1', name: 'Bat', activity: 'ff-summon', delta: { system: { attributes: { hp: { value: 3, max: 4 } } } } })
const bat2 = await summoned(arena, bat, thorin, 'findFamiliar', { id: 'bat2', name: 'Bat', activity: 'ff-summon', delta: { system: { attributes: { hp: { value: 2, max: 4 } } } } })
const drake1 = await summoned(arena, drake, thorin, 'summonDragon', { id: 'drake1', name: 'Drake', activity: 'sd-summon' })
const BAT1 = 'arena-bat1'
const BAT2 = 'arena-bat2'
const DRAKE = 'arena-drake1'
await until(async () => (await tabNames(alice)).length === 5, 'five tabs', 30_000)
check(same(await tabNames(alice), ['Thorin', 'Brakka', 'Bat 1', 'Bat 2', 'Drake']) && same(listedKeys(), ['brakka', BAT1, BAT2, DRAKE]),
  `the tabs Thorin, Brakka, Bat 1, Bat 2, Drake (${JSON.stringify(await tabNames(alice))}; keys ${JSON.stringify(listedKeys())})`)
{
  const face = await tabOf(alice, BAT1).evaluate(tab => ({ name: tab.querySelector('.truncate')?.textContent ?? null, badge: [...tab.querySelectorAll('span[aria-hidden]')].map(s => s.textContent).find(t => /^\d+$/.test(t)) ?? null }))
  const shown = await tabOf(alice, BAT1).isVisible()
  check(shown && (face.name === 'Bat' || face.name === null) && (face.badge === '1' || face.name === null),
    `each Bat's visible name "Bat" with its badge (${JSON.stringify(face)})`)
}
check(await describedAs(alice, BAT1) === 'Summoned by Thorin with Find Familiar' && await tabOf(alice, BAT1).getAttribute('data-kind') === 'summoned'
  && await tabOf(alice, DRAKE).getAttribute('data-kind') === 'summoned', 'a Bat described "Summoned by Thorin with Find Familiar", summoned')
for (const [width] of WIDTHS) {
  const view = views[width]
  await until(async () => (await tabNames(view)).length === 5, `five tabs at ${width}`, 30_000)
  const look = await rowLook(view)
  check((width > 400 || look.mode === 'avatars') && ruleHolds(look), `at ${width}: ${look.mode}, the rule itself holding (copy ${look.ghostWidth} against the row's ${look.boxWidth})`)
  if (look.mode === 'avatars') {
    await choose(view, 'brakka')
    const after = await rowLook(view)
    check(after.mode === 'avatars' && ruleHolds(after), `at ${width} choosing Brakka keeps the mode, the chosen one a tab with its name, 40 px clear of the edges`)
    await shootBoth(view, 'companions-switcher-avatars', switcher(view).locator('xpath=..'))
    await choose(view, 'self')
  }
  check(await sideways(view.page) === 0, `no horizontal page scroll at ${width}`)
}

// =================================================================================================
// 3. Brakka's sheet
// =================================================================================================
part('3. brakka\'s sheet')
await choose(alice, 'brakka')
const brakkaPanel = panelOf(alice, 'brakka')
await brakkaPanel.locator('#creature-brakka-creature-name').waitFor({ timeout: 20_000 })
{
  const header = await brakkaPanel.locator('section[aria-labelledby="creature-brakka-creature-name"]').evaluate(section => ({
    h2: section.querySelector('h2')?.textContent, lines: [...section.querySelectorAll('p')].map(p => p.textContent.trim()),
    chips: [...section.querySelectorAll('span.rounded-full.border')].map(s => s.textContent.trim()),
    tiles: [...section.querySelectorAll('dl')].at(0) ? [...section.querySelectorAll('dl')[0].querySelectorAll('dt')].map(dt => dt.textContent.trim()) : [],
  }))
  check(header.h2 === 'Brakka' && header.lines.includes('Medium Humanoid, Neutral') && header.lines.includes('Thorin’s companion') && header.chips.includes('CR 2'),
    `h2 Brakka, its creature line, "Thorin’s companion", CR 2 (${JSON.stringify(header)})`)
  check(header.tiles.length === 5 && /^(Hit points|HP)/.test(header.tiles[0]) && /^(Armor class|AC)/.test(header.tiles[1]) && /^(Proficiency|Prof)/.test(header.tiles[2])
    && /^(Initiative|Init)/.test(header.tiles[3]) && /^Speed/.test(header.tiles[4]) && !header.tiles.some(t => /Hit dice/.test(t)),
    `five tiles, no Hit dice tile (${JSON.stringify(header.tiles)})`)
  const stats = await brakkaPanel.getByRole('definition').evaluateAll(() => null).catch(() => null)
  void stats
  const creatureStats = await brakkaPanel.locator('dl[aria-label="Creature stats"]').evaluate(dl => [...dl.children].map(div => `${div.querySelector('dt')?.textContent}: ${div.querySelector('dd')?.textContent}`))
  check(creatureStats.includes('Hit dice: 3 of 4 (d8)'), `"Creature stats" with Hit dice 3 of 4 (d8) (${JSON.stringify(creatureStats)})`)
  const tabs = await alice.page.locator('[id^="creature-brakka-sheet-tab-"]').evaluateAll(list => list.map(tab => tab.id.replace('creature-brakka-sheet-tab-', '')))
  check(same(tabs, ['character', 'actions', 'inventory', 'features']), `its tabs Character, Actions, Inventory, Features, and no Spells, Effects or Biography (${JSON.stringify(tabs)})`)
  const text = await brakkaPanel.textContent()
  check(await brakkaPanel.getByRole('button', { name: /Inspiration/ }).count() === 0 && await brakkaPanel.getByRole('button', { name: /^(Give|Remove)/ }).count() === 0
    && !/Journal/.test(text) && await brakkaPanel.getByRole('button', { name: /^Spend/ }).count() === 0, 'no Inspiration, Give, Remove, Journal card or spend control')
  await openSheetTab(alice, 'brakka', 'inventory')
  await brakkaPanel.getByText('Greataxe').first().waitFor({ timeout: 10_000 })
  check(true, 'its Inventory has its Greataxe')
  check(/Thorin/.test(await alice.page.locator('header').first().textContent()), "Thorin's page header unchanged")
  await openSheetTab(alice, 'brakka', 'character')
  for (const [width] of WIDTHS.filter(([w]) => w !== 360)) {
    const view = views[width]
    await choose(view, 'brakka')
    await panelOf(view, 'brakka').locator('#creature-brakka-creature-name').waitFor({ timeout: 20_000 })
    await shootBoth(view, 'companions-creature-brakka', panelOf(view, 'brakka').locator('section[aria-labelledby="creature-brakka-creature-name"]'))
    await choose(view, 'self')
  }
}

// =================================================================================================
// 4. Brakka attacks
// =================================================================================================
part('4. brakka attacks')
const fight = T.combatOf('fight', [
  { id: 'cbThorin', actor: thorin, token: tokenOf.thorin, fields: { name: 'Thorin', initiative: null } },
  { id: 'cbBrakka', actor: brakka, token: tokenOf.brakka, fields: { name: 'Brakka', initiative: null } },
  { id: 'cbBat', token: bat1, fields: { name: 'Bat', initiative: null } },
  { id: 'cbGoblin', actor: goblin, token: tokenOf.goblin, fields: { name: 'Goblin', initiative: null } },
])
Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight') ?? null, configurable: true })
await Hooks.callAll('createCombat', fight)
await until(() => sql('select count(*) from combat') === '1', 'the app to hear of the fight', 15_000)
await choose(alice, 'brakka')
await openSheetTab(alice, 'brakka', 'actions')
{
  const chip = brakkaPanel.getByRole('button', { name: 'Greataxe attack, +5', exact: true })
  await chip.waitFor({ timeout: 15_000 })
  const before = requests()
  await force(alice, 20, 15)
  await chip.click()
  const picker = alice.page.getByRole('dialog', { name: 'Greataxe attack' })
  await picker.waitFor({ timeout: 10_000 })
  await picker.getByRole('button', { name: /^Goblin/ }).click()
  await until(() => requests() > before && rowsSince(before).every(r => ['done', 'failed'].includes(r.status)), 'Brakka\'s attack to be made', 30_000)
  await unforce(alice)
  const attack = rowsSince(before)[0]
  check(attack.kind === 'attack' && attack.actorId === 'brakka' && attack.status === 'done', `Brakka's attack sent through its own route and made (${attack.kind}, ${attack.actorId}, ${attack.status})`)
  // Its damage: rolled at once where the game does, else from its tray.
  await wait(2500)
  if (!rowsSince(before).some(r => r.kind === 'damage')) {
    const roll = statusIn(alice, 'brakka').locator('xpath=..').getByRole('button', { name: /^Roll damage/ }).first()
    await roll.waitFor({ timeout: 15_000 })
    await roll.click()
  }
  await until(() => rowsSince(before).some(r => (r.kind === 'damage') && ['done', 'failed'].includes(r.status)), 'Brakka\'s damage', 30_000)
  const damage = rowsSince(before).find(r => r.kind === 'damage')
  check(damage.status === 'done' && damage.useId === attack.id, `its damage made on its attack (${damage.status})`)
  const card = MIDI ? W.messages.contents.find(m => m.flags?.['sending-stone']?.use === attack.id) : madeFor(attack.id)
  check(!!card && card.speaker?.actor === 'brakka' && (MIDI || card.author?.id === 'alice') && card.flags['sending-stone']?.companion === 'brakka',
    `Foundry's attack card spoken by Brakka, authored by Alice, flagged companion (${card?.speaker?.alias ?? card?.speaker?.actor}, ${card?.author?.id}, ${JSON.stringify(card?.flags?.['sending-stone'])})`)
  if (MIDI) check(W.midi.made.at(-1)?.actor?.id === 'brakka', "through Midi-QOL's workflow on Brakka")
  await statusIn(alice, 'brakka').waitFor({ timeout: 10_000 })
  const thorinTray = await panelOf(alice, 'self').getByRole('region', { name: 'Your rolls' }).getByRole('status').textContent().catch(() => '')
  check(!/Greataxe/.test(thorinTray), `its tray in Brakka's pane; Thorin's tray has nothing new ("${thorinTray}")`)
}

// =================================================================================================
// 5. A Bat
// =================================================================================================
part('5. a bat')
await choose(alice, BAT1)
const bat1Panel = panelOf(alice, BAT1)
await bat1Panel.locator(`#creature-${BAT1}-creature-name`).waitFor({ timeout: 20_000 })
{
  const header = await bat1Panel.locator(`section[aria-labelledby="creature-${BAT1}-creature-name"]`).evaluate(section => ({
    h2: section.querySelector('h2')?.textContent, text: section.textContent, chips: [...section.querySelectorAll('span.rounded-full.border')].map(s => s.textContent.trim()),
    speed: [...section.querySelectorAll('dl')[0].children].find(div => /Speed/.test(div.querySelector('dt')?.textContent ?? ''))?.querySelector('dd')?.innerText,
  }))
  check(header.h2 === 'Bat 1' && /3\s*\/\s*4|3 of 4/.test(header.text) && header.chips.includes('CR 0'), `its HP is its token's, 3 of 4, not the template's; CR 0 (${JSON.stringify(header.chips)})`)
  check(/^5 ft\s+fly 30 ft$/.test((header.speed ?? '').replace(/\n/g, ' ').trim()), `its Speed tile "5 ft" over "fly 30 ft" (${JSON.stringify(header.speed)})`)
  await shootBoth(alice, 'companions-creature-bat', bat1Panel.locator(`section[aria-labelledby="creature-${BAT1}-creature-name"]`))
  for (const width of [390, 768]) {
    const view = views[width]
    await choose(view, BAT1)
    const header = panelOf(view, BAT1).locator(`section[aria-labelledby="creature-${BAT1}-creature-name"]`)
    await header.waitFor({ timeout: 20_000 })
    await shootBoth(view, 'companions-creature-bat', header)
    await choose(view, 'self')
  }
  const bat2Sheet = JSON.stringify((await call(alice.page, `${companionApi(BAT2)}/table`)).json?.sheet?.attributes ?? {})
  const perception = bat1Panel.getByRole('button', { name: /^Perception/ }).first()
  await perception.waitFor({ timeout: 10_000 })
  const { request, made } = await sent(() => perception.click(), "Bat 1's Perception")
  const card = madeFor(request.id)
  check(request.kind === 'skill' && request.actorId === BAT1 && made.status === 'done' && card?.speaker?.token === 'bat1' && card.flags['sending-stone']?.companion === BAT1,
    `a Perception check for Bat 1, made on that token's actor, the card's speaker that token (${card?.speaker?.token})`)
  check(JSON.stringify((await call(alice.page, `${companionApi(BAT2)}/table`)).json?.sheet?.attributes ?? {}) === bat2Sheet, "Bat 2's sheet unchanged")
}

// =================================================================================================
// 6. Switching keeps state
// =================================================================================================
part('6. switching keeps state')
{
  await choose(alice, 'self')
  await openSheetTab(alice, 'self', 'actions')
  const swing = sheetPanel(alice, 'self').getByRole('button', { name: 'Longsword attack, +6', exact: true })
  await swing.waitFor({ timeout: 10_000 })
  await force(alice, 20, 16)
  await swing.click()
  const picker = alice.page.getByRole('dialog', { name: 'Longsword attack' })
  await picker.waitFor()
  const attack = await sent(() => picker.getByRole('button', { name: /^Goblin/ }).click(), "Thorin's attack")
  await unforce(alice)
  check(attack.made.status === 'done', "Thorin attacks the goblin")
  const selfTray = panelOf(alice, 'self').getByRole('region', { name: 'Your rolls' })
  await selfTray.getByRole('button', { name: 'Roll damage' }).waitFor({ timeout: 30_000 })
  await choose(alice, BAT1)
  await choose(alice, 'self')
  const roll = selfTray.getByRole('button', { name: 'Roll damage' })
  check(await roll.isVisible(), 'chose Bat 1, then Thorin: "Roll damage" still offered')
  // A familiar summoned meanwhile, its tab joining the row, doesn't clear Thorin's tray.
  const bat3 = await summoned(arena, bat, thorin, 'findFamiliar', { id: 'bat3', name: 'Bat', activity: 'ff-summon' })
  await tabOf(alice, 'arena-bat3').waitFor({ timeout: 30_000 })
  check(await roll.isVisible(), 'a familiar summoned meanwhile, its tab joining the row, leaves Thorin\'s tray as it was: "Roll damage" still offered')
  const damage = await sent(() => roll.click(), "Thorin's damage")
  // It goes again, its tab left once it's been visited: on every page, each of which has seen it
  // first, a tab it never saw being none it could keep.
  for (const [width] of WIDTHS) await tabOf(views[width], 'arena-bat3').waitFor({ state: 'attached', timeout: 30_000 })
  await bat3.delete()
  await until(async () => (await tabOf(alice, 'arena-bat3').getAttribute('data-kind')) === 'gone', 'the third Bat gone', 30_000)
  await choose(alice, 'arena-bat3')
  await choose(alice, 'self')
  for (const [width] of WIDTHS) {
    const view = views[width]
    if (view === alice) continue
    await until(async () => (await tabOf(view, 'arena-bat3').getAttribute('data-kind').catch(() => null)) === 'gone', `the third Bat gone at ${width}`, 30_000)
    await choose(view, 'arena-bat3')
    await choose(view, 'self')
  }
  check(damage.request.kind === 'damage' && damage.request.useId === attack.request.id && damage.made.status === 'done', 'and rolled there, on his attack')
  const canvases = await alice.page.locator('[id^="dice-canvas-threejs-"]').count()
  check(canvases === 1, `the page holds one dice canvas with three panes visited (${canvases})`)
}

// =================================================================================================
// 7. A hidden pane
// =================================================================================================
part('7. a hidden pane')
const toasting = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin' })
watchRefusals(toasting)
watchDamage(toasting, 'the toasting page at 390')
await switcher(toasting).waitFor({ timeout: 20_000 })
{
  await choose(toasting, 'brakka')
  await openSheetTab(toasting, 'brakka', 'actions')
  const cry = panelOf(toasting, 'brakka').getByRole('button', { name: 'Battle Cry, DEX saving throw DC 13', exact: true })
  await cry.waitFor({ timeout: 15_000 })
  // The use goes; Thorin is chosen before its result.
  await paced()
  const before = requests()
  await cry.click()
  // The game held from fetching it until Thorin is chosen, so that he's chosen before its result.
  await stopFetching()
  await useAt(toasting.page.getByRole('dialog', { name: 'Battle Cry' }), /^Goblin/)
  await until(() => requests() > before, 'Battle Cry to be sent', 15_000)
  await choose(toasting, 'self')
  startFetching()
  await until(() => requests() > before && ['done', 'failed'].includes(rowsSince(before)[0].status), 'Battle Cry to be used', 30_000)
    .catch(async error => {
      note(`rows: ${JSON.stringify(rowsSince(before).map(r => [r.kind, r.status, r.actorId, r.result?.reason]))}; requests ${requests()} from ${before}`)
      await shoot(toasting, 'companions-failed-cry')
      throw error
    })
  await until(async () => (await tabOf(toasting, 'brakka').getAttribute('aria-label')) === 'Brakka, damage to roll', 'Brakka\'s tab marked', 20_000)
  check(rowsSince(before).every(r => r.kind !== 'damage'), 'Brakka\'s tab named "Brakka, damage to roll", no dice thrown')
  const dot = await tabOf(toasting, 'brakka').evaluate(tab => !!tab.querySelector('.bg-primary.rounded-full, .rounded-full.bg-primary'))
  check(dot, 'with its dot')
  await shootBoth(toasting, 'companions-switcher-marks', switcher(toasting).locator('xpath=..'))
  const toastsBefore = await toasting.page.getByRole('log', { name: 'Roll results' }).locator('[data-roll-toast]').count()
  await choose(toasting, 'brakka')
  // Its tray, behind its rolls' button where toasts show: "Brakka’s rolls".
  await panelOf(toasting, 'brakka').getByRole('button', { name: /^Brakka’s rolls/ }).click()
  const rolls = toasting.page.getByRole('dialog', { name: 'Brakka’s rolls' })
  await rolls.waitFor({ timeout: 10_000 })
  const offer = rolls.getByRole('button', { name: /^Roll damage/ }).first()
  await offer.waitFor({ timeout: 15_000 })
  check(await tabOf(toasting, 'brakka').getAttribute('aria-label') === 'Brakka', 'chose Brakka: its tray, "Brakka’s rolls", offers the damage, and the mark goes')
  await toasting.page.keyboard.press('Escape')
  await wait(1500)
  const shownToasts = await toasting.page.getByRole('log', { name: 'Roll results' }).locator('[data-roll-toast]').count()
  await choose(toasting, 'self')
  await wait(1500)
  const after = await toasting.page.getByRole('log', { name: 'Roll results' }).locator('[data-roll-toast]').count()
  check(shownToasts <= toastsBefore && after <= toastsBefore, `no toast pops as its pane is shown again, nor as Thorin's is after it (${toastsBefore}, ${shownToasts}, ${after})`)
}

// =================================================================================================
// 8. Combat, the character's view
// =================================================================================================
part('8. combat, the character\'s view')
await fight.setInitiative(fight.combatants.get('cbThorin'), 20)
await fight.setInitiative(fight.combatants.get('cbBrakka'), 17)
await fight.setInitiative(fight.combatants.get('cbBat'), 15)
await fight.setInitiative(fight.combatants.get('cbGoblin'), 10)
await fight.update({ round: 1, turn: 0 })
const combatRows = async who => {
  const view = (await call(who.page, `${API}/table`)).json
  return view?.combat?.combatants?.map(c => [c.name, c.yours === true, c.companion ?? null, c.side, c.stance ?? null]) ?? []
}
await until(async () => (await combatRows(alice)).length === 4, 'the app to show the fight', 20_000)
{
  const rows = await combatRows(alice)
  check(rows.some(([name, yours, key]) => name === 'Brakka' && yours && key === 'brakka') && rows.some(([name, yours, key]) => name === 'Bat' && yours && key === BAT1),
    `the view marks Brakka and the Bat yours, by their keys (${JSON.stringify(rows)})`)
  await choose(alice, BAT1)
  await alice.page.getByRole('tab', { name: /^Combat/ }).click()
  const tracker = alice.page.getByRole('region', { name: 'Combat' })
  await tracker.getByText('Yours').first().waitFor({ timeout: 15_000 }).catch(async error => {
    note(`combat regions ${await tracker.count()}; ${JSON.stringify(await combatRows(alice))}; text ${(await alice.page.locator('body').innerText()).slice(0, 1500)}`)
    await shoot(alice, 'companions-failed-combat')
    throw error
  })
  const roles = await tracker.locator('li').evaluateAll(items => items.map(li => li.textContent))
  check(roles.filter(t => /Yours/.test(t)).length === 2 && roles.some(t => /Thorin\s*You(?!rs)/.test(t)),
    `Thorin's tracker shows Brakka and the Bat as Yours, with HP, Bat 1 chosen and Thorin still You (${JSON.stringify(roles)})`)
  await fight.setTurn(1, 2)
  await until(async () => (await alice.page.locator('#turn-heading').textContent().catch(() => '')) === 'Bat’s turn', 'the Bat\'s turn in the panel', 20_000)
  const link = tracker.getByRole('button', { name: 'its tab' })
  check(await tracker.getByText('Roll for it on its tab.').isVisible() && (await link.boundingBox()).height >= 44,
    'on the Bat\'s turn: "Bat’s turn", "Roll for it on its tab.", "its tab" a 44 px link')
  await choose(alice, 'self')
  await until(async () => (await tabOf(alice, BAT1).getAttribute('aria-label')) === 'Bat 1, its turn', 'Bat 1 marked', 15_000)
  check(true, 'Bat 1\'s tab named "Bat 1, its turn"')
  await shootBoth(alice, 'companions-combat-yours', tracker)
  for (const width of [390, 768]) {
    const view = views[width]
    await view.nav.getByRole('button', { name: /^Combat/ }).click()
    const region = view.page.getByRole('region', { name: 'Combat' })
    await until(async () => (await view.page.locator('#turn-heading').textContent().catch(() => '')) === 'Bat’s turn', `the Bat's turn at ${width}`, 20_000)
    await shootBoth(view, 'companions-combat-yours', region)
    await view.character()
  }
  await link.click()
  await until(async () => (await tabOf(alice, BAT1).getAttribute('aria-selected')) === 'true', 'its tab chosen', 5_000)
  await until(() => alice.page.evaluate(id => document.activeElement?.id === id, `creature-tab-${BAT1}`), 'its tab focused', 5_000)
  check(true, '"its tab" chooses Bat 1\'s tab, shows Character and focuses the tab')
  // The Combat tab's dot, at a phone.
  const phone = views[390]
  const combatButton = phone.nav.getByRole('button', { name: /^Combat/ })
  await until(async () => /your turn/.test(await combatButton.textContent()), 'the Combat dot', 15_000)
  check(/Combat\s*, your turn/.test(await combatButton.textContent()), `the Combat tab's dot ("${await combatButton.textContent()}")`)
  await fight.setTurn(1, 1)
  await phone.nav.getByRole('button', { name: /^Combat/ }).click()
  await until(async () => (await phone.page.locator('#turn-heading').textContent().catch(() => '')) === 'Brakka’s turn', 'Brakka\'s turn in the panel', 20_000)
  check(await phone.page.getByText('You are up next.').count() === 0, 'on Brakka\'s turn with Thorin next, no "You are up next."')
  await phone.character()
  // Bat 1's own initiative, with the Gamemaster viewing another scene.
  await fight.setInitiative(fight.combatants.get('cbBat'), null)
  T.faults.canvasScene = 'den'
  await choose(alice, BAT1)
  await openSheetTab(alice, BAT1, 'character')
  const init = bat1Panel.getByRole('button', { name: 'Initiative, +2, to roll for the combat' })
  await init.waitFor({ timeout: 20_000 })
  await shootBoth(alice, 'companions-initiative-own', init.locator('xpath=ancestor::div[1]'))
  for (const width of [390, 768]) {
    const view = views[width]
    await choose(view, BAT1)
    await openSheetTab(view, BAT1, 'character')
    const tile = panelOf(view, BAT1).getByRole('button', { name: 'Initiative, +2, to roll for the combat' })
    await tile.waitFor({ timeout: 20_000 })
    await shootBoth(view, 'companions-initiative-own', tile.locator('xpath=ancestor::div[1]'))
    await choose(view, 'self')
  }
  await force(alice, 20, 12)
  const rolled = await sent(() => init.click(), "Bat 1's initiative")
  await unforce(alice)
  check(rolled.made.status === 'done' && fight.combatants.get('cbBat').initiative === 14.14 && fight.combatants.get('cbThorin').initiative === 20,
    `In Bat 1's pane its own initiative, rolled: that Bat's combatant set (${fight.combatants.get('cbBat').initiative}), with the Gamemaster viewing another scene`)
  T.faults.canvasScene = null
  // The Gamemaster asks Thorin a save while Bat 1 is chosen.
  const shaman = { id: 'hex', name: 'Hex', img: 'hex.webp', uuid: 'Actor.goblin.Item.hex' }
  await W.cards.saveCard({ by: goblin, item: shaman, dc: 12, targets: [thorin] })
  await until(async () => (await tabOf(alice, 'self').getAttribute('aria-label')) === 'Thorin, your Gamemaster asks for a roll', 'Thorin\'s tab marked as asked', 30_000)
  check(true, 'while the Gamemaster asks Thorin a save and Bat 1 is chosen, Thorin\'s tab is named "Thorin, your Gamemaster asks for a roll"')
  await choose(views[768], BAT1)
  await until(async () => (await tabOf(views[768], 'self').getAttribute('aria-label')) === 'Thorin, your Gamemaster asks for a roll', 'the mark at 768', 30_000)
  await shootBoth(views[768], 'companions-switcher-marks', switcher(views[768]).locator('xpath=..'))
  await choose(views[768], 'self')
  await shootBoth(alice, 'companions-switcher-marks', switcher(alice).locator('xpath=..'))
}
{
  // A fight with only the Bat and the goblin reaches the app.
  const small = T.combatOf('skirmish', [{ id: 'sbBat', token: bat2, fields: { name: 'Bat', initiative: 9 } }, { id: 'sbGoblin', actor: goblin, token: tokenOf.goblin, fields: { name: 'Goblin', initiative: 5 } }])
  small.active = false
  await Hooks.callAll('createCombat', small)
  await until(() => Number(sql('select count(*) from combat')) >= 2, 'the app to hear of the skirmish', 15_000)
  check(true, 'a fight with only a Bat and the goblin reaches the app')
}

// =================================================================================================
// 8b. Companions' initiative
// =================================================================================================
part('8b. companions\' initiative')
{
  const companionsCb = () => ['cbBrakka', 'cbBat'].map(id => fight.combatants.get(id).initiative)
  await game.settings.set('sending-stone', 'campaigns', [campaign({ companionInitiative: 'after' })])
  for (const id of ['cbThorin', 'cbBrakka', 'cbBat', 'cbGoblin']) await fight.setInitiative(fight.combatants.get(id), null)
  await until(() => postsOf('bridge.hello').at(-1)?.data?.features?.companions?.initiative === 'after', 'the hello to say after', 20_000)
  const gm = await browse({ width: 1280, height: 800, path: '/campaigns' })
  const card = gm.page.getByRole('article', { name: TITLE })
  await card.waitFor()
  const settingsSection = card.locator('details').filter({ has: gm.page.locator('summary', { hasText: 'Foundry settings' }) })
  await settingsSection.locator('summary').click()
  await until(async () => /Companions' initiative\s*Right after its character/.test(await settingsSection.textContent()), 'the card to say Right after its character', 20_000)
  check(true, 'the Gamemaster\'s campaign card shows "Companions\' initiative" · "Right after its character"')
  await choose(alice, BAT1)
  await openSheetTab(alice, BAT1, 'character')
  const group = bat1Panel.getByRole('group', { name: 'Initiative, +2, acts right after Thorin' })
  await group.waitFor({ timeout: 30_000 })
  check(/After Thorin/i.test(await group.textContent()) && await bat1Panel.getByRole('button', { name: /^Initiative/ }).count() === 0,
    'before Thorin rolls, Bat 1\'s Initiative tile reads "After Thorin", a group named "Initiative, +2, acts right after Thorin", no Roll and no button')
  await shootBoth(alice, 'companions-initiative-after', group.locator('xpath=ancestor::div[1]'))
  for (const width of [390, 768]) {
    const view = views[width]
    await choose(view, BAT1)
    await openSheetTab(view, BAT1, 'character')
    const tile = panelOf(view, BAT1).getByRole('group', { name: 'Initiative, +2, acts right after Thorin' })
    await tile.waitFor({ timeout: 30_000 })
    await shootBoth(view, 'companions-initiative-after', tile.locator('xpath=ancestor::div[1]'))
    await choose(view, 'self')
  }
  await choose(alice, 'self')
  await openSheetTab(alice, 'self', 'character')
  const thorinInit = sheetPanel(alice, 'self').getByRole('button', { name: /^Initiative, \+2, to roll for the combat/ })
  await thorinInit.waitFor({ timeout: 20_000 })
  await force(alice, 20, 16)
  const rolled = await sent(() => thorinInit.click(), "Thorin's initiative")
  await unforce(alice)
  await until(() => same(companionsCb(), [18.139, 18.139]), 'the companions to follow', 15_000)
  await fight.setInitiative(fight.combatants.get('cbGoblin'), 18.13)
  check(rolled.made.status === 'done' && fight.combatants.get('cbThorin').initiative === 18.14 && same(companionsCb(), [18.139, 18.139]),
    `Thorin's 18.14 with the tiebreaker → Brakka and the Bat 18.139 (${fight.combatants.get('cbThorin').initiative}, ${JSON.stringify(companionsCb())})`)
  check(same(fight.turns.map(cb => cb.id), ['cbThorin', 'cbBrakka', 'cbBat', 'cbGoblin']), `the goblin's 18.13 after them (${JSON.stringify(fight.turns.map(cb => [cb.id, cb.initiative]))})`)
  const tracker = alice.page.getByRole('region', { name: 'Combat' })
  await until(async () => (await tracker.textContent()).split('18.14').length - 1 >= 3, 'the tracker to show 18.14 three times', 20_000)
  check(true, "Alice's tracker shows Thorin, Brakka and the Bat each 18.14, then the goblin")
  const refused = await call(alice.page, `${companionApi(BAT1)}/rolls`, { method: 'POST', body: { kind: 'initiative', combatId: 'fight', mode: 0, explicit: false, extras: [], dice: [{ faces: 20, results: [10] }] } })
  check(refused.status === 422 && refused.json?.reason === 'follows', `a POST of the Bat's initiative answers 422 follows (${refused.status}, ${refused.text})`)
  await fight.setInitiative(fight.combatants.get('cbThorin'), 9)
  await until(() => same(companionsCb(), [8.999, 8.999]), 'theirs 8.999', 15_000)
  check(true, "Thorin's changed in Foundry to 9 → theirs 8.999")
  await fight.setInitiative(fight.combatants.get('cbThorin'), null)
  await until(() => same(companionsCb(), [null, null]), 'theirs cleared', 15_000)
  check(true, 'reset → theirs cleared')
  await fight.setInitiative(fight.combatants.get('cbBat'), 5)
  await wait(1500)
  check(fight.combatants.get('cbBat').initiative === 5, "the Gamemaster's own 5 on the Bat stands until Thorin's next change")
  // Thorin removed from the fight: the Bat's rolls from its tab again.
  const thorinCb = fight.combatants.get('cbThorin')
  fight.combatants.delete('cbThorin')
  await Hooks.callAll('deleteCombatant', thorinCb, {}, 'gm')
  await choose(alice, BAT1)
  await bat1Panel.getByRole('button', { name: /^Initiative, \+2/ }).waitFor({ timeout: 30_000 })
  check(true, 'with Thorin removed from the fight, the Bat\'s initiative rolls from its tab again')
  fight.combatants.set('cbThorin', thorinCb)
  await Hooks.callAll('createCombatant', thorinCb, {}, 'gm')
  await game.settings.set('sending-stone', 'campaigns', [campaign()])
  await gm.view.close()
}

// =================================================================================================
// 9. Chat
// =================================================================================================
part('9. chat')
{
  await alice.page.getByRole('tab', { name: /^Chat/ }).click()
  const log = alice.page.getByRole('list', { name: 'Chat log' })
  const batBubble = log.locator('[data-side]').filter({ hasText: 'Bat' }).last()
  await batBubble.waitFor({ timeout: 20_000 })
  const side = await batBubble.getAttribute('data-side')
  const portrait = await batBubble.evaluate(el => !!el.querySelector('img'))
  check(side === 'me', `the Bat's card in Alice's chat on her side (${side}), its portrait ${portrait ? 'drawn' : 'as initials'} and its name over it`)
  await shootBoth(alice, 'companions-chat-companions', log)
  for (const width of [390, 768]) {
    const view = views[width]
    await view.chat()
    await view.log.locator('[data-side="me"]').filter({ hasText: 'Bat' }).last().waitFor({ timeout: 20_000 })
    await shootBoth(view, 'companions-chat-companions', view.log)
    await view.character()
  }
  await bob.page.getByRole('tab', { name: /^Chat/ }).click().catch(() => bob.chat())
  const bobLog = bob.page.getByRole('list', { name: 'Chat log' })
  const bobBubble = bobLog.locator('[data-side]').filter({ hasText: 'Bat' }).last()
  await bobBubble.waitFor({ timeout: 20_000 })
  check(await bobBubble.getAttribute('data-side') === 'party', `in Bob's as the party's (${await bobBubble.getAttribute('data-side')})`)
  await alice.page.getByRole('tab', { name: /^Combat/ }).click()
}

// =================================================================================================
// 10. The Drake
// =================================================================================================
part('10. the drake')
await choose(alice, DRAKE)
const drakePanel = panelOf(alice, DRAKE)
await drakePanel.locator(`#creature-${DRAKE}-creature-name`).waitFor({ timeout: 20_000 })
{
  const header = await drakePanel.locator(`section[aria-labelledby="creature-${DRAKE}-creature-name"]`).evaluate(section => ({
    chips: [...section.querySelectorAll('span.rounded-full.border')].map(s => s.textContent.trim()),
    prof: [...section.querySelectorAll('dl')[0].children].find(div => /^(Proficiency|Prof)/.test(div.querySelector('dt')?.textContent ?? ''))?.querySelector('dd')?.textContent?.trim(),
  }))
  check(header.chips.includes('In its lair') && !header.chips.some(c => /^CR/.test(c)) && header.prof === '—', `the chip "In its lair", no CR chip, Proficiency — (${JSON.stringify(header)})`)
  const stats = await drakePanel.locator('dl[aria-label="Creature stats"]').evaluate(dl => [...dl.children].map(div => `${div.querySelector('dt')?.textContent}: ${div.querySelector('dd')?.textContent}`))
  check(stats.includes('Legendary actions: 3 of 3') && stats.includes('Lair initiative: 20'), `"Creature stats" Legendary actions 3 of 3, Lair initiative 20 (${JSON.stringify(stats)})`)
  await shootBoth(alice, 'companions-creature-drake', drakePanel.locator(`section[aria-labelledby="creature-${DRAKE}-creature-name"]`))
  await openSheetTab(alice, DRAKE, 'actions')
  const legendary = drakePanel.getByRole('region', { name: 'Legendary Actions' })
  await legendary.waitFor({ timeout: 15_000 })
  check(/3 of 3 left/.test(await legendary.textContent()), 'the Legendary Actions heading\'s "3 of 3 left"')
  await shootBoth(alice, 'companions-legendary-count', legendary)
  for (const width of [390, 768]) {
    const view = views[width]
    await choose(view, DRAKE)
    const header = panelOf(view, DRAKE).locator(`section[aria-labelledby="creature-${DRAKE}-creature-name"]`)
    await header.waitFor({ timeout: 20_000 })
    await shootBoth(view, 'companions-creature-drake', header)
    await openSheetTab(view, DRAKE, 'actions')
    const region = panelOf(view, DRAKE).getByRole('region', { name: 'Legendary Actions' })
    await region.waitFor({ timeout: 15_000 })
    await shootBoth(view, 'companions-legendary-count', region)
    await choose(view, 'self')
  }
  const wing = legendary.getByRole('button', { name: /^Use Wing Attack/ })
  /** The use, with no one ticked in its picker. */
  const useWing = async () => {
    await wing.click()
    const picker = alice.page.getByRole('dialog', { name: 'Wing Attack' })
    await picker.waitFor({ timeout: 10_000 })
    await picker.getByRole('button', { name: 'Use', exact: true }).click()
  }
  const used = await sent(useWing, 'Wing Attack')
  check(used.made.status === 'done', 'Wing Attack used')
  await until(async () => /1 of 3 left/.test(await legendary.textContent()), '1 of 3 left', 20_000)
  check(true, '→ "1 of 3 left" once the sheet comes')
  const again = await sent(useWing, 'Wing Attack again')
  check(again.made.status === 'failed' && again.made.result?.reason === 'legendary', `used again → refused legendary (${JSON.stringify(again.made.result?.reason)})`)
  // A use's refusal is worded as a use's, "Not used at the table", as every use's has been
  // (APP src/components/character-sheet/roll-tray.tsx, `Not ${verb} at the table`); the fragment is §9.5's.
  await until(async () => (await statusIn(alice, DRAKE).textContent().catch(() => '')).includes('Not used at the table: it has too few legendary actions left'), 'the refusal in the Drake\'s tray', 20_000)
    .catch(async error => { note(`the Drake's tray: ${await statusIn(alice, DRAKE).textContent().catch(() => null)}`); throw error })
  check(drake1.actor.system.resources.legact.spent === 2, 'the tray: "Not used at the table: it has too few legendary actions left"; nothing used in Foundry for it')
  const breathRow = drakePanel.locator('li').filter({ has: alice.page.getByRole('button', { name: /^Fire Breath/ }) }).last()
  const order = await breathRow.evaluate(row => {
    const chip = [...row.querySelectorAll('button')].find(b => /recharge/.test(b.getAttribute('aria-label') ?? ''))
    return chip ? [...chip.parentElement.children].map(el => (el.getAttribute('aria-label') ?? el.textContent).trim()) : []
  })
  check(order[0] === 'Roll Fire Breath’s recharge: 5 or more on a d6' && /0\/1|0 of 1/.test(order[1] ?? ''), `its Fire Breath row: the Recharge chip first, left of 0/1 (${JSON.stringify(order)})`)
  await openSheetTab(alice, DRAKE, 'biography').catch(() => {})
  const drakeText = await drakePanel.textContent()
  const viewText = JSON.stringify((await call(alice.page, `${companionApi(DRAKE)}/table`)).json ?? {})
  check(!drakeText.includes(SECRET_TEXT) && !viewText.includes(SECRET_TEXT), 'its description has no secret section (Alice doesn\'t own it)')
}

// =================================================================================================
// 11. Foundry changes
// =================================================================================================
part('11. foundry changes')
const GONE = 'No longer with Thorin in your Gamemaster’s game'
{
  await choose(alice, 'self')
  await bat2.delete()
  await until(async () => (await tabOf(alice, BAT2).getAttribute('data-kind')) === 'gone', 'Bat 2 marked gone', 30_000)
  check(await describedAs(alice, BAT2) === GONE && await tabOf(alice, BAT2).getAttribute('aria-label') === 'Bat 2', `Bat 2's token deleted while it isn't chosen → its tab stays, gone, described "${GONE}", no marks`)
  check(await tabOf(alice, BAT1).getAttribute('aria-label') === 'Bat 1', 'Bat 1 keeps "Bat 1"')
  for (const [width] of WIDTHS) {
    const view = views[width]
    await until(async () => (await tabOf(view, BAT2).getAttribute('data-kind')) === 'gone', `gone at ${width}`, 30_000)
    await shootBoth(view, 'companions-switcher-gone', switcher(view).locator('xpath=..'))
  }
  await choose(alice, BAT2)
  await panelOf(alice, BAT2).getByText('Bat 2 is no longer with Thorin in your Gamemaster’s game.').waitFor({ timeout: 15_000 })
  check(true, 'chose Bat 2, never mounted: its pane shows "Bat 2 is no longer with Thorin in your Gamemaster’s game."')
  await shootBoth(alice, 'companions-pane-gone', panelOf(alice, BAT2))
  for (const width of [390, 768]) {
    const view = views[width]
    await choose(view, BAT2)
    await panelOf(view, BAT2).getByText('Bat 2 is no longer with Thorin in your Gamemaster’s game.').waitFor({ timeout: 15_000 })
    await shootBoth(view, 'companions-pane-gone', panelOf(view, BAT2))
    await choose(view, 'self')
  }
  await choose(alice, 'self')
  await until(async () => (await tabOf(alice, BAT2).count()) === 0, 'Bat 2\'s tab to leave', 10_000)
  check(await tabOf(alice, BAT1).getAttribute('aria-label') === 'Bat', 'chose Thorin → Bat 2\'s tab leaves the row, and Bat 1\'s tab is named "Bat" again')
  // Bat 1's token deleted while chosen.
  await choose(alice, BAT1)
  await openSheetTab(alice, BAT1, 'character')
  // A roll queued for it a moment before: sent, its token deleted before the game fetches it.
  await stopFetching()
  const queuedBefore = requests()
  await panelOf(alice, BAT1).getByRole('button', { name: /^Perception/ }).first().click()
  await until(() => requests() > queuedBefore, 'the queued Perception to be sent', 30_000)
  const queuedRoll = rowsSince(queuedBefore)[0]
  await bat1.delete()
  const goneNote = panelOf(alice, BAT1).getByRole('note')
  await goneNote.waitFor({ timeout: 30_000 })
  check((await goneNote.textContent()).trim() === 'Bat is no longer with Thorin in your Gamemaster’s game. Its sheet is as it was; nothing more can be rolled for it here.',
    `Bat 1's token deleted while chosen → the note over its sheet ("${(await goneNote.textContent()).trim()}")`)
  const perception = panelOf(alice, BAT1).getByRole('button', { name: /^Perception/ }).first()
  check(await perception.isDisabled(), 'its Perception disabled')
  await openSheetTab(alice, BAT1, 'actions')
  const bite = panelOf(alice, BAT1).getByRole('button', { name: /^Bite attack/ })
  check(await bite.isDisabled(), 'its Bite disabled, its sheet\'s tabs still working')
  startFetching()
  await until(() => ['done', 'failed'].includes(rollRow(queuedRoll.id).status), 'the queued roll to be answered', 30_000)
  const queuedMade = rollRow(queuedRoll.id)
  await until(async () => (await statusIn(alice, BAT1).textContent().catch(() => '')).includes('Not made at the table: Bat isn’t one of Thorin’s companions in your Gamemaster’s game now'), 'the queued roll\'s refusal in its tray', 20_000)
    .catch(async error => { note(`its tray: ${await statusIn(alice, BAT1).textContent().catch(() => null)}`); throw error })
  check(queuedMade.status === 'failed' && queuedMade.result?.reason === 'unknown',
    `a roll queued for it a moment before → "Not made at the table: Bat isn’t one of Thorin’s companions in your Gamemaster’s game now" (${queuedMade.result?.reason})`)
  await choose(alice, 'self')
  await until(async () => (await tabOf(alice, BAT1).count()) === 0, 'Bat 1\'s tab to go', 10_000)
  check(true, 'chose Thorin → its tab goes')
  // A token summoned anew → a new tab.
  const bat4 = await summoned(arena, bat, thorin, 'findFamiliar', { id: 'bat4', name: 'Bat', activity: 'ff-summon' })
  await tabOf(alice, 'arena-bat4').waitFor({ timeout: 30_000 })
  check(true, 'a token summoned anew → a new tab')
  // The scene switched to one without them, and back.
  await T.activate(den)
  await until(async () => (await tabOf(alice, 'arena-bat4').getAttribute('data-kind')) === 'gone' && (await tabOf(alice, DRAKE).getAttribute('data-kind')) === 'gone', 'the summons marked gone', 30_000)
  check(await tabOf(alice, 'brakka').getAttribute('data-kind') === 'owned', 'the active scene switched to one without them → their tabs stay marked gone; Brakka\'s, linked, stays')
  await alice.page.reload()
  await switcher(alice).waitFor({ timeout: 20_000 })
  await until(async () => (await tabNames(alice)).length === 2, 'the reload to clear them', 20_000)
  check(same(await tabNames(alice), ['Thorin', 'Brakka']), 'a reload clears them')
  await T.activate(arena)
  await until(async () => (await tabNames(alice)).length === 4, 'the summons back', 30_000)
  void bat4
  // Brakka's Owner taken from Alice, and given back.
  await choose(alice, 'brakka')
  brakka.ownership = { default: 0 }
  await Hooks.callAll('updateActor', brakka, { ownership: { default: 0 } }, {}, 'gm')
  await until(async () => (await tabOf(alice, 'brakka').getAttribute('data-kind')) === 'gone', 'Brakka marked gone', 30_000)
  const brakkaGone = await call(alice.page, `${companionApi('brakka')}/table`)
  check(brakkaGone.status === 404, `Brakka's Owner taken from Alice → its tab marked gone, its routes 404 (${brakkaGone.status})`)
  await panelOf(alice, 'brakka').getByRole('note').waitFor({ timeout: 30_000 })
  brakka.ownership = { default: 0, alice: 3 }
  await Hooks.callAll('updateActor', brakka, { ownership: { alice: 3 } }, {}, 'gm')
  await until(async () => (await tabOf(alice, 'brakka').getAttribute('data-kind')) === 'owned', 'Brakka listed again', 30_000)
  await openSheetTab(alice, 'brakka', 'actions')
  const axe = panelOf(alice, 'brakka').getByRole('button', { name: 'Greataxe attack, +5', exact: true })
  await axe.waitFor({ timeout: 20_000 })
  check(!(await axe.isDisabled()) && await panelOf(alice, 'brakka').getByRole('note').count() === 0, 'Owner given back → its tab unmarked, its pane mounted afresh, its Greataxe attack chip enabled')
  await force(alice, 20, 14)
  await axe.click()
  const picker = alice.page.getByRole('dialog', { name: 'Greataxe attack' })
  await picker.waitFor()
  const attack = await sent(() => picker.getByRole('button', { name: /^Goblin/ }).click(), "Brakka's attack again")
  await unforce(alice)
  check(attack.request.actorId === 'brakka' && attack.made.status === 'done', 'the attack posts to its route and is made, with no reload')
  // Three Bats: Bat 1's token deleted, visited and left: the others keep their numbers.
  await choose(alice, 'self')
  for (const id of ['arena-bat4']) if (await tabOf(alice, id).count()) await T.scenes.get('arena').tokens.get('bat4')?.delete()
  await until(async () => (await tabOf(alice, 'arena-bat4').getAttribute('data-kind').catch(() => null)) !== 'summoned', 'bat4 gone', 15_000).catch(() => {})
  await choose(alice, 'arena-bat4').catch(() => {})
  await choose(alice, 'self')
  const trio = []
  for (const n of [5, 6, 7]) trio.push(await summoned(arena, bat, thorin, 'findFamiliar', { id: `bat${n}`, name: 'Bat', activity: 'ff-summon' }))
  await until(async () => (await tabNames(alice)).filter(n => /^Bat/.test(n)).length === 3, 'three Bats', 30_000)
  check(same((await tabNames(alice)).filter(n => /^Bat/.test(n)), ['Bat 1', 'Bat 2', 'Bat 3']), `three Bats placed, Bat 1-3 (${JSON.stringify(await tabNames(alice))})`)
  await trio[0].delete()
  await until(async () => (await tabOf(alice, 'arena-bat5').getAttribute('data-kind')) === 'gone', 'Bat 1 gone', 30_000)
  await choose(alice, 'arena-bat5')
  await choose(alice, 'self')
  await until(async () => (await tabOf(alice, 'arena-bat5').count()) === 0, 'Bat 1 left', 10_000)
  check(same((await tabNames(alice)).filter(n => /^Bat/.test(n)), ['Bat 2', 'Bat 3']), `Bat 1's token deleted, visited and left → the others still read "Bat 2" and "Bat 3" (${JSON.stringify(await tabNames(alice))})`)
}

// =================================================================================================
// 12. Rights
// =================================================================================================
part('12. rights')
{
  const bobs = await call(bob.page, `/api/characters/sheet-thorin/companions/brakka/table`)
  check(bobs.status === 404, `Bob's GET of Thorin's Brakka → 404 (${bobs.status})`)
  const unlisted = await call(alice.page, `${companionApi('arena-nobody')}/table`)
  check(unlisted.status === 404, `Alice's of a key not listed → 404 (${unlisted.status})`)
  const named = await call(alice.page, `${companionApi('brakka')}/rolls`, { method: 'POST', body: { kind: 'skill', key: 'prc', mode: 0, explicit: false, extras: [], dice: [{ faces: 20, results: [10] }], actorId: 'goblin' } })
  check(named.status === 400, `a POST body naming actorId → 400 (${named.status})`)
  const spend = await call(alice.page, `${companionApi('brakka')}/rolls`, { method: 'POST', body: { kind: 'spend', counter: { item: 'cry' }, count: 1, mode: 0, explicit: false, extras: [], dice: [] } })
  check(spend.status === 409, `a spend POST at Brakka's pane → 409 (${spend.status})`)
  void BOB_SHEET
}

// =================================================================================================
// 13. The Gamemaster
// =================================================================================================
part('13. the gamemaster')
{
  const gm = await browse({ width: 1280, height: 800, path: `/campaigns/${A}/characters/thorin`, toasts: false })
  await switcher(gm).waitFor({ timeout: 20_000 })
  check((await tabNames(gm))[1] === 'Brakka' && await describedAs(gm, 'brakka') === 'Thorin’s companion', 'at Thorin\'s Gamemaster page the same tabs')
  const goneOnGm = await tabOf(gm, 'arena-bat6').count()
  void goneOnGm
  await choose(gm, 'brakka')
  await openSheetTab(gm, 'brakka', 'character')
  const perception = panelOf(gm, 'brakka').getByRole('button', { name: /^Perception/ }).first()
  await perception.waitFor({ timeout: 20_000 })
  const { request, made } = await sent(() => perception.click(), 'the Gamemaster\'s roll as Brakka')
  check(request.kind === 'skill' && made.status === 'done' && madeFor(request.id)?.flags?.['sending-stone']?.by === 'gm', "the Gamemaster's roll as Brakka is marked GM in Foundry")
  await choose(alice, 'brakka')
  await panelOf(alice, 'brakka').getByText(/GM/).first().waitFor({ timeout: 30_000 })
  check(true, 'and in Alice\'s Brakka pane (gmRolls)')
  const cards = await browse({ width: 1280, height: 800, path: '/campaigns' })
  const card = cards.page.getByRole('article', { name: TITLE })
  await card.waitFor()
  const line = card.getByText(/^Companions: /).first()
  await line.waitFor({ timeout: 20_000 })
  check(/^Companions: Brakka(, Bat \d \(summoned\))*, Drake \(summoned\)$/.test((await line.textContent()).trim()), `the campaign card says "${(await line.textContent()).trim()}", names only`)
  await shootBoth(cards, 'companions-gm-card', card)
  await cards.view.close()
  for (const [width, height] of [[390, 844], [768, 1024]]) {
    const small = await browse({ width, height, path: '/campaigns' })
    const smallCard = small.page.getByRole('article', { name: TITLE })
    await smallCard.getByText(/^Companions: /).first().waitFor({ timeout: 20_000 })
    await shootBoth(small, 'companions-gm-card', smallCard)
    await small.view.close()
  }
  await gm.view.close()
}

// =================================================================================================
// 14. Keyboard
// =================================================================================================
part('14. keyboard')
{
  const names = await tabNames(alice)
  await choose(alice, 'self')
  await tabOf(alice, 'self').focus()
  await alice.page.keyboard.press('ArrowRight')
  check(await alice.page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === names[1] && await tabOf(alice, 'brakka').getAttribute('aria-selected') === 'true', 'Right moves focus and chooses')
  await alice.page.keyboard.press('End')
  const last = await alice.page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
  await alice.page.keyboard.press('ArrowRight')
  check(last === names.at(-1) && await tabOf(alice, 'self').getAttribute('aria-selected') === 'true', 'End to the last, Right wrapping to Thorin')
  await alice.page.keyboard.press('ArrowLeft')
  await alice.page.keyboard.press('Home')
  check(await tabOf(alice, 'self').getAttribute('aria-selected') === 'true', 'Left back, Home to the first')
  await alice.page.keyboard.press('Tab')
  check(await alice.page.evaluate(() => !!document.activeElement?.closest('#creature-panel-self')), 'Tab into the panel')
}

// =================================================================================================
// 15. Five companions visited
// =================================================================================================
part('15. five companions visited')
{
  for (const n of [8, 9]) await summoned(arena, bat, thorin, 'findFamiliar', { id: `bat${n}`, name: 'Bat', activity: 'ff-summon' })
  await until(async () => (await tabNames(alice)).length >= 7, 'six companions', 30_000)
  const keys = (await switcher(alice).getByRole('tab').evaluateAll(tabs => tabs.map(tab => tab.dataset.key))).filter(key => key !== 'self')
  const mountedNow = () => alice.page.locator('[id^="creature-panel-"]').evaluateAll(panels => panels.map(p => p.id.replace('creature-panel-', '')).filter(id => id !== 'self'))
  const visit = async key => {
    await choose(alice, key)
    await panelOf(alice, key).locator('[id$="sheet-panel"], [role=note], p.font-semibold').first().waitFor({ timeout: 20_000 })
  }
  // Brakka's Battle Cry on its way, its POST held back, as the others are visited.
  await visit('brakka')
  await openSheetTab(alice, 'brakka', 'actions')
  // Its tray left with nothing to roll first: step 11's attack's damage, still due, is rolled, so
  // that its tab's mark below is the use's alone.
  const due = panelOf(alice, 'brakka').getByRole('button', { name: /^Roll damage/ })
  while (await due.count()) await sent(() => due.first().click(), 'Brakka\'s earlier damage')
  let release
  const held = new Promise(resolve => { release = resolve })
  await alice.page.route('**/companions/brakka/rolls', async route => {
    if (route.request().method() === 'POST') await held
    await route.continue().catch(() => {})
  })
  const before = requests()
  await panelOf(alice, 'brakka').getByRole('button', { name: 'Battle Cry, DEX saving throw DC 13', exact: true }).click()
  await useAt(alice.page.getByRole('dialog', { name: 'Battle Cry' }), /^Goblin/)
  const others = keys.filter(key => key !== 'brakka')
  for (const key of others) await visit(key)
  const whileOnWay = await mountedNow()
  check(whileOnWay.includes('brakka'), `with ${others.length} more visited, Brakka's pane, its use on its way, stays mounted (${JSON.stringify(whileOnWay)})`)
  release()
  await until(() => requests() > before && rowsSince(before).every(r => ['done', 'failed'].includes(r.status)), 'Battle Cry to be made', 30_000)
  await alice.page.unroute('**/companions/brakka/rolls')
  // Its pane, hidden, hears the use is made, as a page asks after a roll each second, and offers its
  // damage, its tab marked so; only then are more visited, so that what keeps it is its damage to
  // roll, not its use still on its way. One shown before it hears rolls the damage, as it should
  // (§8.2): the use's result reaching it only once it's shown again isn't what's checked here.
  const marked = await until(async () => (await tabOf(alice, 'brakka').getAttribute('aria-label')) === 'Brakka, damage to roll', 'Brakka\'s hidden pane to offer its damage', 20_000)
    .then(() => true, () => false)
  // Brakka's damage now due, hidden: it's kept as more are visited, the least recent other unmounted.
  for (const key of others.slice(0, 2)) await visit(key)
  const after = await mountedNow()
  check(after.includes('brakka') && after.length <= 5 && after.length >= 4, `choosing a fifth unmounts the least recently shown pane with nothing pending, never Brakka with damage to roll (${JSON.stringify(after)})`)
  const unmounted = others.filter(key => !after.includes(key))
  check(unmounted.length >= 1, `the least recently shown unmounted (${JSON.stringify(unmounted)})`)
  await visit('brakka')
  const offered = await panelOf(alice, 'brakka').getByRole('button', { name: /^Roll damage/ }).first().waitFor({ timeout: 20_000 }).then(() => true, () => false)
  const thrown = rowsSince(before).filter(r => r.kind === 'damage').length
  // Checked last, so that the steps after it run whatever it finds.
  later(marked && offered && thrown === 0, `the use's damage, its POST let through while Brakka's pane was hidden, is offered there, its tab marked, and when its pane is visited again, not rolled while hidden (marked ${marked}; offered ${offered}; damage rolled ${thrown}: ${JSON.stringify(rowsSince(before).map(r => [r.kind, r.status]))}; damage posted by ${JSON.stringify(damagePosts.slice(-2))})`)
  if (unmounted.length) {
    await visit(unmounted[0])
    const trayText = await panelOf(alice, unmounted[0]).getByRole('region', { name: /rolls$/ }).textContent().catch(() => '')
    check(!/At the table/.test(trayText), `an unmounted pane's tray is empty when visited again ("${trayText.slice(0, 60)}")`)
  }
}

// =================================================================================================
// 16. The pane's states
// =================================================================================================
part('16. the pane\'s states')
{
  const key = (await switcher(alice).getByRole('tab').evaluateAll(tabs => tabs.map(tab => tab.dataset.key))).find(k => /bat/.test(k ?? ''))
  // Loading: the pane's first view held back, at each width.
  for (const [width, height] of [[1280, 800], [390, 844], [768, 1024]]) {
    const fresh = await browse({ width, height, path: '/characters/sheet-thorin', toasts: false })
    await switcher(fresh).waitFor({ timeout: 20_000 })
    let release
    const held = new Promise(resolve => { release = resolve })
    await fresh.page.route(`**/companions/${key}/table**`, async route => { await held; await route.continue().catch(() => {}) })
    // Its name as this page numbers it, fresh.
    const name = await tabOf(fresh, key).getAttribute('aria-label')
    await choose(fresh, key)
    await panelOf(fresh, key).getByText(`${name}’s sheet hasn’t arrived yet.`).waitFor({ timeout: 15_000 })
    if (width === 1280) {
      check(await panelOf(fresh, key).getAttribute('tabindex') === '0' && await panelOf(fresh, key).locator('[id$="sheet-tab-character"]').count() === 0,
        `loading: the spinner and "${name}’s sheet hasn’t arrived yet.", no sheet tab row or cog; its panel takes focus itself`)
    }
    await shootBoth(fresh, 'companions-pane-loading', panelOf(fresh, key))
    if (width === 1280) await panelOf(fresh, key).focus()
    release()
    await panelOf(fresh, key).locator('[id$="sheet-tab-character"]').waitFor({ timeout: 20_000 })
    await fresh.page.unroute(`**/companions/${key}/table**`)
    if (width === 1280) {
      await until(() => fresh.page.evaluate(() => /sheet-tab-character$/.test(document.activeElement?.id ?? '')), 'focus handed to the sheet\'s Character tab', 10_000)
      check(true, 'focus handed to its sheet\'s Character tab when the sheet comes (§13.2 step 14)')
    }
    await fresh.view.close()
  }
  // Too large: held back by the module, as it sends one (MOD scripts/character-sync.mjs:454-457), apart.
  const { buildEnvelope, post } = await import(`${MODULE}/scripts/transport.mjs`)
  const entry = (postsOf('companion.updated').filter(p => p.data.companion?.key === key).at(-1) ?? {}).data?.companion
  const { sheetWithheld: _withheld, ...rest } = entry ?? {}
  const before = postsOf('companion.updated').length
  post(buildEnvelope('companion.updated', { companion: { ...rest, sheetWithheld: { reason: 'tooLarge', bytes: 3_100_000, limit: 2_000_000 } }, sheet: null }, { campaign: settings.get('campaigns').find(c => c.id === 'camp-ash') }))
  await until(() => postsOf('companion.updated').slice(before).some(p => (p.data.sheet === null) && (p.status < 300)), 'the held-back sheet taken', 15_000)
  for (const [width, height] of [[1280, 800], [390, 844], [768, 1024]]) {
    const large = await browse({ width, height, path: '/characters/sheet-thorin', toasts: false })
    await switcher(large).waitFor({ timeout: 20_000 })
    const name = await tabOf(large, key).getAttribute('aria-label')
    await choose(large, key)
    await panelOf(large, key).getByText(`${name}’s sheet is too large to send (3.1 MB).`).waitFor({ timeout: 20_000 })
    if (width === 1280) check(true, `too large: "${name}’s sheet is too large to send (3.1 MB)."`)
    await shootBoth(large, 'companions-pane-large', panelOf(large, key))
    await large.view.close()
  }
}

// =================================================================================================
// 17. Widths and themes
// =================================================================================================
part('17. widths and themes')
for (const [width] of WIDTHS) check(await sideways(views[width].page) === 0, `no horizontal page scroll at ${width}`)

part('deferred checks')
{
  const failed = deferred.filter(([cond, msg]) => (cond ? (check(true, msg), false) : (console.log('FAIL (deferred) -', msg), true)))
  check(failed.length === 0, `every check made at the end holds (${failed.length} not)`)
}
await finish()
