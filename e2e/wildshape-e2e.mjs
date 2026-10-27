// Wild Shape from the app (module 0.40.0 and the app, its contract §10.4), end to end, in the world of
// world-030.mjs with dnd5e's transformation and return as the module's harness ports them
// (fvtt/transform5e.mjs: dnd5e 5.3.3's own 2024 Beasts in its Actors, its Monsters' Wolf, a
// Gamemaster's own pack of Secret Beasts, and the contract's druids), on two scenes (fvtt/token-core.mjs),
// with world time and rests (fvtt/dish-core.mjs) and effects (fvtt/effects-core.mjs). Ashlands, on
// dnd5e 5.3.3, has one campaign, Erebor, with "Allow Players to use Wild Shape from the app" on and the
// 2024 Actors its Beasts' pack. Alice plays Elowen, a druid 5 with Wild Resurgence, 2 of 2 uses and no
// forms yet, at 1280 × 800 and on a phone at 390 × 844 (360 × 780 where said); Bob plays Rowan, a
// Circle of the Moon druid 6 who knows the Brown Bear and the Black Bear, on a phone; Carol plays
// Thorin, a fighter. Elowen's linked token is on both scenes, the Gamemaster viewing the Forest, and in
// a started fight with a bandit and Thorin, its combatant following its token. The Gamemaster is at
// Elowen's page and on the campaigns page. The hello and the answer; the block on her stored sheet;
// choosing forms from the Beasts her Gamemaster's pack offers; becoming a Wolf, its use, tokens, sheet,
// header, ribbon, Character tab, toast, focus and chat line; the seat while shaped (the Bite, a merged
// skill, End Turn on the wolf's turn, controls hidden, her familiar, a save card asked of the form);
// time left; a refusal while the game isn't taking Wild Shape; changing while shaped; Return and its
// confirm; the endings (its hours, 0 hit points) and the banner; the replacement after a Long Rest;
// the Moon; a Polymorph made in Foundry; the Gamemaster's page; two taps; a Wild Shape made in Foundry
// and returned from the app; a form deleted by hand; the Favorites strip; known forms put there in
// Foundry outside the pool; the campaign page and the switch; phones and both themes. DND5E6=1:
// dnd5e 6.0.5, steps 1, 3, 4, 10 and 14. SKEW=039 with MODULE=module-0.39.0: no Wild Shape in the
// hello or on any sheet, a druid shaped in Foundry keeping her own sheet with no End Turn, the
// campaign page's words, and a Wild Shape queued by hand never handed over. Synthetic characters only.
// Run with --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import {
  BOB, DND5E6, SKEW039, W, browse, call, check, companion, cookieFor, escapeRe, finish, foundryWorld, launch, newCampaign,
  note, npc, part, postsOf, same, sameJson, sceneWorld, settled, shootBoth, sideways, sql, startFetching, startModule,
  stopFetching, summoned, until, wait,
} from './world-030.mjs'

const GAME = 'https://ashlands-wildshape.forge-vtt.com'
const ADDRESS = 'ashlands-wildshape.forge-vtt.com'
const SECRET = 'erebor-wildshape-40'
const TITLE = 'Erebor'
await launch(GAME)
const { id: A } = await newCampaign({ title: TITLE, address: ADDRESS, secret: SECRET })
await foundryWorld({ more: true })
// A checkout's module.json says 0.1.0, which the Gamemaster's page reads as before Wild Shape: the
// version the release would stamp, as round 0.39.0's suite does.
game.modules.get('sending-stone').version = SKEW039 ? '0.39.0' : '0.40.0'
// What favorites need of Foundry's constants (common/constants.mjs), for the Favorites strip.
CONST.SORT_INTEGER_DENSITY = 100000

// The module's harness's stand-ins: scenes and tokens, then dnd5e's transformation, its packs and
// druids, with world time, rests and effects; the current checkout's under every variant.
const T = await sceneWorld()
const t5 = await import('./fvtt/transform5e.mjs')
t5.installTransformCore()
const { setWorldTime } = await import('./fvtt/dish-core.mjs')
const { saveCard } = await import('./fvtt/dnd5e-cards.mjs')

// The module's results to the app, held while `results.held` is, as a result on its way takes its time.
const results = { held: null, release: null }
{
  const inner = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    if (results.held) {
      let type = null
      try { type = JSON.parse(init.body).type } catch {}
      while ((type === 'command.result') && results.held) await results.held
    }
    return inner(url, init)
  }
}
const holdResults = () => { results.held = new Promise(resolve => { results.release = resolve }) }
const releaseResults = () => {
  const release = results.release
  results.held = null
  results.release = null
  release?.()
}

// ---- The world: Elowen, Alice's; Rowan, Bob's; Thorin, Carol's; a bandit no player owns ----
const { elowen, rowan, thorin } = t5.transformWorld()
game.users.get('alice').character = elowen
game.users.get('bob').character = rowan
game.users.get('carol').character = thorin
const bandit = npc('bandit', 'Bandit', 12, { dex: 1 })
bandit.hasPlayerOwner = false
// Two scenes, the Hall active, the Gamemaster viewing the Forest, so dnd5e's own switch of tokens
// reaches the Forest's alone and the module's every scene's.
const hall = t5.withTokenBatches(T.scene('hall', { active: true, name: 'The Hall' }))
const forest = t5.withTokenBatches(T.scene('forest', { name: 'The Forest' }))
T.faults.canvasScene = 'forest'
const tokenOf = (on, base, id) => {
  const token = T.placeToken(on, base, { id, actorLink: true })
  Object.assign(token, { bar1: { attribute: 'attributes.hp' }, displayBars: 40, disposition: base.type === 'npc' ? -1 : 1, rotation: 0, elevation: 0, flags: {}, ...(DND5E6 && { level: 2 }) })
  W.placeables.set(token.id, token.object)
  return token
}
const elowenHall = tokenOf(hall, elowen, 'elowenHallToken0')
const elowenForest = tokenOf(forest, elowen, 'elowenForestTkn0')
const thorinHall = tokenOf(hall, thorin, 'thorinHallToken0')
const banditHall = tokenOf(hall, bandit, 'banditHallToken0')
tokenOf(hall, rowan, 'rowanHallToken00')
// Rowan knows the Brown Bear and the Black Bear, put on his Wild Shape as the module writes a known form.
const WILD_SHAPE = 'phbdrdWildShape0'
const ACTIVITY = 'FsDnynyqno8XNHgf'
const profile = (_id, name, uuid) => ({ _id, name, uuid, cr: '', level: { min: null, max: null }, movement: [], sizes: [], types: [] })
const knowing = (actor, profiles) => actor.updateEmbeddedDocuments('Item', [{
  _id: WILD_SHAPE, [`system.activities.${ACTIVITY}.transform.mode`]: '', [`system.activities.${ACTIVITY}.profiles`]: profiles,
}])
await knowing(rowan, [profile('rowanBrownBear00', 'Brown Bear', t5.beastUuid('Brown Bear')), profile('rowanBlackBear00', 'Black Bear', t5.beastUuid('Black Bear'))])
// Bless on Elowen from Rowan's spell, an effect her party put on her, which she may turn off as herself.
const { PlainEffect } = await import('./fvtt/effects-core.mjs')
elowen.effects.push(new PlainEffect(elowen, { _id: 'rowanBlessOnElow', name: 'Bless', origin: 'Actor.rowan.Item.rowanBless000000', duration: { rounds: 10, value: 10, units: 'rounds', remaining: 10 } }))

const campaign = changes => ({
  id: 'erebor', title: TITLE, characters: ['elowen', 'rowan', 'thorin'], groups: [], rolls: true, attacks: true, prompts: true,
  transfers: true, effects: true, wildShape: true, wildShapePacks: ['dnd5e.actors24'], ...changes,
})
await startModule({ campaigns: [campaign()], secrets: { erebor: SECRET } })
await settled()
// The fight, started at round 1 on Elowen's turn: her combatant follows her token's actor, as core's does.
const fight = T.combatOf('fight', [
  { id: 'cbElowen', actor: elowen, token: elowenHall, fields: { name: 'Elowen', initiative: 18, follows: elowenHall } },
  { id: 'cbThorin', actor: thorin, token: thorinHall, fields: { name: 'Thorin', initiative: 14, follows: thorinHall } },
  { id: 'cbBandit', actor: bandit, token: banditHall, fields: { name: 'Bandit', initiative: 9 } },
])
fight.round = 1
fight.turn = 0
Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight') ?? null, configurable: true })
await Hooks.callAll('createCombat', fight)
await until(() => sql('select count(*) from combat') === '1', 'the app to hear of the fight', 15_000)

// ---- What's kept, posted and handed over ----
const hello = () => postsOf('bridge.hello').filter(p => p.campaign === 'erebor').at(-1)
const wildShapeEnabled = () => sql(`select "wildShapeEnabled" from campaign where id = '${A}'`)
const PLAIN = { mode: 0, explicit: false, extras: [], dice: [] }
/** The Wild Shape commands kept, in order: each its status, payload and result. */
const commands = () => JSON.parse(sql(`select coalesce(json_agg(r order by r."createdAt")::text, '[]') from (select id, role, "actorId", label, status, payload, result, "createdAt" from roll_request where "campaignId" = '${A}' and kind = 'wildShape') r`))
/** The `count`th Wild Shape command, once the module has answered it and posted its result. */
async function answered(count, what, ms = 45_000) {
  await until(() => commands().length >= count && ['done', 'failed'].includes(commands()[count - 1].status), what, ms)
  const made = commands()[count - 1]
  await until(() => postsOf('command.result').some(p => p.data?.id === made.id), `${what}: its result as posted`, 10_000)
  return made
}
/** Every command the app handed the module, as its answers to the module's fetches said them. */
const handed = () => postsOf('fetch').filter(p => p.url.endsWith('/api/bridge/commands') && p.status === 200)
  .flatMap(p => { try { return JSON.parse(p.body).commands ?? [] } catch { return [] } })
