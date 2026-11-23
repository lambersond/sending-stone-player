// Summon activities cast from the app (module 0.54.0 and the app, ROADMAP item 59), end to end, in
// the world of world-030.mjs with scenes and tokens (fvtt/token-core.mjs) and dnd5e's summon activity,
// its card's Summon button and its dialog (the module's fvtt/activity5e.mjs). Alice plays Thorin in
// Ashlands: Find Familiar, a Bat, a Cat or an Owl, Celestial, Fey or Fiend; Summon Beast, a Land or
// Sea spirit, an Air one from the 3rd level; Conjure Animals, by Challenge Rating; a Find Familiar
// of dnd5e's fourteen creatures; and Pack of Wolves, a feature summoning two wolves once a day.
// 1. The hello's rolls carry summons and the app answers summons: 1.
// 2. Find Familiar has Cast, not "Used in Foundry"; its picker offers the creatures and types and
//    says who places it; Owl, Fey, Cast: a 1st-level slot spent, the tray's line, the card's
//    "Chosen on Sending Stone: Owl (Fey)".
// 3. The Gamemaster clicks the card's Summon button: dnd5e's dialog has the Owl and Fey chosen; the
//    token placed as dnd5e places it, an Owl tab, "Summoned by Thorin with Find Familiar", its
//    Perception rolled.
// 4. Summon Beast: Land and Sea at the 2nd, Air too at the 3rd, cast as Air, concentration shown;
//    Conjure Animals' labels at the 3rd and the 5th.
// 5. Pack of Wolves used at once, "…places the creatures in Foundry", its card with no line.
// 6. The Gamemaster's seat casts Find Familiar for Thorin: "You place it…".
// 7. The keyboard and the layout at 390: focus in the picker, Tab through each chip to Cast, the
//    chips wrapping with nothing sideways; the fourteen listed one under another.
// MIDI=1: the uses through Midi-QOL's stand-in. DND5E6=1: dnd5e 6.0.5's card and dice. SKEW=053 with
// MODULE=module-0.53.0: nothing to cast, and no request naming a summon.
// Synthetic characters only. Run with --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs.
// Screenshots to SHOTS.
import {
  DND5E6, MIDI, W, activeScene, browse, character, check, companion, finish, focusInside, foundryWorld, launch,
  newCampaign, part, place, postsOf, same, sameJson, sceneWorld, settled, shootBoth, sideways, sql, startModule, summoned, until,
} from './world-030.mjs'
import { JSDOM } from 'jsdom'

/** Module 0.53.0, which casts no summon activity (the app's ROADMAP item 59). */
const SKEW053 = process.env.SKEW === '053'
const NEW = !SKEW053
const GAME = 'https://ashlands-summons.forge-vtt.com'
const SECRET = 'ashlands-summons-54'
const TITLE = 'Ashlands'
await launch(GAME)
const { id: A } = await newCampaign({ title: TITLE, address: 'ashlands-summons.forge-vtt.com', secret: SECRET })
await foundryWorld({ dice6: DND5E6 })
await sceneWorld()
game.modules.get('sending-stone').version = SKEW053 ? '0.53.0' : '0.54.0'
const { clickSummon, screen } = await import('./fvtt/activity5e.mjs')
const { renderCard } = await import('./fvtt/dish-core.mjs')

// ---- dnd5e, as far as summons read it ----
// config.mjs's creature types and sizes, as dnd5e's dialog labels a summon's choices by them.
Object.assign(CONFIG.DND5E, {
  creatureTypes: { beast: { label: 'Beast' }, celestial: { label: 'Celestial' }, fey: { label: 'Fey' }, fiend: { label: 'Fiend' } },
  actorSizes: { tiny: { label: 'Tiny' }, sm: { label: 'Small' }, med: { label: 'Medium' }, lg: { label: 'Large' } },
})
/**
 * Arithmetic as dnd5e's simplifyRollFormula and simplifyBonus work it out of these summons'
 * formulas, their data put in already: numbers, + - * / and floor; anything else kept as written.
 */
