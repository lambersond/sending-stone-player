// Constant companions (module 0.54.0 and the app, ROADMAP item 98), end to end, in the world of
// world-030.mjs with scenes and tokens (fvtt/token-core.mjs). Alice plays Thorin in Ashlands, with
// Brakka, a linked NPC she owns, a Bat summoned with Find Familiar, and a Steel Defender: a world
// NPC no player owns, which the Gamemaster marks as Thorin's constant companion on Manage
// Campaigns, and dnd5e's copy of it for a summon. The hello carries companionsConstant and the app
// answers companions: 4; before the mark a token of the copy Thorin summoned is his summoned tab,
// after it the old tab shows gone and the constant tab comes last. With no token on any scene, at
// 390 and 1280: its pin, its dashed ring and circle, "Thorin’s constant companion, not on a scene",
// the note above its sheet and the header's dashed portrait; a check, an attack and a use made on
// the NPC marked, the attack at no one with a fight on the arena, its chat card saying "No target",
// and its hit points set from the tile on it. The Gamemaster places a token of it: the same tab,
// its ring solid, no note, the token's hit points; moved to the den, its pin then the struck pin
// and the away note; deleted, back to no token. The Gamemaster's card and seat, the keyboard, and
// Help. MIDI=1: the attack through Midi-QOL's stand-in, its workflow at no one, whose own card
// stands for it in chat in place of the roll card. DND5E6=1: dnd5e 6.0.5's dice. SKEW=053 with
// MODULE=module-0.53.0: no constant tab, the card's row naming 0.54.0, Help without the part.
// Synthetic characters only. Run with --import ./fvtt/unref-timers.mjs --import
// ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import {
  DND5E6, MIDI, SKEW053, W, activeScene, browse, character, check, companion, finish, foundryWorld, launch, newCampaign,
  npc, part, place, postsOf, same, sceneWorld, settled, shootBoth, sideways, sql, startModule, summoned, until, wait,
  changeSetting,
} from './world-030.mjs'

const GAME = 'https://ashlands-constant.forge-vtt.com'
const SECRET = 'ashlands-constant-54'
const TITLE = 'Ashlands'
const NEW = !SKEW053
await launch(GAME)
const { id: A } = await newCampaign({ title: TITLE, address: 'ashlands-constant.forge-vtt.com', secret: SECRET })
await foundryWorld({ dice6: DND5E6 })
const T = await sceneWorld()
game.modules.get('sending-stone').version = SKEW053 ? '0.53.0' : '0.54.0'
// What an NPC's sheet names, as dnd5e configures it (D5 config.mjs:2407-2430, actorSizes).
Object.assign(CONFIG.DND5E, {
  movementTypes: { walk: { label: 'DND5E.MOVEMENT.Type.Speed' }, fly: { label: 'DND5E.MOVEMENT.Type.Fly' } },
  movementUnits: { ft: { label: 'Feet', abbreviation: 'DND5E.DistFtAbbr' } },
  actorSizes: { tiny: { label: 'DND5E.SizeTiny' }, med: { label: 'DND5E.SizeMedium' } },
})
// dnd5e's handling of a change of hit points, from the module's harness.
const { withHitPoints } = await import('./fvtt/hp-core.mjs')

