// Companions' saves (module 0.41.0 and the app, its contract §3, §7.5, §8.4.2), end to end, in the
// world of world-030.mjs with scenes and tokens (fvtt/token-core.mjs). Alice plays Thorin in
// Ashlands, with Find Familiar and Summon Dragon; Brakka, a linked NPC she owns, is his companion;
// two Bats summoned from one template with Find Familiar (arena-bat1, arena-bat2); and a Draconic
// Spirit the Gamemaster summoned for Thorin with Summon Dragon, owned by no player. The hello says
// companionPrompts and the app answers companions: 2; a save card at both Bats asks each, filed under
// its key, on its own pane, its tab marked, the phone's Character tab dotted, and Thorin's own banner
// saying so, with Show, which switches to it and posts nothing; Bat 1 answers on its pane with its own
// modifier, rolled in Foundry on its token's creature as Alice; the Gamemaster answers Bat 2 from her
// page; Brakka's concentration card asked on her pane, closed when her concentration is ended from
// the app; the Spirit's whispered to the Gamemaster alone asked on Alice's Spirit pane; a Gamemaster's
// request in chat asks Thorin alone; a Bat that leaves the list has its prompt closed; Thorin's own
// seat can't answer a Bat's; every width in both themes. MIDI=1: Midi-QOL's own save of Bat 1 while
// Thorin's page is open waits, on its pane and in his notice, at 390 and 1280, and is answered there;
// with his page closed Midi rolls one its own way. DND5E6=1: dnd5e 6.0.5's dice. SKEW=040 with
// MODULE=module-0.40.0: no companionPrompts, a Bat asked nothing, a crafted answer refused.
// Synthetic characters only. Run with --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs.
// Screenshots to SHOTS.
import {
  DND5E6, MIDI, SKEW040, W, activeScene, browse, call, character, check, companion, finish, foundryWorld, launch, newCampaign,
  npc, part, place, posted, postsOf, same, sceneWorld, settled, shootBoth, sideways, sql, startModule, summoned, until, wait,
} from './world-030.mjs'

const GAME = 'https://ashlands-saves.forge-vtt.com'
const SECRET = 'ashlands-saves-41'
const TITLE = 'Ashlands'
await launch(GAME)
const { id: A } = await newCampaign({ title: TITLE, address: 'ashlands-saves.forge-vtt.com', secret: SECRET })
await foundryWorld({ dice6: DND5E6 })
const T = await sceneWorld()
game.modules.get('sending-stone').version = SKEW040 ? '0.40.0' : '0.41.0'
// What an NPC's sheet names, as dnd5e configures it (D5 config.mjs:2407-2430, actorSizes).
Object.assign(CONFIG.DND5E, {
  movementTypes: { walk: { label: 'DND5E.MOVEMENT.Type.Speed' }, fly: { label: 'DND5E.MOVEMENT.Type.Fly' } },
  movementUnits: { ft: { label: 'Feet', abbreviation: 'DND5E.DistFtAbbr' } },
  actorSizes: { tiny: { label: 'DND5E.SizeTiny' }, med: { label: 'DND5E.SizeMedium' }, lg: { label: 'DND5E.SizeLarge' } },
})
// Midi-QOL's saves on its workflow (fvtt/midi-saves.mjs), as midi-e2e has them: dnd5e's cards first,
// their saves left to their buttons and concentration to dnd5e's card, until Midi's own part.
let saves = null
if (MIDI) {
  saves = await import('./fvtt/midi-saves.mjs')
  saves.installMidiSaves({ actorClasses: [W.Actor5e], concentrationClass: W.cards.Character })
  Object.assign(W.midi.settings, { autoCheckSaves: 'none', doConcentrationCheck: 'chatOnly', requiresTargets: 'none', gmAutoFastForward: ['save'] })
}

