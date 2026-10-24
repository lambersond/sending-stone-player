// End Turn (module 0.36.0 and the app, its contract §2.8, §5.5, §6.13, §13.8, §19), end to end, in
// the world of world-030.mjs with scenes and tokens (fvtt/token-core.mjs): the steps that need no
// End Turn screen. Its button, the Combat tab's hold and fill, and the turn toast (§8.11) wait for
// the user's prototype (decisions Q 13), and their steps (§13.8 steps 2-4, 7-13, 16-17, 19-20, 22-23)
// with them; the module's endTurn through the app's request path is covered by jest and the
// harness besides. Here, through the routes a page posts to: Alice plays Thorin, with Brakka (owned,
// linked) and a Bat the Gamemaster summoned with Thorin's Find Familiar; Bob plays Vex, with his own
// wolf; a goblin; a fight started at round 1 on Thorin (Thorin 20, Brakka 18, the Bat 15, the
// goblin 12, Vex 10, the wolf 8), moved as Foundry's Next Turn moves it. The hello takes `endTurn`
// and a companion's kinds don't; Thorin's turn ended from Alice's seat, then Brakka's, Foundry's turn
// moving on once each; Bob may not end Brakka's; a turn already over is refused `moved`; two ends of
// the Bat's turn at once end it once; the Gamemaster's page and a companion's route refuse it (409);
// a turn rewound is ended again. MIDI=1 and DND5E6=1: the same. SKEW=035 with
// MODULE=module-0.35.0: no endTurn in the hello, and the app refuses one. Synthetic characters
// only. Run with --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs.
import {
  BOB, SKEW035, W, activeScene, actors, browse, call, character, check, companion, finish, foundryWorld, launch,
  newCampaign, note, npc, part, place, postsOf, same, sceneWorld, settled, sql, startModule, summoned, until, wait,
} from './world-030.mjs'

const GAME = 'https://ashlands-turns.forge-vtt.com'
const SECRET = 'ashlands-endturn-36'
const TITLE = 'Ashlands'
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: TITLE, address: 'ashlands-turns.forge-vtt.com', secret: SECRET })
await foundryWorld()
const T = await sceneWorld()
game.modules.get('sending-stone').version = SKEW035 ? '0.35.0' : '0.36.0'

// ---- The world ----
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, dex: 2 }, hp: { value: 30, max: 40, temp: 0 } }, {
  ac: 18, items: [{ id: 'findFamiliar', name: 'Find Familiar', type: 'spell', system: { level: 1, method: 'spell', properties: [] }, activities: [{ id: 'ffSummon', type: 'summon' }] }],
})
thorin.system.details = { level: 5 }
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { dex: 3 }, hp: { value: 24, max: 30, temp: 0 } }, { ac: 14, items: [] })
vex.system.details = { level: 5 }
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
const goblin = npc('goblin', 'Goblin', 12, { dex: 1 })
const brakka = companion('brakka', 'Brakka', { owners: ['alice'], linked: true, ac: 14, npc: { spec: { mods: { str: 3, dex: 1 }, hp: { value: 30, max: 30, temp: 0 } }, system: { details: { cr: 2, type: { value: 'humanoid', label: 'Humanoid' } } } } })
const wolf = companion('wolf', 'Wolf', { owners: ['bob'], linked: true, ac: 13, npc: { spec: { mods: { dex: 2 }, hp: { value: 11, max: 11, temp: 0 } }, system: { details: { cr: 0.25, type: { value: 'beast', label: 'Beast' } } } } })
const bat = companion('bat', 'Bat', { linked: false, ac: 12, npc: { flags: { dnd5e: { isAutoImported: true } }, spec: { mods: { dex: 2 }, hp: { value: 1, max: 1, temp: 0 } } } })
const arena = await activeScene('arena')
const tokenOf = {}
for (const actor of [thorin, vex, goblin, brakka, wolf]) tokenOf[actor.id] = await place(arena, actor, { id: `tok${actor.id}`, actorLink: true, tell: false })
const bat1 = await summoned(arena, bat, thorin, 'findFamiliar', { id: 'bat1', name: 'Bat', activity: 'ffSummon', tell: false })
Object.defineProperty(actors, 'party', { get: () => null, configurable: true })
W.gm.targets = new Set()
await startModule({ campaigns: [{ id: 'camp-ash', title: TITLE, characters: ['thorin', 'vex'], groups: [], rolls: true, attacks: true }], secrets: { 'camp-ash': SECRET } })
await settled()
const fight = T.combatOf('fight', [
  { id: 'cbThorin', actor: thorin, token: tokenOf.thorin, fields: { name: 'Thorin', initiative: 20 } },
  { id: 'cbBrakka', actor: brakka, token: tokenOf.brakka, fields: { name: 'Brakka', initiative: 18 } },
  { id: 'cbBat', token: bat1, fields: { name: 'Bat', initiative: 15 } },
  { id: 'cbGoblin', actor: goblin, token: tokenOf.goblin, fields: { name: 'Goblin', initiative: 12 } },
  { id: 'cbVex', actor: vex, token: tokenOf.vex, fields: { name: 'Vex', initiative: 10 } },
  { id: 'cbWolf', actor: wolf, token: tokenOf.wolf, fields: { name: 'Wolf', initiative: 8 } },
])
fight.round = 1
fight.turn = 0
Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight') ?? null, configurable: true })
await Hooks.callAll('createCombat', fight)
await until(() => sql('select count(*) from combat') === '1', 'the app to hear of the fight', 15_000)