// ---- The world ----
const capital = text => text.charAt(0).toUpperCase() + text.slice(1)
const hits = (formula, type) => ({ formula, damageType: type, label: `${formula} ${capital(type)}` })
const summonSpell = (id, name, activity) => ({
  id, name, type: 'spell', system: { level: 1, method: 'spell', prepared: 1, canPrepare: true, properties: [], duration: { units: 'hour', value: 1 } },
  activities: [{ id: activity, type: 'summon' }],
})
// Thorin, Alice's: Find Familiar, and the Steel Defender his class makes.
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, dex: 1, con: 2, wis: 1 }, hp: { value: 30, max: 40, temp: 0 } }, {
  ac: 18,
  items: [summonSpell('findFamiliar', 'Find Familiar', 'ffSummon'), { ...summonSpell('steelDefender', 'Steel Defender', 'sdSummon'), type: 'feat', system: { properties: [] } }],
})
thorin.system.details = { level: 5 }
game.users.get('alice').character = thorin
const goblin = npc('goblin', 'Goblin', 12, { dex: 1 })
// Brakka, a sidekick: linked, Alice's by name.
const brakka = companion('brakka', 'Brakka', {
  owners: ['alice'], linked: true, ac: 14,
  npc: {
    spec: { mods: { str: 3, dex: 1, con: 2 }, prof: 2, hp: { value: 30, max: 30, temp: 0 } },
    system: { traits: { size: 'med' }, details: { cr: 2, type: { value: 'humanoid', label: 'Humanoid' }, alignment: 'Neutral' }, attributes: { movement: { walk: 30, units: 'ft' }, init: { total: 1 } } },
  },
})
// The Bat, Find Familiar's template, auto-imported.
const bat = companion('bat', 'Bat', {
  owners: ['alice'], linked: false, ac: 12,
  npc: {
    flags: { dnd5e: { isAutoImported: true } },
    spec: { mods: { dex: 2, wis: 1 }, prof: 2, hp: { value: 1, max: 1, temp: 0 } },
    system: { traits: { size: 'tiny' }, details: { cr: 0, type: { value: 'beast', label: 'Beast' }, alignment: 'Unaligned' }, attributes: { movement: { walk: 5, fly: 30, units: 'ft' }, init: { total: 2 } } },
  },
})
// The Steel Defender: a world NPC from the compendium, owned by no player, unlinked, with its Rend
// and its Repair, which spends a use; and dnd5e's copy of it, auto-imported for a summon.
const SD_SOURCE = 'Compendium.dnd5e.monsters.Actor.sd'
const steelGear = { items: [
  {
    id: 'rend', name: 'Force-Empowered Rend', type: 'weapon', system: { properties: [], quantity: 1, attackType: 'melee', equipped: true },
    activities: [{ id: 'rendHit', attack: { ability: 'str' }, damage: [{ number: 1, denomination: 8, bonus: '@mod', types: ['force'] }], labels: { modifier: '+4', damage: [hits('1d8 + 2', 'force')] } }],
  },
  {
    id: 'repair', name: 'Repair', type: 'feat', system: { properties: [], uses: { max: 3, spent: 0, recovery: [] } },
    activities: [{
      id: 'mend', type: 'heal', affects: 'self', range: 'self', activation: { type: 'action', value: 1 },
      consumption: [{ type: 'itemUses', value: 1 }],
      healing: { number: 2, denomination: 8, bonus: '2', types: ['healing'] }, labels: { damage: [hits('2d8 + 2', 'healing')] },
    }],
  },
] }
const steelNpc = flags => ({
  ...(flags && { flags }),
  stats: { compendiumSource: SD_SOURCE },
  spec: { mods: { str: 2, dex: 1, con: 2 }, prof: 2, hp: { value: 20, max: 20, temp: 0 } },
  system: { traits: { size: 'med' }, details: { cr: null, type: { value: 'construct', label: 'Construct' }, alignment: 'Neutral' }, attributes: { movement: { walk: 40, units: 'ft' }, init: { total: 1 } } },
})
const steel = withHitPoints(companion('steel', 'Steel Defender', { linked: false, ac: 15, gear: steelGear, npc: steelNpc() }), { generation: DND5E6 ? 6 : 5 })
const steelCopy = companion('steelCopy', 'Steel Defender', { linked: false, ac: 15, gear: steelGear, npc: steelNpc({ dnd5e: { isAutoImported: true } }) })
const arena = await activeScene('arena')
const den = T.scene('den')
const tokenOf = {}
for (const actor of [thorin, goblin, brakka]) tokenOf[actor.id] = await place(arena, actor, { id: `tok-${actor.id}`, actorLink: true, tell: false })
const bat1 = await summoned(arena, bat, thorin, 'findFamiliar', { id: 'bat1', name: 'Bat', activity: 'ffSummon', tell: false })
// A token of dnd5e's copy, summoned by Thorin before any mark.
const sd1 = await summoned(arena, steelCopy, thorin, 'steelDefender', { id: 'sd1', name: 'Steel Defender', activity: 'sdSummon', tell: false })
W.gm.targets = new Set()
const campaign = changes => ({ id: 'camp-ash', title: TITLE, characters: ['thorin'], groups: [], rolls: true, attacks: true, prompts: true, ...changes })
await startModule({ campaigns: [campaign()], secrets: { 'camp-ash': SECRET } })
await settled()