const fetchesAnswered = () => postsOf('fetch').filter(p => p.url.endsWith('/api/bridge/commands')).length
/** A character's sheet as the app keeps it. */
const stored = (actorId = 'elowen') => JSON.parse(sql(`select coalesce((select data::text from actor_sheet where "campaignId" = '${A}' and "actorId" = '${actorId}'), 'null')`))
/** A Wild Shape posted as a page would post it, through a seat's API. */
const crafted = (who, api, wildShape, extra = {}) => call(who.page, `${api}/rolls`, { method: 'POST', body: { kind: 'wildShape', wildShape, ...PLAIN, ...extra } })
/** The newest roll of a kind the app kept: its id, status, payload and result. */
const lastOf = kind => JSON.parse(sql(`select coalesce((select row_to_json(r)::text from (select id, status, payload, result from roll_request where "campaignId" = '${A}' and kind = '${kind}' order by "createdAt" desc limit 1) r), 'null')`))
/** Room under the app's limit of rolls a minute from a seat. */
const paced = () => until(() => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}' and "createdAt" > now() - interval '1 minute'`)) < 15, 'room under the rate limit', 70_000)
/** A character's form in Foundry: the newest of dnd5e's transformations of it. */
const formOf = (actor = elowen) => game.actors.find(each => (each.flags?.dnd5e?.isPolymorphed === true) && (each.flags.dnd5e.originalActor === actor.id)
  && !game.actors.some(other => (other.flags?.dnd5e?.previousActorIds ?? []).includes(each.id)))
const formsOf = (actor = elowen) => game.actors.filter(each => each.flags?.dnd5e?.originalActor === actor.id)
const shapeItem = (actor = elowen) => actor.items.get(WILD_SHAPE)
const profilesOf = (actor = elowen) => shapeItem(actor).system.activities.get(ACTIVITY).profiles
const usesLeft = (actor = elowen) => shapeItem(actor).system.uses.value
const bothTokens = () => [elowenHall.actorId, elowenForest.actorId]
/** A Gamemaster's transformation in Foundry, as dnd5e's own Wild Shape or Polymorph card makes one. */
const transformation = preset => new t5.TransformationSetting({ ...CONFIG.DND5E.transformation.presets[preset].settings, preset })

// ---- The seats ----
// Carol, a third player, with a session of her own, synthetic as seed.sql's.
sql(`insert into "user" (id, name, email, "createdAt", "updatedAt") values ('e2e-carol', 'Carol', 'carol@example.test', now(), now());
  insert into "session" (id, token, "userId", "expiresAt", "createdAt", "updatedAt") values ('e2e-session-carol', 'e2e-carol-token', 'e2e-carol', now() + interval '1 day', now(), now())`)
const CAROL = await cookieFor('e2e-carol-token')
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-elowen', 'Elowen', '${GAME}', '${TITLE}', '${A}', 'elowen', 'e2e-user', now()),
         ('sheet-rowan', 'Rowan', '${GAME}', '${TITLE}', '${A}', 'rowan', 'e2e-bob', now()),
         ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-carol', now())`)
const API = '/api/characters/sheet-elowen'
const GM_API = `/api/campaigns/${A}/characters/elowen`
const GM_PAGE = `/campaigns?campaign=${A}`
const view = async (who, path = API) => (await call(who.page, `${path}/table`)).json

// ---- The pages and their parts ----
/** The sheet in view, on a page that shows the table's panes one at a time. */
async function sheetShown(who) {
  if (await who.nav.isVisible()) await who.character()
}
const tabpanel = who => who.page.locator('#sheet-panel')
/** A tab of the sheet, shown. */
async function tab(who, name) {
  await sheetShown(who)
  await who.tab(name)
}
/** A row by its name, in a scope: the `li` of its row's button. */
const rowIn = (scope, name) => scope.locator('li').filter({ has: scope.page().locator('button[aria-expanded] .font-medium', { hasText: new RegExp(`^${escapeRe(name)}$`) }) }).first()
/** Actions' Bonus Actions, where Wild Shape is. */
const bonusActions = who => tabpanel(who).getByRole('region', { name: 'Bonus Actions', exact: true })
const wsRowOn = (who, scope) => rowIn(scope ?? bonusActions(who), 'Wild Shape')
/** The Wild Shape row's own line, under its name. */
const rowLine = row => row.locator(':scope > p').first().textContent().catch(() => null)
const ribbon = who => who.page.locator('section[aria-label="Wild Shape"], section[aria-label="Transformed"]')
const ribbonText = who => ribbon(who).evaluate(el => el.innerText.replace(/\s+/g, ' ').trim()).catch(() => null)
const dialog = who => who.page.locator('dialog[open]')
const dialogTitle = who => dialog(who).locator('header h2').textContent().catch(() => null)
const cards = who => dialog(who).getByRole('radiogroup', { name: 'Known forms' }).getByRole('radio')
const cardNames = who => cards(who).evaluateAll(all => all.map(card => card.getAttribute('aria-label')))
const footer = who => dialog(who).locator('footer')
const footerText = who => footer(who).evaluate(el => el.innerText.replace(/\s+/g, ' ').trim()).catch(() => null)
const become = who => footer(who).getByRole('button').last()
const popover = who => who.page.getByRole('dialog', { name: /^Return to .+\?$/ })
/** What has focus: its tag, its words, its accessible name, and the region it's in. */
const focusOf = who => who.page.evaluate(() => {
  const el = document.activeElement
  return {
    tag: el?.tagName.toLowerCase() ?? null, text: el?.textContent?.trim() ?? null, label: el?.getAttribute('aria-label') ?? null,
    id: el?.id ?? null, ribbon: !!el?.closest('section[aria-label="Wild Shape"]'), dialog: !!el?.closest('dialog'),
  }
})
/** A tile of the Character tab, by its label: its words, as shown. */
const tileText = (who, label) => tabpanel(who).locator('div').filter({ has: who.page.locator('dt').filter({ hasText: label }) }).last()
  .evaluate(el => el.innerText.replace(/\s+/g, ' ').trim().toLowerCase())
/** The page's line under the character's name, in the header. */
const headerLine = who => who.page.locator('header').getByText(/^(In Wild Shape|Transformed) · /).first().textContent().catch(() => null)
/** The toasts' log, and a toast once it says this. */
const toastLog = who => who.page.getByRole('log', { name: 'Roll results' })
async function toastSays(who, words) {
  const toast = toastLog(who).locator('[data-roll-toast]').filter({ hasText: words }).first()
  await toast.waitFor({ timeout: 20_000 })
  return (await toast.evaluate(el => el.innerText.replace(/\s+/g, ' ').trim()))
}
/** The banner when the game ends a Wild Shape. */
const ended = who => who.page.locator('[role="status"]').filter({ hasText: /^Wild Shape (ended|was ended)/ })
/** The column's Combat or Chat, at a width that has the column. */
async function column(who, name) {
  if (await who.nav.isVisible()) {
    await who.nav.locator(':scope > button').filter({ hasText: new RegExp(`^${name}`) }).click()
    return
  }
  const index = name === 'Combat' ? 1 : 2
  const tabButton = who.page.locator(`[role="tablist"][aria-label="Combat or chat"] > button:nth-child(${index})`)
  if ((await tabButton.getAttribute('aria-selected')) !== 'true') await tabButton.click()
}
const turnButton = who => who.page.locator('#turn-heading ~ button')
/** Every control in a scope that's shown: its name and height. */
const heights = scope => scope.locator('button, [role="radio"], input').evaluateAll(all => all.filter(el => el.getClientRects().length > 0)
  .map(el => ({ name: el.getAttribute('aria-label') ?? el.textContent.trim().slice(0, 30), h: Math.round(el.getBoundingClientRect().height) })))

/** The game's pictures, served to a page as a grey pixel each, so that a portrait shows as it would. */
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOYNWsWAAOgAc+4dJWtAAAAAElFTkSuQmCC', 'base64')
const pictures = who => who.view.route(/\.(webp|png|svg)(\?|$)/, route => (new URL(route.request().url()).origin === new URL(GAME).origin
  ? route.fulfill({ contentType: 'image/png', body: PIXEL }) : route.fallback()))
/** What an Inventory row's own menu offers, by a right-click on its name: none where it has no menu. */
async function menuOf(who, name) {
  const row = tabpanel(who).locator('li').filter({ has: who.page.getByText(name, { exact: true }) }).first()
  await row.waitFor({ timeout: 15_000 })
  const menu = await who.itemMenu(row, 'mouse', name)
  await menu.waitFor({ timeout: 3_000 }).catch(() => {})
  const items = (await menu.getByRole('menuitem').allTextContents().catch(() => [])).map(item => item.trim())
  await who.page.keyboard.press('Escape')
  return items
}
/** An effect's controls on the Effects tab, its row opened: their names. */
async function effectControls(who, name) {
  const row = tabpanel(who).locator('li').filter({ has: who.page.locator('.font-medium', { hasText: new RegExp(`^${escapeRe(name)}$`) }) }).first()
  await row.waitFor({ timeout: 15_000 })
  const details = row.locator('details').first()
  if ((await details.count()) && (await details.getAttribute('open')) === null) await row.locator('summary').first().click()
  await wait(300)
  return row.getByRole('button', { name: /^(Turn off|Turn on|Delete) / }).evaluateAll(all => all.map(b => b.getAttribute('aria-label')))
}
/** Open the picker from a Wild Shape row's Change. */
async function openPicker(who, row) {
  const change = row.getByRole('button', { name: 'Change', exact: true })
  await until(async () => (await change.count()) === 1 && (await change.getAttribute('aria-disabled')) === null, 'Change offered', 20_000)
    .catch(async error => { note(`Change not offered at ${who.width}: "${await rowLine(row)}" (${JSON.stringify(stored()?.wildShape?.uses)})`); throw error })
  await change.click()
  await until(async () => (await dialogTitle(who)) === 'Wild Shape', 'the picker', 10_000)
}
/** A card, by its form's name, in the picker. */
const card = (who, name) => cards(who).filter({ has: who.page.locator('.font-semibold', { hasText: new RegExp(`^${escapeRe(name)}$`) }) }).first()
/** Change into a known form from the picker, by its card, and wait for the sheet to say so. */
async function changeInto(who, row, name) {
  await paced()
  const before = commands().length
  await openPicker(who, row)
  await card(who, name).click()
  await become(who).click()
  const made = await answered(before + 1, `the change into the ${name}`)
  await until(() => stored()?.form?.name === name, `the ${name}'s sheet kept`, 20_000)
  await until(async () => (await ribbonText(who))?.includes(`Wild Shape · ${name}`), `the ribbon of the ${name}`, 20_000)
  await until(async () => (await dialog(who).count()) === 0, 'the picker to close', 15_000)
  return made
}
/** Return from the ribbon, and wait for her own sheet. */
async function returnFrom(who) {
  await paced()
  const before = commands().length
  await ribbon(who).getByRole('button', { name: /^Return to / }).click()
  await popover(who).getByRole('button', { name: 'Return', exact: true }).click()
  const made = await answered(before + 1, 'the return')
  await until(() => !stored()?.form, 'her own sheet kept', 20_000)
  await until(async () => (await ribbon(who).count()) === 0, 'the ribbon to go', 20_000)
  return made
}

