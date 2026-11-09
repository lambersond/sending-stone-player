// Hit points and temporary hit points set from the app (module 0.44.0 and the app, the v0.44 plan's
// item 4), end to end, in the world of world-030.mjs with scenes and tokens (fvtt/token-core.mjs),
// dnd5e's own handling of a change of hit points from the module's stand-in (fvtt/hp-core.mjs): its
// floating numbers, a concentration challenged where they drop, and its hooks. Ashlands, on dnd5e
// 5.3.3, has one campaign, Erebor, saved without the switch, so "Allow Players to change their hit
// points from the app" reads on, and its players' rolls off: hit points go on their own. Alice plays
// Thorin Oakenshield, 22 of 30 hit points and 3 temporary, at 1280 × 800, on a tablet at 768 and on
// a phone at 390 × 844 and 360 × 780; Brakka, a linked NPC she owns, 30 of 30, is his companion on
// the active scene. Bob plays Vex; the Gamemaster is at Thorin's page and on the campaigns page. The
// hello and the app's answer; the tile a button with its name; the editor by touch and by keyboard
// alone, a heal typed past the maximum clamped; the GM's fall, temporary 3 → 0 and hit points 22 →
// 21, the sheet ahead of the result, the tray's words, dnd5e's floating numbers, the tile waiting and
// a crafted second post meanwhile answered 409 moving; the editor reset as the game changes the
// numbers while it's open; a stale view refused "changed" by the module, nothing written; Brakka's
// header tile, her own actor written, Thorin's untouched; never the Gamemaster's page nor another
// player's seat; the campaign card; the switch off in Foundry, the tile read-only within a poll and a
// crafted post answered 409; phones, the tablet and both themes. Synthetic characters only. Run with
// --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import {
  BOB, activeScene, browse, call, character, check, companion, finish, foundryWorld, launch, newCampaign, note, part,
  place, posted, postsOf, relay, same, sameJson, sceneWorld, settled, shootBoth, sideways, sql, startModule, until, wait,
} from './world-030.mjs'

const GAME = 'https://ashlands-hitpoints.forge-vtt.com'
const ADDRESS = 'ashlands-hitpoints.forge-vtt.com'
const SECRET = 'erebor-hitpoints-44'
const TITLE = 'Erebor'
await launch(GAME)
const { id: A } = await newCampaign({ title: TITLE, address: ADDRESS, secret: SECRET })
await foundryWorld()
await sceneWorld()
// A checkout's module.json carries its last release's version: the one this release stamps.
game.modules.get('sending-stone').version = '0.44.0'
// What an NPC's sheet names, as dnd5e configures it (D5 config.mjs:2407-2430, actorSizes).
Object.assign(CONFIG.DND5E, {
  movementTypes: { walk: { label: 'DND5E.MOVEMENT.Type.Speed' } },
  movementUnits: { ft: { label: 'Feet', abbreviation: 'DND5E.DistFtAbbr' } },
  actorSizes: { med: { label: 'DND5E.SizeMedium' } },
})
// dnd5e's handling of a change of hit points, from the module's harness.
const { hpLog, withHitPoints } = await import('./fvtt/hp-core.mjs')

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

// ---- The world: Thorin, Alice's, and Brakka, his companion; Vex, Bob's ----
// world-030's character fires updateActor itself: dnd5e's hit points go around it.
const thorin = withHitPoints(character({ id: 'thorin', name: 'Thorin Oakenshield', owners: ['alice'], mods: { str: 3, con: 2 }, hp: { value: 22, max: 30, temp: 3 } }, { ac: 16, items: [] }), { coreHooks: false })
thorin.system.details = { level: 5 }
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { dex: 3, wis: 2 }, hp: { value: 20, max: 30, temp: 0 } }, { ac: 14, items: [] })
vex.system.details = { level: 5 }
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
// Brakka, a sidekick: linked, Alice's, a world actor whose own update fires no hook.
const brakka = withHitPoints(companion('brakka', 'Brakka', {
  owners: ['alice'], linked: true, ac: 14,
  npc: {
    spec: { mods: { str: 3, dex: 1, con: 2 }, prof: 2, hp: { value: 30, max: 30, temp: 0 } },
    system: { traits: { important: true, size: 'med' }, details: { cr: 2, type: { value: 'humanoid', label: 'Humanoid' }, alignment: 'Neutral' }, attributes: { movement: { walk: 30, units: 'ft' }, init: { total: 1 } } },
  },
}))
const arena = await activeScene('arena')
for (const actor of [thorin, vex, brakka]) await place(arena, actor, { id: `tok-${actor.id}`, actorLink: true, tell: false })
// Saved before 0.44.0: no hitPoints key, so it reads on; the players' rolls off.
const campaign = changes => ({ id: 'erebor', title: TITLE, characters: ['thorin', 'vex'], groups: [], rolls: false, ...changes })
await startModule({ campaigns: [campaign()], secrets: { erebor: SECRET } })
await settled()