const arithmetic = formula => {
  const text = String(formula ?? '').trim()
  if (!text || !/^[\d\s+\-*/().]*$/.test(text.replace(/floor/g, ''))) return null
  return Function('const floor = Math.floor; return (' + text + ')')()
}
// dice/simplify-roll-formula.mjs and utils.mjs's formatCR and simplifyBonus, for these formulas.
globalThis.dnd5e.dice.simplifyRollFormula = formula => {
  const value = arithmetic(formula)
  return (value === null) ? String(formula ?? '').trim() : String(value)
}
globalThis.dnd5e.utils = {
  ...globalThis.dnd5e.utils,
  formatCR: value => ((value === null) ? '—' : ({ 0.125: '⅛', 0.25: '¼', 0.5: '½' }[value] ?? String(value))),
  simplifyBonus: (bonus, data = {}) => {
    if (!bonus) return 0
    if (/^-?\d+(\.\d+)?$/.test(String(bonus).trim())) return Number(bonus)
    return arithmetic(Roll.replaceFormulaData(String(bonus), data)) ?? 0
  },
}
// The creatures summoned, as dnd5e's compendium holds them, found as fromUuidSync finds them, before
// the world's and the scenes' own.
const FOURTEEN = ['Bat', 'Cat', 'Crab', 'Frog', 'Hawk', 'Lizard', 'Octopus', 'Owl', 'Poisonous Snake', 'Quipper', 'Rat', 'Raven', 'Spider', 'Weasel']
const CREATURES = Object.fromEntries([...FOURTEEN, 'Wolf', 'Bestial Spirit'].map(name => [`Compendium.dnd5e.monsters.Actor.${name.replace(/\W/g, '').padEnd(16, '0')}`, { name }]))
const MONSTER = name => Object.keys(CREATURES).find(uuid => CREATURES[uuid].name === name)
const worldSync = globalThis.fromUuidSync
globalThis.fromUuidSync = (uuid, options) => CREATURES[uuid] ?? worldSync?.(uuid, options) ?? null