// ---- The world ----
const summonSpell = (id, name, activity) => ({
  id, name, type: 'spell', system: { level: 1, method: 'spell', prepared: 1, canPrepare: true, properties: [], duration: { units: 'hour', value: 1 } },
  activities: [{ id: activity, type: 'summon' }],
})
const spell = (id, name) => ({
  id, name, type: 'spell', system: { level: 1, method: 'spell', properties: ['concentration'], description: { value: `<p>${name}.</p>` } },
  activities: [{ id: `${id}-use`, type: 'utility' }],
})
// Thorin, Alice's: Dexterity +1, Find Familiar and Summon Dragon.
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, dex: 1, con: 2, wis: 1 }, hp: { value: 30, max: 40, temp: 0 } }, {
  ac: 18,
  items: [summonSpell('findFamiliar', 'Find Familiar', 'ff-summon'), summonSpell('summonDragon', 'Summon Dragon', 'sd-summon')],
})
thorin.system.details = { level: 5 }
thorin.system.attributes.init.total = 1
game.users.get('alice').character = thorin
// The goblin shaman, whose Burning Hands asks the saves.
const goblin = npc('goblin', 'Goblin Shaman', 12, { dex: 1 })
const burning = { id: 'burning', name: 'Burning Hands', img: 'burning.webp', uuid: 'Actor.goblin.Item.burning' }
goblin.items.set('burning', burning)
// Each companion checks concentration as dnd5e's actors do, its tokens' creatures too, given before
// any of them is first read (fvtt/dnd5e-cards.mjs's withConcentrationChecks).
const { withConcentrationChecks, concentrationCardOf, saveCard, requestCard, deleteMessage } = W.cards
// Brakka, a sidekick: linked, Alice's by name, with Bless to concentrate on.
const brakka = withConcentrationChecks(companion('brakka', 'Brakka', {
  owners: ['alice'], linked: true, ac: 14, gear: { items: [spell('bless', 'Bless')] },
  npc: {
    spec: { mods: { str: 3, dex: 1, con: 2 }, prof: 2, hp: { value: 30, max: 30, temp: 0 } },
    system: { traits: { important: true, size: 'med' }, details: { cr: 2, type: { value: 'humanoid', label: 'Humanoid' }, alignment: 'Neutral' }, attributes: { movement: { walk: 30, units: 'ft' }, init: { total: 1 } } },
  },
}))
// The Bat, Find Familiar's template, auto-imported: Dexterity +2, its save its own.
const bat = withConcentrationChecks(companion('bat', 'Bat', {
  owners: ['alice'], linked: false, ac: 12,
  npc: {
    flags: { dnd5e: { isAutoImported: true } },
    spec: { mods: { dex: 2, wis: 1 }, prof: 2, hp: { value: 4, max: 4, temp: 0 } },
    system: { traits: { size: 'tiny' }, details: { cr: 0, type: { value: 'beast', label: 'Beast' }, alignment: 'Unaligned' }, attributes: { movement: { walk: 5, fly: 30, units: 'ft' }, init: { total: 2 } } },
  },
}))
// The Draconic Spirit, Summon Dragon's, owned by no player, with Hold Monster to concentrate on.
const draconic = withConcentrationChecks(companion('draconic', 'Draconic Spirit', {
  linked: false, ac: 16, gear: { items: [spell('hold', 'Hold Monster')] },
  npc: {
    spec: { mods: { str: 4, dex: 1, con: 3 }, prof: null, hp: { value: 50, max: 50, temp: 0 } },
    system: { traits: { size: 'lg' }, details: { cr: null, type: { value: 'dragon', label: 'Dragon' }, alignment: 'Neutral' }, attributes: { movement: { walk: 30, fly: 60, units: 'ft' }, init: { total: 1 } } },
  },
}))
const arena = await activeScene('arena')
const tokenOf = {}
for (const actor of [thorin, goblin, brakka]) tokenOf[actor.id] = await place(arena, actor, { id: `tok-${actor.id}`, actorLink: true, tell: false })
brakka.speakerToken = tokenOf.brakka
const bat1 = await summoned(arena, bat, thorin, 'findFamiliar', { id: 'bat1', name: 'Bat', activity: 'ff-summon', tell: false })
const bat2 = await summoned(arena, bat, thorin, 'findFamiliar', { id: 'bat2', name: 'Bat', activity: 'ff-summon', tell: false })
const spirit1 = await summoned(arena, draconic, thorin, 'summonDragon', { id: 'spirit1', name: 'Draconic Spirit', activity: 'sd-summon', tell: false })
const BAT1 = 'arena-bat1'
const BAT2 = 'arena-bat2'
const SPIRIT = 'arena-spirit1'
W.gm.targets = new Set()
const campaign = { id: 'camp-ash', title: TITLE, characters: ['thorin'], groups: [], rolls: true, attacks: true, prompts: true }
await startModule({ campaigns: [campaign], secrets: { 'camp-ash': SECRET } })
await settled()