// ---- What's posted, kept and made ----
const hello = () => postsOf('bridge.hello').at(-1)
const requests = () => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}'`))
const rollRow = id => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, role, "actorId", payload, result from roll_request where id = '${id}') r`) || 'null')
const rowsSince = count => JSON.parse(sql(`select coalesce(json_agg(r order by r."createdAt")::text, '[]') from (select id, kind, status, "actorId", payload, "createdAt" from roll_request where "campaignId" = '${A}' order by "createdAt" offset ${count}) r`))
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

sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const alice = await browse({ width: 1280, height: 800, path: '/characters/sheet-thorin', toasts: false })
await alice.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })

const switcher = who => who.page.getByRole('tablist', { name: 'Character and companions' })
const tabOf = (who, key) => who.page.locator(`#creature-tab-${key}`)
const panelOf = (who, key) => who.page.locator(`#creature-panel-${key}`)
/** The tabs' keys, in order. */
const tabKeys = who => switcher(who).getByRole('tab').evaluateAll(tabs => tabs.map(tab => tab.dataset.key))
const describedAs = (who, key) => tabOf(who, key).evaluate(tab => document.getElementById(tab.getAttribute('aria-describedby'))?.textContent ?? null)
async function choose(who, key) {
  await tabOf(who, key).click()
  await until(async () => (await tabOf(who, key).getAttribute('aria-selected')) === 'true', `${key} chosen`, 5_000)
}
async function openSheetTab(who, key, id) {
  const tab = who.page.locator(`#creature-${key}-sheet-tab-${id}`)
  await tab.waitFor({ timeout: 20_000 })
  await tab.click()
}
/**
 * How a tab draws the Steel Defender: its kind, whether it's marked on no scene or another, its
 * icons in order, and its picture's ring as drawn (`border-style`), wherever the ring is.
 */
const lookOf = (who, key) => tabOf(who, key).evaluate(tab => {
  const ringed = tab.querySelector('img, span.rounded-full.bg-card')
  const style = ringed && getComputedStyle(ringed)
  return {
    kind: tab.dataset.kind ?? null, unplaced: tab.dataset.unplaced ?? null, away: tab.dataset.away ?? null,
    icons: [...tab.querySelectorAll('svg')].map(svg => [...svg.classList].find(c => c.startsWith('lucide-') && c !== 'lucide') ?? null),
    sizes: [...tab.querySelectorAll('svg')].map(svg => Math.round(svg.getBoundingClientRect().width)),
    ring: style ? style.borderTopStyle : null,
    // The ring's box: round, as wide as it's tall, about the picture.
    box: ringed ? [Math.round(ringed.getBoundingClientRect().width), Math.round(ringed.getBoundingClientRect().height)] : null,
  }
})
/** Whether a look's ring is drawn round its picture: a box as wide as it's tall, at least 28 px. */
const roundRing = look => Array.isArray(look.box) && look.box[0] >= 28 && Math.abs(look.box[0] - look.box[1]) <= 1
const STEEL = 'steel'
const SD1 = 'arena-sd1'
const UNPLACED_NOTE = 'Steel Defender isn’t on a scene in your Gamemaster’s game. You can still roll for it and use its features here; its attacks and spells go without a target.'
const noteOf = (who, key = STEEL) => panelOf(who, key).getByRole('note')
const hpOf = actor => actor.system.attributes.hp.value

// =================================================================================================
// 1. The hello
// =================================================================================================
part('1. the hello')
{
  const { data } = hello()
  const answer = JSON.parse(hello().body ?? '{}')
  if (NEW) {
    check(Array.isArray(data.companionsConstant) && data.features?.companions?.constant === true && answer.features?.companions === 4,
      `the hello carries companionsConstant and features.companions.constant, and the app answers companions: 4 (${answer.features?.companions})`)
  } else {
    check(!('companionsConstant' in data) && !data.features?.companions?.constant && answer.features?.companions === 4,
      `module 0.53.0's hello carries no companionsConstant, the app answering 4 all the same (${answer.features?.companions})`)
  }
}

// =================================================================================================
// 2. Marking
// =================================================================================================
part('2. marking')
await switcher(alice).waitFor({ timeout: 20_000 })
await until(async () => (await tabKeys(alice)).includes(SD1), 'the summoned Steel Defender\'s tab', 30_000)
check(await tabOf(alice, SD1).getAttribute('data-kind') === 'summoned' && await describedAs(alice, SD1) === 'Summoned by Thorin with Steel Defender',
  'before the mark, the Steel Defender Thorin summoned is his summoned companion')
