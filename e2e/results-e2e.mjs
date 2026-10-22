// Hits, misses, saves and checks on chat cards (module 0.30.0 and the app, its contract §1a, §3.7
// F1-F7 and §7 results-e2e.mjs), end to end, in the world of world-030.mjs: one case for each
// combination the Gamemaster's world could use, each read as a pill by the player who sees it in
// Foundry, and absent, from what the app gives the page too, for the player who doesn't. Alice plays
// Thorin, Bob plays Vex, each on a phone; the Gamemaster's creatures are a goblin, an orc and
// Corvin. Plain dnd5e: attacks under each Attack Result Visibility; saves from the Gamemaster's card
// under each Challenge Visibility; request cards' saves, the Gamemaster's and a player's; a save from
// a link in a description, its outcome its roller's alone; checks from a request card, "Success" and
// "Failure"; total cover, a hit as dnd5e 5.3.3 draws it. MIDI=1, Midi-QOL at its own defaults but as
// each case sets it: Midi's cards' hits (H1, H2, H3) and saves, by Midi's own rules (§1a M1-M16),
// dnd5e's own attacks in a Midi world (A7), and the Gamemaster's rolls on Midi's cards trimmed as
// GM Attack Roll Display and GM Damage Roll Display show them (M8). With Gamemaster-only information
// on, everything. DND5E6=1, dnd5e 6.0.5's typed messages: an attack, a save by its `system.origin`,
// and no armor class or DC from `system`. SKEW=029 with MODULE=module 0.29.0: what 0.29.0 withheld
// is still withheld, and nothing is refused. Screenshots of the chat under dnd5e's defaults and
// Midi-QOL's. Synthetic characters only. Run with --import ./fvtt/unref-timers.mjs --import
// ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import {
  BOB, DND5E6, MIDI, MIDI_DEFAULTS, MIDI_WORDS, NEW, SHOTS_031, SKEW, actors, browse, call, character, check, faces, finish, foundryWorld, launch, newCampaign, note,
  npc, part, postsOf, posted, same, settings, settled, shoot, shootBoth, sideways, sql, startModule, until, wait,
} from './world-030.mjs'

const GAME = 'https://ashen-vale.forge-vtt.com'
const SECRET = 'ashen-vale-results-30'
const TITLE = 'Ashen Vale'
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: TITLE, address: 'ashen-vale.forge-vtt.com', secret: SECRET })
const W = await foundryWorld()
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, dex: 1, wis: 1 }, hp: { value: 30, max: 38, temp: 0 } }, { ac: 16, items: [] })
thorin.system.details = { level: 5 }
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { wis: 3 }, hp: { value: 24, max: 30, temp: 0 } }, { ac: 14, items: [] })
vex.system.details = { level: 5 }
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
const goblin = npc('goblin', 'Goblin', 13)
const orc = npc('orc', 'Orc', 18)
const corvin = npc('corvin', 'Corvin', 15, { int: 3 })
// Corvin's breath and hail, each a save activity, whose cards ask for saves.
W.equip(corvin, {
  ac: 15,
  items: [['frost', 'Frost Breath'], ['hail', 'Hail Burst']].map(([id, name]) => ({
    id, name, type: 'feat', system: { properties: [] }, activities: [{ id: 'save', type: 'save', save: ['dex'], dc: 13, damage: [{ number: 2, denomination: 6, types: ['cold'] }] }],
  })),
})
Object.defineProperty(actors, 'party', { get: () => null, configurable: true })
// The tokens on the Gamemaster's canvas, each its actor's speaker, as Midi-QOL names targets by them.
const tokenOf = {}
for (const actor of [thorin, vex, goblin, orc, corvin]) {
  const token = { id: `tok-${actor.id}`, name: actor.name, uuid: `Scene.scene.Token.tok-${actor.id}`, actor, hidden: false, isLinked: true, disposition: actor.type === 'npc' ? -1 : 1 }
  const placeable = { id: token.id, name: actor.name, document: token, actor }
  token.object = placeable
  W.placeables.set(token.id, placeable)
  actor.speakerToken = placeable
  tokenOf[actor.id] = token.uuid
}
if (MIDI) canvas.scene.tokens.size = W.placeables.size
await startModule({ campaigns: [{ id: 'camp-ash', title: TITLE, characters: ['thorin', 'vex'], groups: [], rolls: true }], secrets: { 'camp-ash': SECRET } })
await settled()

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
alice.sheet = 'sheet-thorin'
bob.sheet = sql(`select id from "character" where "actorId" = 'vex' and "campaignId" = '${A}'`)
await alice.chat()
await bob.chat()