// =================================================================================================
// Module 0.39.0: no Wild Shape
// =================================================================================================
if (SKEW039) {
  part('module 0.39.0: no Wild Shape')
  const features = hello().data.features ?? {}
  check(!('wildShape' in features) && same(Object.keys(features).slice(-2), ['dishes', 'effects']),
    `module 0.39.0's hello says nothing of Wild Shape (${JSON.stringify(Object.keys(features))})`)
  await wait(3000)
  check(wildShapeEnabled() === 'f', `the app keeps wildShapeEnabled off (${wildShapeEnabled()})`)
  await until(() => stored('elowen') && stored('rowan'), "Elowen's and Rowan's sheets", 20_000)
  check(!('wildShape' in stored('elowen')) && !('wildShape' in stored('rowan')) && !('form' in stored('elowen')), 'no Wild Shape block on any druid\'s sheet')
  // Shaped in Foundry by the Gamemaster: her own sheet stays hers, and End Turn isn't offered on her turn.
  const desk = await browse({ width: 1280, height: 800, path: '/characters/sheet-elowen', toasts: false })
  await desk.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  // The Gamemaster on the fight's scene, the Hall, so that dnd5e's own switch reaches her combatant's token.
  T.faults.canvasScene = 'hall'
  await elowen.transformInto(await fromUuid(t5.beastUuid('Wolf')), transformation('wildshape'))
  const wolf = formOf()
  await until(() => elowenHall.actorId === wolf?.id, "the Hall's token the Wolf's", 10_000)
  await settled()
  await wait(4000)
  const shown = await view(desk)
  check(!shown?.sheet?.form && shown?.sheet?.speed?.value === 30 && fight.combatants.get('cbElowen').actor?.id === wolf.id && await ribbon(desk).count() === 0,
    `shaped in Foundry, her combatant the Wolf's, Elowen's page keeps her own sheet: no form, her own Walk ${shown?.sheet?.speed?.value} ft (the Wolf's 40), no ribbon`)
  // Her initiative written again in the Gamemaster's tracker, so that her combatant is sent again.
  await fight.setInitiative(fight.combatants.get('cbElowen'), 17)
  const snapshot = () => JSON.parse(sql(`select coalesce((select data::text from combat where "campaignId" = '${A}' limit 1), 'null')`))
  await until(() => (snapshot()?.combatants ?? []).find(cb => cb.id === 'cbElowen')?.character !== 'elowen', 'the fight sent again', 20_000)
  await column(desk, 'Combat')
  await desk.page.locator('#turn-heading').waitFor({ timeout: 20_000 })
  await wait(4000)
  check(await turnButton(desk).count() === 0, `on her turn, her combatant the Wolf's token and no one's character, End Turn isn't offered (${await desk.page.locator('#turn-heading').textContent()})`)
  const gm = await browse({ width: 1280, height: 800, path: GM_PAGE })
  const section = gm.page.getByRole('article', { name: TITLE }).locator('section').filter({ has: gm.page.getByRole('heading', { name: 'Wild Shape' }) })
  await section.waitFor({ timeout: 15_000 })
  const said = (await section.locator('p').allTextContents()).join(' ')
  check(said === 'Your Sending Stone module doesn’t take Wild Shape yet. Version 0.40.0 or later does.', `the Gamemaster's campaign page: "${said}"`)
  await shootBoth(gm, 'wildshape-gm', section)
  // A Wild Shape queued by hand, as one from before a downgrade: module 0.39.0 is never handed it.
  sql(`insert into roll_request (id, "campaignId", "characterId", role, "requestedById", "actorId", kind, payload, status, "updatedAt")
    values ('e2equeued039', '${A}', 'sheet-elowen', 'player', 'e2e-user', 'elowen', 'wildShape', '${JSON.stringify({ kind: 'wildShape', wildShape: { op: 'revert' }, ...PLAIN })}', 'pending', now())`)
  const from = fetchesAnswered()
  await until(() => fetchesAnswered() >= from + 2, "two more of the module's fetches answered", 120_000)
  const status = sql(`select status from roll_request where id = 'e2equeued039'`)
  check(!handed().some(command => command.kind === 'wildShape') && status === 'pending' && formOf()?.id === wolf.id,
    `module 0.39.0 still fetches, and no answer hands it a Wild Shape: the row stays pending, Elowen still the Wolf (${JSON.stringify({ fetches: fetchesAnswered() - from, status })})`)
  await finish()
}

// =================================================================================================
// 1. The hello and the answer
// =================================================================================================
part('1. the hello and the answer')
{
  const features = hello().data.features
  check(same(features.wildShape, { enabled: true, kinds: ['wildShape'], reason: null })
    && same(Object.keys(features), ['rolls', 'transfers', 'removals', 'notes', 'companions', 'favorites', 'dishes', 'effects', 'wildShape']),
  `the hello takes Wild Shape, by the campaign's switch, its key last, after effects (${JSON.stringify({ wildShape: features.wildShape, keys: Object.keys(features) })})`)
  check(JSON.parse(hello().body ?? '{}').features?.wildShape === 1, `the app answers wildShape: 1 (${hello().body})`)
  await until(() => wildShapeEnabled() === 't', 'the app to keep Wild Shape on', 15_000)
  check(wildShapeEnabled() === 't', 'the campaign row keeps wildShapeEnabled on')
}

// =================================================================================================
// 2. The block
// =================================================================================================
part('2. the block')
{
  await until(() => stored('elowen')?.wildShape && stored('thorin'), "Elowen's block and Thorin's sheet", 20_000)
  const block = stored('elowen').wildShape
  check(sameJson(block.limits, { count: 6, cr: 0.5, fly: false }) && same(block.known, []) && block.item === WILD_SHAPE
    && sameJson(block.uses, { value: 2, max: 2 }) && block.hours === 2 && block.temp === 5 && block.resurgence === true,
  `Elowen's stored sheet has her Wild Shape: limits {6, 1/2, no fly}, no forms yet, 2 of 2 uses, 2 hours, 5 temporary hit points, Wild Resurgence (${JSON.stringify(block)})`)
  check(!('wildShape' in stored('thorin')), "Thorin's, a fighter's, has none")
}

const desk = await browse({ width: 1280, height: 800, path: '/characters/sheet-elowen' })
await pictures(desk)
await desk.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })

// =================================================================================================
// 3. Choose forms
// =================================================================================================
part('3. choose forms')
{
  await tab(desk, 'Actions')
  const row = wsRowOn(desk)
  await row.getByRole('button', { name: 'Change', exact: true }).waitFor({ timeout: 20_000 })
  const line = await rowLine(row)
  check(line === 'Change into a known Beast form for 2 hours.', `Actions › Bonus Actions › Wild Shape: "${line}", and Change`)
  await openPicker(desk, row)
  const body = await dialog(desk).locator('p').first().textContent()
  const choose = dialog(desk).getByRole('button', { name: 'Choose forms…' })
  check(body === 'Elowen knows no forms yet.' && await choose.count() === 1 && await dialog(desk).getByRole('button', { name: /^Become/ }).count() === 0,
    `the picker: "${body}", Choose forms…, and no Become`)
  await choose.click()
  await until(async () => (await dialogTitle(desk)) === 'Known forms', 'the Known forms view', 10_000)
  const said = await dialog(desk).locator('p').first().textContent()
  const back = dialog(desk).getByRole('button', { name: 'Back to Wild Shape' })
  const empty = await dialog(desk).getByText('An empty place', { exact: true }).count()
  check(said === 'Elowen knows 0 of 6 forms: Beasts up to CR 1/2, none with a Fly Speed.' && await back.count() === 1 && empty === 6,
    `"Known forms": "${said}", Back named "Back to Wild Shape", six empty places`)
  // Learn a form…: the Beasts her Gamemaster's pack offers her, read from the game.
  // The game's answer held a moment, as one on its way takes its time.
  holdResults()
  await dialog(desk).getByRole('button', { name: 'Learn a form…' }).first().click()
  await until(async () => (await dialogTitle(desk)) === 'Learn a form', 'Learn a form', 10_000)
  const finding = await dialog(desk).getByRole('status').filter({ hasText: 'Finding Beasts…' }).count()
  releaseResults()
  const beasts = dialog(desk).getByRole('radiogroup', { name: 'Beasts' })
  await beasts.waitFor({ timeout: 30_000 })
  const listed = await beasts.getByRole('radio').evaluateAll(all => all.map(el => el.getAttribute('aria-label')))
  const names = listed.map(label => label.split(', ')[0])
  note(`Beasts listed: ${JSON.stringify(listed)}`)
  check(finding === 1 && same(names, ['Rat', 'Spider', 'Panther', 'Riding Horse', 'Wolf', 'Black Bear', 'Crocodile', 'Reef Shark']) && !names.includes('Giant Bat') && !names.includes('Brown Bear'),
    `"Finding Beasts…" while the game lists them (${finding}), then her eight Beasts by CR, without the Giant Bat (a Fly Speed) or the Brown Bear (CR 1): ${JSON.stringify(names)}`)
  await dialog(desk).getByLabel('Search Beasts').fill('wolf')
  await until(async () => (await beasts.getByRole('radio').count()) === 1, 'the search to leave the Wolf', 10_000)
  // The count just before the list, read where it stands and never announced (round 0.40.0 §9.5):
  // this view's live words are its "Finding Beasts…" and its refusals alone.
  const countLine = beasts.locator('xpath=preceding-sibling::p[1]')
  const counted = await countLine.textContent()
  const live = await dialog(desk).locator('[aria-live], [role="status"], [role="alert"], [role="log"]').count()
  const wolfLabel = await beasts.getByRole('radio').first().getAttribute('aria-label')
  check(counted === '1 of 8 Beasts' && live === 0 && wolfLabel === 'Wolf, Medium · CR 1/4, AC 12, Walk 40 ft',
    `searched "wolf": "${counted}", no live region in the view (${live}), "${wolfLabel}"`)
  await beasts.getByRole('radio').first().click()
  const learnButton = footer(desk).getByRole('button').last()
  check(await learnButton.textContent() === 'Learn a Wolf', `its button: "${await learnButton.textContent()}"`)
  const count = commands().length
  holdResults()
  await learnButton.click()
  await until(async () => (await learnButton.textContent()) === 'Learning…', 'Learning…', 10_000)
  check(true, 'on its way, "Learning…"')
  releaseResults()
  const made = await answered(count + 1, 'the Wolf learned')
  const toast = await toastSays(desk, 'Elowen knows a Wolf')
  const activity = shapeItem().system.activities.get(ACTIVITY)
  check(made.status === 'done' && activity.transform.mode === '' && same(activity.profiles.map(p => p.name), ['Wolf']) && toast.startsWith('Elowen knows a Wolf'),
    `learned: the toast "${toast}"; Foundry's Wild Shape in linked forms with the Wolf (${JSON.stringify({ mode: activity.transform.mode, profiles: activity.profiles.map(p => p.name) })})`)
  await until(async () => (await dialogTitle(desk)) === 'Known forms', 'back to Known forms', 15_000)
  // Then the Black Bear and the Panther, the same way.
  for (const name of ['Black Bear', 'Panther']) {
    await dialog(desk).getByRole('button', { name: 'Learn a form…' }).first().click()
    await beasts.waitFor({ timeout: 30_000 })
    await beasts.getByRole('radio', { name: new RegExp(`^${escapeRe(name)},`) }).click()
    const before = commands().length
    await footer(desk).getByRole('button', { name: new RegExp(`^Learn an? ${escapeRe(name)}$`) }).click()
    await answered(before + 1, `the ${name} learned`)
    await until(async () => (await dialogTitle(desk)) === 'Known forms', 'back to Known forms', 15_000)
  }
  await until(() => (stored().wildShape?.known ?? []).length === 3, 'three forms on her stored sheet', 20_000)
  check(same(profilesOf().map(p => p.name), ['Wolf', 'Black Bear', 'Panther']) && same(stored().wildShape.known.map(k => k.name), ['Wolf', 'Black Bear', 'Panther']),
    `then the Black Bear and the Panther: ${JSON.stringify(profilesOf().map(p => p.name))}`)
  await dialog(desk).getByRole('button', { name: 'Close' }).click()
  // Before her first change, her own gear: the Quarterstaff's menu offers its move, its removal and a favorite.
  await tab(desk, 'Inventory')
  const own = await menuOf(desk, 'Quarterstaff')
  check(['Add to favorites', 'Send to…', 'Remove…'].every(item => own.includes(item)), `as herself, her Quarterstaff's menu: ${JSON.stringify(own)}`)
  await tab(desk, 'Effects')
  const blessed = await effectControls(desk, 'Bless')
  check(blessed.includes('Turn off Bless'), `as herself, Rowan's Bless on her offers its controls: ${JSON.stringify(blessed)}`)
  await tab(desk, 'Actions')
}

// =================================================================================================
// 4. Become a Wolf
// =================================================================================================
part('4. become a Wolf')
const WOLF = () => profilesOf().find(p => p.name === 'Wolf')._id
let started
{
  const row = wsRowOn(desk)
  await openPicker(desk, row)
  const chips = await dialog(desk).getByRole('list', { name: 'What happens' }).getByRole('listitem').allTextContents()
  check(same(chips.slice(0, 3), ['Bonus Action', '2 hours', '+5 temporary hit points']) && chips.includes('No spellcasting'),
    `the picker's chips: ${JSON.stringify(chips)}`)
  const names = await cardNames(desk)
  check(names[0] === 'Wolf, Medium, CR 1/4, AC 12, Walk 40 ft, Bite +4 · 1d6 + 2' && names.length === 3,
    `the known forms as radios: ${JSON.stringify(names)}`)
  const checkedName = () => cards(desk).evaluateAll(all => all.find(el => el.getAttribute('aria-checked') === 'true')?.getAttribute('aria-label')?.split(',')[0] ?? null)
  const first = await checkedName()
  await desk.page.locator('dialog[open] [role="radio"][aria-checked="true"]').focus()
  await desk.page.keyboard.press('ArrowDown')
  const second = await checkedName()
  await desk.page.keyboard.press('ArrowUp')
  const third = await checkedName()
  check(first === 'Wolf' && second === 'Black Bear' && third === 'Wolf', `arrows move the check: ${first} → ${second} → ${third}`)
  const note0 = await footerText(desk)
  check(note0 === '2 of 2 uses left · this uses one Become a Wolf', `its footer: "${note0}"`)
  await shootBoth(desk, 'wildshape-picker', dialog(desk))
  const count = commands().length
  holdResults()
  const button = become(desk)
  await button.click()
  await until(async () => (await button.textContent()) === 'Changing…', 'Changing…', 10_000)
  const focus = await focusOf(desk)
  check(await button.getAttribute('aria-disabled') === 'true' && focus.text === 'Changing…',
    `on its way: "Changing…", aria-disabled, focus kept on it (${JSON.stringify(focus)})`)
  started = game.time.worldTime
  releaseResults()
  const made = await answered(count + 1, 'the change into the Wolf')
  const wolf = formOf()
  check(made.status === 'done' && wolf?.name === 'Elowen (Wolf)' && usesLeft() === 1 && same(bothTokens(), [wolf.id, wolf.id]),
    `done: "${wolf?.name}" made, a use spent (2/2 → ${usesLeft()}/2), both scenes' tokens the Wolf's (${JSON.stringify(bothTokens())})`)
  await until(() => stored()?.form?.name === 'Wolf', "the Wolf's sheet kept", 20_000)
  const sheet = stored()
  check(sheet.form.kind === 'wildShape' && sheet.form.minutesLeft === 120 && sheet.ac === 12 && sheet.hp.temp === 5,
    `the stored sheet under elowen is the form's, with form (${JSON.stringify({ form: { ...sheet.form, beast: undefined }, ac: sheet.ac, hp: sheet.hp })})`)
  await until(async () => (await ribbonText(desk))?.includes('Wild Shape · Wolf'), 'the ribbon', 20_000)
  const r = await ribbonText(desk)
  const header = await headerLine(desk)
  check(header === 'In Wild Shape · Wolf' && r.includes('2 h 0 m left') && await ribbon(desk).getByRole('button', { name: 'Return to Elowen' }).count() === 1,
    `the header "${header}", the ribbon "${r}" with Return to Elowen`)
  const toast = await toastSays(desk, 'Elowen is a Wolf')
  check(toast.includes('5 temporary hit points · 2 hours'), `the toast: "${toast}"`)
  await until(async () => (await focusOf(desk)).tag === 'h2', 'focus on the ribbon', 15_000).catch(() => {})
  const after = await focusOf(desk)
  const selected = await desk.page.getByRole('tablist', { name: 'Character sheet' }).getByRole('tab', { selected: true }).textContent()
  check(after.tag === 'h2' && after.ribbon && after.text === 'Wild Shape · Wolf' && /^Actions/.test(selected),
    `focus on the ribbon's heading, the tab still Actions (${JSON.stringify({ after, selected })})`)
  await tab(desk, 'Character')
  const panel = tabpanel(desk)
  const h2 = await panel.locator('h2').first().textContent()
  const line = await panel.locator('h2 + p').first().textContent()
  const acTile = await tileText(desk, 'Armor class')
  const hpText = await panel.evaluate(el => el.innerText)
  check(h2 === 'Elowen as a Wolf' && line === 'Medium · CR 1/4 · Darkvision 60 ft' && /\bwolf\b/.test(acTile) && /\b12\b/.test(acTile) && /\+5 temp/.test(hpText),
    `the Character tab: "${h2}", "${line}", AC tagged Wolf ("${acTile}"), her hit points +5 temp`)
  await shootBoth(desk, 'wildshape-shaped', desk.page.locator('main'))
  // The chat line, hers.
  await column(desk, 'Chat')
  const lineInChat = desk.log.locator('li').filter({ hasText: 'Elowen uses Wild Shape and becomes a Wolf.' })
  await lineInChat.waitFor({ timeout: 20_000 })
  check(await lineInChat.locator('article').getAttribute('data-side') === 'me', 'in app chat, "Elowen uses Wild Shape and becomes a Wolf." on her side')
}
if (DND5E6) {
  // 10, then 14, under dnd5e 6.0.5.
  part('10. return (dnd5e 6.0.5)')
  await returnFrom(desk)
  check(!formOf() && same(bothTokens(), ['elowen', 'elowen']) && elowen.system.attributes.hp.temp === 5,
    `returned: the form deleted, both tokens hers, 5 temporary hit points kept (${elowen.system.attributes.hp.temp})`)
}

// =================================================================================================
// 14. The Moon (Bob at 390), here under dnd5e 6.0.5
// =================================================================================================
async function moon() {
  part('14. the Moon')
  const bob = await browse({ width: 390, height: 844, who: BOB, path: '/characters/sheet-rowan' })
  await bob.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await tab(bob, 'Actions')
  const row = wsRowOn(bob)
  await row.getByRole('button', { name: 'Change', exact: true }).waitFor({ timeout: 20_000 })
  await openPicker(bob, row)
  const chips = await dialog(bob).getByRole('list', { name: 'What happens' }).getByRole('listitem').allTextContents()
  check(chips.includes('+18 temporary hit points') && chips.includes('AC at least 16') && chips.includes('Circle of the Moon spells only'),
    `Rowan's chips: ${JSON.stringify(chips)}`)
  const before = commands().length
  await card(bob, 'Black Bear').click()
  await become(bob).click()
  await answered(before + 1, "Rowan's change into the Black Bear")
  await until(() => stored('rowan')?.form?.name === 'Black Bear', "Rowan's Black Bear kept", 20_000)
  await until(async () => (await dialog(bob).count()) === 0, 'the picker to close', 15_000)
  await tab(bob, 'Character')
  const ac = await tileText(bob, 'Armor class')
  const sheet = stored('rowan')
  check(sheet.ac === 16 && sheet.form.flooredAc === true && /\b16\b/.test(ac) && ac.includes('circle of the moon'),
    `Become a Black Bear: AC 16, tagged Circle of the Moon ("${ac}")`)
  return bob
}
if (DND5E6) {
  await moon()
  await finish()
}

