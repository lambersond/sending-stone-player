// The conditions aside, end to end: Thorin, poisoned and at exhaustion level 2, sent by the real
// module from a stand-in Foundry; Alice opens every condition's rules from the Effects tab on a
// phone and a laptop. Screenshots to SHOTS.
import { actor, combat, combatant, message, settings, user, users } from './fvtt/stub.mjs'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'

const GAME = 'https://lonely-mountain.forge-vtt.com'
const SECRET = 'ashlands-secret-123'
const SHOTS = process.env.SHOTS
const cookie = await cookieFor('e2e-token')
const check = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok -', msg) }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const browser = await chromium.launch()
const problems = []
// The Forge game: its page, and Thorin's portrait, served like any world asset.
const serveGame = ctx => ctx.route(`${GAME}/**`, route => {
  if (route.request().url().endsWith('/worlds/erebor/thorin.svg')) {
    return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#7a4b2a"/><circle cx="32" cy="24" r="12" fill="#e8c39e"/><rect x="14" y="40" width="36" height="24" rx="8" fill="#3b5b8a"/><path d="M20 30 q12 22 24 0 v8 q-12 14 -24 0z" fill="#9a9a9a"/></svg>' })
  }
  return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Foundry VTT</title>' })
})
const foundryContext = await browser.newContext()
await foundryContext.grantPermissions(['local-network-access'], { origin: GAME })
await serveGame(foundryContext)
const gmTab = await foundryContext.newPage()
await gmTab.goto(`${GAME}/game`)
let inFlight = 0
let lastActivity = Date.now()
const posted = []
// Since module 0.33.0 the module also fetches its commands for every dnd5e campaign whose app takes
// removals, rolls and moves off too: made from the game's page as before, but kept apart from the
// posts checked here, and not waited on by idle(), as the app holds one open while a player is at
// the table.
globalThis.fetch = async (url, init) => {
  const command = String(url).endsWith('/api/bridge/commands')
  if (!command) inFlight++
  try {
    // The answer, with its body: the app may ask for everything again with {"resend": "hello"}.
    const { status, statusText, type, body } = await gmTab.evaluate(async ({ url, init }) => {
      const response = await fetch(url, init)
      return { status: response.status, statusText: response.statusText, type: response.headers.get('content-type'), body: await response.text() }
    }, { url: String(url), init: { method: init.method, headers: init.headers, body: init.body, mode: init.mode, credentials: init.credentials, cache: init.cache } })
    if (!command) posted.push({ type: JSON.parse(init.body).type, status, body, data: JSON.parse(init.body).data })
    if (status >= 300) problems.push(`${JSON.parse(init.body).type} → ${status}`)
    return {
      ok: status >= 200 && status < 300, status, statusText,
      headers: new Headers(type ? { 'content-type': type } : {}),
      json: async () => JSON.parse(body), text: async () => body,
    }
  } finally { if (!command) { inFlight--; lastActivity = Date.now() } }
}
const idle = async () => {
  await wait(50)
  while (inFlight > 0 || Date.now() - lastActivity < 150) await wait(25)
}

// ---- The Gamemaster (Alice) sets up the campaign ----
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