// ---- Reading what each player is shown ----
const PILL = { outcome: { hit: 'Hit', miss: 'Miss' }, save: { saved: 'Saved', failed: 'Failed' }, check: { success: 'Success', failure: 'Failure' } }
/** A message as the app gives a player's page, by its id in Foundry. */
async function viewOf(who, id) {
  const table = await call(who.page, `/api/characters/${who.sheet}/table`)
  return table.json?.messages?.find(m => m.id === id)
}
/** A message's targets, as the player reads their pills: "Goblin, Hit". */
const pillsOf = message => message.targets.map(t => [t.name, ...['outcome', 'save', 'check'].filter(k => t[k]).map(k => PILL[k][t[k]])].join(', '))
/** What a player is shown of a message, once it's there. */
async function seen(who, id) {
  let message
  await until(async () => (message = await viewOf(who, id)), `message ${id} on ${who === alice ? "Alice's" : "Bob's"} page`, 20_000)
  return message
}
/** The message as the module last told the app of it. */
const toldOf = id => posted.filter(p => ['chat.message.created', 'chat.message.updated'].includes(p.type) && (p.data?.message?.id === id)).at(-1)?.data?.message
/** Nothing of how it went in what the app gives a page: no outcome, save or check, no summary. */
const nothingOf = message => message.targets.every(t => !t.outcome && !t.save && !t.check) && !message.summary
/** The message's card in a page's chat, its pills as read there; the same order as the app gives it. */
async function domPills(who, id) {
  const table = (await call(who.page, `/api/characters/${who.sheet}/table`)).json
  const index = table.messages.findIndex(m => m.id === id)
  const items = who.log.locator(':scope > li')
  // Once the page shows every message the app gives it, in the same order.
  await until(async () => (await items.count()) === table.messages.length, 'the chat to show it', 15_000)
  const item = items.nth(index)
  return item.evaluate(li => {
    const p = [...li.querySelectorAll('p')].find(p => /Targets?:/.test(p.querySelector(':scope > span.sr-only')?.textContent ?? ''))
    // No line of targets at all, as for a message whose creature the module doesn't name.
    if (!p) return []
    return [...p.querySelectorAll(':scope > span.inline-flex')].map(span => [span.querySelector('span.font-semibold')?.textContent,
      ...[...span.querySelectorAll('span.rounded-full')].map(pill => pill.textContent.trim())].join(', '))
  })
}
/**
 * A case: what Alice and Bob each read on the message, in the app's view and on their pages; and,
 * for any who mustn't, nothing of it. `bob: null` for a message Bob never receives.
 */
async function expect(name, message, { alice: forAlice, bob: forBob }) {
  const a = await seen(alice, message.id)
  const aliceDom = await domPills(alice, message.id)
  let bobRead = null
  if (forBob === null) {
    await wait(500)
    bobRead = (await viewOf(bob, message.id)) ?? null
    check(same(pillsOf(a), forAlice) && same(aliceDom, forAlice) && bobRead === null,
      `${name}: Alice reads ${JSON.stringify(forAlice)}; Bob never receives it (read: ${JSON.stringify([pillsOf(a), aliceDom, bobRead && pillsOf(bobRead)])})`)
    return a
  }
  const b = await seen(bob, message.id)
  bobRead = pillsOf(b)
  const hiddenFrom = [[forAlice, a], [forBob, b]].filter(([want]) => want.every(t => !t.includes(', '))).map(([, got]) => got)
  const right = same(pillsOf(a), forAlice) && same(aliceDom, forAlice) && same(bobRead, forBob) && hiddenFrom.every(nothingOf)
  check(right, `${name}: Alice reads ${JSON.stringify(forAlice)}, Bob ${JSON.stringify(forBob)}${hiddenFrom.length ? ', and the app gives whoever has no pill nothing of how it went' : ''}`
    + (right ? '' : ` (read: ${JSON.stringify([pillsOf(a), aliceDom, bobRead])}; told: ${JSON.stringify(toldOf(message.id)?.dnd5e)})`))
  return a
}

/** Alice's chat on a tablet, 768 px, in both themes, as it is now: nothing to scroll sideways. */
async function tabletChat(name) {
  const tablet = await browse({ width: 768, height: 1024, scheme: 'dark', path: '/characters/sheet-thorin' })
  await tablet.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await tablet.chat()
  await tablet.log.locator(':scope > li').last().waitFor()
  check(await sideways(tablet.page) === 0, `${name}: Alice's chat at 768 px scrolls nothing sideways`)
  await shootBoth(tablet, name)
  await tablet.view.close()
}

// ---- Foundry's messages ----
const roll20 = async (face, bonus, options = {}) => {
  faces.push(face)
  return new CONFIG.Dice.D20Roll(`1d20 + ${bonus}`, {}, { criticalSuccess: 20, criticalFailure: 1, ...options }).evaluate()
}
const damage = async (formula, type, thrown, section = 'defaultDamage') => {
  faces.push(...thrown)
  return new CONFIG.Dice.DamageRoll(formula, {}, { type, ...(MIDI && { 'midi-qol': { rollType: section } }) }).evaluate()
}
const descriptor = (actor, ac = actor.system.attributes.ac.value) => ({ name: actor.name, img: '', uuid: actor.uuid, ac })
const speakerOf = actor => ChatMessage.getSpeaker({ actor })
/** dnd5e's attack roll message: by `by`, at these targets, [actor, its armor class as the card has it]. */
async function attack({ author = 'gm', by = goblin, targets, face, bonus = 4, flavor = 'Scimitar - Attack Roll', target }) {
  const roll = await roll20(face, bonus, { rollType: 'attack', ...(target && { target }) })
  return ChatMessage.create({
    author, speaker: speakerOf(by), rolls: [roll], flavor,
    flags: { dnd5e: { messageType: 'roll', roll: { type: 'attack' }, targets: targets.map(([actor, ac]) => descriptor(actor, ac)) } },
  })
}
/** A creature's saving throw or check, as dnd5e's roll message is, from a card or from none. */
async function rollOf({ author, by, kind = 'save', face, bonus = 1, dc, from, flavor }) {
  const roll = await roll20(face, bonus, { target: dc })
  const type = kind === 'save' ? { type: 'save', ability: 'dex' } : { type: 'skill', skillId: 'prc' }
  return ChatMessage.create({
    author, speaker: speakerOf(by), rolls: [roll], flavor: flavor ?? (kind === 'save' ? 'Dexterity Saving Throw' : 'Perception Check'),
    flags: { dnd5e: { messageType: 'roll', roll: type, ...(from && { originatingMessage: from.id }) } },
  })
}