// ---- The world ----
const profile = (_id, fields = {}) => ({ _id, count: '', cr: '', name: '', uuid: '', level: { min: null, max: null }, types: [], ...fields })
/** A spell Thorin casts with an action through its summon activity, its duration the spell's. */
const summonSpell = (id, name, level, activity, system = {}) => ({
  id, name, type: 'spell',
  system: { level, method: 'spell', prepared: 1, canPrepare: true, properties: [], duration: { units: 'hour', value: 1 }, ...system },
  activities: [{ type: 'summon', affects: '', activation: { type: 'action', value: 1 }, duration: { override: false }, ...activity }],
})
const P = {
  bat: 'batProfile000000', cat: 'catProfile000000', owl: 'owlProfile000000', land: 'landProfile00000', sea: 'seaProfile000000',
  air: 'airProfile000000', wolves: 'wolvesProfile000',
}
const FAMILIAR = [profile(P.bat, { uuid: MONSTER('Bat') }), profile(P.cat, { uuid: MONSTER('Cat') }), profile(P.owl, { uuid: MONSTER('Owl') })]
const level = n => [`spell${n}`, { value: [0, 4, 3, 3, 3, 2][n] ?? 0, max: [0, 4, 3, 3, 3, 2][n] ?? 0, level: n }]
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 1, dex: 1, con: 2, wis: 3 }, skills: { prc: { ability: 'wis' } }, hp: { value: 50, max: 60, temp: 0 } }, {
  ac: 15,
  spells: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(level)),
  items: [
    summonSpell('findFamiliar', 'Find Familiar', 1, { id: 'ffSummon', profiles: FAMILIAR, creatureTypes: ['celestial', 'fey', 'fiend'] }),
    summonSpell('summonBeast', 'Summon Beast', 2, {
      id: 'sbSummon',
      profiles: [profile(P.land, { name: 'Land', uuid: MONSTER('Bestial Spirit') }), profile(P.sea, { name: 'Sea', uuid: MONSTER('Bestial Spirit') }),
        profile(P.air, { name: 'Air', uuid: MONSTER('Bestial Spirit'), level: { min: 3, max: null } })],
    }, { properties: ['concentration'] }),
    // Conjure Animals, by Challenge Rating (spells/3rd-level/conjure-animals.yml).
    summonSpell('conjureAnimals', 'Conjure Animals', 3, {
      id: 'caSummon', summon: { mode: 'cr', prompt: true },
      profiles: [['caCr2', '2', 1], ['caCr1', '1', 2], ['caCrHalf', '0.5', 4], ['caCrQuarter', '0.25', 8]].map(([id, cr, n]) =>
        profile(id.padEnd(16, '0'), { cr, count: `${n} * floor((@item.level - 1) / 2)`, types: ['beast'] })),
    }, { properties: ['concentration'] }),
    // Find Familiar with dnd5e's own fourteen creatures, listed one under another.
    summonSpell('familiarPack', 'Find Familiar (all fourteen)', 1, {
      id: 'fpSummon', profiles: FOURTEEN.map(name => profile(`fp${name.replace(/\W/g, '')}`.padEnd(16, '0'), { uuid: MONSTER(name) })),
    }),
    // Pack of Wolves, a feature: two wolves, once a day.
    { id: 'packOfWolves', name: 'Pack of Wolves', type: 'feat', system: { properties: [], uses: { max: 1, spent: 0, recovery: [{ period: 'lr' }] } },
      activities: [{ id: 'pwSummon', type: 'summon', affects: '', activation: { type: 'action', value: 1 }, consumption: [{ type: 'itemUses', value: '1' }],
        profiles: [profile(P.wolves, { count: '2', uuid: MONSTER('Wolf') })] }] },
  ],
})
thorin.system.details = { ...thorin.system.details, level: 9 }
// actor.mjs's beginConcentrating, as casting a concentration spell begins it: the cards'
// concentration on the item, then Foundry tells every client of the new effect.
thorin.beginConcentrating = async activity => {
  const effect = thorin.concentrateOn(activity.item.name, { id: activity.item.id })
  await Hooks.callAll('createActiveEffect', effect, {}, 'gm')
  return effect
}
game.users.get('alice').character = thorin
// The Owl, Find Familiar's, as dnd5e imports it for a summon.
const owl = companion('owl', 'Owl', {
  owners: ['alice'], linked: false, ac: 11,
  npc: {
    flags: { dnd5e: { isAutoImported: true } },
    spec: { mods: { dex: 1, wis: 1 }, prof: 2, skills: { prc: { ability: 'wis' } }, hp: { value: 1, max: 1, temp: 0 } },
    system: { traits: { size: 'tiny' }, details: { cr: 0, type: { value: 'beast', label: 'Beast' }, alignment: 'Unaligned' }, attributes: { movement: { walk: 5, fly: 60, units: 'ft' }, init: { total: 1 } } },
  },
})
const arena = await activeScene('arena')
// The scene dnd5e's summoning reads as the Gamemaster's (summon.mjs's canvas.scene).
globalThis.canvas ??= {}
canvas.scene ??= arena
await place(arena, thorin, { id: 'tok-thorin', actorLink: true, tell: false })
W.gm.targets = new Set()
await startModule({ campaigns: [{ id: 'camp-ash', title: TITLE, characters: ['thorin'], groups: [], rolls: true, attacks: true, prompts: true }], secrets: { 'camp-ash': SECRET } })
await settled()

// ---- What's posted, kept and made ----
const hello = () => postsOf('bridge.hello').at(-1)
const requests = () => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}'`))
const rollRow = id => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, "actorId", payload, result from roll_request where id = '${id}') r`) || 'null')
const rowsSince = count => JSON.parse(sql(`select coalesce(json_agg(r order by r."createdAt")::text, '[]') from (select id, kind, status, "actorId", payload, "createdAt" from roll_request where "campaignId" = '${A}' order by "createdAt" offset ${count}) r`))
const useCard = id => W.messages.contents.find(m => m.flags?.['sending-stone']?.use === id)
/**
 * A card, drawn as the Gamemaster's client draws it, with jsdom's document as the page's, as
 * cookbook-e2e draws one; the module's line drawn on it among dnd5e's hooks.
 */
async function drawn(message) {
  const dom = new JSDOM('')
  const held = { document: globalThis.document, HTMLElement: globalThis.HTMLElement }
  Object.assign(globalThis, { document: dom.window.document, HTMLElement: dom.window.HTMLElement })
  try {
    return await renderCard(message)
  } finally {
    Object.assign(globalThis, held)
  }
}
const linesOf = html => [...html.querySelectorAll('.sending-stone-summon-choice')].map(line => line.textContent)
const slots = () => Object.fromEntries(Object.entries(thorin.system.spells).filter(([, pool]) => pool.max).map(([key, pool]) => [key, pool.value]))
const paced = () => until(() => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}' and "createdAt" > now() - interval '1 minute'`)) < 15, 'room under the rate limit', 70_000)
/** Send what a tap uses or rolls, and wait until the game has made it, or refused it. */
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
const alice = await browse({ device: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 }, path: '/characters/sheet-thorin', toasts: false })
await alice.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })

/** The button that casts or uses an item, by its exact name. */
const button = (who, name) => who.page.getByRole('button', { name, exact: true }).first()
const pickerOf = (who, name) => who.page.getByRole('dialog', { name })
/** A row of the picker's chips, by its legend: each chip's accessible name, whether it's chosen, and its text. */
const chips = (picker, legend) => picker.getByRole('group', { name: legend, exact: true }).getByRole('radio')
  .evaluateAll(all => all.map(chip => [chip.getAttribute('aria-label'), chip.getAttribute('aria-checked'), chip.textContent.trim()]))
const status = who => who.page.getByRole('region', { name: 'Your rolls' }).getByRole('status')
const trayShows = async (who, text) => {
  await status(who).getByText(text, { exact: false }).first().waitFor({ timeout: 20_000 })
  return (await status(who).textContent()).trim()
}
const switcher = who => who.page.getByRole('tablist', { name: 'Character and companions' })
const tabOf = (who, key) => who.page.locator(`#creature-tab-${key}`)
const panelOf = (who, key) => who.page.locator(`#creature-panel-${key}`)
const describedAs = (who, key) => tabOf(who, key).evaluate(tab => document.getElementById(tab.getAttribute('aria-describedby'))?.textContent ?? null)
const summonRequests = () => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}' and payload::jsonb ? 'summon'`))
const PLAIN = !MIDI && !DND5E6

// =================================================================================================
// 1. The hello
// =================================================================================================
part('1. the hello')
{
  const { data } = hello()
  const answer = JSON.parse(hello().body ?? '{}')
  if (NEW) {
    check(data.features?.rolls?.summons === true && Object.keys(data.features.rolls).at(-1) === 'summons' && answer.features?.summons === 1,
      `the hello's rolls end with summons, true, and the app answers summons: 1 (${answer.features?.summons})`)
  } else {
    check(!('summons' in (data.features?.rolls ?? {})) && answer.features?.summons === 1,
      `module 0.53.0's hello says nothing of summons, the app answering summons: 1 all the same (${answer.features?.summons})`)
  }
}