// ---- What's kept, posted and handed over ----
const hello = () => postsOf('bridge.hello').filter(p => p.campaign === 'erebor').at(-1)
const hitPointsEnabled = () => sql(`select "hitPointsEnabled" from campaign where id = '${A}'`)
const PLAIN = { mode: 0, explicit: false, extras: [], dice: [] }
/** The hit points commands kept, in order: each its actor, its character, status, payload and result. */
const commands = () => JSON.parse(sql(`select coalesce(json_agg(r order by r."createdAt")::text, '[]') from (select id, role, "actorId", "ofActorId", label, status, payload, result, "createdAt" from roll_request where "campaignId" = '${A}' and kind = 'hitPoints') r`))
/** The `count`th hit points command, once the module has answered it and posted its result. */
async function answered(count, what) {
  await until(() => commands().length >= count && ['done', 'failed'].includes(commands()[count - 1].status), what, 30_000)
  const row = commands()[count - 1]
  // The app keeps the result as the module posts it, a moment before its answer is back and the post
  // noted here: under load, long enough for a check reading the post to find none.
  await until(() => resultOf(row), `${what}: its result as the module posted it`, 15_000)
  return row
}
/** What the module posted as a command's result. */
const resultOf = row => postsOf('command.result').find(p => p.data?.id === row.id)?.data
/** Thorin's hit points as the app keeps his sheet. */
const storedHp = () => JSON.parse(sql(`select coalesce((select (data->'hp')::text from actor_sheet where "campaignId" = '${A}' and "actorId" = 'thorin'), 'null')`))
const hpOf = actor => ({ value: actor.system.attributes.hp.value, temp: actor.system.attributes.hp.temp ?? 0 })
/** Hit points posted as a page would post them, through a seat's API. */
const crafted = (who, api, hitPoints) => call(who.page, `${api}/rolls`, { method: 'POST', body: { kind: 'hitPoints', hitPoints, ...PLAIN } })
/** Room under the app's limit of rolls a minute from a seat. */
const paced = () => until(() => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}' and "createdAt" > now() - interval '1 minute'`)) < 15, 'room under the rate limit', 70_000)

// ---- The pages and their parts ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin Oakenshield', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now()),
         ('sheet-vex', 'Vex', '${GAME}', '${TITLE}', '${A}', 'vex', 'e2e-bob', now())`)
const API = '/api/characters/sheet-thorin'
const GM_API = `/api/campaigns/${A}/characters/thorin`
const GM_PAGE = `/campaigns?campaign=${A}`
const desk = await browse({ width: 1280, height: 800, path: '/characters/sheet-thorin', toasts: false })
await desk.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })

/** The sheet in view, on a page that shows the table's panes one at a time. */
async function sheetShown(who) {
  if (await who.nav.isVisible()) await who.character()
}
/** A pane's sheet panel: the character's own, or a companion's by its key. */
const panelOf = (who, key) => who.page.locator(key ? `#creature-${key}-sheet-panel` : '#sheet-panel')
/** The Hit points tile's button in a pane, by the start of its name. */
const tileOf = (who, key) => panelOf(who, key).getByRole('button', { name: /^Hit points: / })
/** The editor, as its dialog. */
const editorOf = who => who.page.getByRole('dialog', { name: 'Hit points', exact: true })
/** What the editor's fields, live line and Save say. */
const editorSays = async who => {
  const dialog = editorOf(who)
  return {
    value: await dialog.getByRole('textbox', { name: 'Hit points', exact: true }).inputValue(),
    temp: await dialog.getByRole('textbox', { name: 'Temporary hit points', exact: true }).inputValue(),
    line: (await dialog.getByRole('status').textContent()).trim(),
    save: await dialog.getByRole('button', { name: 'Save', exact: true }).getAttribute('aria-disabled'),
  }
}
/** One of the editor's steppers, tapped this many times. */
async function step(who, name, times = 1) {
  for (let tap = 0; tap < times; tap += 1) await editorOf(who).getByRole('button', { name, exact: true }).click()
}
/**
 * A pane's roll tray, as its banner names it: the player's own, "Your rolls", or at a companion's
 * pane its own, "Brakka’s rolls" (the character's pane hidden meanwhile).
 */