// ---- What's posted, kept and made ----
const hello = () => postsOf('bridge.hello').at(-1)
const features = () => sql(`select array_to_string("rollFeatures", ',') from campaign where id = '${A}'`).split(',')
const requests = () => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}'`))
const rollRow = id => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, role, "actorId", payload, result from roll_request ${id ? `where id = '${id}'` : `where "campaignId" = '${A}' order by "createdAt" desc limit 1`}) r`) || 'null')
const rowsSince = count => JSON.parse(sql(`select coalesce(json_agg(r order by r."createdAt")::text, '[]') from (select id, kind, status, role, "actorId", payload, result, "createdAt" from roll_request where "campaignId" = '${A}' order by "createdAt" offset ${count}) r`))
/** The prompts the app keeps of a card, or of a Midi key: id, whose, and whether and why closed. */
const promptsOf = prefix => JSON.parse(sql(`select coalesce(json_agg(p order by p.id)::text, '[]') from (select "promptId" as id, "actorId", "closedAt" is not null as closed, "closedReason" as reason from roll_prompt where "campaignId" = '${A}' and "promptId" like '${prefix}-%') p`))
const promptRow = id => JSON.parse(sql(`select row_to_json(p)::text from (select "promptId" as id, "actorId", "closedAt" is not null as closed, "closedReason" as reason from roll_prompt where "campaignId" = '${A}' and "promptId" = '${id}') p`) || 'null')
const madeFor = id => W.messages.contents.find(m => m.flags?.['sending-stone']?.request === id)
const opened = () => postsOf('roll.prompt.opened').map(p => p.data.prompt)
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
/** Every answer to the module's fetches of its commands, parsed, oldest first; and who the app last said is open. */
const fetchAnswers = () => posted.filter(p => (p.type === 'fetch') && (p.status === 200) && p.url.endsWith('/api/bridge/commands'))
  .flatMap(p => { try { return [JSON.parse(p.body)] } catch { return [] } })
const lastOpen = () => fetchAnswers().at(-1)?.open
/** A save card of the goblin shaman's Burning Hands at these creatures. */
const saveAt = (...targets) => saveCard({ by: goblin, item: burning, dc: 13, abilities: ['dex'], targets: targets.map(token => token.actor) })

sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const API = '/api/characters/sheet-thorin'
const companionApi = key => `${API}/companions/${key}`
// Alice at 1280 and on her phone at 390, both at Thorin's page.
const alice = await browse({ width: 1280, height: 800, path: '/characters/sheet-thorin', toasts: false })
await alice.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const phone = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin', toasts: false })
await phone.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
/** The POSTs each page makes of its rolls. */
const sentBy = new Map()
const watchPosts = who => {
  sentBy.set(who, [])
  who.page.on('request', request => { if (request.method() === 'POST' && /\/rolls$/.test(request.url())) sentBy.get(who).push(request.url()) })
}
watchPosts(alice)
watchPosts(phone)

const SWITCHER = 'Character and companions'
const switcher = who => who.page.getByRole('tablist', { name: SWITCHER })
const tabOf = (who, key) => who.page.locator(`#creature-tab-${key}`)
const panelOf = (who, key) => who.page.locator(`#creature-panel-${key}`)
const tabNames = who => switcher(who).getByRole('tab').evaluateAll(tabs => tabs.map(tab => tab.getAttribute('aria-label')))
async function choose(who, key) {
  await tabOf(who, key).click()
  await until(async () => (await tabOf(who, key).getAttribute('aria-selected')) === 'true', `${key} chosen`, 5_000)
}
const ASKS = ', your Gamemaster asks for a roll'
const GM_ASKS = ', your game asks for a roll'
/** A pane's banner of what the game asks: the player's words, or the Gamemaster's. */
const bannerOf = (who, key, words = 'Your Gamemaster asks') => panelOf(who, key).getByRole('region', { name: words })
/** Thorin's banner's notice of the companions asked: each row's words. */
const noticeOf = who => bannerOf(who, 'self').getByRole('list', { name: 'Companions asked' })
const noticeRows = who => noticeOf(who).getByRole('listitem').evaluateAll(items => items.map(li => li.querySelector('p')?.textContent.replace(/\s+/g, ' ').trim()))

if (SKEW040) {
  // =================================================================================================
  // 12. Module 0.40.0
  // =================================================================================================
  part('12. module 0.40.0')
  const rolls = hello().data.features.rolls
  check(rolls.prompts === true && !('companionPrompts' in rolls) && !features().includes('companionPrompts'),
    `module 0.40.0's hello asks its players for their saves and says nothing of companions' (${JSON.stringify(Object.keys(rolls))}; ${features().join(',')})`)
  check(JSON.parse(hello().body ?? '{}').features?.companions === 2, `the app answers companions: 2 all the same (${hello().body})`)
  await switcher(alice).waitFor({ timeout: 20_000 })
  await until(async () => (await tabNames(alice)).length === 5, 'five tabs', 30_000)
  const card = await saveAt(bat1)
  await settled()
  await wait(4000)
  check(same(promptsOf(card.id), []) && !opened().some(prompt => prompt.messageId === card.id),
    `a save card at Bat 1 asks nothing in the app: no prompt kept (${JSON.stringify(promptsOf(card.id))})`)
  check(same(await tabNames(alice), ['Thorin', 'Brakka', 'Bat 1', 'Bat 2', 'Draconic Spirit']) && await noticeOf(alice).count() === 0,
    `no tab marked, no notice on Thorin's banner (${JSON.stringify(await tabNames(alice))})`)
  await paced()
  const crafted = await call(alice.page, `${companionApi(BAT1)}/rolls`, { method: 'POST', body: { kind: 'save', key: 'dex', prompt: `${card.id}-bat1`, mode: 0, explicit: false, extras: [], dice: [{ faces: 20, results: [12] }] } })
  check(crafted.status === 422 && crafted.json?.reason === 'prompt', `a crafted answer as Bat 1 to that card → 422 prompt (${crafted.status} ${crafted.text})`)
  check(await sideways(phone.page) === 0, 'no horizontal scroll at 390')
  await finish()
}