// =================================================================================================
// 6. Hidden while shaped
// =================================================================================================
part('6. hidden while shaped')
{
  await tab(desk, 'Inventory')
  const inventory = await tabpanel(desk).evaluate(el => el.innerText)
  const gives = await tabpanel(desk).getByRole('button', { name: /^(Give|Remove|Take)/ }).count()
  const biteMenu = await menuOf(desk, 'Bite')
  check(inventory.includes('Elowen’s own gear is back on this tab when Wild Shape ends.') && gives === 0
    && !biteMenu.some(item => ['Add to favorites', 'Send to…', 'Remove…'].includes(item)),
  `Inventory: the line; no Give, Remove or Take, and the Bite's menu offers neither a move, a removal nor a favorite (${JSON.stringify(biteMenu)})`)
  await tab(desk, 'Effects')
  const blessed = await effectControls(desk, 'Bless')
  const effectsText = await tabpanel(desk).evaluate(el => el.innerText)
  check(blessed.length === 0 && await tabpanel(desk).getByRole('button', { name: /^(Turn off|Turn on|Delete) / }).count() === 0
    && effectsText.includes('Effects are changed from here again once Elowen is no longer a Wolf.'),
  'Effects: the form\'s copy of Bless, no effect controls, and the line')
  const post = await call(desk.page, `${API}/rolls`, { method: 'POST', body: { kind: 'favorite', favorite: { op: 'add', type: 'item', id: 'elowenStaff00000' }, ...PLAIN } })
  check(post.status === 422 && post.json?.reason === 'shaped', `a crafted favorite: ${post.status} ${post.json?.reason}`)
}

// =================================================================================================
// 5. In form
// =================================================================================================
part('5. in form')
{
  const wolf = formOf()
  await tab(desk, 'Actions')
  const chip = tabpanel(desk).getByRole('button', { name: 'Bite attack, +4', exact: true })
  await chip.waitFor({ timeout: 10_000 })
  await paced()
  const rolls = () => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}' and kind = 'attack'`))
  const before = rolls()
  await chip.click()
  const picker = desk.page.getByRole('dialog', { name: 'Bite attack' })
  await picker.waitFor({ timeout: 10_000 })
  await picker.getByRole('button', { name: /^Bandit/ }).click()
  await until(() => rolls() > before, 'the Bite sent', 15_000)
  const attack = lastOf('attack')
  await until(() => postsOf('command.result').some(p => p.data?.id === attack.id), 'the Bite made', 30_000)
  const result = postsOf('command.result').find(p => p.data?.id === attack.id)?.data
  const spoken = W.messages.get(result?.messageId)?.speaker?.actor
  check(result?.status === 'done' && wolf.items.has(attack.payload.item) && !elowen.items.has(attack.payload.item) && spoken === wolf.id,
    `the Bite's attack chip rolls on the form's own Bite, spoken by the form (${JSON.stringify({ status: result?.status, item: attack.payload.item, spoken })})`)
  await column(desk, 'Chat')
  await until(async () => (await desk.log.locator('li').filter({ hasText: 'Bite' }).count()) > 0, 'the Bite in app chat', 20_000)
  const biteCard = desk.log.locator('li').filter({ hasText: 'Bite' }).last()
  check(await biteCard.locator('article').getAttribute('data-side') === 'me', "the Bite's card hers in app chat")
  // Perception: the higher of hers and the Wolf's, merged.
  await tab(desk, 'Character')
  const perception = tabpanel(desk).getByRole('button', { name: /^Perception check/ }).first()
  const label = await perception.getAttribute('aria-label')
  const total = wolf.system.skills.prc.total
  check(label.startsWith(`Perception check, ${total >= 0 ? '+' : '−'}${Math.abs(total)}`) && total === Math.max(elowen.system.skills.prc.total, total),
    `Perception rolls the merged total, ${total} ("${label}")`)
  const skills = () => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}' and kind = 'skill'`))
  const skilled = skills()
  await perception.click()
  await until(() => skills() > skilled, 'Perception sent', 15_000)
  const skill = lastOf('skill')
  await until(() => postsOf('command.result').some(p => p.data?.id === skill.id), 'Perception made', 30_000)
  const made = postsOf('command.result').find(p => p.data?.id === skill.id).data
  const d20 = lastOf('skill').payload.dice[0].results[0]
  check(made.status === 'done' && made.rolls[0].total === d20 + total,
    `rolled on the form: ${d20} + ${total} = ${made.rolls[0].total}`)
  // On the wolf's turn, End Turn offered, and it ends it.
  await column(desk, 'Combat')
  await until(async () => (await turnButton(desk).count()) === 1 && (await turnButton(desk).textContent()) === 'End turn', 'End turn offered', 20_000)
  check(fight.combatants.get('cbElowen').actor?.id === wolf.id, "on the wolf's turn, its combatant the form's, End turn offered (the old Known limit gone)")
  await turnButton(desk).click()
  await until(() => fight.turn === 1, 'the turn to move on', 20_000)
  check(fight.combatant?.id === 'cbThorin', `End turn ends it: Thorin's turn now (${fight.combatant?.id})`)
}

// =================================================================================================
// 24. Her familiar
// =================================================================================================
part('24. her familiar')
{
  const owl = companion('owl', 'Owl', { linked: false, ac: 11, npc: { spec: { mods: { dex: 2, wis: 1 }, prof: 2, skills: { prc: { ability: 'wis' } }, hp: { value: 1, max: 1, temp: 0 } } } })
  await summoned(hall, owl, elowen, WILD_SHAPE, { id: 'owlToken00000000', name: 'Owl', activity: ACTIVITY })
  const switcher = desk.page.getByRole('tablist', { name: 'Character and companions' })
  await switcher.waitFor({ timeout: 30_000 })
  const names = await switcher.getByRole('tab').evaluateAll(tabs => tabs.map(each => each.getAttribute('aria-label')))
  const self = desk.page.locator('#creature-tab-self')
  await self.locator('img').first().waitFor({ timeout: 10_000 }).catch(() => {})
  const portrait = await self.locator('img').first().getAttribute('src').catch(() => null)
  check(names[0] === 'Elowen, in Wild Shape as a Wolf' && names.some(name => /^Owl/.test(name ?? '')) && /Wolf\.webp$/.test(portrait ?? ''),
    `the switcher: her familiar beside her, her own tab "${names[0]}", its portrait the beast's (${portrait}) (${JSON.stringify(names)})`)
  const owlTab = switcher.getByRole('tab').filter({ hasText: /Owl/ }).first()
  const key = await switcher.getByRole('tab').evaluateAll(tabs => tabs.find(each => /^Owl/.test(each.getAttribute('aria-label') ?? ''))?.dataset.key)
  await (key ? desk.page.locator(`#creature-tab-${key}`) : owlTab).click()
  const owlPanel = desk.page.locator(`#creature-panel-${key}`)
  const perception = owlPanel.getByRole('button', { name: /^Perception/ }).first()
  await perception.waitFor({ timeout: 20_000 })
  await paced()
  const skills = () => JSON.parse(sql(`select coalesce(json_agg(r order by r."createdAt")::text, '[]') from (select id, "actorId", payload, "createdAt" from roll_request where "campaignId" = '${A}' and kind = 'skill') r`))
  const before = skills().length
  await perception.click()
  await until(() => skills().length > before, "the Owl's Perception sent", 15_000)
  const sent = skills().at(-1)
  await until(() => postsOf('command.result').some(p => p.data?.id === sent.id), "the Owl's Perception made", 30_000)
  const made = postsOf('command.result').find(p => p.data?.id === sent.id).data
  const speaker = W.messages.get(made.messageId)?.speaker
  check(made.status === 'done' && sent.actorId !== 'elowen' && speaker?.actor === 'owl' && speaker.token === 'owlToken00000000',
    `the familiar's roll is still its own (${JSON.stringify({ actorId: sent.actorId, of: sent.payload.of, speaker })})`)
  await desk.page.locator('#creature-tab-self').click()
}

// =================================================================================================
// 20. A save asked of the form
// =================================================================================================
part('20. a save asked of the form')
{
  const wolf = formOf()
  await tab(desk, 'Character')
  const banner = desk.page.getByRole('region', { name: 'Your Gamemaster asks' })
  const net = { id: 'thorinNet0000000', name: 'Net', img: 'icons/net.webp', uuid: 'Actor.thorin.Item.thorinNet0000000' }
  const asked = await saveCard({ by: thorin, item: net, dc: 13, abilities: ['dex'], targets: [wolf] })
  await banner.waitFor({ timeout: 20_000 })
  const said = await banner.textContent()
  const prompt = postsOf('roll.prompt.opened').map(p => p.data.prompt).at(-1)
  check(prompt?.id === `${asked.id}-elowen` && prompt.actorId === 'elowen' && /Dexterity/.test(said),
    `a dnd5e save card at the wolf's token: Elowen's page shows the prompt banner ("${said}"), asked of her (${prompt?.id})`)
  await paced()
  await banner.getByRole('button', { name: /^Roll Dexterity saving throw/ }).click()
  await until(() => ['done', 'failed'].includes(lastOf('save')?.status), 'the save made', 30_000)
  const answer = lastOf('save')
  await until(() => postsOf('command.result').some(p => p.data?.id === answer.id), 'its result posted', 10_000)
  const made = postsOf('command.result').find(p => p.data?.id === answer.id)?.data
  const message = W.messages.get(made?.messageId)
  check(made?.status === 'done' && message?.speaker?.actor === wolf.id && message.flags?.dnd5e?.originatingMessage === asked.id
    && made.rolls[0].total === answer.payload.dice[0].results[0] + wolf.system.abilities.dex.save.value,
  `Roll: the save rolled on the form in Foundry, the wolf's Dex (${wolf.system.abilities.dex.save.value}), the card answered`)
  await until(async () => (await banner.count()) === 0, 'the banner to go', 20_000)
  check(true, 'and the banner gone')
}