if (NEW) {
  // ===============================================================================================
  // 2. Find Familiar cast as an Owl, Fey
  // ===============================================================================================
  part('2. find familiar')
  await alice.tab('Spells')
  const cast = button(alice, 'Cast Find Familiar')
  await cast.waitFor({ timeout: 20_000 })
  const row = cast.locator('xpath=ancestor::li[1]')
  check(!/Used in Foundry/.test(await row.textContent()), 'Find Familiar on the Spells tab has Cast, and isn\'t "Used in Foundry"')
  await cast.click()
  const picker = pickerOf(alice, 'Find Familiar')
  await picker.waitFor({ timeout: 10_000 })
  const line = 'Your Gamemaster places it in Foundry from the card.'
  check(same(await chips(picker, 'Creature'), [['Bat', 'true', 'Bat'], ['Cat', 'false', 'Cat'], ['Owl', 'false', 'Owl']])
    && same((await chips(picker, 'Type')).map(([name, chosen]) => [name, chosen]), [['Celestial', 'true'], ['Fey', 'false'], ['Fiend', 'false']])
    && await picker.getByRole('group', { name: 'Size', exact: true }).count() === 0
    && await picker.getByText(line, { exact: true }).count() === 1,
    `its picker: Creature Bat, Cat, Owl; Type Celestial, Fey, Fiend; no Size; and "${line}"`)
  await picker.getByRole('radio', { name: 'Owl', exact: true }).click()
  await picker.getByRole('radio', { name: 'Fey', exact: true }).click()
  if (PLAIN) await shootBoth(alice, 'summons-familiar-picker', picker)
  const before = slots()
  const { request, made } = await sent(() => picker.getByRole('button', { name: 'Cast', exact: true }).click(), 'Find Familiar')
  check(request.kind === 'use' && sameJson(request.payload.summon, { profile: P.owl, type: 'fey' }) && same(request.payload.targets, []) && request.payload.slot === 'spell1'
    && !('self' in request.payload) && made.status === 'done',
    `sent as the Owl, Fey, at no one, with a 1st-level slot, and made (${JSON.stringify(request.payload.summon)}, ${made.status})`)
  const tray = await trayShows(alice, 'places the creature in Foundry')
  check(/Cast at the table · your Gamemaster places the creature in Foundry/.test(tray), `the tray: "${tray}"`)
  await alice.page.getByText('3 of 4 spell slots left').first().waitFor({ timeout: 20_000 })
  check(slots().spell1 === before.spell1 - 1, `a 1st-level slot spent in the game, and the sheet says 3 of 4 left (${slots().spell1})`)
  const owlCard = useCard(request.id)
  const html = await drawn(owlCard)
  check(same(linesOf(html), ['Chosen on Sending Stone: Owl (Fey)']) && !!html.querySelector('[data-action="placeSummons"]'),
    `its card has dnd5e's Summon button and the line "${linesOf(html)[0]}"`)

  // ===============================================================================================
  // 3. The Gamemaster places it
  // ===============================================================================================
  part('3. the gamemaster places it')
  const opened = screen.summonDialogs.length
  const done = clickSummon(owlCard, html)
  await until(() => (screen.summonDialogs.length > opened) && (screen.summonDialogs.at(-1).renders > 0), 'dnd5e\'s summoning dialog', 10_000)
  const dialog = screen.summonDialogs.at(-1)
  const field = name => [...dialog.form.elements].find(element => element.name === name)?.value ?? null
  check(field('summons.profile') === P.owl && field('summons.creatureType') === 'fey',
    `the card's Summon button opens dnd5e's dialog with the Owl and Fey chosen (${field('summons.profile')}, ${field('summons.creatureType')})`)
  await dialog.use()
  await done
  const placedAs = screen.placed.at(-1)
  check(placedAs?.profile === P.owl && placedAs.creatureType === 'fey' && placedAs.item === 'findFamiliar', `dnd5e places the Owl, Fey (${JSON.stringify(placedAs)})`)
  // The token dnd5e's placeSummons would make: the Owl, summoned by Thorin with Find Familiar.
  await summoned(arena, owl, thorin, 'findFamiliar', { id: 'owl1', name: 'Owl', activity: 'ffSummon' })
  const OWL = 'arena-owl1'
  await switcher(alice).waitFor({ timeout: 30_000 })
  await tabOf(alice, OWL).waitFor({ timeout: 30_000 })
  check(await describedAs(alice, OWL) === 'Summoned by Thorin with Find Familiar', `an Owl tab: "${await describedAs(alice, OWL)}"`)
  await tabOf(alice, OWL).click()
  const perception = panelOf(alice, OWL).getByRole('button', { name: /^Perception/ }).first()
  await perception.waitFor({ timeout: 20_000 })
  const rolled = await sent(() => perception.click(), "the Owl's Perception")
  check(rolled.request.kind === 'skill' && rolled.request.actorId === OWL && rolled.made.status === 'done', `its Perception rolled and made (${rolled.made.status})`)
  await tabOf(alice, 'self').click()

  // ===============================================================================================
  // 4. Summon Beast and Conjure Animals
  // ===============================================================================================
  part('4. summon beast and conjure animals')
  await alice.tab('Spells')
  await button(alice, 'Cast Summon Beast').click()
  let beast = pickerOf(alice, 'Summon Beast')
  await beast.waitFor({ timeout: 10_000 })
  const atSecond = (await chips(beast, 'Creature')).map(([name]) => name)
  await beast.getByRole('radio', { name: '3rd Level, 3 slots left', exact: true }).click()
  const atThird = (await chips(beast, 'Creature')).map(([name]) => name)
  check(same(atSecond, ['Land', 'Sea']) && same(atThird, ['Land', 'Sea', 'Air']), `Summon Beast: ${atSecond.join(', ')} at the 2nd; ${atThird.join(', ')} at the 3rd`)
  await beast.getByRole('radio', { name: 'Air', exact: true }).click()
  const air = await sent(() => beast.getByRole('button', { name: 'Cast', exact: true }).click(), 'Summon Beast')
  check(sameJson(air.request.payload.summon, { profile: P.air }) && air.request.payload.slot === 'spell3' && air.made.status === 'done',
    `cast at the 3rd as the Air spirit (${JSON.stringify(air.request.payload.summon)})`)
  await until(() => [...thorin.concentration.items].some(item => item.id === 'summonBeast'), 'concentration on Summon Beast')
  await alice.tab('Character')
  const conditions = alice.page.getByRole('list', { name: 'Conditions' })
  await conditions.getByRole('button', { name: /Concentrating/ }).filter({ hasText: 'Summon Beast' }).waitFor({ timeout: 20_000 })
  check(true, `concentration begun, and the sheet says so: "${(await conditions.textContent()).trim()}"`)
  await alice.tab('Spells')
  await button(alice, 'Cast Conjure Animals').click()
  const animals = pickerOf(alice, 'Conjure Animals')
  await animals.waitFor({ timeout: 10_000 })
  const cr = n => `Challenge Rating of ${n} or lower`
  const third = (await chips(animals, 'Creature')).map(([, , text]) => text)
  await animals.getByRole('radio', { name: '5th Level, 2 slots left', exact: true }).click()
  const fifth = await chips(animals, 'Creature')
  check(same(third, [`1 × ${cr(2)}`, `2 × ${cr(1)}`, `4 × ${cr('½')}`, `8 × ${cr('¼')}`])
    && same(fifth.map(([, , text]) => text), [`2 × ${cr(2)}`, `4 × ${cr(1)}`, `8 × ${cr('½')}`, `16 × ${cr('¼')}`])
    && fifth[1][0] === `${cr(1)}, 4 of them`,
    `Conjure Animals as dnd5e labels it: "${third[1]}" at the 3rd, "${fifth[1][2]}" at the 5th, told "${fifth[1][0]}"`)
  if (PLAIN) await shootBoth(alice, 'summons-conjure-picker', animals)
  await alice.page.keyboard.press('Escape')
  await animals.waitFor({ state: 'hidden', timeout: 10_000 })

  // ===============================================================================================
  // 5. Pack of Wolves
  // ===============================================================================================
  part('5. pack of wolves')
  await alice.tab('Features')
  const wolves = button(alice, 'Use Pack of Wolves')
  await wolves.waitFor({ timeout: 20_000 })
  const pack = await sent(() => wolves.click(), 'Pack of Wolves')
  check(await alice.page.getByRole('dialog').count() === 0 && sameJson(pack.request.payload.summon, { profile: P.wolves }) && pack.made.status === 'done',
    `used at once, nothing asked, with its one creature (${JSON.stringify(pack.request.payload.summon)})`)
  const packTray = await trayShows(alice, 'places the creatures in Foundry')
  check(/Used at the table · your Gamemaster places the creatures in Foundry/.test(packTray), `the tray: "${packTray}"`)
  check(same(linesOf(await drawn(useCard(pack.request.id))), []), 'its card, which dnd5e asks nothing on, has no line')

  // ===============================================================================================
  // 6. The Gamemaster's seat
  // ===============================================================================================
  part('6. the gamemaster casts it')
  const gm = await browse({ width: 1280, height: 900, path: `/campaigns/${A}/characters/thorin`, toasts: false })
  await gm.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await gm.tab('Spells')
  await button(gm, 'Cast Find Familiar').click()
  const gmPicker = pickerOf(gm, 'Find Familiar')
  await gmPicker.waitFor({ timeout: 10_000 })
  check(await gmPicker.getByText('You place it in Foundry from the card.', { exact: true }).count() === 1, 'at the Gamemaster\'s seat: "You place it in Foundry from the card."')
  const gmCast = await sent(() => gmPicker.getByRole('button', { name: 'Cast', exact: true }).click(), 'Find Familiar from the Gamemaster\'s seat')
  const gmTray = await trayShows(gm, 'place the creature in Foundry')
  check(gmCast.made.status === 'done' && sameJson(gmCast.request.payload.summon, { profile: P.bat, type: 'celestial' }) && /Cast at the table · you place the creature in Foundry/.test(gmTray),
    `cast for Thorin as the Bat, Celestial: "${gmTray}"`)
  await gm.view.close()

  // ===============================================================================================
  // 7. The keyboard and the layout at 390
  // ===============================================================================================
  part('7. keyboard and layout')
  const phone = await browse({ device: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, path: '/characters/sheet-thorin', toasts: false })
  await phone.page.getByRole('navigation', { name: 'Table' }).waitFor({ timeout: 20_000 })
  await phone.character()
  await phone.tab('Spells')
  const phoneCast = button(phone, 'Cast Find Familiar')
  await phoneCast.focus()
  await phone.page.keyboard.press('Enter')
  const phonePicker = pickerOf(phone, 'Find Familiar')
  await phonePicker.waitFor({ timeout: 10_000 })
  await focusInside(phonePicker)
  const inside = await phonePicker.evaluate(el => el.contains(document.activeElement))
  const order = []
  for (let i = 0; i < 16; i++) {
    const at = await phone.page.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent?.trim() || '')
    order.push(at)
    if (at === 'Cast') break
    await phone.page.keyboard.press('Tab')
  }
  const wanted = ['Bat', 'Cat', 'Owl', 'Celestial', 'Fey', 'Fiend', 'Cast']
  const reached = order.filter(name => wanted.includes(name))
  check(inside && same(reached, wanted), `focus inside the picker as it opens; Tab reaches each Creature and Type chip, then Cast (${JSON.stringify(order)})`)
  const fits = await phonePicker.evaluate(el => [...el.querySelectorAll('fieldset')].every(set => set.scrollWidth <= set.clientWidth))
  check(fits && await sideways(phone.page) === 0, 'at 390 the chips wrap inside the picker, and nothing scrolls sideways')
  if (PLAIN) await shootBoth(phone, 'summons-familiar-picker', phonePicker)
  await phone.page.keyboard.press('Escape')
  await phonePicker.waitFor({ state: 'hidden', timeout: 10_000 })
  await button(phone, 'Cast Find Familiar (all fourteen)').click()
  const fourteen = pickerOf(phone, 'Find Familiar (all fourteen)')
  await fourteen.waitFor({ timeout: 10_000 })
  const listed = await fourteen.getByRole('radiogroup', { name: 'Creature' }).getByRole('radio').allTextContents()
  check(same(listed.map(text => text.trim()), FOURTEEN) && await sideways(phone.page) === 0,
    `dnd5e's fourteen creatures listed one under another at 390, nothing sideways (${listed.length})`)
  if (PLAIN) await shootBoth(phone, 'summons-fourteen-picker', fourteen)
  await phone.view.close()
} else {
  // ===============================================================================================
  // 2. Module 0.53.0
  // ===============================================================================================
  part('2. module 0.53.0')
  await alice.tab('Spells')
  await alice.page.getByRole('tabpanel').getByText('Find Familiar', { exact: true }).first().waitFor({ timeout: 20_000 })
  check(await button(alice, 'Cast Find Familiar').count() === 0, 'with module 0.53.0 Find Familiar has no Cast: it\'s cast in Foundry, as before')
  await alice.tab('Features')
  await alice.page.getByRole('tabpanel').getByText('Pack of Wolves', { exact: true }).first().waitFor({ timeout: 20_000 })
  check(await button(alice, 'Use Pack of Wolves').count() === 0 && summonRequests() === 0, 'nor Pack of Wolves a Use chip; and no request names a summon')
}

await alice.view.close()
await finish()