// =================================================================================================
// Plain dnd5e, and what module 0.29.0 told of it
// =================================================================================================
if (!MIDI && !DND5E6) {
  part('dnd5e: attacks')
  const AT = [[thorin], [vex]]
  for (const [visibility, shown] of [['none', false], ['hideAC', true], ['all', true]]) {
    settings.set('attackRollVisibility', visibility)
    const message = await attack({ targets: AT, face: 11 })
    const want = shown ? ['Thorin, Miss', 'Vex, Hit'] : ['Thorin', 'Vex']
    await expect(`an attack at Thorin and Vex, 15, under Attack Result Visibility "${visibility}"`, message, { alice: want, bob: want })
    check(toldOf(message.id).dnd5e.targets.every(t => !('ac' in t) && (shown || !('outcome' in t))),
      `and the module sends no armor class${shown ? '' : ', nor any outcome'} (${JSON.stringify(toldOf(message.id).dnd5e.targets)})`)
    if (visibility === 'none') {
      await shootBoth(alice, 'results-dnd5e-defaults')
      await tabletChat('results-dnd5e-defaults')
    }
  }

  part('dnd5e: the Gamemaster\'s save card')
  settings.set('attackRollVisibility', 'none')
  for (const [visibility, face, want] of [['player', 15, ['Goblin']], ['all', 4, ['Goblin, Failed']]]) {
    settings.set('challengeVisibility', visibility)
    const card = await W.cards.saveCard({ by: corvin, item: corvin.items.get('frost'), dc: 13, abilities: ['dex'], targets: [goblin], author: 'gm' })
    const save = await rollOf({ author: 'gm', by: goblin, face, bonus: 0, dc: 13, from: card })
    await expect(`the goblin's save from the Gamemaster's card under Challenge Visibility "${visibility}"`, save, { alice: want, bob: want })
  }

  part('dnd5e: request cards')
  settings.set('challengeVisibility', 'all')
  {
    const request = await W.cards.requestCard({ type: 'save', abilities: ['dex'], dc: 12, author: 'gm' })
    const save = await rollOf({ author: 'alice', by: thorin, face: 15, dc: 12, from: request })
    // Module 0.29.0 names no creature on a save but one from a save activity's card: no line of targets.
    const want = NEW ? ['Thorin, Saved'] : []
    await expect(`Thorin's save from the Gamemaster's request card under "Show all"${SKEW ? ', which 0.29.0 never told' : ''}`, save, { alice: want, bob: want })
  }
  settings.set('challengeVisibility', 'player')
  {
    const request = await W.cards.requestCard({ type: 'save', abilities: ['dex'], dc: 12, author: 'alice' })
    const save = await rollOf({ author: 'bob', by: vex, face: 5, dc: 12, from: request })
    const want = NEW ? ['Vex, Failed'] : []
    await expect(`Vex's save from a request card Alice posted, under "Show only from other players"`, save, { alice: want, bob: want })
  }

  part('dnd5e: a link in a description')
  settings.set('challengeVisibility', 'none')
  {
    const save = await rollOf({ author: 'alice', by: thorin, face: 17, dc: 14, flavor: 'Dexterity Saving Throw (DC 14)' })
    await expect('Thorin\'s save from a [[/save]] link Alice rolled, under "Hide all": hers to see, not Bob\'s', save,
      { alice: NEW ? ['Thorin, Saved'] : [], bob: NEW ? ['Thorin'] : [] })
    if (NEW) check(same(toldOf(save.id).dnd5e.save, { target: 'Actor.thorin', outcome: 'success', readers: ['thorin'] }), 'the module tells its outcome for Thorin\'s player alone')
    await shootBoth(bob, 'results-link-save-hidden')
  }

  part('dnd5e: checks')
  settings.set('challengeVisibility', 'all')
  {
    const request = await W.cards.requestCard({ type: 'skill', abilities: ['wis'], dc: 12, author: 'gm' })
    const passed = await rollOf({ author: 'alice', by: thorin, kind: 'check', face: 14, dc: 12, from: request })
    await expect('a Perception check from the Gamemaster\'s request card, 15 against 12', passed, { alice: NEW ? ['Thorin, Success'] : [], bob: NEW ? ['Thorin, Success'] : [] })
    const failed = await rollOf({ author: 'alice', by: thorin, kind: 'check', face: 3, dc: 12, from: request })
    await expect('and another, 4', failed, { alice: NEW ? ['Thorin, Failure'] : [], bob: NEW ? ['Thorin, Failure'] : [] })
    if (NEW) await shootBoth(alice, 'results-checks')
    else check(!('check' in toldOf(passed.id).dnd5e), 'module 0.29.0 sends no check')
  }

  part('dnd5e: total cover')
  settings.set('attackRollVisibility', 'hideAC')
  {
    const message = await attack({ targets: [[thorin, null]], face: 10 })
    const want = NEW ? ['Thorin, Hit'] : ['Thorin, Miss']
    await expect(`an attack at Thorin under total cover, under "Show only results": ${NEW ? 'a hit, as dnd5e 5.3.3 draws it' : 'module 0.29.0 told it a miss'}`, message, { alice: want, bob: want })
  }
}