// =================================================================================================
// 1. The hello and the answer
// =================================================================================================
part('1. the hello and the answer')
{
  const data = hello().data
  const rolls = data.features.rolls
  const keys = Object.keys(rolls)
  // Changed on purpose (round 0.42.0 §8.5): module 0.42.0's effectDice and keptRerolls come after
  // it, the last of v0.41's flags.
  check(rolls.companionPrompts === true && rolls.prompts === true && same(keys.slice(keys.indexOf('companionPrompts')), ['companionPrompts', 'effectDice', 'keptRerolls']),
    `features.rolls.companionPrompts true, as prompts is, and last of module 0.41.0's, only 0.42.0's effectDice and keptRerolls after it (${JSON.stringify(keys)})`)
  check(JSON.parse(hello().body ?? '{}').features?.companions === 2, `the app answers companions: 2 (${hello().body})`)
  await until(() => features().includes('companionPrompts'), 'the app to keep companionPrompts', 15_000).catch(() => {})
  check(features().includes('companionPrompts'), `the app keeps companionPrompts (${features().join(',')})`)
  check(same((data.companions ?? []).map(c => c.key), ['brakka', BAT1, BAT2, SPIRIT]), `the hello lists Brakka, both Bats and the Spirit (${JSON.stringify((data.companions ?? []).map(c => c.key))})`)
}
await switcher(alice).waitFor({ timeout: 20_000 })
await until(async () => (await tabNames(alice)).length === 5, 'five tabs', 30_000)

// =================================================================================================
// 2. A save card at both Bats
// =================================================================================================
part('2. a save card at both bats')
const both = await saveAt(bat1, bat2)
const BAT1_PROMPT = `${both.id}-bat1`
const BAT2_PROMPT = `${both.id}-bat2`
await until(() => promptsOf(both.id).length === 2, 'both Bats asked', 20_000).catch(() => {})
check(same(promptsOf(both.id).map(p => [p.id, p.actorId, p.closed]), [[BAT1_PROMPT, BAT1, false], [BAT2_PROMPT, BAT2, false]]),
  `the app keeps two prompts, ${BAT1_PROMPT} under ${BAT1} and ${BAT2_PROMPT} under ${BAT2} (${JSON.stringify(promptsOf(both.id))})`)
await until(async () => (await tabNames(alice)).filter(name => name.endsWith(ASKS)).length === 2, 'both Bats\' tabs marked', 30_000).catch(() => {})
check(same(await tabNames(alice), ['Thorin', 'Brakka', `Bat 1${ASKS}`, `Bat 2${ASKS}`, 'Draconic Spirit']),
  `Thorin's tab unmarked; the Bats' named "Bat 1${ASKS}" and "Bat 2${ASKS}" (${JSON.stringify(await tabNames(alice))})`)
for (const who of [alice, phone]) {
  await noticeOf(who).waitFor({ timeout: 30_000 })
  await until(async () => (await noticeRows(who)).length === 2, 'both rows of the notice', 15_000).catch(() => {})
  const rows = await noticeRows(who)
  check(same(rows, ['Bat 1 is asked for a Dexterity saving throw', 'Bat 2 is asked for a Dexterity saving throw'])
    && await noticeOf(who).getByRole('button', { name: 'Show Bat 1' }).count() === 1 && await noticeOf(who).getByRole('button', { name: 'Show Bat 2' }).count() === 1,
    `at ${who.width} Thorin's banner, though he's asked nothing, says "Bat 1 is asked for a Dexterity saving throw" and Bat 2's, each with Show (${JSON.stringify(rows)})`)
  check(await bannerOf(who, 'self').locator('button').filter({ hasText: /^Roll / }).count() === 0, `at ${who.width} and offers no roll of the Bats' on Thorin's own banner`)
  await shootBoth(who, 'companionsaves-notice', bannerOf(who, 'self'))
}
// The phone's Character tab, dotted while another tab shows.
{
  await phone.chat()
  const dotted = phone.nav.getByRole('button', { name: `Character ${ASKS}` })
  await dotted.waitFor({ timeout: 15_000 }).catch(() => {})
  check(await dotted.count() === 1, `at 390 on the Chat tab, the Character tab is dotted: "Character ${ASKS}"`)
  await phone.character()
}