const tray = (who, name = 'Your rolls') => who.page.getByRole('region', { name, exact: true })
const trayText = (who, name) => tray(who, name).evaluate(el => el.innerText.replace(/\s+/g, ' '))
/** Until a pane's tray says all of these. */
const paneTrayShows = (who, name, ...words) => until(async () => {
  const text = await trayText(who, name).catch(() => '')
  return words.every(word => text.includes(word))
}, `${name} to say ${JSON.stringify(words)}`, 20_000)
/** Until the player's own tray says all of these. */
const trayShows = (who, ...words) => paneTrayShows(who, 'Your rolls', ...words)
/** What has focus: its tag and its accessible name, as the page names it. */
const focusOf = who => who.page.evaluate(() => {
  const el = document.activeElement
  return { tag: el?.tagName.toLowerCase() ?? null, name: el?.getAttribute('aria-label') ?? el?.textContent?.trim() ?? null }
})
/** A control's box: its height and width, rounded. */
const boxOf = locator => locator.evaluate(el => {
  const r = el.getBoundingClientRect()
  return { height: Math.round(r.height), width: Math.round(r.width) }
})

// =================================================================================================
// 1. The hello and the answer
// =================================================================================================
part('1. the hello and the answer')
{
  const features = hello().data.features
  check(same(features.hitPoints, { enabled: true, kinds: ['hitPoints'], reason: null }) && Object.keys(features).at(-1) === 'hitPoints',
    `the hello takes hit points, on for a campaign saved without the switch, last among its features, rolls off (${JSON.stringify({ hitPoints: features.hitPoints, rolls: features.rolls?.enabled, keys: Object.keys(features) })})`)
  check(JSON.parse(hello().body ?? '{}').features?.hitPoints === 1, `the app answers hitPoints: 1 (${hello().body})`)
  await until(() => hitPointsEnabled() === 't', 'the app to keep hit points on', 15_000)
  check(hitPointsEnabled() === 't' && sql(`select "rollsEnabled" from campaign where id = '${A}'`) === 'f', 'the campaign row keeps hitPointsEnabled on, the rolls off')
}