// =================================================================================================
// Midi-QOL
// =================================================================================================
if (MIDI) {
  const midi = W.midi.settings
  const set = changes => Object.assign(midi, MIDI_DEFAULTS, changes)
  const uuid = actor => tokenOf[actor.id]
  /** Midi-QOL's card, as its workflow writes its flags once it has checked hits and saves. */
  async function midiCard({ author = 'alice', by = thorin, targets, hit, saved, attackFace, bonus = 5, aimed, damages = [], speaker = true, rollMode, flavor = 'Thundering Strike', isHit, isCritical, isFumble }) {
    const attackRoll = (attackFace !== undefined) ? [await roll20(attackFace, bonus, { 'midi-qol': { rollType: 'attack' }, ...(aimed && { target: aimed }) })] : []
    const rolls = [...attackRoll, ...await Promise.all(damages.map(([formula, type, thrown, section]) => damage(formula, type, thrown, section)))]
    return ChatMessage.create({
      author, speaker: speaker ? speakerOf(by) : { actor: null, alias: 'Gamemaster' }, rolls, flavor,
      content: '<div class="midi-qol-hits-display"><div>hit</div></div><div class="midi-qol-saves-display"><div>save</div></div>',
      flags: {
        'midi-qol': {
          messageType: 'attack', GMOnlyAttackRoll: false, targets: targets.map(actor => ({ uuid: uuid(actor) })),
          ...(hit && { hitTargetUuids: hit.map(uuid), hitECTargetUuids: [] }),
          ...(saved && { saveUuids: saved.map(uuid), failedSaveUuids: targets.filter(actor => !saved.includes(actor)).map(uuid) }),
          ...((isHit !== undefined) && { isHit }), ...((isCritical !== undefined) && { isCritical }), ...((isFumble !== undefined) && { isFumble }),
        },
        dnd5e: {
          messageType: 'usage', item: { id: 'strike', type: 'spell' }, activity: { id: 'atk', type: 'attack' },
          targets: targets.map(actor => ({ ...descriptor(actor), ...(saved && { saved: saved.includes(actor) }) })),
        },
      },
    }, rollMode ? { rollMode } : {})
  }

  part('Midi: hits')
  settings.set('attackRollVisibility', 'hideAC')
  set({ autoCheckHit: 'none' })
  await expect('Auto Check Hits "None", a card at the goblin and the orc', await midiCard({ targets: [goblin, orc], hit: [goblin], attackFace: 12 }),
    { alice: ['Goblin', 'Orc'], bob: ['Goblin', 'Orc'] })
  set({ autoCheckHit: 'all' })
  await expect('"Check - all see result", a public card, under "Show only results" (M1)', await midiCard({ targets: [goblin, orc], hit: [goblin], attackFace: 12 }),
    { alice: ['Goblin, Hit', 'Orc, Miss'], bob: ['Goblin, Hit', 'Orc, Miss'] })
  settings.set('attackRollVisibility', 'none')
  await expect('the same under dnd5e\'s "Hide all" (M1)', await midiCard({ targets: [goblin, orc], hit: [goblin], attackFace: 12 }),
    { alice: ['Goblin', 'Orc'], bob: ['Goblin', 'Orc'] })
  settings.set('attackRollVisibility', 'hideAC')
  {
    const self = await midiCard({ targets: [goblin, orc], hit: [orc], attackFace: 16, rollMode: 'selfroll' })
    await expect('a Self Roll card: its author sees its hits (M6)', self, { alice: ['Goblin, Miss', 'Orc, Hit'], bob: null })
    check(same(toldOf(self.id).audience.characters, ['thorin']), 'and the module sends it to Thorin\'s player alone')
  }
  set({ autoCheckHit: 'none' })
  await expect('Auto Check Hits "None", Alice\'s card at the goblin alone, its d20 against AC 13, under "Show only results" (M4)',
    await midiCard({ targets: [goblin], attackFace: 13, aimed: 13 }), { alice: ['Goblin, Hit'], bob: ['Goblin, Hit'] })
  await shootBoth(alice, 'results-midi-one-target')
  set({ autoCheckHit: 'none', highLightCriticalAttackOnly: true })
  await expect('with "Only highlight critical/fumble hits" on (M4)', await midiCard({ targets: [goblin], attackFace: 13, aimed: 13 }),
    { alice: ['Goblin'], bob: ['Goblin'] })

  part('Midi: the Gamemaster\'s Hit/Miss Only')
  settings.set('attackRollVisibility', 'none')
  set({ autoCheckHit: 'none', gmAttackDisplay: 'hitMiss' })
  {
    const card = await midiCard({ author: 'gm', by: orc, targets: [thorin], attackFace: 14, aimed: 16, isHit: true })
    const view = await expect('the Gamemaster\'s orc at Thorin alone, "Hit/Miss Only", under dnd5e\'s "Hide all": "hits" (M5)', card, { alice: ['Thorin, Hit'], bob: ['Thorin, Hit'] })
    const [shown] = view.rolls
    check(shown.formula === '' && same(shown.dice, []) && shown.total === null && !shown.critical, `its attack shows "–", no formula and no dice (${JSON.stringify(shown)})`)
    const text = await alice.log.locator(':scope > li').last().textContent()
    check(text.includes('–') && !text.includes('1d20') && !text.includes('19'), `on Alice's page too: "${text.slice(0, 120)}"`)
    await shootBoth(alice, 'results-midi-gm-hitmiss')
  }
  await expect('at Thorin and Vex: no pill (M5)', await midiCard({ author: 'gm', by: orc, targets: [thorin, vex], attackFace: 14, isHit: true }),
    { alice: ['Thorin', 'Vex'], bob: ['Thorin', 'Vex'] })

  part('Midi: the Gamemaster\'s rolls, trimmed')
  settings.set('attackRollVisibility', 'none')
  const FULL = { formula: '1d20 + 5', dice: [{ faces: 20, value: 14, active: true }], total: 19 }
  const TRIMS = {
    full: FULL,
    hideFormula: { formula: '', dice: [], total: 19 },
    d20Only: { formula: '', dice: [{ faces: 20, value: 14, active: true }], total: null },
    attackTotal: { formula: '', dice: [], total: 19 },
    hitMiss: { formula: '', dice: [], total: null },
    hitMissCrit: { formula: '', dice: [], total: null },
    hidden: { formula: '', dice: [], total: null },
  }
  for (const [display, want] of Object.entries(TRIMS)) {
    set({ autoCheckHit: 'none', gmAttackDisplay: display })
    const card = await midiCard({ author: 'gm', by: orc, targets: [vex, goblin], attackFace: 14, damages: [['1d8 + 3', 'slashing', [5]]] })
    const view = await seen(bob, card.id)
    const [shown] = view.rolls
    const sent = toldOf(card.id).rolls.find(r => r.attack)
    const got = { formula: shown.formula, dice: shown.dice, total: shown.total }
    check(same(got, want) && (display === 'full' || (!/1d20/.test(JSON.stringify(sent)) && (want.total !== null || sent.total === null))),
      `GM Attack Roll Display "${display}": Bob's page shows the Gamemaster's attack as ${JSON.stringify(got)}, and the module sent nothing more (${JSON.stringify({ formula: sent.formula, total: sent.total, dice: sent.dice })})`)
  }
  for (const [display, total] of [['totalOnly', 8], ['hidden', null]]) {
    set({ autoCheckHit: 'none', gmDamageDisplay: display })
    const card = await midiCard({ author: 'gm', by: orc, targets: [vex], attackFace: 14, damages: [['1d8 + 3', 'slashing', [5]]] })
    const view = await seen(bob, card.id)
    const [main] = view.damage ?? []
    const rolls = main?.rolls ?? []
    check(rolls.length === 1 && rolls.every(r => r.formula === '' && same(r.dice, [])) && rolls[0].total === total && (main.total ?? null) === total
      && !JSON.stringify(toldOf(card.id).rolls.filter(r => r.damage)).includes('1d8'),
      `GM Damage Roll Display "${display}": the damage ${total === null ? 'shows "–"' : `total ${total}`}, with no formula or dice (${JSON.stringify(main)})`)
    if (display === 'totalOnly') await shootBoth(bob, 'results-midi-gm-damage-total')
  }
  set({})

  part('Midi: dnd5e\'s own attacks')
  settings.set('attackRollVisibility', 'hideAC')
  await expect('a dnd5e attack card at Thorin and Vex in a Midi world, "Show only results": no tray, so no pills (A7)', await attack({ targets: [[thorin], [vex]], face: 11 }),
    { alice: ['Thorin', 'Vex'], bob: ['Thorin', 'Vex'] })
  await expect('at Vex alone, its d20 against AC 14: dnd5e\'s own highlight (A7)', await attack({ targets: [[vex]], face: 11, target: 14 }),
    { alice: ['Vex, Hit'], bob: ['Vex, Hit'] })

  part('Midi: saves')
  settings.set('challengeVisibility', 'player')
  set({ autoCheckSaves: 'all' })
  await expect('the Gamemaster\'s card, its saves shown, under "Show only from other players": Vex\'s, a player\'s, shown, the goblin\'s not (M10, M11)',
    await midiCard({ author: 'gm', by: corvin, targets: [vex, goblin], saved: [vex] }), { alice: ['Vex, Saved', 'Goblin'], bob: ['Vex, Saved', 'Goblin'] })
  await expect('a card with no speaker, under "Show only from other players": Midi\'s saves shown (M16)',
    await midiCard({ author: 'gm', speaker: false, targets: [vex, goblin], saved: [] }), { alice: ['Vex, Failed', 'Goblin'], bob: ['Vex, Failed', 'Goblin'] })
  settings.set('challengeVisibility', 'all')
  {
    const card = await midiCard({ author: 'alice', targets: [vex], saved: [vex] })
    const save = await rollOf({ author: 'gm', by: vex, face: 15, dc: 14, from: card })
    await expect('Midi\'s save message of Vex\'s, with its DC, under "Show all" (M13)', save, { alice: ['Vex, Saved'], bob: ['Vex, Saved'] })
    set({ autoCheckSaves: 'all', highlightSuccess: false })
    const plain = await rollOf({ author: 'gm', by: vex, face: 15, dc: 14, from: card })
    await expect('with "Color code Hit/Miss/Save Display" off (M13)', plain, { alice: ['Vex'], bob: ['Vex'] })
  }
  settings.set('challengeVisibility', 'player')
  set({ autoCheckSaves: 'none' })
  {
    const card = await midiCard({ author: 'alice', targets: [goblin] })
    const save = await rollOf({ author: 'gm', by: goblin, face: 3, bonus: 0, dc: 14, from: card })
    await expect('Auto Check Saves "Off", the goblin\'s save from dnd5e\'s button on Alice\'s card, under "Show only from other players" (M14)', save,
      { alice: ['Goblin, Failed'], bob: ['Goblin, Failed'] })
  }
  // Midi-QOL out of the box, and dnd5e: no hits, Midi's saves not checked.
  set({})
  settings.set('attackRollVisibility', 'none')
  settings.set('challengeVisibility', 'player')
  await expect("Midi-QOL's defaults and dnd5e's: Alice's card at the goblin alone", await midiCard({ targets: [goblin], attackFace: 13, aimed: 13 }),
    { alice: ['Goblin'], bob: ['Goblin'] })
  await shootBoth(alice, 'results-midi-defaults')
  await tabletChat('results-midi-defaults')
}