// =================================================================================================
// 3. Show
// =================================================================================================
part('3. show')
{
  const posts = sentBy.get(alice).length
  const before = requests()
  await noticeOf(alice).getByRole('button', { name: 'Show Bat 1' }).click()
  await until(async () => (await tabOf(alice, BAT1).getAttribute('aria-selected')) === 'true', 'Bat 1 chosen', 5_000).catch(() => {})
  const focused = await alice.page.evaluate(() => document.activeElement?.id ?? null)
  await wait(1000)
  check(await tabOf(alice, BAT1).getAttribute('aria-selected') === 'true' && focused === `creature-tab-${BAT1}` && sentBy.get(alice).length === posts && requests() === before,
    `Show Bat 1: Bat 1's tab chosen, focus on it (${focused}), nothing posted`)
}

// =================================================================================================
// 10. A crafted answer (while Bat 1's prompt is open)
// =================================================================================================
part('10. a crafted answer')
{
  await paced()
  const crafted = await call(alice.page, `${API}/rolls`, { method: 'POST', body: { kind: 'save', key: 'dex', prompt: BAT1_PROMPT, mode: 0, explicit: false, extras: [], dice: [{ faces: 20, results: [12] }] } })
  check(crafted.status === 422 && crafted.json?.reason === 'prompt' && promptRow(BAT1_PROMPT)?.closed === false,
    `Thorin's own seat answering Bat 1's prompt → 422 prompt, the prompt still open (${crafted.status} ${crafted.text})`)
}

// =================================================================================================
// 4. Bat 1 answers
// =================================================================================================
part('4. bat 1 answers')
{
  const banner = bannerOf(alice, BAT1)
  await banner.waitFor({ timeout: 30_000 })
  const text = (await banner.textContent()).replace(/\s+/g, ' ')
  const button = banner.getByRole('button', { name: /^Roll Dexterity saving throw/ })
  const name = await button.getAttribute('aria-label') ?? (await button.textContent()).trim()
  check(/Dexterity saving throw/.test(text) && /Burning Hands/.test(text) && await button.count() === 1 && /\+2$/.test(name),
    `Bat 1's pane: its banner "Your Gamemaster asks", the save with Bat 1's own Dexterity, "${name}" ("${text}")`)
  check(await alice.page.locator(`#creature-${BAT1}-prompts-heading`).count() === 1, `its banner's heading its own pane's, creature-${BAT1}-prompts-heading`)
  await shootBoth(alice, 'companionsaves-banner', banner)
  await force(alice, 20, 14)
  const { request, made } = await sent(() => button.click(), "Bat 1's save")
  await unforce(alice)
  const message = madeFor(request.id)
  check(request.kind === 'save' && request.actorId === BAT1 && request.payload.prompt === BAT1_PROMPT && request.payload.key === 'dex' && made.status === 'done',
    `sent through Bat 1's own route, answering its prompt (${JSON.stringify({ actorId: request.actorId, payload: request.payload })})`)
  check(message?.speaker?.token === 'bat1' && message.author?.id === 'alice' && message.flags['sending-stone']?.companion === BAT1
    && message.flags.dnd5e?.originatingMessage === both.id && message.rolls[0].total === 16,
    `in Foundry the save on Bat 1's token's creature, authored by Alice, flagged companion, on the card, 14 + 2 (${JSON.stringify({ speaker: message?.speaker, author: message?.author?.id, flags: message?.flags?.['sending-stone'], total: message?.rolls?.[0]?.total })})`)
  await until(() => promptRow(BAT1_PROMPT)?.closed, 'Bat 1\'s prompt to close', 15_000).catch(() => {})
  check(promptRow(BAT1_PROMPT)?.reason === 'answered' && promptRow(BAT2_PROMPT)?.closed === false, `Bat 1's prompt closed answered; Bat 2's open (${JSON.stringify(promptsOf(both.id))})`)
  await banner.waitFor({ state: 'detached', timeout: 30_000 }).catch(() => {})
  check(await banner.count() === 0, 'Bat 1\'s banner gone')
  await until(async () => (await tabNames(alice))[2] === 'Bat 1', 'Bat 1\'s tab unmarked', 30_000).catch(() => {})
  check(same(await tabNames(alice), ['Thorin', 'Brakka', 'Bat 1', `Bat 2${ASKS}`, 'Draconic Spirit']), `Bat 1's tab unmarked, Bat 2's still (${JSON.stringify(await tabNames(alice))})`)
  await choose(alice, 'self')
  await until(async () => (await noticeRows(alice)).length === 1, 'the notice to list Bat 2 alone', 30_000).catch(() => {})
  check(same(await noticeRows(alice), ['Bat 2 is asked for a Dexterity saving throw']), `Thorin's notice lists Bat 2 alone (${JSON.stringify(await noticeRows(alice))})`)
}