// =================================================================================================
// 2. The tile, and the editor by keyboard alone
// =================================================================================================
part('2. the tile, and the editor by keyboard')
const NAME = 'Hit points: 22 of 30, 3 temporary. Change hit points'
{
  await tileOf(desk).waitFor({ timeout: 20_000 })
  const tile = tileOf(desk)
  check(await tile.getAttribute('aria-label') === NAME && await tile.getAttribute('aria-haspopup') === 'dialog' && await tile.getAttribute('aria-expanded') === 'false'
    && (await boxOf(tile)).height >= 44,
  `the Hit points tile is a button, "${await tile.getAttribute('aria-label')}", opening a dialog, 44 px tall at least (${JSON.stringify(await boxOf(tile))})`)
  await tile.focus()
  await desk.page.keyboard.press('Enter')
  await editorOf(desk).waitFor({ timeout: 10_000 })
  await until(async () => (await focusOf(desk)).name === 'One hit point fewer', 'focus on one hit point fewer', 5_000)
  const opened = await editorSays(desk)
  check(same(opened, { value: '22', temp: '3', line: 'Now 22 / 30 · 3 temporary', save: 'true' }) && await tile.getAttribute('aria-expanded') === 'true',
    `Enter opens it, focus on one hit point fewer, at the sheet's numbers, Save waiting for a change (${JSON.stringify(opened)})`)
  const reason = await editorOf(desk).getByRole('button', { name: 'Save', exact: true }).evaluate(b => document.getElementById(b.getAttribute('aria-describedby'))?.textContent)
  check(reason === 'Change a number to save', `Save's visible reason, tied by aria-describedby: "${reason}"`)
  // A heal typed past the maximum, by the keyboard: clamped as the field is left.
  await desk.page.keyboard.press('Tab')
  await desk.page.keyboard.type('99')
  await desk.page.keyboard.press('Tab')
  const clamped = await editorSays(desk)
  const most = await editorOf(desk).getByRole('button', { name: 'One hit point more', exact: true })
  const hint = await most.evaluate(b => document.getElementById(b.getAttribute('aria-describedby') ?? '')?.textContent ?? null)
  check(clamped.value === '30' && clamped.line === '22 → 30' && await most.getAttribute('aria-disabled') === 'true' && hint === '30 is the maximum',
    `99 typed, Tab: clamped to 30, the maximum, its + held back with its hint (${JSON.stringify({ clamped, hint })})`)
  await shootBoth(desk, 'hitpoints-editor', editorOf(desk))
  await desk.page.keyboard.press('Escape')
  await editorOf(desk).waitFor({ state: 'hidden', timeout: 5_000 })
  await until(async () => (await focusOf(desk)).name === NAME, 'focus back on the tile', 5_000)
  check(commands().length === 0 && same(hpOf(thorin), { value: 22, temp: 3 }), 'Escape closes it, nothing sent, focus back on the tile, Thorin as he was')
}

// =================================================================================================
// 3. The GM's fall, by pointer: temporary 3 → 0, hit points 22 → 21
// =================================================================================================
part('3. the GM\'s fall')
{
  const shown = hpLog.shown.length
  holdResults()
  await paced()
  await tileOf(desk).click()
  await editorOf(desk).waitFor({ timeout: 10_000 })
  await step(desk, 'One temporary hit point fewer', 3)
  await step(desk, 'One hit point fewer')
  const asked = await editorSays(desk)
  check(asked.line === '22 → 21 · temporary 3 → 0' && asked.save === 'false', `the live line says the change: "${asked.line}"`)
  await editorOf(desk).getByRole('button', { name: 'Save', exact: true }).click()
  await until(() => commands().length === 1, 'the command', 10_000)
  await until(() => same(hpOf(thorin), { value: 21, temp: 0 }), 'Thorin set in Foundry', 20_000)
  const row = commands()[0]
  check(sameJson(row.payload.hitPoints, { op: 'set', value: 21, temp: 0, from: { value: 22, temp: 3 } }) && row.actorId === 'thorin' && row.ofActorId === null && row.label === null && row.role === 'player',
    `one command, its numbers from what the tile showed, no label kept (${JSON.stringify({ hitPoints: row.payload.hitPoints, actorId: row.actorId, of: row.ofActorId, label: row.label })})`)
  // On its way: the tile waits, and a second post meanwhile clashes.
  await until(() => storedHp()?.value === 21, 'the sheet ahead of the result', 20_000)
  const tile = tileOf(desk)
  const waiting = { disabled: await tile.getAttribute('aria-disabled'), said: await tile.evaluate(b => document.getElementById(b.getAttribute('aria-describedby') ?? '')?.textContent ?? null) }
  const second = await crafted(desk, API, { op: 'set', value: 20, from: { value: 21 } })
  check(waiting.disabled === 'true' && waiting.said === 'Waiting for the game' && second.status === 409 && second.json?.reason === 'moving',
    `on its way, the tile waits, "Waiting for the game", and a crafted second post is answered ${second.status} ${second.json?.reason}`)
  await trayShows(desk, 'Hit points 22 → 21 · temporary 3 → 0', 'Setting it')
  check(true, `the tray's line says the change, then "Setting it…" (${await trayText(desk)})`)
  releaseResults()
  const made = await answered(1, 'the fall')
  const resultIndex = posted.findIndex(p => (p.type === 'command.result') && (p.data?.id === made.id))
  const sheetIndex = posted.findIndex(p => (p.type === 'character.updated') && (p.data?.character?.id === 'thorin') && (p.data.character.sheet?.hp?.value === 21))
  check(made.status === 'done' && sameJson(resultOf(made)?.hitPoints, { value: 21, temp: 0, max: 30 }) && (sheetIndex >= 0) && (sheetIndex < resultIndex),
    `done, the result saying the numbers now, the sheet posted ahead of it (${JSON.stringify({ result: resultOf(made), sheetIndex, resultIndex })})`)
  await trayShows(desk, 'Hit points now 21 / 30')
  check(true, 'the tray says "Hit points now 21 / 30", as the game says')
  const floating = hpLog.shown.slice(shown)
  check(floating.length === 1 && same(floating[0].changes, { hp: -1, temp: -3, total: -4 }),
    `dnd5e's floating numbers over his token, once: ${JSON.stringify(floating)}`)
  await until(async () => (await tileOf(desk).getAttribute('aria-label')) === 'Hit points: 21 of 30. Change hit points'
    && (await tileOf(desk).getAttribute('aria-disabled')) === null, 'the tile to show 21 and stop waiting', 20_000)
  check(true, 'the tile shows 21 of 30, waiting no more')
}