// =================================================================================================
// dnd5e 6.0.5's typed messages
// =================================================================================================
if (DND5E6) {
  /** dnd5e 6's typed message, as its data model has it: `system` with its getters and toObject(). */
  function typed(type, system, fields = {}) {
    const { origin, ...stored } = system
    const model = {
      ...structuredClone(stored), origin: origin ?? null,
      get forceSuccess() { return (type === 'save') && (this.resisted === true) },
      toObject: () => ({ ...structuredClone(stored), origin: origin?.id ?? null }),
    }
    return ChatMessage.create({ type, system: model, flags: {}, ...fields })
  }
  const target = (who, ac) => ({ ac, actor: who.uuid, img: '', name: who.name, token: tokenOf[who.id] })
  part('dnd5e 6')
  settings.set('attackRollVisibility', 'hideAC')
  settings.set('challengeVisibility', 'player')
  {
    const message = await typed('attack', {
      activity: { id: 'chop', name: 'Attack', type: 'attack', uuid: 'Actor.thorin.Item.axe.Activity.chop' },
      item: { id: 'axe', name: 'Battleaxe', type: 'weapon', uuid: 'Actor.thorin.Item.axe' },
      targets: [target(goblin, 13), target(orc, 18)],
    }, { author: 'alice', speaker: speakerOf(thorin), rolls: [await roll20(12, 5, { rollType: 'attack' })] })
    const view = await expect('a dnd5e 6 attack at the goblin and the orc, 17, under "Show only results"', message, { alice: ['Goblin, Hit', 'Orc, Miss'], bob: ['Goblin, Hit', 'Orc, Miss'] })
    check(view.targets.every(t => !('ac' in t)) && !('ac' in (toldOf(message.id).system.targets[0] ?? {})), 'no armor class, in the app\'s view or in the `system` the module sent')
  }
  {
    const card = await ChatMessage.create({ author: 'alice', speaker: speakerOf(thorin), content: '<p>Thunderclap</p>', flavor: 'Thunderclap' })
    const save = await typed('save', { ability: 'con', type: 'ability', origin: card, targets: [] },
      { author: 'bob', speaker: speakerOf(vex), rolls: [await roll20(15, 1, { target: 13 })] })
    await expect("Vex's save by its system.origin, Alice's card, under \"Show only from other players\"", save, { alice: ['Vex, Saved'], bob: ['Vex, Saved'] })
  }
  {
    const usage = await typed('usage', {
      buttons: [{ action: 'rollSave', dataset: { dc: 15, ability: 'dex' }, label: { hidden: 'DEX Saving Throw', value: 'DC 15 DEX Saving Throw' } }],
      targets: [target(vex, 14)],
    }, { author: 'gm', speaker: speakerOf(corvin), content: '<p>Frost Breath</p>' })
    const view = await seen(alice, usage.id)
    const kept = sql(`select data::text from chat_message where "messageId" = '${usage.id}' and "campaignId" = '${A}'`)
    check(!/"dc"|DC 15|"ac"/.test(JSON.stringify(view)) && !/"dc"|DC 15|"ac":14/.test(kept),
      `a usage card's buttons' DC and its target's armor class are in neither the app's view nor what it keeps (${kept.length} characters kept)`)
  }
}