// Saved as Foundry saves a world setting from Manage Campaigns: its onChange, then updateSetting.
const marks = [campaign({ constantCompanions: [{ actorId: 'steel', characterId: 'thorin' }] })]
await game.settings.set('sending-stone', 'campaigns', marks)
await changeSetting('sending-stone', 'campaigns', marks)
if (NEW) {
  await until(async () => (await tabKeys(alice)).includes(STEEL), 'the constant tab', 30_000)
  await until(async () => (await tabOf(alice, SD1).getAttribute('data-kind')) === 'gone', 'the summoned tab marked gone', 30_000)
  const keys = await tabKeys(alice)
  // The gone tab seen and left, as a player does; the constant tab chosen, so that it's drawn as a
  // tab with its kind, where the row has room for avatars alone.
  await choose(alice, SD1)
  await choose(alice, STEEL)
  const marked = await lookOf(alice, STEEL)
  check(keys.at(-1) === STEEL && marked.kind === 'constant' && marked.icons[0] === 'lucide-pin',
    `the Gamemaster's mark saved: the summoned tab shows gone and the constant tab comes last, pinned (${JSON.stringify(keys)}, ${JSON.stringify(marked)})`)
  await until(async () => !(await tabKeys(alice)).includes(SD1), 'the gone tab to go', 15_000)
} else {
  await settled()
  await wait(4_000)
  check(!(await tabKeys(alice)).includes(STEEL) && await tabOf(alice, SD1).getAttribute('data-kind') === 'summoned',
    'module 0.53.0 keeps no mark: the summoned tab as it was, no constant tab')
}
// Its token taken off: no token of it on any scene.
await sd1.delete()
await settled()

// =================================================================================================
// 3. No token, at 390 and 1280
// =================================================================================================
part('3. no token')
if (NEW) {
  await until(async () => (await tabOf(alice, STEEL).getAttribute('data-unplaced')) === 'true', 'the Steel Defender marked on no scene', 30_000)
  const look = await lookOf(alice, STEEL)
  check(same(await tabKeys(alice), ['self', 'brakka', 'arena-bat1', STEEL]) && look.kind === 'constant' && look.ring === 'dashed'
    && same(look.icons.slice(0, 2), ['lucide-pin', 'lucide-circle-dashed']) && await describedAs(alice, STEEL) === 'Thorin’s constant companion, not on a scene',
    `with no token: tabs Thorin, Brakka, Bat, Steel Defender; its pin and dashed circle, its ring dashed, described "Thorin’s constant companion, not on a scene" (${JSON.stringify(look)})`)
  for (const [width, height] of [[390, 844], [1280, 800]]) {
    const view = await browse({ device: { viewport: { width, height }, deviceScaleFactor: 2, isMobile: width < 1024, hasTouch: width < 1024 }, path: '/characters/sheet-thorin', toasts: false })
    await switcher(view).waitFor({ timeout: 20_000 })
    await until(async () => (await tabOf(view, STEEL).getAttribute('data-unplaced')) === 'true', `the mark at ${width}`, 20_000)
    const seen = await lookOf(view, STEEL)
    const mode = await switcher(view).getAttribute('data-mode')
    check(seen.ring === 'dashed' && roundRing(seen) && await sideways(view.page) === 0,
      `at ${width} (${mode}): the ring dashed, round its picture, and the row inside the page (${JSON.stringify(seen)})`)
    await shootBoth(view, 'constant-tabs', switcher(view).locator('xpath=..'))
    await view.view.close()
  }
} else {
  // Its summoned tab shows gone until Alice leaves it, as it always has.
  await until(async () => (await tabOf(alice, SD1).getAttribute('data-kind')) === 'gone', 'the summoned tab marked gone', 30_000)
  check(!(await tabKeys(alice)).includes(STEEL), 'module 0.53.0: with its token gone, its summoned tab shows gone and no constant tab comes')
}