// =================================================================================================
// 4. Changed in the game while it's open
// =================================================================================================
part('4. changed in the game while it\'s open')
{
  await tileOf(desk).click()
  await editorOf(desk).waitFor({ timeout: 10_000 })
  await step(desk, 'One hit point fewer')
  check((await editorSays(desk)).line === '21 → 20', 'one fewer: "21 → 20"')
  await thorin.update({ 'system.attributes.hp.temp': 5 })
  await until(async () => (await editorSays(desk)).temp === '5', 'the fields to reset to the game\'s', 20_000)
  const reset = await editorSays(desk)
  check(same(reset, { value: '21', temp: '5', line: 'Changed in the game: now 21 / 30 · 5 temporary', save: 'true' }),
    `the Gamemaster gives him 5 temporary in Foundry: the fields reset, and the line says so (${JSON.stringify(reset)})`)
  await shootBoth(desk, 'hitpoints-changed', editorOf(desk))
  await editorOf(desk).getByRole('button', { name: 'Cancel', exact: true }).click()
  await editorOf(desk).waitFor({ state: 'hidden', timeout: 5_000 })
  check(commands().length === 1, 'Cancel closes it, nothing sent')
}

// =================================================================================================
// 5. A stale view, refused in the game
// =================================================================================================
part('5. a stale view')
{
  await until(async () => (await tileOf(desk).getAttribute('aria-label')) === 'Hit points: 21 of 30, 5 temporary. Change hit points', 'the tile at 21 and 5', 20_000)
  // The sheet held from the app: the page still shows 21 while the game has 15. `relay.lose` answers
  // it 400 on the app's behalf, so the module's log says the app couldn't read it, and dropped it:
  // the loss, not a bug; built the same, the refusal's sheet ahead of it isn't sent again.
  relay.lose = sent => (sent.type === 'character.updated') && (sent.data?.character?.id === 'thorin')
  await thorin.update({ 'system.attributes.hp.value': 15 })
  await wait(1500)
  check(storedHp()?.value === 21 && hpOf(thorin).value === 15, `the app still has 21, the game 15 (${JSON.stringify({ app: storedHp(), game: hpOf(thorin) })})`)
  await paced()
  await tileOf(desk).click()
  await editorOf(desk).waitFor({ timeout: 10_000 })
  await step(desk, 'One hit point fewer')
  await editorOf(desk).getByRole('button', { name: 'Save', exact: true }).click()
  const refused = await answered(2, 'the stale change')
  await trayShows(desk, 'Couldn’t set your hit points: they changed in Foundry; look again')
  check(refused.status === 'failed' && resultOf(refused)?.reason === 'changed' && same(hpOf(thorin), { value: 15, temp: 5 }) && !('hitPoints' in (resultOf(refused) ?? {})),
    `refused "changed", nothing written, no hitPoints in it: "Couldn’t set your hit points: they changed in Foundry; look again" (${JSON.stringify(resultOf(refused))})`)
  check(await tileOf(desk).getAttribute('aria-disabled') === null, 'refused, the tile waits no more, to be tried again')
  await shootBoth(desk, 'hitpoints-changed-refused', tray(desk))
  relay.lose = null
  await thorin.update({ 'system.attributes.hp.value': 14 })
  await until(async () => (await tileOf(desk).getAttribute('aria-label')) === 'Hit points: 14 of 30, 5 temporary. Change hit points', 'the tile at the game\'s numbers', 20_000)
  check(true, 'the sheet let through again, the tile shows the game\'s 14 and 5')
}