// =================================================================================================
// 16. The Gamemaster's page of Elowen while shaped
// =================================================================================================
part("16. the Gamemaster's page")
{
  const gm = await browse({ width: 1280, height: 800, path: `/campaigns/${A}/characters/elowen` })
  await gm.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await ribbon(gm).waitFor({ timeout: 20_000 })
  const r = await ribbonText(gm)
  await tab(gm, 'Actions')
  await wsRowOn(gm).waitFor({ timeout: 20_000 })
  const changes = await wsRowOn(gm).getByRole('button', { name: /^(Change|Return)/ }).count()
  const post = await crafted(gm, GM_API, { op: 'revert' })
  check(r.includes('Wild Shape · Wolf') && r.includes('It ends in Foundry.') && await ribbon(gm).getByRole('button').count() === 0 && changes === 0 && post.status === 409,
    `at Elowen's page, the Gamemaster has the ribbon ("${r}") with no Return, no Change; a Wild Shape posted from it ${post.status} ${post.json?.reason}`)
  await gm.view.close()
}

// =================================================================================================
// 7. Time
// =================================================================================================
part('7. time')
{
  await setWorldTime(started + 58 * 60)
  await until(async () => (await ribbonText(desk))?.includes('1 h 2 m left'), 'the ribbon to say 1 h 2 m left', 20_000)
  check(stored().form.minutesLeft === 62, `58 minutes of world time on, within a poll the ribbon reads "1 h 2 m left" (${await ribbonText(desk)})`)
}

// =================================================================================================
// 8. A refusal
// =================================================================================================
part('8. a refusal')
{
  await tab(desk, 'Actions')
  await openPicker(desk, wsRowOn(desk))
  await stopFetching({ age: A })
  await until(async () => (await view(desk))?.wildShape !== true, "the app's view no longer offering Wild Shape", 30_000)
  await wait(3000)
  check(await dialogTitle(desk) === 'Wild Shape', 'fetching stopped and the bridge aged: the picker still open')
  await card(desk, 'Black Bear').click()
  const before = commands().length
  await become(desk).click()
  const alert = footer(desk).getByRole('alert')
  await alert.waitFor({ timeout: 10_000 })
  const said = await alert.textContent()
  check(said === 'Elowen didn’t change: your Gamemaster’s game isn’t taking Wild Shape now. Try again in a moment.' && commands().length === before,
    `Become a Black Bear: "${said}" in the footer, nothing sent`)
  await shootBoth(desk, 'wildshape-refused', dialog(desk))
  await dialog(desk).getByRole('button', { name: 'Close' }).click()
  await until(async () => (await ribbonText(desk))?.includes('Your Gamemaster’s game isn’t taking Wild Shape now.'), 'the ribbon\'s line', 20_000)
  check(await ribbon(desk).getByRole('button').count() === 0, `the ribbon: "${await ribbonText(desk)}", no Return`)
  startFetching()
  await until(async () => (await view(desk))?.wildShape === true, 'Wild Shape offered again', 60_000)
  await ribbon(desk).getByRole('button', { name: 'Return to Elowen' }).waitFor({ timeout: 20_000 })
}

// =================================================================================================
// 9. Change form
// =================================================================================================
part('9. change form')
{
  const row = wsRowOn(desk)
  const controls = await row.getByRole('button').evaluateAll(all => all.map(b => b.textContent.trim()).filter(t => ['Change', 'Return'].includes(t)))
  check(same(controls, ['Return', 'Change']), `the row's Change beside Return: ${JSON.stringify(controls)}`)
  await openPicker(desk, row)
  const names = await cardNames(desk)
  check(names.some(name => name.startsWith('Wolf,') && name.endsWith(', now')), `the picker with the Wolf "Now": ${JSON.stringify(names)}`)
  const wolf = formOf()
  await card(desk, 'Black Bear').click()
  const before = commands().length
  await become(desk).click()
  await answered(before + 1, 'the change into the Black Bear')
  await until(() => stored()?.form?.name === 'Black Bear', "the Black Bear's sheet", 20_000)
  const forms = formsOf()
  check(forms.length === 1 && forms[0].name === 'Elowen (Black Bear)' && !game.actors.get(wolf.id) && usesLeft() === 0 && stored().hp.temp === 5,
    `one form "${forms.map(f => f.name)}", the Wolf gone, uses 0/2, temp kept at ${stored().hp.temp}`)
  await until(async () => (await dialog(desk).count()) === 0, 'the picker to close', 15_000)
  const change = wsRowOn(desk).getByRole('button', { name: 'Change', exact: true })
  await until(async () => (await change.getAttribute('aria-disabled')) === 'true', 'Change disabled', 20_000)
  const line = await rowLine(wsRowOn(desk))
  check(line.includes('No uses left. You regain one on a Short Rest, and all on a Long Rest. Or spend a spell slot with Wild Resurgence.'),
    `the row's Change now disabled: "${line}"`)
}

// =================================================================================================
// 10. Return
// =================================================================================================
part('10. return')
{
  const bear = formOf()
  const opener = ribbon(desk).getByRole('button', { name: 'Return to Elowen' })
  await opener.click()
  await popover(desk).waitFor({ timeout: 10_000 })
  const words = await popover(desk).locator('p').allTextContents()
  const focus = await focusOf(desk)
  check(same(words, ['Return to Elowen?', 'Wild Shape ends. It takes a Bonus Action.', 'Elowen keeps 5 temporary hit points.']) && focus.text === 'Stay a Black Bear',
    `the popover: ${JSON.stringify(words)}, "Stay a Black Bear" focused`)
  await shootBoth(desk, 'wildshape-popover', popover(desk))
  await desk.page.keyboard.press('Escape')
  await until(async () => (await popover(desk).count()) === 0, 'the popover to close', 5_000)
  const back = await focusOf(desk)
  check(back.text === 'Return to Elowen' && back.ribbon, `Escape: focus back on Return to Elowen (${JSON.stringify(back)})`)
  const before = commands().length
  holdResults()
  await opener.click()
  await popover(desk).getByRole('button', { name: 'Return', exact: true }).click()
  await until(async () => (await ribbon(desk).getByRole('button').first().textContent()) === 'Returning…', 'Returning…', 10_000)
  check(await ribbon(desk).getByRole('button').first().getAttribute('aria-disabled') === 'true', '"Returning…", aria-disabled')
  releaseResults()
  await answered(before + 1, 'the return')
  await until(() => !stored()?.form, 'her own sheet', 20_000)
  check(!game.actors.get(bear.id) && same(bothTokens(), ['elowen', 'elowen']) && elowen.system.attributes.hp.temp === 5 && stored().hp.temp === 5,
    `her own sheet: hp.temp 5 in Foundry (${elowen.system.attributes.hp.temp}) and the app (${stored().hp.temp}), the form deleted, both tokens hers`)
  const toast = await toastSays(desk, 'Elowen is no longer a Black Bear')
  check(toast.includes('5 temporary hit points stay'), `the toast: "${toast}"`)
  await until(async () => (await focusOf(desk)).id === 'sheet-panel', 'focus on the panel', 15_000).catch(() => {})
  check((await focusOf(desk)).id === 'sheet-panel', 'focus on the tab panel')
}

// A phone of Alice's, open from here on, for the banner and the phone's checks.
const phone = await browse({ width: 390, height: 844, path: '/characters/sheet-elowen' })
await phone.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })

// =================================================================================================
// 11. The game ends it
// =================================================================================================
part('11. the game ends it')
{
  await t5.rest(elowen, { type: 'long' })
  await until(() => stored()?.wildShape?.uses?.value === 2 && stored().wildShape.swap === true, 'the Long Rest on her sheet', 20_000)
  check(usesLeft() === 2 && shapeItem().flags['sending-stone']?.wildShape?.swap === true, 'a Long Rest in Foundry: 2 of 2 uses back, and a replacement')
  await tab(desk, 'Actions')
  await wsRowOn(desk).getByRole('button', { name: 'Change', exact: true }).waitFor({ timeout: 20_000 })
  await changeInto(desk, wsRowOn(desk), 'Wolf')
  const wolf = formOf()
  await setWorldTime(game.time.worldTime + 2 * 3600)
  await until(() => !game.actors.get(wolf.id), 'its hours to end it', 20_000)
  const banner = ended(desk)
  await banner.waitFor({ timeout: 20_000 })
  const said = await banner.locator('p').textContent()
  check(said === 'Wild Shape ended in your game: its 2 hours ran out. Elowen is no longer a Wolf.' && !formOf(),
    `world time advanced 2 hours: returned in Foundry, the banner "${said}"`)
  await ended(phone).waitFor({ timeout: 20_000 })
  for (const who of [desk, phone]) await shootBoth(who, 'wildshape-banner', ended(who))
  await banner.getByRole('button', { name: 'Dismiss' }).click()
  await until(async () => (await banner.count()) === 0, 'the banner dismissed', 5_000)
  check((await focusOf(desk)).id === 'sheet-panel', 'Dismiss: focus to the panel')
  await desk.page.reload()
  await desk.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await wait(4000)
  check(await ended(desk).count() === 0, 'reloaded: not shown again')
}