// =================================================================================================
// 4. The note, the sheet's line, the portrait
// =================================================================================================
part('4. the note and the header')
if (NEW) {
  await choose(alice, STEEL)
  await noteOf(alice).waitFor({ timeout: 20_000 })
  const header = await panelOf(alice, STEEL).locator(`section[aria-labelledby="creature-${STEEL}-creature-name"]`).evaluate(section => {
    const ringed = section.querySelector('img, span.size-16')
    return { text: section.textContent, ring: ringed ? getComputedStyle(ringed).borderTopStyle : null }
  })
  const noteFirst = await noteOf(alice).evaluate(note => Boolean(note.compareDocumentPosition(document.getElementById('creature-steel-creature-name')) & Node.DOCUMENT_POSITION_FOLLOWING))
  check((await noteOf(alice).textContent()).trim() === UNPLACED_NOTE && noteFirst && header.text.includes('Thorin’s constant companion') && header.ring === 'dashed',
    `the note above its sheet, "${(await noteOf(alice).textContent()).trim()}"; the sheet says "Thorin’s constant companion", its portrait ringed in dashes (${header.ring})`)
  await shootBoth(alice, 'constant-note', panelOf(alice, STEEL))
}

// =================================================================================================
// 5. Rolled for and used, on the NPC marked
// =================================================================================================
part('5. rolls and uses')
if (NEW) {
  await openSheetTab(alice, STEEL, 'character')
  const strength = panelOf(alice, STEEL).getByRole('button', { name: /^Strength check/ }).first()
  await strength.waitFor({ timeout: 20_000 })
  const checked = await sent(() => strength.click(), 'the Steel Defender\'s Strength check')
  const card = madeFor(checked.request.id)
  check(checked.request.actorId === STEEL && checked.made.status === 'done' && card?.speaker?.actor === 'steel',
    `a check made on Actor.steel, with no token (${checked.made.status}, ${card?.speaker?.actor})`)
  // A fight on the arena, the Steel Defender in none of it: its attack is made at no one.
  const fight = T.combatOf('fight', [
    { id: 'cbThorin', actor: thorin, token: tokenOf.thorin, fields: { name: 'Thorin', initiative: null } },
    { id: 'cbGoblin', actor: goblin, token: tokenOf.goblin, fields: { name: 'Goblin', initiative: null } },
  ])
  Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight') ?? null, configurable: true })
  await Hooks.callAll('createCombat', fight)
  await until(() => sql('select count(*) from combat') === '1', 'the app to hear of the fight', 15_000)
  await openSheetTab(alice, STEEL, 'actions')
  const rend = panelOf(alice, STEEL).getByRole('button', { name: 'Force-Empowered Rend attack, +4', exact: true })
  await rend.waitFor({ timeout: 20_000 })
  const attack = await sent(() => rend.click(), 'the Rend')
  check(await alice.page.getByRole('dialog', { name: 'Force-Empowered Rend attack' }).count() === 0
    && attack.request.kind === 'attack' && attack.request.actorId === STEEL && (attack.request.payload.targets ?? []).length === 0 && attack.made.status === 'done',
  `its attack offers no combatant and is made at no one (${attack.made.status}, ${JSON.stringify(attack.request.payload.targets)})`)
  if (MIDI) {
    // Midi-QOL's own card stands for the attack in chat, not the app's roll card that says "No target".
    const workflow = W.midi.made.at(-1)
    check(workflow?.actor?.id === 'steel' && workflow.targets.size === 0, `through Midi-QOL's workflow on Actor.steel, at no one (${workflow?.targets.size})`)
  } else {
    const said = alice.page.getByRole('list', { name: 'Chat log' }).getByText('No target', { exact: true }).first()
    await said.waitFor({ timeout: 30_000 })
    check(true, 'its card in chat says "No target"')
    await shootBoth(alice, 'constant-no-target', said.locator('xpath=ancestor::li[1]'))
  }
  // Its damage, where the game asks for it, rolled so that nothing waits.
  await wait(2_000)
  const damage = panelOf(alice, STEEL).getByRole('button', { name: /^Roll damage/ }).first()
  if (await damage.count()) await damage.click()
  await settled()
  const spentBefore = steel.items.get('repair').system.uses.spent
  const repair = panelOf(alice, STEEL).getByRole('button', { name: /^Repair healing/ }).first()
  await repair.waitFor({ timeout: 20_000 })
  const used = await sent(() => repair.click(), 'the Repair')
  check(used.request.actorId === STEEL && used.made.status === 'done' && steel.items.get('repair').system.uses.spent === spentBefore + 1,
    `Repair spends a use of Actor.steel's (${spentBefore} → ${steel.items.get('repair').system.uses.spent})`)
  await settled()
  // Its hit points, set from its header's tile, on Actor.steel.
  await openSheetTab(alice, STEEL, 'character')
  const tile = panelOf(alice, STEEL).getByRole('button', { name: /^Hit points: / })
  await tile.waitFor({ timeout: 20_000 })
  const hpBefore = hpOf(steel)
  await paced()
  await tile.click()
  const editor = alice.page.getByRole('dialog', { name: 'Hit points', exact: true })
  await editor.waitFor({ timeout: 10_000 })
  for (let tap = 0; tap < 3; tap += 1) await editor.getByRole('button', { name: 'One hit point fewer', exact: true }).click()
  await editor.getByRole('button', { name: 'Save', exact: true }).click()
  await until(() => hpOf(steel) === hpBefore - 3, 'Actor.steel\'s hit points', 30_000)
  check(hpOf(steel) === hpBefore - 3, `its hit points set from the tile land on Actor.steel (${hpBefore} → ${hpOf(steel)})`)
  game.combats.delete('fight')
  await Hooks.callAll('deleteCombat', fight)
  await until(() => sql('select count(*) from combat') === '0', 'the fight to end in the app', 15_000)
}