// =================================================================================================
// 6. Brakka's header tile
// =================================================================================================
part('6. a companion\'s')
{
  const thorinWas = hpOf(thorin)
  await desk.page.locator('#creature-tab-brakka').click()
  await tileOf(desk, 'brakka').waitFor({ timeout: 20_000 })
  check(await tileOf(desk, 'brakka').getAttribute('aria-label') === 'Hit points: 30 of 30. Change hit points', `Brakka's header tile: "${await tileOf(desk, 'brakka').getAttribute('aria-label')}"`)
  await paced()
  await tileOf(desk, 'brakka').click()
  await editorOf(desk).waitFor({ timeout: 10_000 })
  await step(desk, 'One hit point fewer', 4)
  await step(desk, 'One temporary hit point more', 5)
  await editorOf(desk).getByRole('button', { name: 'Save', exact: true }).click()
  const made = await answered(3, 'Brakka\'s change')
  check(made.status === 'done' && made.actorId === 'brakka' && made.ofActorId === 'thorin'
    && sameJson(made.payload.hitPoints, { op: 'set', value: 26, temp: 5, from: { value: 30, temp: 0 } })
    && same(hpOf(brakka), { value: 26, temp: 5 }) && same(hpOf(thorin), thorinWas),
  `made on Brakka, as Thorin's companion, her own actor written, Thorin's untouched (${JSON.stringify({ actorId: made.actorId, of: made.ofActorId, brakka: hpOf(brakka), thorin: hpOf(thorin) })})`)
  await paneTrayShows(desk, 'Brakka’s rolls', 'Hit points 30 → 26 · temporary 0 → 5', 'Brakka’s hit points now 26 / 30 · 5 temporary')
  check(true, 'her pane\'s tray says "Brakka’s hit points now 26 / 30 · 5 temporary"')
  await shootBoth(desk, 'hitpoints-companion', panelOf(desk, 'brakka').locator('section').first())
  await desk.page.locator('#creature-tab-self').click()
}

// =================================================================================================
// 7. Phones, the tablet, and both themes
// =================================================================================================
part('7. phones, the tablet and themes')
{
  const phone = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin', toasts: false })
  await phone.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await sheetShown(phone)
  await tileOf(phone).waitFor({ timeout: 20_000 })
  for (const [width, height] of [[390, 844], [360, 780]]) {
    await phone.page.setViewportSize({ width, height })
    phone.width = width
    await wait(400)
    await tileOf(phone).click()
    await editorOf(phone).waitFor({ timeout: 10_000 })
    const dialog = editorOf(phone)
    const steppers = await dialog.getByRole('button', { name: /^One / }).evaluateAll(all => all.map(b => Math.round(b.getBoundingClientRect().height)))
    const field = await boxOf(dialog.getByRole('textbox', { name: 'Hit points', exact: true }))
    const save = await boxOf(dialog.getByRole('button', { name: 'Save', exact: true }))
    const inside = await dialog.evaluate(el => {
      const r = el.getBoundingClientRect()
      return r.left >= 0 && r.right <= document.documentElement.clientWidth
    })
    check(await sideways(phone.page) === 0 && inside && steppers.length === 4 && steppers.every(h => h >= 40) && field.height >= 44 && save.height >= 44,
      `at ${width}, the editor fits the screen, nothing scrolls sideways, its steppers 40 px, its fields and Save 44 (${JSON.stringify({ steppers, field, save })})`)
    await shootBoth(phone, 'hitpoints-editor', dialog)
    await phone.page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden', timeout: 5_000 })
  }
  await phone.view.close()
  const tablet = await browse({ width: 768, height: 1024, path: '/characters/sheet-thorin', toasts: false })
  await tablet.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await sheetShown(tablet)
  await tileOf(tablet).waitFor({ timeout: 20_000 })
  await tileOf(tablet).click()
  await editorOf(tablet).waitFor({ timeout: 10_000 })
  const steppers = await editorOf(tablet).getByRole('button', { name: /^One / }).evaluateAll(all => all.map(b => Math.round(b.getBoundingClientRect().height)))
  check(await sideways(tablet.page) === 0 && steppers.every(h => h >= 44), `at 768, the steppers are 44 px, nothing scrolls sideways (${JSON.stringify(steppers)})`)
  await shootBoth(tablet, 'hitpoints-editor', editorOf(tablet))
  await tablet.view.close()
}