// =================================================================================================
// 12. 0 hit points
// =================================================================================================
part('12. 0 hit points')
{
  await tab(desk, 'Actions')
  await wsRowOn(desk).getByRole('button', { name: 'Change', exact: true }).waitFor({ timeout: 20_000 })
  await changeInto(desk, wsRowOn(desk), 'Panther')
  const panther = formOf()
  check(usesLeft() === 0, `Become a Panther: ${usesLeft()} of 2 left`)
  await panther.update({ 'system.attributes.hp.value': 0 })
  await until(() => !game.actors.get(panther.id), 'the 0 hit points ending', 20_000)
  await ended(desk).waitFor({ timeout: 20_000 })
  const said = await ended(desk).locator('p').textContent()
  check(said === 'Wild Shape ended in your game at 0 hit points. Elowen is no longer a Panther.' && elowen.system.attributes.hp.value === 0,
    `the form damaged to 0: returned, Elowen at ${elowen.system.attributes.hp.value}, the banner "${said}"`)
  const row = wsRowOn(desk)
  await until(async () => (await rowLine(row))?.includes('Elowen can’t use Wild Shape while Incapacitated.'), 'the Incapacitated line', 20_000)
  check(await row.getByRole('button', { name: 'Change', exact: true }).getAttribute('aria-disabled') === 'true',
    `the row "${await rowLine(row)}", Change aria-disabled`)
  const post = await crafted(desk, API, { op: 'transform', form: WOLF() })
  check(post.status === 422 && post.json?.reason === 'incapacitated', `a crafted transform: ${post.status} ${post.json?.reason} (before consume, though no use is left)`)
  await ended(desk).getByRole('button', { name: 'Dismiss' }).click()
  await ended(phone).getByRole('button', { name: 'Dismiss' }).click()
  // Healed in Foundry, for what follows; and the page past its wait for the Panther's sheet
  // (WILD_SHAPE_SETTLE, 10 s), which this ending came within, as a player's next step would be.
  await elowen.update({ 'system.attributes.hp.value': 38 })
  await wait(10_000)
}

// =================================================================================================
// 13. The replacement
// =================================================================================================
part('13. the replacement')
{
  await tab(desk, 'Features')
  const row = rowIn(tabpanel(desk), 'Wild Shape')
  await row.getByRole('button', { name: 'Known forms…' }).waitFor({ timeout: 20_000 })
  await row.getByRole('button', { name: 'Known forms…' }).click()
  await until(async () => (await dialogTitle(desk)) === 'Known forms', 'Known forms', 10_000)
  const replaces = await dialog(desk).getByRole('button', { name: /^Replace / }).evaluateAll(all => all.map(b => b.getAttribute('aria-label')))
  const swap = await dialog(desk).getByText('Elowen may replace one known form, after the last Long Rest.').count()
  check(same(replaces, ['Replace Wolf', 'Replace Black Bear', 'Replace Panther']) && swap === 1,
    `the Features row's Known forms…: Replace… on each (${JSON.stringify(replaces)}), "Elowen may replace one known form, after the last Long Rest."`)
  await shootBoth(desk, 'wildshape-manager', dialog(desk))
  await dialog(desk).getByRole('button', { name: 'Replace Panther' }).click()
  await until(async () => (await dialogTitle(desk)) === 'Replace a Panther', 'Replace a Panther', 10_000)
  const beasts = dialog(desk).getByRole('radiogroup', { name: 'Beasts' })
  await beasts.waitFor({ timeout: 30_000 })
  await beasts.getByRole('radio', { name: /^Riding Horse,/ }).click()
  const button = footer(desk).getByRole('button').last()
  const words = await button.textContent()
  const before = commands().length
  await paced()
  await button.click()
  await until(() => commands().length > before, 'the replacement sent', 10_000)
    .catch(async error => { note(`not sent: "${await footerText(desk)}"`); throw error })
  const made = await answered(before + 1, 'the replacement')
  const toast = await toastSays(desk, 'Elowen knows a Riding Horse')
  await until(async () => (await dialogTitle(desk)) === 'Known forms', 'back to Known forms', 15_000)
  await until(async () => (await dialog(desk).getByRole('button', { name: /^Replace / }).count()) === 0, 'Replace… to go', 20_000)
  check(words === 'Learn a Riding Horse in place of a Panther' && made.status === 'done' && toast.includes('in place of a Panther')
    && same(profilesOf().map(p => p.name), ['Wolf', 'Black Bear', 'Riding Horse']),
  `"${words}": the toast "${toast}", Replace… gone (${JSON.stringify(profilesOf().map(p => p.name))})`)
  await dialog(desk).getByRole('button', { name: 'Close' }).click()
}

// =================================================================================================
// 17. Two taps
// =================================================================================================
part('17. two taps')
{
  await t5.rest(elowen, { type: 'long' })
  await until(() => stored()?.wildShape?.uses?.value === 2, 'her uses back', 20_000)
  await tab(desk, 'Actions')
  await openPicker(desk, wsRowOn(desk))
  await card(desk, 'Wolf').click()
  const before = commands().length
  holdResults()
  await paced()
  await become(desk).dblclick()
  await until(() => commands().length > before, 'the command', 10_000)
  const second = await crafted(desk, API, { op: 'transform', form: WOLF() })
  await wait(1000)
  check(commands().length === before + 1 && second.status === 409 && second.json?.reason === 'moving',
    `Become pressed twice quickly: one command; a crafted second post answered ${second.status} ${second.json?.reason}`)
  releaseResults()
  await answered(before + 1, 'the change into the Wolf')
  await until(async () => (await ribbonText(desk))?.includes('Wild Shape · Wolf'), 'the ribbon', 20_000)
  await returnFrom(desk)
}

// =================================================================================================
// 22. Deleted by hand
// =================================================================================================
part('22. deleted by hand')
{
  await tab(desk, 'Actions')
  await changeInto(desk, wsRowOn(desk), 'Black Bear')
  const bear = formOf()
  await bear.update({ 'system.attributes.hp.value': 25 })
  await bear.delete()
  await until(() => !stored()?.form, 'her own sheet', 20_000)
  await ended(desk).waitFor({ timeout: 20_000 })
  const said = await ended(desk).locator('p').textContent()
  check(said === 'Wild Shape was ended in Foundry. Elowen is no longer a Black Bear.' && same(bothTokens(), ['elowen', 'elowen']) && elowen.system.attributes.hp.value === 25,
    `"Elowen (Black Bear)" deleted from the sidebar: within a poll her own sheet, the banner "${said}", both tokens hers, her hit points the form's (${elowen.system.attributes.hp.value})`)
  await ended(desk).getByRole('button', { name: 'Dismiss' }).click()
  // The page past its wait for the Black Bear's sheet (WILD_SHAPE_SETTLE), which this came within.
  await wait(10_000)
}

// =================================================================================================
// 21. Made in Foundry, returned from the app
// =================================================================================================
part('21. made in Foundry, returned from the app')
{
  await elowen.transformInto(await fromUuid(t5.beastUuid('Wolf')), transformation('wildshape'))
  await until(async () => (await ribbonText(desk))?.includes('Wild Shape · Wolf'), 'the ribbon', 20_000)
  const r = await ribbonText(desk)
  check(/\d+ h \d+ m left/.test(r) && await ribbon(desk).getByRole('button', { name: 'Return to Elowen' }).count() === 1,
    `the Gamemaster's own Wild Shape in Foundry: the ribbon "${r}" with its time and Return to Elowen`)
  await returnFrom(desk)
  await wait(3000)
  check(!formOf() && await ended(desk).count() === 0, 'Return: her own sheet, no banner')
}

// =================================================================================================
// 23. The Favorites strip
// =================================================================================================
part('23. the Favorites strip')
{
  await t5.rest(elowen, { type: 'long' })
  await elowen.update({ 'system.favorites': [{ type: 'item', id: `.Item.${WILD_SHAPE}`, sort: 100000 }] })
  await tab(desk, 'Actions')
  const strip = desk.page.getByRole('region', { name: 'Favorites', exact: true }).or(desk.page.getByRole('complementary', { name: 'Favorites', exact: true }))
  const row = rowIn(strip, 'Wild Shape')
  await row.getByRole('button', { name: 'Change', exact: true }).waitFor({ timeout: 20_000 })
  await changeInto(desk, row, 'Wolf')
  const ret = row.getByRole('button', { name: 'Return', exact: true })
  await ret.waitFor({ timeout: 20_000 })
  await ret.click()
  await popover(desk).getByRole('button', { name: /^Stay / }).click()
  const focus = await focusOf(desk)
  check(focus.text === 'Return' && !focus.ribbon, `in the Favorites strip its row shows Change, then shaped Return; the popover's Stay returns focus to that row's Return (${JSON.stringify(focus)})`)
}

// =================================================================================================
// 25. The pool
// =================================================================================================
part('25. the pool')
{
  await returnFrom(desk)
  const known = profilesOf().map(p => profile(p._id, p.name, p.uuid))
  await knowing(elowen, [...known, profile('elowenThorin0000', 'Thorin', 'Actor.thorin'), profile('elowenSecretHare', 'Moon Hare', 'Compendium.world.secret-beasts.Actor.secretHare000000')])
  await until(() => (stored().wildShape?.known ?? []).length === 5, 'the two on her stored sheet', 20_000)
  const outside = stored().wildShape.known.slice(3)
  check(sameJson(outside, [{ id: 'elowenThorin0000', name: 'Thorin', pool: false }, { id: 'elowenSecretHare', name: 'Moon Hare', pool: false }]),
    `no stats for either in the stored sheet: ${JSON.stringify(outside)}`)
  await tab(desk, 'Actions')
  await openPicker(desk, wsRowOn(desk))
  await until(async () => (await cards(desk).count()) === 5, 'the two cards in the picker', 20_000)
  const names = await cardNames(desk)
  const thorinCard = card(desk, 'Thorin')
  check(names.includes('Thorin, not from your Gamemaster’s compendiums') && names.includes('Moon Hare, not from your Gamemaster’s compendiums')
    && await thorinCard.getAttribute('aria-disabled') === 'true' && (await thorinCard.textContent()).includes('Only in Foundry.'),
  `the picker lists them by name with "Not from your Gamemaster’s compendiums" and "Only in Foundry.", not offered: ${JSON.stringify(names)}`)
  await dialog(desk).getByRole('button', { name: 'Close' }).click()
  const posts = []
  for (const id of ['elowenThorin0000', 'elowenSecretHare']) posts.push(await crafted(desk, API, { op: 'transform', form: id }))
  check(posts.every(post => post.status === 422 && post.json?.reason === 'form'), `a crafted transform into each: ${JSON.stringify(posts.map(p => [p.status, p.json?.reason]))}`)
}