// =================================================================================================
// 5. The Gamemaster answers Bat 2
// =================================================================================================
part('5. the gamemaster answers bat 2')
{
  const gm = await browse({ width: 1280, height: 800, path: `/campaigns/${A}/characters/thorin`, toasts: false })
  await switcher(gm).waitFor({ timeout: 20_000 })
  await until(async () => (await tabNames(gm)).includes(`Bat 2${GM_ASKS}`), 'the Gamemaster\'s Bat 2 tab marked', 30_000).catch(() => {})
  check((await tabNames(gm)).includes(`Bat 2${GM_ASKS}`), `at the Gamemaster's page Bat 2's tab is "Bat 2${GM_ASKS}" (${JSON.stringify(await tabNames(gm))})`)
  await choose(gm, BAT2)
  const banner = bannerOf(gm, BAT2, 'Your game asks')
  await banner.waitFor({ timeout: 30_000 })
  const button = banner.getByRole('button', { name: /^Roll Dexterity saving throw/ })
  check(await button.count() === 1, 'Bat 2\'s pane at the Gamemaster\'s page: "Your game asks", its save')
  const { request, made } = await sent(() => button.click(), "the Gamemaster's answer for Bat 2")
  const message = madeFor(request.id)
  check(request.role === 'gm' && request.actorId === BAT2 && request.payload.prompt === BAT2_PROMPT && made.status === 'done'
    && message?.flags['sending-stone']?.by === 'gm' && message.flags['sending-stone']?.companion === BAT2 && message.speaker?.token === 'bat2',
    `answered as the Gamemaster, the save on Bat 2's token's creature flagged by: "gm" (${JSON.stringify(message?.flags?.['sending-stone'])})`)
  await until(() => promptRow(BAT2_PROMPT)?.closed, 'Bat 2\'s prompt to close', 15_000).catch(() => {})
  check(promptRow(BAT2_PROMPT)?.reason === 'answered', 'Bat 2\'s prompt closed answered')
  await until(async () => (await noticeOf(alice).count()) === 0, 'Thorin\'s notice to go', 30_000).catch(() => {})
  check(await noticeOf(alice).count() === 0 && await bannerOf(alice, 'self').count() === 0, 'Thorin\'s banner gone with the last of them')
  await gm.view.close()
  await deleteMessage(both)
}

// =================================================================================================
// 6. Brakka's concentration card
// =================================================================================================
part('6. brakka\'s concentration card')
{
  const effect = await brakka.beginConcentrating({ id: 'bless-use', item: brakka.items.get('bless') })
  // Its id as Foundry makes one, sixteen letters and digits, which the app takes an effect's to be:
  // the stand-in's own (activity5e.mjs's equip) names it after its activity.
  brakka.concentration.effects.delete(effect.id)
  effect.id = 'blessConcBrakka1'
  brakka.concentration.effects.set(effect.id, effect)
  await Hooks.callAll('createActiveEffect', effect, {}, 'gm')
  const card = await concentrationCardOf(brakka, { dc: 12 })
  const id = `${card.id}-brakka`
  await until(() => promptRow(id), 'Brakka\'s prompt', 20_000).catch(() => {})
  check(promptRow(id)?.actorId === 'brakka' && promptRow(id)?.closed === false, `her concentration card asks her, ${id} under brakka (${JSON.stringify(promptRow(id))})`)
  await choose(alice, 'brakka')
  const banner = bannerOf(alice, 'brakka')
  await banner.waitFor({ timeout: 30_000 })
  const text = (await banner.textContent()).replace(/\s+/g, ' ')
  check(/Concentration check/.test(text) && /Bless/.test(text), `on her pane's banner, "${text}"`)
  // Her concentration as the app has it, before it's ended from there.
  await until(async () => (await call(alice.page, `${companionApi('brakka')}/table`)).json?.sheet?.concentration?.effects?.some(each => each.id === effect.id),
    'the app to have her concentrating', 20_000).catch(() => {})
  await paced()
  const ended = await call(alice.page, `${companionApi('brakka')}/rolls`, { method: 'POST', body: { kind: 'endConcentration', concentration: { effect: effect.id }, mode: 0, explicit: false, extras: [], dice: [] } })
  check(ended.status === 202, `End concentration from the app, as Brakka (${ended.status} ${ended.text})`)
  await until(() => promptRow(id)?.closed, 'her prompt to close', 30_000).catch(() => {})
  check(promptRow(id)?.reason === 'gone' && !brakka.concentration?.effects?.size, `her concentration ended, the prompt closed gone (${JSON.stringify(promptRow(id))})`)
  await banner.waitFor({ state: 'detached', timeout: 30_000 }).catch(() => {})
  check(await banner.count() === 0, 'her banner gone')
  await deleteMessage(card)
}