// ---- The seats ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const API = '/api/characters/sheet-thorin'
const alice = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin', toasts: false })
await alice.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const bob = await browse({ width: 390, height: 844, who: BOB, toasts: false })
await bob.page.goto(invite)
await bob.page.getByRole('radio', { name: /^Vex/ }).check()
await bob.page.getByRole('button', { name: 'Join as this character' }).click()
await bob.page.waitForURL(/\/characters\/[\w-]+$/)
await bob.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const BOB_API = `/api/characters/${sql(`select id from "character" where "actorId" = 'vex' and "campaignId" = '${A}'`)}`

const hello = () => postsOf('bridge.hello').at(-1)
const current = () => fight.combatant?.id ?? null
const turnOf = combatantId => ({ combatId: 'fight', round: fight.round, combatantId })
const endTurn = (who, api, turn) => call(who.page, `${api}/rolls`, { method: 'POST', body: { kind: 'endTurn', turn, mode: 0, explicit: false, extras: [], dice: [] } })
const rollRow = id => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, result from roll_request where id = '${id}') r`) || 'null')
/** Until the app's view of the fight has this combatant's turn, as a page polls it. */
const viewOn = (who, api, name) => until(async () => {
  const combat = (await call(who.page, `${api}/table`)).json?.combat
  return combat?.combatants?.find(c => c.id === combat.currentId)?.name === name
}, `${name}'s turn in the app`, 20_000)
/** A turn ended through a seat: its POST's answer, and its row once the game has made it. */
async function ended(who, api, turn, what) {
  const answer = await endTurn(who, api, turn)
  if (answer.status !== 202) return { answer, made: null }
  await until(() => ['done', 'failed'].includes(rollRow(answer.json.id)?.status), `${what} to be made`, 30_000)
  return { answer, made: rollRow(answer.json.id) }
}

if (SKEW035) {
  // =================================================================================================
  // 21. Module 0.35.0
  // =================================================================================================
  part('21. module 0.35.0')
  const kinds = hello().data.features?.rolls?.kinds ?? []
  check(!kinds.includes('endTurn'), `module 0.35.0's hello takes no endTurn (${JSON.stringify(kinds)})`)
  await viewOn(alice, API, 'Thorin')
  const answer = await endTurn(alice, API, turnOf('cbThorin'))
  await wait(2000)
  check(answer.status !== 202 && fight.advances === 0 && current() === 'cbThorin', `a POST of endTurn is refused, and nothing moves (${answer.status} ${answer.text})`)
  await finish()
}

// =================================================================================================
// 1. Offered
// =================================================================================================
part('1. offered')
{
  const features = hello().data.features
  check(features.rolls.kinds.includes('endTurn') && !features.companions.kinds.includes('endTurn'),
    `the hello's kinds have endTurn; features.companions.kinds doesn't (${JSON.stringify(features.companions.kinds)})`)
}