// =================================================================================================
// 6. A token of it placed, and moved
// =================================================================================================
part('6. a token placed and moved')
if (NEW) {
  const at = Date.now()
  const placedAt = await place(arena, steel, { id: 'sdtok', name: 'Steel Defender', actorLink: false, delta: { system: { attributes: { hp: { value: 12, max: 20 } } } } })
  await until(async () => (await tabOf(alice, STEEL).getAttribute('data-unplaced')) === null, 'the mark to go', 30_000)
  const took = Date.now() - at
  await until(async () => (await noteOf(alice).count()) === 0, 'the note to go', 20_000)
  const tile = panelOf(alice, STEEL).getByRole('button', { name: /^Hit points: / })
  await until(async () => /^Hit points: 12 of 20/.test(await tile.getAttribute('aria-label') ?? ''), 'the token\'s hit points', 20_000)
  const look = await lookOf(alice, STEEL)
  check((await tabKeys(alice)).at(-1) === STEEL && look.ring === 'solid' && !look.icons.includes('lucide-circle-dashed') && await describedAs(alice, STEEL) === 'Thorin’s constant companion',
    `a token placed on the arena: within ${took} ms the same tab, in the same place, its ring solid, no circle, no note, the token's 12 of 20 (${JSON.stringify(look)})`)
  await shootBoth(alice, 'constant-placed', switcher(alice).locator('xpath=..'))
  await placedAt.delete()
  const moved = await place(den, steel, { id: 'sdtok2', name: 'Steel Defender', actorLink: false })
  await until(async () => (await tabOf(alice, STEEL).getAttribute('data-away')) === 'true', 'the away mark', 30_000)
  const away = await lookOf(alice, STEEL)
  await noteOf(alice).filter({ hasText: 'on another scene' }).waitFor({ timeout: 20_000 })
  const pin = away.icons.indexOf('lucide-pin')
  const off = away.icons.indexOf('lucide-map-pin-off')
  check(pin !== -1 && off > pin && away.sizes[pin] >= 14 && away.sizes[off] >= 14 && away.ring === 'solid' && await describedAs(alice, STEEL) === 'Thorin’s constant companion, on another scene',
    `moved to the den: its pin then the struck pin, both ${away.sizes[pin]} px, and the away note (${JSON.stringify(away)})`)
  await shootBoth(alice, 'constant-away', switcher(alice).locator('xpath=..'))

  // =================================================================================================
  // 7. Its token deleted
  // =================================================================================================
  part('7. the token deleted')
  await moved.delete()
  await until(async () => (await tabOf(alice, STEEL).getAttribute('data-unplaced')) === 'true', 'no token again', 30_000)
  await noteOf(alice).filter({ hasText: 'isn’t on a scene' }).waitFor({ timeout: 20_000 })
  check((await lookOf(alice, STEEL)).ring === 'dashed' && (await tabKeys(alice)).at(-1) === STEEL, 'its token deleted: back to no token, ring and note again')
}