// =================================================================================================
// 7. The Spirit's concentration card
// =================================================================================================
part('7. the spirit\'s concentration card')
{
  const spirit = spirit1.actor
  await spirit.beginConcentrating({ id: 'hold-use', item: spirit.items.get('hold') })
  const card = await concentrationCardOf(spirit, { dc: 12 })
  const id = `${card.id}-spirit1`
  await until(() => promptRow(id), 'the Spirit\'s prompt', 20_000).catch(() => {})
  check(same(card.whisper, ['gm']) && promptRow(id)?.actorId === SPIRIT && promptRow(id)?.closed === false,
    `its card whispered to the Gamemaster alone asks it, ${id} under ${SPIRIT} (${JSON.stringify({ whisper: card.whisper, row: promptRow(id) })})`)
  await choose(alice, SPIRIT)
  const banner = bannerOf(alice, SPIRIT)
  await banner.waitFor({ timeout: 30_000 })
  const text = (await banner.textContent()).replace(/\s+/g, ' ')
  check(/Concentration check/.test(text) && /Hold Monster/.test(text) && await banner.getByRole('button', { name: /^Roll Concentration/ }).count() >= 1,
    `asked on Alice's Spirit pane: "${text}"`)
  await deleteMessage(card)
  await until(() => promptRow(id)?.closed, 'its prompt to close with its card', 15_000).catch(() => {})
  await choose(alice, 'self')
}

// =================================================================================================
// 8. A Gamemaster's request in chat
// =================================================================================================
part('8. a gamemaster\'s request in chat')
{
  const card = await requestCard({ abilities: ['dex'], dc: 13 })
  await until(() => promptRow(`${card.id}-thorin`), 'Thorin\'s prompt', 20_000).catch(() => {})
  const banner = bannerOf(alice, 'self')
  await banner.waitFor({ timeout: 30_000 })
  check(same(promptsOf(card.id).map(p => p.actorId), ['thorin']) && await banner.getByRole('button', { name: /^Roll Dexterity saving throw/ }).count() === 1 && await noticeOf(alice).count() === 0,
    `asks Thorin alone, on his own banner, no companion (${JSON.stringify(promptsOf(card.id))})`)
  await deleteMessage(card)
  await banner.waitFor({ state: 'detached', timeout: 30_000 }).catch(() => {})
}

// =================================================================================================
// 9. Leaving
// =================================================================================================
part('9. leaving')
{
  const card = await saveAt(bat2)
  const id = `${card.id}-bat2`
  await until(async () => (await noticeRows(alice)).length === 1, 'Bat 2 in the notice', 30_000).catch(() => {})
  check(same(await noticeRows(alice), ['Bat 2 is asked for a Dexterity saving throw']), `Bat 2 asked again (${JSON.stringify(await noticeRows(alice))})`)
  await bat2.delete()
  await until(() => promptRow(id)?.closed, 'Bat 2\'s prompt to close', 30_000).catch(() => {})
  check(promptRow(id)?.reason === 'gone', `its token deleted while asked: its prompt closed gone (${JSON.stringify(promptRow(id))})`)
  await until(async () => (await noticeOf(alice).count()) === 0, 'the notice without it', 30_000).catch(() => {})
  const names = await tabNames(alice)
  check(await noticeOf(alice).count() === 0 && !names.some(name => name.endsWith(ASKS)), `within a poll the notice without it, no tab marked (${JSON.stringify(names)})`)
  await deleteMessage(card)
}