// =================================================================================================
// 2. Thorin's turn ended from Alice's seat (the button's request; the button waits, §8.11)
// =================================================================================================
part('2. thorin\'s turn ended')
await viewOn(alice, API, 'Thorin')
const thorinTurn = turnOf('cbThorin')
{
  const { answer, made } = await ended(alice, API, thorinTurn, "Thorin's turn")
  check(answer.status === 202 && made?.status === 'done' && fight.advances === 1 && current() === 'cbBrakka',
    `Alice's End Turn on Thorin's turn: made, Foundry's turn moved on once, Brakka current (${answer.status}, ${made?.status}, advances ${fight.advances}, ${current()})`)
  await viewOn(alice, API, 'Brakka')
  check(true, "the app's view follows: Brakka's turn")
}

// =================================================================================================
// 5. Not hers
// =================================================================================================
part('5. not hers')
{
  await viewOn(bob, BOB_API, 'Brakka')
  const answer = await endTurn(bob, BOB_API, turnOf('cbBrakka'))
  check(answer.status === 422 && answer.json?.reason === 'not-turn' && fight.advances === 1, `Bob's POST naming Brakka's turn → 422 not-turn (${answer.status} ${answer.text})`)
}

// =================================================================================================
// 6. Stale and twice
// =================================================================================================
part('6. stale and twice')
{
  const stale = await endTurn(alice, API, thorinTurn)
  check(stale.status === 422 && stale.json?.reason === 'moved' && fight.advances === 1, `a POST naming Thorin's ended turn → 422 moved (${stale.status} ${stale.text})`)
  // Brakka's, a companion's, ended from Alice's seat, as its character's player.
  const { made } = await ended(alice, API, turnOf('cbBrakka'), "Brakka's turn")
  check(made?.status === 'done' && fight.advances === 2 && current() === 'cbBat', `Brakka's turn ended from Thorin's seat: the Bat current (${current()})`)
  await viewOn(alice, API, 'Bat')
  const batTurn = turnOf('cbBat')
  const [one, two] = await Promise.all([endTurn(alice, API, batTurn), endTurn(alice, API, batTurn)])
  const answers = [one, two]
  const accepted = answers.filter(a => a.status === 202)
  for (const a of accepted) await until(() => ['done', 'failed'].includes(rollRow(a.json.id)?.status), 'each end of the Bat\'s turn to be made', 30_000)
  const outcomes = accepted.map(a => [rollRow(a.json.id).status, rollRow(a.json.id).result?.reason ?? null])
  const refusedByApp = answers.filter(a => a.status === 422 && a.json?.reason === 'moved').length
  const done = outcomes.filter(([status]) => status === 'done').length
  const moved = outcomes.filter(([status, reason]) => status === 'failed' && reason === 'moved').length + refusedByApp
  check(done === 1 && moved === 1 && fight.advances === 3 && current() === 'cbGoblin',
    `two POSTs at once for the Bat's turn: one done, the other refused moved, one advance (${JSON.stringify({ statuses: answers.map(a => a.status), outcomes, advances: fight.advances, current: current() })})`)
}

// =================================================================================================
// 14 and 15. The Gamemaster's page, and a companion's route
// =================================================================================================
part('14, 15. the gamemaster and a companion\'s route')
{
  await viewOn(alice, API, 'Goblin')
  const gmPage = await browse({ width: 390, height: 844, path: `/campaigns/${A}/characters/thorin`, toasts: false })
  await gmPage.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  const gm = await endTurn(gmPage, `/api/campaigns/${A}/characters/thorin`, turnOf('cbGoblin'))
  check(gm.status === 409 && fight.advances === 3, `a POST of endTurn at the Gamemaster's page → 409 (${gm.status} ${gm.text})`)
  const viaCompanion = await endTurn(alice, `${API}/companions/brakka`, turnOf('cbGoblin'))
  check(viaCompanion.status === 409 && fight.advances === 3, `a POST of endTurn to …/companions/brakka/rolls → 409 (${viaCompanion.status} ${viaCompanion.text})`)
  await gmPage.view.close()
}

// =================================================================================================
// 18. A rewind
// =================================================================================================
part('18. a rewind')
{
  await fight.setTurn(1, 0)
  await viewOn(alice, API, 'Thorin')
  const { made } = await ended(alice, API, turnOf('cbThorin'), "Thorin's turn again")
  check(made?.status === 'done' && fight.advances === 4 && current() === 'cbBrakka',
    `the Gamemaster's setTurn back to Thorin in round 1 → ended again (advances ${fight.advances}, ${current()})`)
}
note('End Turn\'s button, hold, fill and toast (§13.8 steps 2-4, 7-13, 16-17, 19-20, 22-23) wait for the prototype (Q 13)')

await finish()