// Game assets: any image the sheet or a description asks for, as a small picture.
const serveAssets = ctx => ctx.route(`${GAME}/**`, route => {
  const { pathname } = new URL(route.request().url())
  if (/\.(svg|webp|png)$/.test(pathname)) {
    const white = pathname.includes('/statuses/')
    return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="${white ? 'none' : '#7a4b2a'}"/><circle cx="16" cy="16" r="9" fill="${white ? '#ffffff' : '#e8c39e'}"/></svg>` })
  }
  return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Foundry VTT</title>' })
})

// ---- Foundry, with Thorin as dnd5e 5.3 prepares him: features, conditions and effects ----
const translations = {
  'DND5E.FeaturesBackground': 'Background Features', 'DND5E.FeaturesOther': 'Other Features',
  'DND5E.Species.Features': 'Species Features',
  'DND5E.EffectTemporary': 'Temporary Effects', 'DND5E.EffectPassive': 'Passive Effects',
  'DND5E.EffectInactive': 'Inactive Effects', 'DND5E.EffectUnavailable': 'Unavailable Effects',
  'DND5E.USES.Recovery.Period.LongRest.Label': 'Long Rest', 'DND5E.USES.Recovery.Period.ShortRest.Label': 'Short Rest',
  'DND5E.ConPoisoned': 'Poisoned', 'DND5E.ConExhaustion': 'Exhaustion', 'EFFECT.DND5E.StatusConcentrating': 'Concentrating',
  'TYPES.Item.subclass': 'Subclass',
}
game.i18n.localize = key => translations[key] ?? key
game.i18n.has = key => key in translations
game.i18n.format = (key, data) => key === 'DND5E.FeaturesClass' ? `${data.class} Features` : key
const RULES = 'Compendium.dnd5e.rules.JournalEntry.rules.JournalEntryPage'
const STATUS = 'systems/dnd5e/icons/svg/statuses'
CONFIG.DND5E = {
  abilities: Object.fromEntries(Object.entries({ str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }).map(([id, label]) => [id, { label, abbreviation: id }])),
  skills: { ath: { label: 'Athletics' }, prc: { label: 'Perception' } },
  conditionTypes: {
    poisoned: { name: 'DND5E.ConPoisoned', img: `${STATUS}/poisoned.svg`, reference: `${RULES}.poisoned` },
    exhaustion: { name: 'DND5E.ConExhaustion', img: `${STATUS}/exhaustion.svg`, reference: `${RULES}.exhaustion`, levels: 6 },
  },
  limitedUsePeriods: { lr: { label: 'DND5E.USES.Recovery.Period.LongRest.Label' }, sr: { label: 'DND5E.USES.Recovery.Period.ShortRest.Label' } },
}
CONFIG.statusEffects = [
  { id: 'poisoned', name: 'DND5E.ConPoisoned', img: `${STATUS}/poisoned.svg`, reference: `${RULES}.poisoned` },
  { id: 'exhaustion', name: 'DND5E.ConExhaustion', img: `${STATUS}/exhaustion.svg`, reference: `${RULES}.exhaustion` },
  { id: 'concentrating', name: 'EFFECT.DND5E.StatusConcentrating', img: `${STATUS}/concentrating.svg` },
]
CONFIG.specialStatusEffects = { CONCENTRATING: 'concentrating' }
CONFIG.Item = { typeLabels: { subclass: 'TYPES.Item.subclass' } }
const staticID = id => id.padEnd(16, '0').slice(0, 16)
globalThis.dnd5e = { utils: { staticID } }
// Foundry's enrichment, as far as these descriptions need it: links and rolls become its markup.
foundry.applications.ux.TextEditor = { implementation: { async enrichHTML(html) {
  return html
    .replace(/@UUID\[([^\]]+)\]\{([^}]+)\}/g, '<a class="content-link" draggable="true" data-uuid="$1"><i class="fas fa-book-open"></i>$2</a>')
    .replace(/\[\[\/(\w+) ([^\]]+)\]\]/g, '<a class="roll-link" data-type="$1"><i class="fa-solid fa-dice-d20"></i>$2</a>')
} } }
const documents = new Map()
globalThis.fromUuid = async uuid => uuid.startsWith(RULES) ? { uuid, text: { content: `<p>The rules for ${uuid.split('.').at(-1)}: a poisoned creature has disadvantage on attack rolls and ability checks.</p>` } } : null
globalThis.fromUuidSync = uuid => documents.get(uuid) ?? null
foundry.utils.getProperty = (object, path) => path.split('.').reduce((o, k) => o?.[k], object)

users.activeGM = user('gm', 'Gamemaster', true)
user('alice', 'Alice')
const thorin = actor('thorin', 'Thorin Oakenshield', ['alice'], 'character', { value: 31, max: 44, temp: 0 })
thorin.documentName = 'Actor'
thorin.img = 'worlds/erebor/thorin.svg'
const ability = (value, proficient = 0) => {
  const mod = Math.floor((value - 10) / 2)
  return { value, mod, proficient, checkBonus: 0, checkProf: { term: '0', flat: 0 }, save: { value: mod + (proficient ? 3 : 0), roll: { mode: 0 } }, check: { roll: { mode: 0 } } }
}
thorin.system = {
  abilities: { str: ability(18, 1), dex: ability(12), con: ability(16, 1), int: ability(8), wis: ability(13), cha: ability(10) },
  skills: {
    ath: { ability: 'str', total: 7, passive: 17, prof: { multiplier: 1 }, roll: { mode: 0 } },
    prc: { ability: 'wis', total: 4, passive: 14, prof: { multiplier: 1 }, roll: { mode: 0 } },
  },
  attributes: { hp: { value: 31, max: 44, temp: 0 }, ac: { value: 18 }, prof: 3, init: { total: 1 }, movement: { speed: 25, units: 'ft' }, exhaustion: 2 },
  details: { level: 5 },
}
const items = new Map()
thorin.items = { get: id => items.get(id), [Symbol.iterator]: () => items.values() }
const item = (id, type, name, { system = {}, flags = {}, labels = {}, ...fields } = {}) => {
  const it = {
    documentName: 'Item', id, uuid: `Actor.thorin.Item.${id}`, type, name, img: `icons/features/${id}.webp`, sort: 0,
    parent: thorin, actor: thorin, labels, system: { description: { value: '' }, ...system },
    getFlag: (scope, key) => flags[scope]?.[key], getRollData: () => ({}), ...fields,
  }
  items.set(id, it)
  return it
}
const fighter = item('fighter', 'class', 'Fighter', { identifier: 'fighter', system: { levels: 5, hd: { denomination: 'd10', value: 3, max: 5 }, description: { value: '<p>A master of martial combat, skilled with a variety of weapons and armor.</p>' } } })
const champion = item('champion', 'subclass', 'Champion', { identifier: 'champion', sort: 9, class: fighter, flags: { dnd5e: { advancementOrigin: 'fighter.subclass' } }, system: { description: { value: '<p>The archetypal Champion focuses on raw physical power.</p>' } } })
fighter.subclass = champion
const dwarf = item('dwarf', 'race', 'Dwarf', { system: { description: { value: '<p>Bold and hardy, dwarves are known as skilled warriors.</p>' } } })
const soldier = item('soldier', 'background', 'Soldier', { system: { description: { value: '<p>War has been your life for as long as you care to remember.</p>' } } })
thorin.system.details.race = dwarf
thorin.system.details.background = soldier
const secondWind = item('second-wind', 'feat', 'Second Wind', {
  sort: 2, flags: { dnd5e: { advancementOrigin: 'fighter.a' } }, labels: { activation: '1 Bonus Action' },
  system: { type: { label: 'Class Feature' }, requirements: 'Fighter 1', activities: { size: 1 }, properties: new Set(),
    uses: { max: 1, spent: 0, value: 1, recovery: [{ period: 'sr' }, { period: 'lr' }] },
    description: { value: '<p>You have a limited well of stamina. On your turn, you can regain [[/heal 1d10 + 5]] hit points.</p><p><img src="worlds/erebor/rune.svg" alt="A rune" width="48"></p>' } },
})
item('action-surge', 'feat', 'Action Surge', {
  sort: 1, flags: { dnd5e: { advancementOrigin: 'fighter.b' } }, labels: { activation: 'Special' },
  system: { type: { label: 'Class Feature' }, requirements: 'Fighter 2', activities: { size: 1 }, properties: new Set(),
    uses: { max: 1, spent: 1, recovery: [{ period: 'sr' }] }, description: { value: '<p>You can push yourself beyond your normal limits for a moment: take one additional action.</p>' } },
})
item('resilience', 'feat', 'Dwarven Resilience', {
  flags: { dnd5e: { advancementOrigin: 'dwarf.a' } },
  system: { type: { label: 'Species Feature' }, activities: { size: 0 }, properties: new Set(['trait']),
    description: { value: '<p>You have advantage on saving throws against being @UUID[Compendium.dnd5e.rules.poisoned]{Poisoned}.</p><section class="secret" id="secret-1"><p>Thorin was poisoned once in Mirkwood.</p></section>' } },
})
item('rank', 'feat', 'Military Rank', {
  flags: { dnd5e: { advancementRoot: 'soldier.a' } },
  system: { type: { label: 'Background Feature' }, activities: { size: 0 }, properties: new Set(), description: { value: '<p>Soldiers loyal to your former organization still recognize your authority.</p>' } },
})
item('cursed-lore', 'feat', 'Cursed Lore', {
  system: { type: { label: 'Feat' }, activities: { size: 0 }, properties: new Set(),
    description: { value: '<p onclick="window.__pwned = 1">Old words of power.<img src="nowhere" onerror="window.__pwned = 2"><script>window.__pwned = 3</script></p><a href="javascript:window.__pwned = 4">Read more</a>' } },
})
const ring = item('ring', 'equipment', 'Ring of Protection', { system: { identified: true } })
const cloak = item('cloak', 'equipment', 'Cloak of Elvenkind', { system: { identified: true } })
const cursedRing = item('cursed-ring', 'equipment', 'Plain Ring', { system: { identified: false } })
const bless = item('bless', 'spell', 'Bless')
documents.set('Actor.bombur.Item.bless', { documentName: 'Item', name: 'Bless', uuid: 'Actor.bombur.Item.bless' })
const byType = {}
for (const it of items.values()) (byType[it.type] ??= []).push(it)
thorin.itemTypes = byType
const effect = (id, name, fields = {}) => ({
  id, name, img: `icons/effects/${id}.webp`, parent: thorin, type: 'base', origin: null, description: '',
  disabled: false, isSuppressed: false, isTemporary: false, statuses: new Set(),
  duration: { remaining: null, label: '', value: null }, updateDuration() {}, ...fields,
})
const thorinEffects = [
  effect(staticID('dnd5epoisoned'), 'Poisoned', { statuses: new Set(['poisoned']) }),
  effect('blessed', 'Bless', { isTemporary: true, origin: 'Actor.bombur.Item.bless', description: '<p>Whenever you make an attack roll or a saving throw, add [[/roll 1d4]].</p>', duration: { remaining: 9, label: '9 Rounds', value: 10 } }),
  effect('protection', 'Ring of Protection', { parent: ring, description: '<p>You gain a +1 bonus to AC and saving throws.</p>' }),
  effect('elvenkind', 'Elvenkind', { parent: cloak, isSuppressed: true }),
  effect('rage', 'Rage', { disabled: true }),
  effect('curse', 'Curse of Clumsiness', { parent: cursedRing, description: '<p>The true nature of the ring.</p>' }),
]
thorin.allApplicableEffects = function* () { yield* thorinEffects }
thorin.statuses = new Set(['poisoned', 'exhaustion', 'concentrating'])
thorin.concentration = { items: new Set([bless]), effects: new Set() }

await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-ash': SECRET })
settings.set('chatEvents', true)
settings.set('combatEvents', true)
settings.set('campaigns', [{ id: 'camp-ash', title: 'Ashlands', characters: ['thorin'] }])
await Hooks.callAll('ready')
await idle()
// From module 0.22.0 the hello goes first, its characters without their sheets; once it's answered,
// each sheet follows in a character.updated of its own, after the descriptions it refers to; and the
// app takes them all, answering the hello and the sheet with what it takes of sheets.
const helloAt = posted.findIndex(p => p.type === 'bridge.hello')
const sheetAt = posted.findIndex(p => p.type === 'character.updated')
const helloSent = posted[helloAt]?.data
check(helloAt >= 0 && helloSent.sheetsApart === true && helloSent.characters.length > 0 && helloSent.characters.every(c => !('sheet' in c))
  && posted.slice(0, helloAt).every(p => !['character.texts', 'character.updated'].includes(p.type))
  && sheetAt > helloAt && posted.slice(helloAt + 1, sheetAt).some(p => p.type === 'character.texts') && posted[sheetAt].data.character.sheet?.slim === 1
  && posted.slice(0, sheetAt + 1).every(p => p.status === 204 || (['bridge.hello', 'character.updated'].includes(p.type) && p.status === 200 && JSON.parse(p.body).features?.slimSheets === 1)),
  `the hello goes first, its characters without sheets, then the descriptions, then the sheet, slim, in a post of its own, and the app takes them all (${posted.map(p => p.type).join(', ')})`)
const textsHeld = () => Number(sql(`select count(*) from sheet_text t join campaign c on c.id = t."campaignId" where c.title = 'Ashlands'`))
// Every description the sheet refers to, anywhere in it: since module 0.7.0, its items' and
// spells' and its biography too.
const refsInSheet = () => {
  const sheet = JSON.parse(sql(`select s.data::text from actor_sheet s join campaign c on c.id = s."campaignId" where c.title = 'Ashlands'`))
  const refs = new Set()
  const walk = value => {
    if (Array.isArray(value)) value.forEach(walk)
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) (k === 'text' && typeof v === 'string') ? refs.add(v) : walk(v)
  }
  walk(sheet)
  if (sheet.details?.biography) refs.add(sheet.details.biography)
  return refs.size
}
check(textsHeld() === refsInSheet() && textsHeld() >= 12, `the app keeps every description the sheet refers to: ${textsHeld()} of ${refsInSheet()}`)
const cursedHtml = sql(`select t.html from sheet_text t where t.html like '%Old words%'`)
check(!/script|onerror|onclick|javascript:/.test(cursedHtml), `a description is sanitised before it is kept: ${cursedHtml}`)
check(sql(`select count(*) from sheet_text where html like '%<span class="ref">Poisoned</span>%'`) === '1' && sql(`select count(*) from sheet_text where html like '%src="${GAME}/worlds/erebor/rune.svg"%'`) === '1', "Foundry's links become plain spans, and its images point at the game")
check(!sql(`select data::text from actor_sheet`).includes('Curse of Clumsiness') && sql(`select count(*) from sheet_text where html like '%true nature%'`) === '0', "an unidentified item's effect isn't sent, as a player wouldn't see it")

// Alice plays Thorin.
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  select 'sheet-thorin', 'Thorin Oakenshield', '${GAME}', 'Ashlands', id, 'thorin', 'e2e-user', now() from campaign where title = 'Ashlands'`)


const shoot = async (page, name) => {
  if (!SHOTS) return
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${SHOTS}/${name}.png` })
}
const NAMES = ['Blinded', 'Charmed', 'Deafened', 'Exhaustion', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious']

for (const [label, viewport, mobile, scheme] of [['phone', { width: 390, height: 844 }, true, 'dark'], ['laptop', { width: 1440, height: 900 }, false, 'light']]) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, colorScheme: scheme })
  await ctx.addCookies([cookie])
  await serveAssets(ctx)
  const page = await ctx.newPage()
  page.on('pageerror', e => problems.push(`${label} pageerror: ${e.message}`))
  await page.goto(`${BASE}/characters/sheet-thorin`)
  const sheetPane = page.getByRole('region', { name: 'Character' })
  await sheetPane.getByRole('button', { name: 'Strength check, +4' }).waitFor()
  await sheetPane.getByRole('tab', { name: /^Effects/ }).click()
  const info = sheetPane.getByRole('button', { name: 'Every condition and its rules' })
  await info.waitFor()
  const heading = await sheetPane.getByRole('heading', { name: 'Conditions', exact: true }).boundingBox()
  const infoBox = await info.boundingBox()
  check(Math.abs((infoBox.y + infoBox.height / 2) - (heading.y + heading.height / 2)) <= 3 && infoBox.x > heading.x + heading.width && infoBox.x - (heading.x + heading.width) < 12,
    `on a ${label}, an info button sits beside the Conditions heading`)
  await info.click()
  const panel = page.getByRole('dialog', { name: 'Conditions' })
  await panel.waitFor()
  await page.waitForTimeout(350)
  const box = await panel.boundingBox()
  check(Math.abs(box.x + box.width - viewport.width) <= 1 && Math.abs(box.height - viewport.height) <= 1 && box.width <= Math.min(viewport.width, 448) + 1,
    `it opens an aside at the right, the height of the screen, ${Math.round(box.width)} pixels wide`)
  check(JSON.stringify(await panel.getByRole('heading', { level: 3 }).allTextContents()) === JSON.stringify(NAMES), 'with every condition of the 2024 rules, in order')
  check((await panel.getByRole('region', { name: 'Poisoned' }).textContent()).includes('You have it') && (await panel.getByRole('region', { name: 'Exhaustion' }).textContent()).includes("You're at level 2") && !(await panel.getByRole('region', { name: 'Blinded' }).textContent()).includes('You have it'),
    "Thorin's own marked: poisoned, and exhaustion at level 2")
  check(await page.evaluate(() => document.activeElement?.closest('dialog') !== null), 'focus moves into the aside')
  await shoot(page, `${label}-conditions`)
  const jump = panel.getByRole('navigation', { name: 'Go to a condition' })
  const scroller = await panel.locator('.overflow-y-auto').boundingBox()
  await jump.getByRole('button', { name: 'Invisible' }).click()
  await page.waitForTimeout(900)
  const invisible = await panel.getByRole('region', { name: 'Invisible' }).boundingBox()
  check(Math.abs(invisible.y - scroller.y) <= 12, `a name at the top jumps to its rules (Invisible at ${Math.round(invisible.y - scroller.y)}px from the top)`)
  await shoot(page, `${label}-conditions-invisible`)
  // The last can't reach the top, but is shown in full.
  await jump.getByRole('button', { name: 'Unconscious' }).click()
  await page.waitForTimeout(900)
  const last = await panel.getByRole('region', { name: 'Unconscious' }).boundingBox()
  check(last.y >= scroller.y - 1 && last.y + last.height <= scroller.y + scroller.height + 1, 'and the last is shown in full')
  if (mobile) {
    await page.keyboard.press('Escape')
  } else {
    // A click beside the aside closes it.
    await page.mouse.click(200, 450)
  }
  await panel.waitFor({ state: 'hidden' })
  check(await info.evaluate(button => button === document.activeElement), `${mobile ? 'Escape' : 'a click beside it'} closes it, and focus goes back to the button`)
  await ctx.close()
}

console.log('problems:', problems)
check(problems.filter(p => !p.includes('Failed to load resource')).length === 0, 'no page errors')
await browser.close()
process.exit(0)