// =================================================================================================
// Midi-QOL's own save (MIDI=1)
// =================================================================================================
if (MIDI) {
  part('11b. midi-qol\'s own save')
  const { midiSaves, saveWorkflow, runSaves, saveActivity } = saves
  Object.assign(W.midi.settings, { autoCheckSaves: 'allShow' })
  let spells = 0
  const hold = target => {
    const slug = `spell${++spells}`
    const item = { id: slug, name: 'Hold Person', type: 'spell', uuid: `Actor.goblin.Item.${slug}`, flags: {}, system: { description: { value: '' } } }
    return saveWorkflow({ actor: goblin, item, activity: saveActivity({ item, abilities: ['dex'], dc: 14 }), targets: [target] })
  }
  await until(() => lastOpen()?.includes('thorin'), 'the module to hear Thorin is open', 45_000)
  const count = opened().length
  const queued = midiSaves.queued.length
  const workflow = await hold(bat1.object)
  const running = runSaves(workflow)
  await until(() => opened().length > count, 'Midi\'s prompt', 20_000)
  const prompt = opened()[count]
  check(/^[A-Za-z0-9]{1,64}-bat1$/.test(prompt.id) && prompt.actorId === BAT1 && prompt.source === 'midi' && same(prompt.abilities, ['dex']),
    `Midi's save of Bat 1 while Thorin's page is open: asked, ${prompt.id} under ${BAT1} (${JSON.stringify(prompt)})`)
  for (const who of [alice, phone]) {
    await until(async () => (await noticeRows(who)).length === 1, `the notice at ${who.width}`, 30_000).catch(() => {})
    check(same(await noticeRows(who), ['Bat 1 is asked for a Dexterity saving throw']), `at ${who.width} Thorin's notice says so (${JSON.stringify(await noticeRows(who))})`)
    await shootBoth(who, 'companionsaves-midi-notice', bannerOf(who, 'self'))
    await choose(who, BAT1)
    const banner = bannerOf(who, BAT1)
    await banner.waitFor({ timeout: 30_000 })
    const text = (await banner.textContent()).replace(/\s+/g, ' ')
    check(/Hold Person/.test(text) && await banner.getByRole('button', { name: /^Roll Dexterity saving throw/ }).count() === 1, `at ${who.width} on Bat 1's pane, Midi's waiting save: "${text}"`)
    await shootBoth(who, 'companionsaves-midi-banner', banner)
  }
  check(midiSaves.queued.length === queued, 'meanwhile Midi\'s own request waits on the app')
  await force(alice, 20, 15)
  const { request, made } = await sent(() => bannerOf(alice, BAT1).getByRole('button', { name: /^Roll Dexterity saving throw/ }).click(), "Bat 1's answer to Midi")
  await unforce(alice)
  await running
  const processed = midiSaves.processed.find(each => each.workflow === workflow)
  check(request.actorId === BAT1 && request.payload.prompt === prompt.id && made.status === 'done' && processed?.results?.[0]?.[0]?.dice?.[0]?.results?.map(r => r.result).join() === '15'
    && (workflow.saves.has(bat1.object) || workflow.failedSaves.has(bat1.object)) && midiSaves.queued.length === queued,
    `answered from Bat 1's pane, Midi takes Alice's 15 as Bat 1's save, its own request never made (${JSON.stringify(made.result?.rolls?.[0] ?? null)})`)
  for (const who of [alice, phone]) await choose(who, 'self')
  // Thorin's pages closed: Midi rolls the next its own way, at once.
  await alice.view.close()
  await phone.view.close()
  await until(() => lastOpen() && !lastOpen().includes('thorin'), 'the app to tell the module Thorin is no longer open', 45_000)
  const again = opened().length
  const started = Date.now()
  const second = await hold(bat1.object)
  await runSaves(second)
  check(midiSaves.queued.length === queued + 1 && opened().length === again && Date.now() - started < 3_000,
    `Thorin's pages closed, Midi's next save of Bat 1 is its own, at once, nothing asked (${Date.now() - started} ms)`)
  await finish()
}

// =================================================================================================
// 11. Widths and themes
// =================================================================================================
part('11. widths and themes')
if (!DND5E6) {
  const card = await saveAt(bat1)
  await until(async () => (await noticeRows(alice)).length === 1, 'Bat 1 asked again', 30_000).catch(() => {})
  for (const [width, height] of [[360, 780], [390, 844], [1280, 800]]) {
    const view = width === 1280 ? alice : (width === 390 ? phone : await browse({ width, height, path: '/characters/sheet-thorin', toasts: false }))
    await view.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
    await noticeOf(view).waitFor({ timeout: 30_000 })
    const look = await noticeOf(view).evaluate(list => [...list.querySelectorAll('button')].map(b => { const r = b.getBoundingClientRect(); return { right: r.right, height: r.height } }))
    const least = width < 640 ? 44 : 36
    check(await sideways(view.page) === 0 && look.every(b => b.right <= width && b.height >= least),
      `at ${width} nothing sideways, the notice's Show ${least} px tall or more and in view (${JSON.stringify(look)})`)
    await shootBoth(view, 'companionsaves-notice', bannerOf(view, 'self'))
    await choose(view, BAT1)
    const banner = bannerOf(view, BAT1)
    await banner.waitFor({ timeout: 30_000 })
    check(await sideways(view.page) === 0, `at ${width} Bat 1's banner, nothing sideways`)
    await shootBoth(view, 'companionsaves-banner', banner)
    await choose(view, 'self')
    if (width === 360) await view.view.close()
  }
  await deleteMessage(card)
}

await finish()