// =================================================================================================
// 8. The Gamemaster's card and seat
// =================================================================================================
part('8. the gamemaster')
{
  const cards = await browse({ width: 1280, height: 800, path: '/campaigns' })
  const card = cards.page.getByRole('article', { name: TITLE })
  await card.waitFor({ timeout: 20_000 })
  const row = card.getByRole('heading', { name: 'Constant companions' })
  await row.waitFor({ timeout: 20_000 })
  const said = (await row.evaluate(heading => heading.nextElementSibling?.textContent ?? '')).trim()
  if (NEW) {
    const line = card.getByText(/^Companions: /).first()
    await until(async () => /Steel Defender \(constant, not on a scene\)$/.test((await line.textContent().catch(() => '')).trim()), 'the card\'s line', 30_000)
    check(said.startsWith('One in Foundry: Steel Defender, Thorin’s. A constant companion shows beside its character in the app with no token on a scene.')
      && await row.evaluate(heading => Boolean(heading.querySelector('.lucide-pin'))),
    `the card's line ends "Steel Defender (constant, not on a scene)", and its row, pinned, reads "${said}"`)
  } else {
    check(said === 'Your Sending Stone module doesn’t keep constant companions yet. Version 0.54.0 or later does.', `with module 0.53.0 the card's row names 0.54.0: "${said}"`)
  }
  await shootBoth(cards, 'constant-gm-card', card)
  await cards.view.close()
  if (NEW) {
    const gm = await browse({ width: 1280, height: 800, path: `/campaigns/${A}/characters/thorin`, toasts: false })
    await switcher(gm).waitFor({ timeout: 20_000 })
    await until(async () => (await tabKeys(gm)).includes(STEEL), 'the Gamemaster\'s constant tab', 20_000)
    await choose(gm, STEEL)
    await noteOf(gm).waitFor({ timeout: 20_000 })
    check((await noteOf(gm).textContent()).trim() === 'Steel Defender isn’t on a scene in your game. You can still roll for it and use its features here; its attacks and spells go without a target.',
      `at Thorin's Gamemaster page the same tab, and the note in the Gamemaster's words: "${(await noteOf(gm).textContent()).trim()}"`)
    await gm.view.close()
  }
}

// =================================================================================================
// 9. Keyboard
// =================================================================================================
part('9. keyboard')
if (NEW) {
  await choose(alice, 'self')
  await tabOf(alice, 'self').focus()
  await alice.page.keyboard.press('End')
  await until(async () => (await tabOf(alice, STEEL).getAttribute('aria-selected')) === 'true', 'End to choose it', 5_000)
  await alice.page.keyboard.press('ArrowLeft')
  await alice.page.keyboard.press('ArrowRight')
  const focused = () => alice.page.evaluate(() => document.activeElement?.id ?? null)
  check(await focused() === 'creature-tab-steel', 'the arrow keys and End reach its tab')
  const placedAgain = await place(arena, steel, { id: 'sdtok3', name: 'Steel Defender', actorLink: false })
  await until(async () => (await tabOf(alice, STEEL).getAttribute('data-unplaced')) === null, 'placed again', 30_000)
  const whilePlaced = await focused()
  await placedAgain.delete()
  await until(async () => (await tabOf(alice, STEEL).getAttribute('data-unplaced')) === 'true', 'no token again', 30_000)
  check(whilePlaced === 'creature-tab-steel' && await focused() === 'creature-tab-steel', `focus stays on its tab as its state changes (${whilePlaced})`)
}

// =================================================================================================
// 10. Help
// =================================================================================================
part('10. help')
{
  await alice.page.getByRole('button', { name: 'Help', exact: true }).click()
  const help = alice.page.getByRole('dialog', { name: 'Help' })
  await help.getByText('Companions and conditions.', { exact: true }).waitFor({ timeout: 15_000 })
  const lead = help.getByText('Constant companions.', { exact: true })
  if (NEW) {
    const text = (await lead.evaluate(el => el.closest('p')?.textContent ?? '')).trim()
    check(text === 'Constant companions. A companion your Gamemaster keeps beside your character, such as a Steel Defender, has a pin on its tab and shows whether or not it’s on a scene. While it isn’t on a scene, a dashed ring marks it, its attacks and spells go without a target, and it can’t roll initiative or be asked a save your Gamemaster asks of the tokens on a scene; it’s still asked its concentration saves, as Foundry asks them.',
      `Help says so: "${text}"`)
  } else {
    check(await lead.count() === 0, 'with module 0.53.0 Help has no "Constant companions." part')
  }
  await alice.page.keyboard.press('Escape')
}

await finish()