// =================================================================================================
// Gamemaster-only information on: everything
// =================================================================================================
if (!SKEW) {
  part('GM-only details on')
  settings.set('gmContent', true)
  settings.set('attackRollVisibility', 'none')
  settings.set('challengeVisibility', 'none')
  if (MIDI) Object.assign(W.midi.settings, MIDI_DEFAULTS)
  {
    const message = await attack({ targets: [[thorin], [vex]], face: 11 })
    const want = ['Thorin, Miss', 'Vex, Hit']
    const view = await expect('with Gamemaster-only information on, an attack under "Hide all"', message, { alice: want, bob: want })
    check(same(view.targets.map(t => t.ac), [16, 14]), 'the armor classes with them')
    const card = await W.cards.saveCard({ by: corvin, item: corvin.items.get('hail'), dc: 13, abilities: ['dex'], targets: [goblin], author: 'gm' })
    const save = await rollOf({ author: 'gm', by: goblin, face: 16, bonus: 0, dc: 13, from: card })
    await expect('and a save from the Gamemaster\'s card under "Hide all"', save, { alice: ['Goblin, Saved'], bob: ['Goblin, Saved'] })
  }
  settings.set('gmContent', false)
}

// =================================================================================================
// Hit/miss and save results in the app: Always show them to players (module 0.31.0)
// =================================================================================================
// Under dnd5e's "Hide all" and "Show none", and with GM-only details off: every hit, miss and save
// told, but never an armor class or a DC; whispers and blind rolls still only where they may be read.
if (!SKEW) {
  part('Always show them to players')
  settings.set('chatResults', 'always')
  settings.set('gmContent', false)
  settings.set('attackRollVisibility', 'none')
  settings.set('challengeVisibility', 'none')
  if (MIDI) Object.assign(W.midi.settings, MIDI_DEFAULTS)
  const noAc = id => (toldOf(id).dnd5e?.targets ?? []).every(t => !('ac' in t))
  if (!MIDI && !DND5E6) {
    {
      const message = await attack({ targets: [[thorin], [vex]], face: 11 })
      const view = await expect('Always, an attack at Thorin and Vex, 15, under "Hide all"', message, { alice: ['Thorin, Miss', 'Vex, Hit'], bob: ['Thorin, Miss', 'Vex, Hit'] })
      check(noAc(message.id) && view.targets.every(t => !('ac' in t)), `and no armor class, neither in what the module sent nor in the app's view (${JSON.stringify(toldOf(message.id).dnd5e.targets)})`)
      await shootBoth(alice, 'results-always', undefined, SHOTS_031)
    }
    {
      const card = await W.cards.saveCard({ by: corvin, item: corvin.items.get('frost'), dc: 13, abilities: ['dex'], targets: [goblin], author: 'gm' })
      const save = await rollOf({ author: 'gm', by: goblin, face: 16, bonus: 0, dc: 13, from: card })
      await expect('the goblin\'s save from the Gamemaster\'s card, under "Show none"', save, { alice: ['Goblin, Saved'], bob: ['Goblin, Saved'] })
      check(!/"dc"|DC 13/.test(JSON.stringify(toldOf(save.id).dnd5e ?? {})), 'and no DC in what the module sent of it')
    }
    {
      const save = await rollOf({ author: 'alice', by: thorin, face: 17, dc: 14, flavor: 'Dexterity Saving Throw (DC 14)' })
      await expect('Thorin\'s save from a [[/save]] link Alice rolled, under "Show none": Bob\'s to see too', save, { alice: ['Thorin, Saved'], bob: ['Thorin, Saved'] })
      check(same(toldOf(save.id).dnd5e.save, { target: 'Actor.thorin', outcome: 'success' }), `its outcome told for everyone who reads it (${JSON.stringify(toldOf(save.id).dnd5e.save)})`)
    }
    {
      const request = await W.cards.requestCard({ type: 'skill', abilities: ['wis'], dc: 12, author: 'gm' })
      const passed = await rollOf({ author: 'alice', by: thorin, kind: 'check', face: 14, dc: 12, from: request })
      await expect('a Perception check from the Gamemaster\'s request card, 15 against 12, under "Show none"', passed, { alice: ['Thorin, Success'], bob: ['Thorin, Success'] })
    }
    {
      const roll = await roll20(11, 4, { rollType: 'attack' })
      const whispered = await ChatMessage.create({
        author: 'alice', speaker: speakerOf(thorin), rolls: [roll], flavor: 'Longsword - Attack Roll',
        flags: { dnd5e: { messageType: 'roll', roll: { type: 'attack' }, targets: [descriptor(goblin)] } },
      }, { rollMode: 'gmroll' })
      await expect('Alice\'s attack whispered to the Gamemaster: hers to read, with its pill; never Bob\'s', whispered, { alice: ['Goblin, Hit'], bob: null })
      const blindRoll = await roll20(11, 4, { rollType: 'attack' })
      const blind = await ChatMessage.create({
        author: 'alice', speaker: speakerOf(thorin), rolls: [blindRoll], flavor: 'Longsword - Attack Roll',
        flags: { dnd5e: { messageType: 'roll', roll: { type: 'attack' }, targets: [descriptor(goblin)] } },
      }, { rollMode: 'blindroll' })
      await settled()
      await wait(1500)
      check(!toldOf(blind.id) && !(await viewOf(alice, blind.id)) && !(await viewOf(bob, blind.id)), 'a blind roll is never sent, nor shown to either')
    }
  }
  if (MIDI) {
    const midi = W.midi.settings
    const set = changes => Object.assign(midi, MIDI_DEFAULTS, changes)
    const uuid = actor => tokenOf[actor.id]
    const card = async ({ author = 'alice', by = thorin, targets, hit, saved, attackFace, bonus = 5, aimed }) => {
      const attackRoll = (attackFace !== undefined) ? [await roll20(attackFace, bonus, { 'midi-qol': { rollType: 'attack' }, ...(aimed && { target: aimed }) })] : []
      return ChatMessage.create({
        author, speaker: speakerOf(by), rolls: attackRoll, flavor: 'Thundering Strike',
        content: '<div class="midi-qol-hits-display"><div>hit</div></div><div class="midi-qol-saves-display"><div>save</div></div>',
        flags: {
          'midi-qol': {
            messageType: 'attack', GMOnlyAttackRoll: false, targets: targets.map(actor => ({ uuid: uuid(actor) })),
            ...(hit && { hitTargetUuids: hit.map(uuid), hitECTargetUuids: [] }),
            ...(saved && { saveUuids: saved.map(uuid), failedSaveUuids: targets.filter(actor => !saved.includes(actor)).map(uuid) }),
          },
          dnd5e: {
            messageType: 'usage', item: { id: 'strike', type: 'spell' }, activity: { id: 'atk', type: 'attack' },
            targets: targets.map(actor => ({ ...descriptor(actor), ...(saved && { saved: saved.includes(actor) }) })),
          },
        },
      })
    }
    for (const check_ of ['whisper', 'gmOnly']) {
      set({ autoCheckHit: check_ })
      const message = await card({ targets: [goblin, orc], hit: [goblin], attackFace: 12 })
      await expect(`Always, Auto check Hits "${MIDI_WORDS.autoCheckHitOptions[check_]}": Midi's hits told`, message, { alice: ['Goblin, Hit', 'Orc, Miss'], bob: ['Goblin, Hit', 'Orc, Miss'] })
      check(noAc(message.id), 'with no armor class')
    }
    set({ autoCheckHit: 'none' })
    await expect('Always, Auto check Hits "None", at the goblin alone, its d20 against AC 13', await card({ targets: [goblin], attackFace: 13, aimed: 13 }),
      { alice: ['Goblin, Hit'], bob: ['Goblin, Hit'] })
    {
      const message = await card({ targets: [goblin, orc], attackFace: 12 })
      await expect('and at the goblin and the orc, 17, each judged by the armor class Midi wrote on its card', message, { alice: ['Goblin, Hit', 'Orc, Miss'], bob: ['Goblin, Hit', 'Orc, Miss'] })
      check(noAc(message.id), 'with no armor class sent')
      await shootBoth(alice, 'results-always-midi', undefined, SHOTS_031)
    }
    set({ autoCheckSaves: 'whisper' })
    await expect('Always, Auto check Saves "only GM sees results + rolls": Midi\'s saves told',
      await card({ author: 'gm', by: corvin, targets: [vex, goblin], saved: [vex] }), { alice: ['Vex, Saved', 'Goblin, Failed'], bob: ['Vex, Saved', 'Goblin, Failed'] })
    set({ autoCheckHit: 'none', gmAttackDisplay: 'hidden' })
    {
      const message = await card({ author: 'gm', by: orc, targets: [thorin], attackFace: 14, aimed: 16 })
      const view = await expect('Always, the Gamemaster\'s orc at Thorin under GM Attack Roll Display "Hidden": its hit told', message, { alice: ['Thorin, Hit'], bob: ['Thorin, Hit'] })
      const [shown] = view.rolls
      check(shown.formula === '' && same(shown.dice, []) && shown.total === null, `while its attack still shows "–", as Midi trims it (${JSON.stringify(shown)})`)
    }
    set({})
    {
      // A save Midi shows players as "??": told nothing, Always or not.
      const roll = await roll20(15, 1, { target: 13 })
      const save = await ChatMessage.create({
        author: 'gm', speaker: speakerOf(goblin), rolls: [roll], flavor: 'Dexterity Saving Throw',
        flags: { dnd5e: { messageType: 'roll', roll: { type: 'save', ability: 'dex' } }, 'midi-qol': { obscureRoll: true } },
      })
      await wait(1500)
      const toldSave = toldOf(save.id)
      check(!toldSave || !toldSave.dnd5e?.save?.outcome, `an obscured save tells no outcome (${JSON.stringify(toldSave?.dnd5e?.save ?? null)})`)
    }
  }
  if (DND5E6) {
    function typed(type, system, fields = {}) {
      const { origin, ...stored } = system
      const model = { ...structuredClone(stored), origin: origin ?? null, get forceSuccess() { return false }, toObject: () => ({ ...structuredClone(stored), origin: origin?.id ?? null }) }
      return ChatMessage.create({ type, system: model, flags: {}, ...fields })
    }
    const target = (who, ac) => ({ ac, actor: who.uuid, img: '', name: who.name, token: tokenOf[who.id] })
    {
      const message = await typed('attack', {
        activity: { id: 'chop', name: 'Attack', type: 'attack', uuid: 'Actor.thorin.Item.axe.Activity.chop' },
        item: { id: 'axe', name: 'Battleaxe', type: 'weapon', uuid: 'Actor.thorin.Item.axe' },
        targets: [target(goblin, 13), target(orc, 18)],
      }, { author: 'alice', speaker: speakerOf(thorin), rolls: [await roll20(12, 5, { rollType: 'attack' })] })
      const view = await expect('Always, a dnd5e 6 attack at the goblin and the orc, 17, under "Hide all"', message, { alice: ['Goblin, Hit', 'Orc, Miss'], bob: ['Goblin, Hit', 'Orc, Miss'] })
      check(view.targets.every(t => !('ac' in t)) && (toldOf(message.id).system?.targets ?? []).every(t => !('ac' in t)), 'with no armor class in the app\'s view or the `system` sent')
    }
    {
      const origin = await ChatMessage.create({ author: 'alice', speaker: speakerOf(thorin), content: '<p>Thunderclap</p>', flavor: 'Thunderclap' })
      const save = await typed('save', { ability: 'con', type: 'ability', origin, targets: [] },
        { author: 'bob', speaker: speakerOf(vex), rolls: [await roll20(15, 1, { target: 13 })] })
      await expect('Vex\'s save by its system.origin, Alice\'s card, under "Show none"', save, { alice: ['Vex, Saved'], bob: ['Vex, Saved'] })
      check(!/"dc"|DC 13/.test(JSON.stringify(toldOf(save.id).system ?? {})), 'with no DC in the `system` sent')
    }
  }
  settings.set('chatResults', 'foundry')
}

await finish()