// =================================================================================================
// 8. Not others': the Gamemaster's page, and another player's seat
// =================================================================================================
part('8. not others\'')
{
  const gmSheet = await browse({ width: 1280, height: 800, path: `/campaigns/${A}/characters/thorin` })
  await gmSheet.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await panelOf(gmSheet).getByText('Hit points', { exact: true }).first().waitFor({ timeout: 20_000 })
  const offered = await tileOf(gmSheet).count()
  const posted = await crafted(gmSheet, GM_API, { op: 'set', value: 10, from: { value: 14 } })
  check(offered === 0 && posted.status === 409 && posted.json?.reason === 'unavailable',
    `at Thorin's page, the Gamemaster's tile is read-only, and hit points posted from it are answered ${posted.status} ${posted.json?.reason}`)
  await gmSheet.view.close()
  const bob = await browse({ width: 390, height: 844, who: BOB, path: '/characters/sheet-vex' })
  const theirs = await crafted(bob, API, { op: 'set', value: 10, from: { value: 14 } })
  check(theirs.status === 404 && hpOf(thorin).value === 14, `Bob, posting at Thorin's seat, is refused by its route: ${theirs.status}`)
  await bob.view.close()
}

// =================================================================================================
// 9. The campaign card, and the switch off
// =================================================================================================
part('9. the campaign card, and the switch off')
const gm = await browse({ width: 1280, height: 800, path: GM_PAGE })
const article = gm.page.getByRole('article', { name: TITLE })
const section = article.locator('section').filter({ has: gm.page.getByRole('heading', { name: "Players' hit points" }) })
{
  await section.waitFor({ timeout: 15_000 })
  const said = (await section.locator('p').allTextContents()).join(' ')
  const order = await article.locator('h3').allTextContents()
  check(said === 'On in Foundry. Your players set their characters’, forms’ and companions’ hit points and temporary hit points from here.'
    && order.indexOf("Players' hit points") === order.indexOf('Wild Shape') + 1,
  `the Gamemaster's campaign card, after Wild Shape: "${said}" (${JSON.stringify(order)})`)
  await shootBoth(gm, 'hitpoints-gm', section)
}
{
  await game.settings.set('sending-stone', 'campaigns', [campaign({ hitPoints: false })])
  await until(() => hitPointsEnabled() === 'f', 'the app to keep hit points off', 20_000)
  await until(() => hello()?.data?.features?.hitPoints?.reason === 'off', 'the hello with the switch off', 10_000).catch(() => {})
  check(same(hello().data.features.hitPoints, { enabled: false, kinds: [], reason: 'off' }), `the switch off in Foundry, the hello says hit points are off (${JSON.stringify(hello().data.features.hitPoints)})`)
  await sheetShown(desk)
  await until(async () => (await tileOf(desk).count()) === 0, 'Alice\'s tile to be read-only', 30_000)
  const shownHp = (await panelOf(desk).getByText('14', { exact: true }).count()) > 0
  const refused = await crafted(desk, API, { op: 'set', value: 10, from: { value: 14 } })
  check(shownHp && refused.status === 409 && refused.json?.reason === 'unavailable',
    `within a poll, Alice's tile is read-only, showing 14, and hit points posted are answered ${refused.status} ${refused.json?.reason}`)
  await gm.page.reload()
  await section.waitFor({ timeout: 15_000 })
  const said = (await section.locator('p').allTextContents()).join(' ')
  check(said === 'Off. To let them, tick Allow Players to change their hit points from the app on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.',
    `the Gamemaster's card: "${said}"`)
}
note(`${commands().length} hit points commands kept`)
await finish()