// =================================================================================================
// 19. Phones and themes
// =================================================================================================
part('19. phones and themes')
{
  // Rested, her uses back, and her six places filled in Foundry from the pool, beside the two from outside it: eight cards.
  await t5.rest(elowen, { type: 'long' })
  const known = profilesOf().map(p => profile(p._id, p.name, p.uuid))
  await knowing(elowen, [...known.slice(0, 3), profile('elowenRat0000000', 'Rat', t5.beastUuid('Rat')), profile('elowenSpider0000', 'Spider', t5.beastUuid('Spider')),
    profile('elowenCroc000000', 'Crocodile', t5.beastUuid('Crocodile')), ...known.slice(3)])
  await until(() => (stored().wildShape?.known ?? []).length === 8 && stored().wildShape.uses.value === 2, 'eight known forms on her stored sheet', 20_000)
  await tab(phone, 'Actions')
  const phoneRow = wsRowOn(phone)
  await phoneRow.getByRole('button', { name: 'Change', exact: true }).waitFor({ timeout: 20_000 })
  await changeInto(phone, phoneRow, 'Wolf')
  await shootBoth(phone, 'wildshape-shaped', phone.page.locator('main'))
  await openPicker(phone, wsRowOn(phone))
  await until(async () => (await cards(phone).count()) === 8, 'eight cards', 10_000)
  const sheet = await dialog(phone).evaluate(el => {
    const box = el.getBoundingClientRect()
    const button = el.querySelector('footer button:last-of-type').getBoundingClientRect()
    return { bottom: Math.round(box.bottom), viewport: window.innerHeight, button: { top: Math.round(button.top), bottom: Math.round(button.bottom) }, width: Math.round(box.width) }
  })
  check(Math.abs(sheet.bottom - sheet.viewport) <= 1 && sheet.button.bottom <= sheet.viewport && sheet.button.top >= 0 && sheet.width === 390,
    `at 390, the picker's bottom edge at the viewport's, its footer's Become in view with eight cards (${JSON.stringify(sheet)})`)
  await shootBoth(phone, 'wildshape-picker', dialog(phone))
  const tooShort = []
  for (const [width, height] of [[390, 844], [360, 780]]) {
    await phone.page.setViewportSize({ width, height })
    phone.width = width
    await wait(400)
    const wide = await sideways(phone.page)
    if (width === 390) tooShort.push(...(await heights(dialog(phone))).filter(each => each.h < 44))
    check(wide === 0, `at ${width}, with the picker open, nothing scrolls sideways (${wide})`)
  }
  await phone.page.setViewportSize({ width: 390, height: 844 })
  phone.width = 390
  await dialog(phone).getByRole('button', { name: 'Known forms…' }).click()
  await until(async () => (await dialogTitle(phone)) === 'Known forms', 'the manager', 10_000)
  tooShort.push(...(await heights(dialog(phone))).filter(each => each.h < 44))
  await shootBoth(phone, 'wildshape-manager', dialog(phone))
  for (const width of [390, 360]) {
    await phone.page.setViewportSize({ width, height: width === 390 ? 844 : 780 })
    await wait(400)
    check(await sideways(phone.page) === 0, `at ${width}, with the manager open, nothing scrolls sideways`)
  }
  await phone.page.setViewportSize({ width: 390, height: 844 })
  await dialog(phone).getByRole('button', { name: 'Close' }).click()
  for (const width of [390, 360]) {
    await phone.page.setViewportSize({ width, height: width === 390 ? 844 : 780 })
    await wait(400)
    check(await sideways(phone.page) === 0 && await ribbon(phone).count() === 1, `at ${width}, with the ribbon, nothing scrolls sideways`)
  }
  await phone.page.setViewportSize({ width: 390, height: 844 })
  tooShort.push(...(await heights(ribbon(phone))).filter(each => each.h < 44))
  await ribbon(phone).getByRole('button', { name: 'Return to Elowen' }).click()
  await popover(phone).waitFor({ timeout: 10_000 })
  tooShort.push(...(await heights(popover(phone))).filter(each => each.h < 44))
  await shootBoth(phone, 'wildshape-popover', popover(phone))
  await phone.page.keyboard.press('Escape')
  // At 1280: a dialog at most 640 px wide, its cards in two columns; every control at least 36 px.
  await tab(desk, 'Actions')
  await openPicker(desk, wsRowOn(desk))
  await until(async () => (await cards(desk).count()) === 8, 'eight cards at 1280', 10_000)
  const wide = await dialog(desk).evaluate(el => {
    const cardsBox = [...el.querySelectorAll('[role="radio"]')].map(card => Math.round(card.getBoundingClientRect().left))
    return { width: Math.round(el.getBoundingClientRect().width), columns: new Set(cardsBox).size }
  })
  const shortWide = (await heights(dialog(desk))).filter(each => each.h < 36)
  check(wide.width <= 640 && wide.columns === 2 && shortWide.length === 0, `at 1280, a dialog ${wide.width} px wide, its cards in ${wide.columns} columns, no control under 36 px (${JSON.stringify(shortWide)})`)
  await dialog(desk).getByRole('button', { name: 'Close' }).click()
  await shootBoth(desk, 'wildshape-shaped', desk.page.locator('main'))
  check(tooShort.length === 0, `at 390, every new control at least 44 px tall (${JSON.stringify(tooShort)})`)
  await returnFrom(desk)
}

// =================================================================================================
// 14. The Moon (Bob at 390)
// =================================================================================================
const bobPage = await moon()
{
  const before = commands().length
  await ribbon(bobPage).getByRole('button', { name: 'Return to Rowan' }).click()
  await popover(bobPage).getByRole('button', { name: 'Return', exact: true }).click()
  await answered(before + 1, "Rowan's return")
  await until(() => !stored('rowan')?.form, "Rowan's own sheet", 20_000)
}

// =================================================================================================
// 15. A Polymorph in Foundry
// =================================================================================================
part('15. a Polymorph in Foundry')
{
  const carol = await browse({ width: 1280, height: 800, who: CAROL, path: '/characters/sheet-thorin' })
  await carol.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  // The Gamemaster on the fight's scene, the Hall, so that dnd5e's own switch reaches Thorin's combatant's token.
  T.faults.canvasScene = 'hall'
  await thorin.transformInto(await fromUuid(t5.beastUuid('Giant Ape')), transformation('polymorph'))
  const ape = formOf(thorin)
  await until(() => thorinHall.actorId === ape?.id, "Thorin's token the ape's", 10_000)
  await until(async () => (await ribbonText(carol))?.includes('Transformed · Giant Ape'), "Carol's ribbon", 20_000)
  const r = await ribbonText(carol)
  const header = await headerLine(carol)
  // His initiative written again in the Gamemaster's tracker: his combatant, the ape's token's, sent again.
  const from = postsOf('combat.combatant.updated').length
  await fight.setInitiative(fight.combatants.get('cbThorin'), 13)
  await until(() => postsOf('combat.combatant.updated').length > from, "Thorin's combatant sent again", 15_000)
  const thorinCb = postsOf('combat.combatant.updated').at(-1).data?.combatant
  check(header === 'Transformed · Giant Ape' && r.includes('It ends in Foundry.') && !/\bleft\b/.test(r) && await ribbon(carol).getByRole('button').count() === 0
    && fight.combatants.get('cbThorin').actor?.id === ape.id && thorinCb?.character === 'thorin',
  `Carol's page: "${header}", the ribbon "${r}", no Return, no time; Thorin's combatant still his (${JSON.stringify(thorinCb?.character)})`)
  await ape.revertOriginalForm()
  T.faults.canvasScene = 'forest'
  await until(async () => (await ribbon(carol).count()) === 0, "Thorin's own sheet", 20_000)
  await wait(3000)
  check(!stored('thorin').form && await ended(carol).count() === 0, 'reverted in Foundry: his own sheet back, no banner')
  await carol.view.close()
}

// =================================================================================================
// 18. The campaign page and the switch
// =================================================================================================
part('18. the campaign page and the switch')
{
  const gm = await browse({ width: 1280, height: 800, path: GM_PAGE })
  const article = gm.page.getByRole('article', { name: TITLE })
  const section = article.locator('section').filter({ has: gm.page.getByRole('heading', { name: 'Wild Shape' }) })
  await section.waitFor({ timeout: 15_000 })
  const said = (await section.locator('p').allTextContents()).join(' ')
  const order = await article.locator('h3').allTextContents()
  check(said.startsWith('On in Foundry. Your players’ druids change from here into the Beasts they know and back')
    && order.indexOf('Wild Shape') === order.indexOf("Players' effects") + 1,
  `the Gamemaster's campaign page, after Players' effects: "${said}" (${JSON.stringify(order)})`)
  await shootBoth(gm, 'wildshape-gm', section)
  await game.settings.set('sending-stone', 'campaigns', [campaign({ wildShape: false })])
  await until(() => wildShapeEnabled() === 'f', 'the app to keep Wild Shape off', 20_000)
  await tab(desk, 'Actions')
  await until(async () => (await wsRowOn(desk).getByRole('button', { name: 'Change', exact: true }).count()) === 0, 'Change to go', 30_000)
  check(true, 'the switch off in Foundry: within a poll, no Change')
  await gm.page.reload()
  await section.waitFor({ timeout: 15_000 })
  const off = (await section.locator('p').allTextContents()).join(' ')
  const details = article.locator('details').filter({ has: gm.page.locator('summary', { hasText: 'Foundry settings' }) })
  if (!(await details.evaluate(el => el.open))) await details.locator('summary').click()
  const rows = await details.locator('h4', { hasText: 'This campaign' }).first().locator('xpath=following-sibling::dl[1]/div')
    .evaluateAll(divs => divs.map(div => `${div.querySelector('dt').textContent}: ${div.querySelector('dd').textContent}`))
  check(off === 'Off. To let them, tick Allow Players to use Wild Shape from the app on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.'
    && rows.includes('Allow Players to use Wild Shape from the app: Off'),
  `the page: "${off}"; Foundry settings' row "Allow Players to use Wild Shape from the app: Off"`)
  await elowen.transformInto(await fromUuid(t5.beastUuid('Wolf')), transformation('wildshape'))
  await until(async () => (await ribbonText(desk))?.includes('Wild Shape · Wolf'), 'the ribbon', 20_000)
  const r = await ribbonText(desk)
  check(r.includes('It ends in Foundry.') && await ribbon(desk).getByRole('button').count() === 0, `a Wild Shape made then in Foundry still shows the ribbon: "${r}"`)
}
note(`${commands().length} Wild Shape commands kept`)
await finish()
