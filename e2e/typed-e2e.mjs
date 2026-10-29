// Players typing in what their own dice show (module 0.32.0 and the app, its contract §9.2), end to end,
// in the world of world-030.mjs, with dnd5e 5.3.3's real dice classes or, with DND5E6=1, 6.0.5's. Alice
// plays Thorin, his assigned Character in Foundry, with the Trusted role, which Make Manual Rolls is
// given to by default; Bob plays Vex with the Player role, which it isn't. The campaign rolls, attacks
// and asks in the app and allows players to enter their dice results, and Manual Dice is on: the hello
// says Thorin's player may and Vex's may not, so Thorin's cog has the switch, Vex's and the
// Gamemaster's page's don't. Turned on at 390, a 768 page follows. Then every roll Thorin makes with
// his own dice asks for them, a box each, typed on the dialog's keypad: a Perception check (no dice
// thrown, the toast at once, `typed: true` on the request and the keyboard badge on Foundry's card);
// advantage and disadvantage from the menu, and from Modify Roll, the first box focused once it closes;
// Elven Accuracy's third d20 on the rapier (a finesse weapon, Dexterity over Strength), two on the
// greataxe; Modify Roll's +1d4 its own box, and the rapier's own magic d4 Foundry's; the rapier's damage after a hit,
// a typed natural 20 asking for the game's doubled 2d8, its card 2d8 + 3 (under Midi-QOL's "Double
// Rolled Damage" for the Gamemaster too), more dice and another die changing the boxes, maximum asking
// for none; Fireball at two foes, its damage offered and waiting for a tap, eight boxes, the tap made
// from the Combat tab at 390 and at 768, the dialog over the page and not in the hidden sheet; hit
// dice, a d10's 0 typed as 10, and three of two sizes at once; Light's 1d4, a description's 1d100 typed
// 00 and its damage as a critical, and its save link; a death save and initiative; a save the game asks
// for, its time left shown. A d6 typed 7 says what a d6 shows, Done with a box empty says to type every
// die; Escape cancels, posting nothing, the damage still offered; with Send to the table off, nothing
// posted. Make Manual Rolls taken away, the switch goes within a poll and the next roll is thrown and
// sent untyped, the choice kept; given back, it's on again. The dialog at 360×640, 390×844, 768×1024,
// 1280×800 and 844×390 in both themes, and with 40 boxes at 390×844 and 844×390, scrolled, the keypad
// and Done kept flush in view. Since module 0.33.0's feedback: no "Next die" on a single die's keypad
// nor on the last box, back again on an earlier one; Enter on it, from the keyboard at 1280, focusing
// the last box; and the keypad a row shorter with no gap at 390×844 (two dice, and 40 that scroll), the
// compact one the same height with Delete four keys wide at 844×390. The Gamemaster's page throws its dice. MIDI=1: Midi-QOL's prompt, its
// 5 s shown and closing the dialog by itself, and a prompt rolled in Foundry closing it; the rapier's
// attack through Midi's workflow takes the three typed d20s. DND5E6=1: the check, Elven Accuracy,
// damage (Modify damage and Maximum offered, as under 5.3.3), the use's damage and hit dice under dnd5e
// 6.0.5's dice. SKEW=031 with MODULE=module-0.31.0: no switch for anyone, two d20s thrown for Elven
// Accuracy, and a crafted `typed` taken (202) and stripped. Since module 0.42.0 (its contract §8.5),
// the dice Thorin's effects add, as the module's harness has effects (fvtt/effects-core.mjs): the
// Gamemaster applies Vex's Bless, from his concentration, and within a poll Thorin's sheet lists it as
// "Bless", never Vex; Perception asks no die for it, a Dexterity save asks "Bless: +1d4" with Skip,
// typed (the card's d4 the typed one, the tray's total the table's) or skipped (the game's, said in the
// total), then typed in again; Grukk, a goblin shaman, adds Bane, "Bane: −1d4", Grukk named nowhere in
// the dialog; Bane alone, a lone −1d4; the rapier's Bless; Athletic Guidance on Athletics, not
// Acrobatics; at 1280 from the keyboard, Skip to the next box, Next die past a skipped die, Enter on
// the last box shown as Done; at 390×844, 360×640 and 844×390 the rapier's three d20s, Bless and Bane,
// Skip and Type it in 44 px tall on a phone and clear of the keypad once focused, beside the dice in
// the compact layout; dnd5e's concentration card asking a die only concentration adds. Rerolls at the
// table: the greatsword's 2d6r<=2 typed 1 and 5 stands, without r<=2, the dialog's note said and the
// tray's total at once; a Halfling's typed 1 stands; an exploding 1d6x, no note, Foundry's die more and
// the game's total; screenshots to shots-042. MIDI=1 also: Midi's save asks Bless's die, and Midi's
// concentration check, made with dnd5e's, asks the die only a concentration check adds too, its total
// the game's. DND5E6=1: no effect's die, rerolls kept.
// Since app 0.42.1 (round 0.42.1 §7.4): Elven Accuracy's third d20 on a line of its own, "Elven
// Accuracy: third d20", after the two of "d20, advantage", with Skip where the roll goes to the game:
// typed, the card's d20s the three typed; skipped, "The game rolls Elven Accuracy’s d20." and the total
// "not counting" it, Type it in bringing its box back, two d20s sent and the card's third Foundry's,
// the tray's table total the card's; no Skip with Send to the table off; at 390×844, 360×640 and
// 844×390 its Skip and Type it in beside Bless's and Bane's. Since module 0.42.1, step 5c: Vex, a
// level 4 bard, has the 2024 Bardic Inspiration, its Inspired effect and a d6 on his scale; the
// Gamemaster applies Inspired to Thorin, and within a poll his sheet offers "Bardic Inspiration", a d6,
// on every kind but initiative. A Strength save asks no die for it, but has the offer's row in the
// dialog's sticky block, "Add it if your Gamemaster says the roll fails." and Add, left out: Done
// sends nothing more, and nothing is spent. At 1280 from the keyboard: the typed d20 moves focus to
// Add, Enter adds its d6 box last among the dice, Leave out and Add again, the d6 typed, Done: sent as
// one of the roll's extras, the card's d6 the typed one, the tray's "Bardic Inspiration +1d6 (5)";
// once made, Inspired removed from the app, its line logged beneath the save, which stays the latest,
// and nothing offered after. The rapier's hit keeps Roll damage with Inspired removed beneath it. With
// the campaign's effects switch off, "Ask your Gamemaster to remove Inspired.", nothing sent, and the
// spent die not offered again on that page. As toasts, the save's toast says its die whole and the
// spent line, and Inspired's toast pops. Vex's scale a d8, a world-time tick re-sends Thorin, and the
// offer is a d8. MIDI=1: Midi-QOL's save prompt asks Bless's die but offers nothing. At 390×844 and
// 360×640, Add in view in the sticky block with focus in the first box, 44 px tall, that box whole
// above the block, its d6 box above the keypad once tapped; at 844×390 (round 0.42.1's review) the
// offer's row in a sticky block at the foot of the dice column, Add, Done and the first box whole in
// view, Add's d6 box above that row. Screenshots to shots-0421. DND5E6=1: no offer. SKEW=041: the Elven line with
// Skip, two d20s sent and the card's third Foundry's, and no offer.
// SKEW=041 with MODULE=module-0.41.0: no effect's die asked, a crafted effectDice and rerolls taken
// (202) and stripped, and the greatsword's typed 1 rerolled by Foundry, the tray waiting for the
// game's total. Synthetic characters only. Run with
// --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import { mkdirSync, readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import {
  BOB, DND5E6, MIDI, MODULE, SHOTS, SHOTS_033, SHOTS_042, SKEW031, SKEW041, VARIANT, W, actors, browse, call, character, check, faces, finish, foundryWorld,
  launch, manualDice, midiCritical, newCampaign, note, npc, part, posted, postsOf, same, sameJson, setPermissions, settings, settled, shoot,
  shootBoth, sideways, sql, startModule, theme, until, wait,
} from './world-030.mjs'
import { combat, combatant, user } from './fvtt/stub.mjs'

const GAME = 'https://dice-hollow.forge-vtt.com'
const SECRET = 'dice-hollow-typed-32'
const TITLE = 'Dice Hollow'
const NEW = !SKEW031
/** Round 0.42.1's pictures, beside the others, whatever folder a run's SHOTS is. */
const SHOTS_0421 = SHOTS && `${SHOTS.replace(/\/[^/]*\/?$/, '')}/shots-0421`
if (SHOTS_0421) mkdirSync(SHOTS_0421, { recursive: true })
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: TITLE, address: 'dice-hollow.forge-vtt.com', secret: SECRET })
await foundryWorld({ dice6: DND5E6 })
manualDice('active')
// Thorin's player is Trusted, whom Make Manual Rolls is given to out of the box; Vex's a Player.
game.users.get('alice').role = 2
game.users.get('bob').role = 1

// ---- The world ----
const capital = text => text.charAt(0).toUpperCase() + text.slice(1)
const hits = (formula, type) => ({ formula, damageType: type, label: `${formula} ${capital(type)}` })
// dnd5e 5.3.3's enriched links, as fvtt/texts.mjs and links-e2e.mjs have them: an inline roll, a
// damage link and a save link.
const ICON = '<i class="fa-solid fa-dice-d20" inert=""></i>'
const wrap = html => `<enriched-content data-enricher-id="dnd5e-enricher">${html}</enriched-content>`
const INLINE_ROLL = formula => `<a class="inline-roll roll" data-mode="roll" data-flavor="" data-formula="${formula}"><i class="fas fa-dice-d20"></i>${formula}</a>`
const DAMAGE_LINK = (formula, type, label) => `<a class="roll-link-group" data-action="roll" data-type="damage" data-formulas="${formula}" data-damage-types="${type}" data-roll-type="damage"><span class="roll-link">${ICON}${formula}</span> ${label}</a>`
const SAVE_LINK = (ability, dc, label) => `<span class="roll-link-group" data-type="save" data-ability="${ability}" data-dc="${dc}"><a class="roll-link" data-action="roll">${ICON}${label}</a></span>`
const JOURNAL = `<p>The page burns: roll ${INLINE_ROLL('1d100')} on the table, take ${wrap(DAMAGE_LINK('2d6', 'fire', 'Fire'))} damage, or make a ${SAVE_LINK('dex', 13, 'DC 13 Dexterity')} saving throw.</p>`
const GWF = '2d6r<=2 + 1'
const spell = (id, name, level, activity, system = {}) => ({
  id, name, type: 'spell', system: { level, method: 'spell', prepared: 1, canPrepare: true, properties: [], duration: { units: 'inst' }, ...system }, activities: [activity],
})
// Thorin, an elf with Elven Accuracy: Dexterity +3 over Strength +1, Wisdom +2; a ranger and a
// cleric, three d10 hit dice and one d8; hurt. Changed on purpose (round 0.42.0 §8.5): Athletics and
// Acrobatics too, for Guidance on the one and not the other.
const thorin = character({
  id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 1, dex: 3, con: 2, wis: 2 }, flags: { elvenAccuracy: true },
  skills: { prc: { ability: 'wis' }, ath: { ability: 'str' }, acr: { ability: 'dex' } }, hp: { value: 20, max: 40, temp: 0 },
  classes: [{ identifier: 'ranger', denomination: 'd10', levels: 3 }, { identifier: 'cleric', denomination: 'd8', levels: 1 }],
}, {
  ac: 15,
  spells: {
    spell1: { value: 2, max: 2, level: 1 }, spell2: { value: 2, max: 2, level: 2 }, spell3: { value: 2, max: 2, level: 3 },
    ...Object.fromEntries([4, 5, 6, 7, 8, 9].map(level => [`spell${level}`, { value: 0, max: 0, level }])),
  },
  items: [
    // dnd5e's attack ability "" (attack-data.mjs:51-63): a finesse weapon's best of Strength and
    // Dexterity, his Dexterity, which Elven Accuracy is for. Changed on purpose (round 0.42.0 §8.5):
    // its own magic d4, which the game throws itself, a part of the attack's formula (the stand-in's
    // magic bonus), no effect's die: Bless, an effect, is step 5b's.
    {
      id: 'rapier', name: 'Rapier', type: 'weapon', system: { properties: ['fin'], quantity: 1, attackType: 'melee', equipped: true },
      activities: [{ id: 'lunge', attack: { ability: '' }, magic: '1d4', damage: [{ number: 1, denomination: 8, bonus: '@mod', types: ['piercing'] }], labels: { modifier: '+6', damage: [hits('1d8 + 3', 'piercing')] } }],
    },
    // Strength's, so no Elven Accuracy.
    {
      id: 'greataxe', name: 'Greataxe', type: 'weapon', system: { properties: ['hvy', 'two'], quantity: 1, attackType: 'melee', equipped: true },
      activities: [{ id: 'cleave', attack: { ability: 'str' }, damage: [{ number: 1, denomination: 12, bonus: '@mod', types: ['slashing'] }], labels: { modifier: '+4', damage: [hits('1d12 + 1', 'slashing')] } }],
    },
    // Module 0.42.0: a Great Weapon Fighter's greatsword, its d6s rerolled on a 1 or 2, as
    // rolling-e2e.mjs writes it; Strength's.
    {
      id: 'greatsword', name: 'Greatsword', type: 'weapon', system: { properties: ['hvy', 'two'], quantity: 1, attackType: 'melee', equipped: true },
      activities: [{ id: 'hew', attack: { ability: 'str' }, damage: [{ custom: GWF, types: ['slashing'] }], labels: { modifier: '+4', damage: [hits(GWF, 'slashing')] } }],
    },
    // A falling star's 20d6, whose critical hit's 40 dice fill the dialog.
    {
      id: 'starfall', name: 'Starfall', type: 'feat', system: { properties: [] },
      activities: [{ id: 'fall', damage: [{ number: 20, denomination: 6, types: ['fire'] }], labels: { modifier: '+6', damage: [hits('20d6', 'fire')] } }],
    },
    spell('fireball', 'Fireball', 3, {
      id: 'blast', type: 'save', template: 'sphere', affects: 'creature', save: ['dex'], dc: 15,
      damage: [{ number: 8, denomination: 6, types: ['fire'], scaling: 1 }], labels: { damage: [hits('8d6', 'fire')] },
    }),
    // Light, whose glow rolls a formula of its own.
    spell('light', 'Light', 0, { id: 'glow', type: 'utility', affects: '', formula: '1d4', rollName: 'Glow' }),
    // Module 0.42.0: a formula whose die explodes, which no feature rerolls.
    spell('sparks', 'Wild Sparks', 0, { id: 'burst', type: 'utility', affects: '', formula: '1d6x', rollName: 'Burst' }),
    { id: 'journal', name: 'Burning Journal', type: 'equipment', system: { quantity: 1, equipped: false, description: { value: JOURNAL } } },
  ],
})
thorin.system.details = { level: 4 }
thorin.system.attributes.spellcasting = 'wis'
thorin.system.attributes.spell = { dc: 13, attack: 5, mod: 2 }
Object.assign(thorin.system.skills.prc, { total: 5, passive: 15 })
// Athletics +4 and Acrobatics +6, and his Constitution save +5, proficient, as dnd5e prepares them,
// for a concentration check's total (module 0.42.0).
thorin.system.abilities.con.save.value = 5
CONFIG.DND5E.skills.acr = { label: 'Acrobatics', ability: 'dex' }
Object.assign(thorin.system.skills.ath, { total: 4, passive: 14 })
Object.assign(thorin.system.skills.acr, { total: 6, passive: 16 })
thorin.system.attributes.init.total = 3
// dnd5e 5.3.3 and 6.0.5 give Elven Accuracy to attacks alone (attack.mjs:97-98, d20-roll.mjs:53):
// the stand-in's skill and tool checks pass the flag on as well, so they're told it isn't theirs.
for (const method of ['rollSkill', 'rollToolCheck']) {
  const roll = thorin[method].bind(thorin)
  thorin[method] = (config = {}, ...rest) => roll({ elvenAccuracy: false, ...config }, ...rest)
}
// His classes, as dnd5e lists them among his items' types, for his hit dice.
{
  const types = Object.getOwnPropertyDescriptor(thorin, 'itemTypes').get
  Object.defineProperty(thorin, 'itemTypes', { configurable: true, get: () => ({ ...types.call(thorin), class: thorin._classes }) })
  for (const cls of thorin._classes) {
    const update = cls.update?.bind(cls)
    if (update) cls.update = async changes => { await update(changes); await Hooks.callAll('updateActor', thorin, {}, {}, 'gm') }
  }
}
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { wis: 3 }, hp: { value: 24, max: 30, temp: 0 } }, { ac: 14, items: [] })
vex.system.details = { level: 4 }
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
const goblin = npc('goblin', 'Goblin', 12)
const ogre = npc('ogre', 'Ogre', 11)

// ---- Module 0.42.0: the effects that add dice to Thorin's d20 rolls (its contract §8.5) ----
// Foundry's effects as the module's harness has them (fvtt/effects-core.mjs); and Foundry's
// fromUuidSync over them too, as the module names an effect's die by where it came from: the
// harness's for actors, their items and their effects, the world's for anything else.
const E = await import('./fvtt/effects-core.mjs')
E.installEffectsCore()
{
  const world = globalThis.fromUuidSync
  globalThis.fromUuidSync = (uuid, options = {}) => E.fromUuidSync(uuid, { ...options, strict: false }) ?? world(uuid, options)
}
// Vex, a bard, concentrating on Bless and on Guidance; Grukk, a goblin shaman no player owns, on
// Bane: each a concentration on the spell, as dnd5e makes one (effects-core.mjs's vexBlessConc).
const grukk = npc('grukk', 'Grukk', 12)
grukk.effects = []
const concentrating = (actor, id, name) => {
  const spell = E.itemOn(actor, { _id: id, name, type: 'spell' })
  return E.concentrateOn(actor, E.effectOn(actor, {
    _id: `${id}Conc`, name: `Concentrating: ${name}`, origin: spell.uuid, flags: { dnd5e: { item: { id, type: 'spell' } } },
  }))
}
const vexBless = concentrating(vex, 'vexBless', 'Bless')
const vexGuidance = concentrating(vex, 'vexGuidance', 'Guidance')
const grukkBane = concentrating(grukk, 'grukkBane', 'Bane')
// What each applies to Thorin, as dnd5e's Apply does: from the caster's concentration, the spell's
// changes, each an ADD of one die (PK spells24/1st-level/bless.yml:96-119). Steady Mind, made on
// his sheet, adds a d4 to his concentration checks alone.
const ATTACK_KINDS = ['mwak', 'rwak', 'msak', 'rsak']
const change = (key, value) => ({ key: `system.${key}`, type: 'add', value, phase: 'initial' })
const SAVES_AND_ATTACKS = ['bonuses.abilities.save', ...ATTACK_KINDS.map(kind => `bonuses.${kind}.attack`)]
const fromSpell = (id, name, concentration, changes) => ({
  _id: id, name, origin: concentration.uuid, duration: { rounds: 10, value: 10, units: 'rounds', remaining: 10 }, system: { changes },
})
const BLESSED = fromSpell('thorinBlessed', 'Blessed', vexBless, SAVES_AND_ATTACKS.map(key => change(key, '1d4')))
const BANED = fromSpell('thorinBane', 'Bane', grukkBane, SAVES_AND_ATTACKS.map(key => change(key, '-1d4')))
const GUIDED = fromSpell('thorinGuidance', 'Athletic Guidance', vexGuidance, [change('skills.ath.bonuses.check', '1d4')])
const STEADY = { _id: 'thorinSteady', name: 'Steady Mind', system: { changes: [change('attributes.concentration.bonuses.save', '1d4')] } }
// Round 0.42.1 §7.4: Vex, a level 4 bard, with the 2024 Bardic Inspiration as dnd5e's compendium
// has it (PK classes24/bard/class-features/bardic-inspiration.yml): the feature by its identifier,
// for the 2024 rules; its Inspire effect, Inspired, with no change and not transferred; and the
// class's scale die, a d6 at his level, `number` null. The stand-in's item has no identifier of its
// own, so the module reads the feature's `system.identifier`, as dnd5e's getter falls back to.
const vexInspire = E.itemOn(vex, { _id: 'vexInspire', name: 'Bardic Inspiration' })
Object.assign(vexInspire.system, { identifier: 'bardic-inspiration', source: { rules: '2024' } })
const vexInspiredSource = E.effectOnItem(vexInspire, { _id: 'vexInspired', name: 'Inspired', transfer: false, system: { changes: [] } })
vex.system.scale = { bard: { inspiration: { number: null, faces: 6 } } }
/**
 * What dnd5e's Apply puts on Thorin from Vex's Inspire: Inspired, its origin the feature's effect,
 * for an hour. A new one each time, as Foundry gives an effect applied again after it was deleted a
 * new id, and the app keeps a die it spent by its effect's id.
 */
let inspirations = 0
const inspiring = () => ({
  _id: `thorinInspired${++inspirations}`, name: 'Inspired', origin: vexInspiredSource.uuid, duration: { seconds: 3600 }, system: { changes: [] },
})
const ROUND_EFFECTS = [BLESSED, BANED, GUIDED, STEADY, { name: 'Inspired' }].map(effect => effect.name)
const EFFECT_FIELDS = [...SAVES_AND_ATTACKS, 'skills.ath.bonuses.check', 'attributes.concentration.bonuses.save']
/**
 * Thorin's fields as dnd5e prepares them from his effects, which the stand-in doesn't apply: each
 * field's ADDs in the effects' order, Bless's and Bane's "1d4 - 1d4", Bane's alone "-1d4" (D5
 * data/fields/formula-field.mjs:63-68).
 */
function prepareThorin() {
  const fields = {}
  for (const effect of thorin.effects) {
    for (const { key, value, type } of effect.system?.changes ?? []) {
      if (type !== 'add') continue
      const path = key.replace(/^system\./, '')
      const negative = value.startsWith('-')
      fields[path] = (fields[path] === undefined) ? value : `${fields[path]} ${negative ? '-' : '+'} ${negative ? value.slice(1) : value}`
    }
  }
  for (const path of EFFECT_FIELDS) foundry.utils.setProperty(thorin.system, path, fields[path] ?? '')
}
/** The Gamemaster puts an effect on Thorin, or takes one off, and every client hears of it. */
async function putOn(data) {
  const effect = E.effectOn(thorin, data)
  prepareThorin()
  await Hooks.callAll('createActiveEffect', effect, {}, 'gm')
  return effect
}
async function takeOff(effect) {
  thorin.effects.splice(thorin.effects.indexOf(effect), 1)
  prepareThorin()
  await Hooks.callAll('deleteActiveEffect', effect, {}, 'gm')
}
// Round 0.42.1: one of Thorin's own effects deleted from the app (v0.39's delete, the module's
// effect.delete()), as Foundry deletes one through its actor: gone from him, his fields prepared
// again, and every client's hook; the world's stand-in deletes only items.
{
  const deleteItems = thorin.deleteEmbeddedDocuments
  thorin.deleteEmbeddedDocuments = async (type, ids, options = {}) => {
    if (type !== 'ActiveEffect') return deleteItems(type, ids, options)
    for (const id of ids) {
      const effect = thorin.effects.find(each => each.id === id)
      if (!effect) throw new Error(`ActiveEffect ${id} does not exist`)
      thorin.effects.splice(thorin.effects.indexOf(effect), 1)
      prepareThorin()
      await Hooks.callAll('deleteActiveEffect', effect, options, game.user?.id ?? 'gm')
    }
  }
}
// The tokens on the Gamemaster's canvas, and a fight.
const tokenOf = {}
for (const actor of [thorin, vex, goblin, ogre]) {
  const token = { id: `tok-${actor.id}`, name: actor.name, uuid: `Scene.scene.Token.tok-${actor.id}`, actor, hidden: false, isLinked: true, disposition: actor.type === 'npc' ? -1 : 1 }
  const placeable = { id: token.id, name: actor.name, document: token, actor }
  token.object = placeable
  W.placeables.set(token.id, placeable)
  actor.speakerToken = placeable
  tokenOf[actor.id] = token
}
if (MIDI) canvas.scene.tokens.size = W.placeables.size
W.gm.targets = new Set()
Object.defineProperty(actors, 'party', { get: () => null, configurable: true })
let midiSaves = null
if (MIDI) {
  const saves = await import('./fvtt/midi-saves.mjs')
  saves.installMidiSaves({ actorClasses: [W.Actor5e], concentrationClass: W.cards.Character })
  midiSaves = saves
  Object.assign(W.midi.settings, { autoCheckSaves: 'all', requiresTargets: 'none', gmAutoFastForward: ['save'] })
}
// Changed on purpose (round 0.42.1 §7.4): the campaign lets players remove their own effects, as
// effects-e2e's does, for the Inspired a spent Bardic Inspiration leaves (step 5c).
const CAMPAIGN = changes => ({ id: 'camp-dice', title: TITLE, characters: ['thorin', 'vex'], groups: [], rolls: true, attacks: true, prompts: true, manualDice: true, effects: true, ...changes })
await startModule({
  campaigns: [CAMPAIGN()],
  secrets: { 'camp-dice': SECRET },
  midiCritical: { gm: 'doubleDice', player: 'default' },
})
await settled()
const fight = combat('fight')
combatant(fight, 'cbGoblin', goblin, { name: 'Goblin', initiative: 18, token: tokenOf.goblin })
const thorinTurn = combatant(fight, 'cbThorin', thorin, { initiative: null, token: tokenOf.thorin })
combatant(fight, 'cbOgre', ogre, { name: 'Ogre', initiative: 6, token: tokenOf.ogre })
fight.getCombatantsByActor = actor => fight.combatants.filter(cb => cb.actor?.id === actor.id)
const { rollCombatInitiative } = await import('./fvtt/actor5e.mjs')
fight.rollInitiative = rollCombatInitiative
fight.started = true
fight.round = 1
Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight'), configurable: true })
await Hooks.callAll('createCombat', fight)
await until(() => sql('select count(*) from combat') === '1', 'the app to hear of the fight', 15_000)

// ---- What's posted, kept and made ----
const hello = () => postsOf('bridge.hello').at(-1)
const requests = () => Number(sql('select count(*) from roll_request'))
const rollRow = id => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, payload, result from roll_request ${id ? `where id = '${id}'` : 'order by "createdAt" desc limit 1'}) r`) || 'null')
const settledRow = row => ['done', 'failed'].includes(row?.status)
/** The message a request made: by the module's flag, or else by the id its result names. */
const madeFor = id => W.messages.contents.find(m => m.flags?.['sending-stone']?.request === id)
  ?? W.messages.get(rollRow(id)?.result?.messageId ?? '')
const madeAllFor = id => W.messages.contents.filter(m => m.flags?.['sending-stone']?.request === id)
const d20sOf = roll => roll?.dice?.[0]?.results.map(r => r.result)
const roster = () => JSON.parse(sql(`select characters::text from campaign where id = '${A}'`)).map(c => [c.id, c.manualDice])
const stored = () => sql(`select "manualDice" from "character" where id = 'sheet-thorin'`)

part('1. the gate')
check(same(hello().data.characters.map(c => [c.id, c.manualDice]), NEW ? [['thorin', true], ['vex', false]] : [['thorin', false], ['vex', false]])
  && hello().data.features.rolls.manualDice === true,
  `the hello says ${NEW ? "Thorin's player may enter his dice results, Vex's may not" : 'no one may, as module 0.31.0 says of everyone'} (${JSON.stringify(hello().data.characters.map(c => [c.id, c.manualDice]))})`)
await until(() => same(roster(), NEW ? [['thorin', true], ['vex', false]] : [['thorin', false], ['vex', false]]), 'the roster as the hello says', 15_000)

// ---- Alice plays Thorin; Bob, Vex ----
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

const MANUAL = 'Enter dice results manually'
const HINT = 'Type in what your own dice show, instead of rolling here.'
/** The page's cog, opened: its manual dice switch, if any. */
async function cog(who) {
  const dialog = who.page.getByRole('dialog', { name: 'Settings' })
  if (!(await dialog.isVisible())) {
    await who.page.getByRole('button', { name: 'Settings', exact: true }).click()
    await dialog.waitFor()
  }
  return { dialog, manual: dialog.getByRole('switch', { name: MANUAL, exact: true }) }
}
const closeCog = async who => {
  const dialog = who.page.getByRole('dialog', { name: 'Settings' })
  if (await dialog.isVisible()) {
    await who.page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
  }
}
// The posts each page makes of its rolls, as sent.
const sentBy = new Map()
const watchPosts = who => {
  sentBy.set(who, [])
  who.page.on('request', request => {
    if (request.method() === 'POST' && /\/rolls$/.test(request.url())) sentBy.get(who).push(request.postDataJSON())
  })
  who.page.on('response', async response => {
    if (response.request().method() === 'POST' && /\/rolls$/.test(response.url()) && response.status() !== 202) note(`refused: ${response.status()} ${await response.text().catch(() => '')}`)
  })
}
watchPosts(alice)

{
  const { manual: aliceSwitch } = await cog(alice)
  const { manual: bobSwitch } = await cog(bob)
  if (NEW) await aliceSwitch.waitFor({ timeout: 15_000 })
  check((await aliceSwitch.count()) === (NEW ? 1 : 0) && (await bobSwitch.count()) === 0,
    NEW ? "Thorin's cog has the switch, and Vex's, whose player may not, doesn't" : "with module 0.31.0, neither Thorin's cog nor Vex's has it")
  await closeCog(bob)
}
const gmPage = await browse({ width: 390, height: 844, path: `/campaigns/${A}/characters/thorin` })
await gmPage.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
{
  const { manual } = await cog(gmPage)
  await wait(500)
  check(await manual.count() === 0, "the Gamemaster's page for Thorin has none")
  await closeCog(gmPage)
}

// ---- The dice entry dialog, as the page shows it ----
const SUBTITLE = 'Type in what your dice show'
const entryOf = who => who.page.getByRole('dialog').filter({ hasText: SUBTITLE })
/** Each term's group in the dialog: its name, and its boxes' names. */
const groupsOf = dialog => dialog.evaluate(el => [...el.querySelectorAll('[role=group][aria-labelledby]')].map(group => ({
  name: document.getElementById(group.getAttribute('aria-labelledby'))?.textContent.trim(),
  boxes: [...group.querySelectorAll('input')].map(input => input.getAttribute('aria-label')),
})))
const keypad = dialog => dialog.getByRole('group', { name: 'Keypad' })
/** Keys tapped on the dialog's keypad, as a finger does. */
async function keys(dialog, ...pressed) {
  for (const key of pressed) await keypad(dialog).getByRole('button', { name: key === 'delete' ? 'Delete' : key, exact: true }).click()
}
const totalOf = async dialog => (await dialog.locator('output').first().textContent()).trim()
/** The keypad's Next die (module 0.33.0's feedback: not on the last box). */
const nextDie = dialog => keypad(dialog).getByRole('button', { name: 'Next die', exact: true })
/** The box typed into: the one marked current. */
const currentBox = dialog => dialog.evaluate(el => el.querySelector('input[aria-current="true"]')?.getAttribute('aria-label') ?? null)
/**
 * The keypad as drawn: its box and each key's, by its data-key; the gap from its foot to the button
 * row's top; Done's box and whether it's the row's last button; the 5 key's box; and the grid's gap.
 */
const keypadLook = dialog => dialog.evaluate(el => {
  const rect = node => { const b = node.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height } }
  const pad = el.querySelector('[aria-label="Keypad"]')
  const keys = [...pad.querySelectorAll('button')].map(k => ({ key: k.dataset.key, ...rect(k) }))
  const done = [...el.querySelectorAll('button')].find(b => b.textContent === 'Done')
  const row = done.parentElement
  const scroller = el.querySelector('form').parentElement
  return {
    pad: rect(pad), keys, next: keys.some(k => k.key === 'next'), gap: row.getBoundingClientRect().top - pad.getBoundingClientRect().bottom,
    done: rect(done), doneLast: [...row.querySelectorAll('button')].at(-1) === done, five: keys.find(k => k.key === '5'),
    columnGap: parseFloat(getComputedStyle(pad).columnGap), scrolls: scroller.scrollHeight > scroller.clientHeight,
  }
})
const near = (a, b, by = 1) => Math.abs(a - b) <= by
const sameBox = (a, b, by = 1) => !!a && !!b && ['x', 'y', 'w', 'h'].every(k => near(a[k], b[k], by))
/** Every key the same size as the first, ± 1 px. */
const keysAlike = look => look.keys.every(k => near(k.w, look.keys[0].w) && near(k.h, look.keys[0].h))
/** Three columns on the last box: a row shorter (a key and its gap, 50 px), no gap where it was, Done the row's last. */
const lostARow = (before, after) => before.next && !after.next && after.keys.length === 12 && near(before.pad.h - after.pad.h, 50)
  && keysAlike(after) && sameBox({ ...after.keys[0], x: 0, y: 0 }, { ...before.keys[0], x: 0, y: 0 }) && near(after.gap, before.gap) && after.doneLast
const moved = (before, after) => ({ five: Math.round(after.five.y - before.five.y), done: Math.round(after.done.y - before.done.y) })
const focusedBox = dialog => dialog.evaluate(el => {
  const active = document.activeElement
  return el.contains(active) ? (active.getAttribute('aria-label') ?? active.textContent.trim()) : null
})
/** Until the dialog's first box takes focus, a frame after it opens. */
const firstFocused = async (dialog, name) => {
  await until(async () => (await focusedBox(dialog)) === name, `the first box, ${name}, focused`, 5_000).catch(() => {})
  return focusedBox(dialog)
}
/** The Combat tab of a phone's or tablet's table, the sheet's pane hidden behind it. */
async function combatTab(who) {
  await who.nav.getByRole('button', { name: /^Combat/ }).click()
  await until(() => who.page.evaluate(() => getComputedStyle(document.getElementById('character-pane')).display === 'none'),
    'the sheet hidden behind the Combat tab', 5_000)
}
/**
 * Whether the dialog is what a tap meets: its first box and Done each the element at its own
 * centre; and whether the sheet's pane is hidden, and the dialog inside it.
 */
const meets = dialog => dialog.evaluate(el => {
  const hits = node => {
    const b = node?.getBoundingClientRect()
    return !!b && b.width > 0 && document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) === node
  }
  const pane = document.getElementById('character-pane')
  return {
    box: hits(el.querySelector('input')),
    done: hits([...el.querySelectorAll('button')].find(b => b.textContent === 'Done')),
    paneHidden: !!pane && getComputedStyle(pane).display === 'none',
    inPane: !!pane?.contains(el),
  }
})
/**
 * Many dice scrolled half way, then to the end: at each, whether the keypad and Done are inside the
 * scroller's box, and how far the block holding them sits from the scroller's edge it sticks to,
 * its bottom or, on a short screen, where it's beside the dice, its top. A gap there would show
 * the dice scrolling by in a strip beyond the block.
 */
const scrolledLook = dialog => dialog.evaluate(async el => {
  const form = el.querySelector('form')
  const scroller = form.parentElement
  const block = form.lastElementChild
  const pad = el.querySelector('[aria-label="Keypad"]')
  const done = [...el.querySelectorAll('button')].find(b => b.textContent === 'Done')
  const short = getComputedStyle(form).gridTemplateColumns.split(' ').length === 2
  const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const at = []
  for (const share of [0.5, 1]) {
    scroller.scrollTop = Math.round((scroller.scrollHeight - scroller.clientHeight) * share)
    await frames()
    const s = scroller.getBoundingClientRect()
    const inside = node => { const b = node.getBoundingClientRect(); return b.width > 0 && b.top >= s.top - 0.5 && b.bottom <= s.bottom + 0.5 }
    const b = block.getBoundingClientRect()
    at.push({ share, scrollTop: Math.round(scroller.scrollTop), keypad: inside(pad), done: inside(done), gap: Math.round((short ? b.top - s.top : s.bottom - b.bottom) * 10) / 10 })
  }
  return { sticky: getComputedStyle(block).position === 'sticky' && block.contains(pad) && block.contains(done), short, at }
})
const stuckWell = look => look.sticky && look.at.length === 2 && look.at.every(a => a.scrollTop > 0 && a.keypad && a.done && Math.abs(a.gap) <= 1)
/**
 * Whether the 3D dice were thrown in the next moment and a half: the renderer shows its container
 * (opacity 1) for each throw and hides it again once the dice settle (3d-dice-core's dice-renderer).
 */
const diceShown = who => who.page.evaluate(async () => {
  for (let i = 0; i < 15; i++) {
    if ([...document.querySelectorAll('[id^=dice-canvas-threejs]')].some(el => el.style.opacity === '1')) return true
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return false
})
const toasts = who => who.page.getByRole('log', { name: 'Roll results' }).locator('[data-roll-toast]')
const tray = who => who.page.getByRole('region', { name: 'Your rolls' })
/** The posts a page made since a count, and the last. */
const postsSince = (who, from) => sentBy.get(who).slice(from)
/**
 * Until the page's roll toasts have gone (4 s each): they're drawn over the top of the sheet, where
 * a tap on what they cover would reach them.
 */
const clearToasts = who => until(async () => (await toasts(who).count()) === 0, 'the toasts to clear', 15_000)
/**
 * Roll results as toasts or in the banner, chosen in the cog: a toast that waits on the player, as
 * an attack's whose damage is due, stays over the top of the sheet until it's rolled.
 */
async function resultsAs(who, label) {
  const { dialog } = await cog(who)
  await dialog.getByRole('radiogroup', { name: 'Roll results' }).getByRole('radio', { name: label }).click()
  await closeCog(who)
}
/** Tap what asks for dice: the dialog, and how many requests and posts there were before. */
/** Wait for room under the app's limit of 20 rolls a minute from a player. */
const lastMinute = () => Number(sql(`select count(*) from roll_request where "createdAt" > now() - interval '1 minute'`))
const paced = () => until(() => lastMinute() < 17, 'room under the rate limit', 70_000)
async function asked(who, tap, what, { clear = true } = {}) {
  await paced()
  if (clear) await clearToasts(who)
  const before = { requests: requests(), posts: sentBy.get(who)?.length ?? 0 }
  await tap()
  const dialog = entryOf(who)
  await dialog.waitFor({ timeout: 15_000 })
  return { dialog, before, what }
}
/**
 * Done, and the request it sent once the game made it. Since module 0.42.0, `submit` sends it as
 * otherwise as Done (Enter on a box), and `soon` reads what the page shows at once, before the game
 * has made it.
 */
async function done(who, { dialog, before, what }, { toast, submit, soon } = {}) {
  const at = Date.now()
  if (submit) await submit()
  else await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  const shownSoon = soon ? await soon() : undefined
  // How soon its toast shows, where asked, watched from the tap.
  let toastIn = null
  if (toast) {
    await toasts(who).filter({ hasText: toast }).first().waitFor({ timeout: 5_000 })
    toastIn = Date.now() - at
  }
  await dialog.waitFor({ state: 'hidden', timeout: 5_000 })
  await until(() => requests() > before.requests, `${what} to be sent`)
  const request = rollRow()
  await until(() => settledRow(rollRow(request.id)), `${what} to be made`, 30_000)
  return { request, made: rollRow(request.id), message: madeFor(request.id), at, toastIn, body: sentBy.get(who)[before.posts], soon: shownSoon }
}

/** The badge the module puts on a message's card in Foundry, drawn as Foundry draws a chat card. */
const { markAppRoll } = await import(`${MODULE}/scripts/command-rolls.mjs`)
const cardPage = await (await browse({ width: 400, height: 300 })).view.newPage()
const moduleStyles = readFileSync(`${MODULE}/styles/sending-stone.css`, 'utf8')
async function badgeOn(message, shot) {
  const dom = new JSDOM(`<ol id="chat-log"><li class="chat-message"><header class="message-header"><h4 class="message-sender">${message.speaker?.alias ?? 'Thorin'}</h4><span class="message-metadata"><time>Now</time></span></header><div class="message-content">${message.content ?? ''}</div></li></ol>`)
  const held = { document: globalThis.document, HTMLElement: globalThis.HTMLElement }
  Object.assign(globalThis, { document: dom.window.document, HTMLElement: dom.window.HTMLElement })
  try { markAppRoll(message, dom.window.document.querySelector('li')) } finally { Object.assign(globalThis, held) }
  const badge = dom.window.document.querySelector('.sending-stone-badge')
  if (shot && SHOTS) {
    await cardPage.setContent(`<!doctype html><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"><style>${moduleStyles} body{font:14px sans-serif;background:#e8e2d4;padding:16px;width:320px} .message-header{display:flex;gap:8px;align-items:baseline} .message-metadata{margin-left:auto;display:flex;gap:4px} .chat-message{list-style:none;background:#fff;border:1px solid #999;padding:6px}</style>${dom.window.document.body.innerHTML}`)
    await cardPage.waitForTimeout(300)
    await cardPage.screenshot({ path: `${SHOTS}/${shot}${VARIANT}.png`, clip: { x: 0, y: 0, width: 360, height: 120 } })
  }
  return badge && { className: badge.className, label: badge.getAttribute('aria-label'), tooltip: badge.dataset.tooltip, icon: !!badge.querySelector('i.fa-keyboard') }
}
const TYPED_BADGE = { className: 'sending-stone-badge sending-stone-typed', label: 'Entered by hand on Sending Stone', tooltip: 'Entered by hand on Sending Stone', icon: true }

const sheet = who => who.page.getByRole('region', { name: 'Character', exact: true })
const perception = who => sheet(who).getByRole('button', { name: /^Perception check/ }).first()
const panel = who => who.page.getByRole('tabpanel')

// ---- Module 0.42.0: the dice effects add, and rerolls kept at the table ----
const REROLL_NOTE = 'Reroll at the table as your feature says, and type in the die you keep.'
const dexSave = who => sheet(who).getByRole('button', { name: /^Dexterity saving throw/ }).first()
const skillCheck = (who, name) => sheet(who).getByRole('button', { name: new RegExp(`^${name} check`) }).first()
const storedSheet = () => JSON.parse(sql(`select coalesce((select data::text from actor_sheet where "campaignId" = '${A}' and "actorId" = 'thorin'), 'null')`))
/** The dice Thorin's effects add, as the app keeps his sheet: null where it has no `effectDice`. */
const storedDice = () => storedSheet()?.effectDice ?? null
const storedEffects = () => (storedSheet()?.effects ?? []).flatMap(section => section.effects.map(row => row.name))
const rollFeatures = () => sql(`select array_to_string("rollFeatures", ',') from campaign where id = '${A}'`).split(',')
/** A roll's d4s as the game threw them: each term's results. */
const d4sOf = roll => (roll?.dice ?? []).filter(die => die.faces === 4).map(die => die.results.map(r => r.result))
/**
 * Until the app keeps Thorin's sheet with these of the round's effects on him, and no other, and each
 * page has it: its Effects tab listing them.
 */
async function sheetWith(pages, names) {
  const listed = text => ROUND_EFFECTS.every(name => text.includes(name) === names.includes(name))
  await until(() => listed(storedEffects()), `Thorin's sheet with ${names.join(', ') || 'none of the round\'s effects'}`, 20_000)
  for (const who of pages) {
    await who.tab('Effects')
    await until(async () => listed(await panel(who).innerText()), `${who.width}'s Effects tab with ${names.join(', ') || 'none of them'}`, 20_000)
  }
}
/** The tray's latest roll as shown: its total, and each line of it. */
const trayLatest = who => tray(who).getByRole('status').first().evaluate(el => ({
  total: el.querySelector('span')?.textContent.trim() ?? null,
  lines: [...el.querySelectorAll('p')].map(p => p.textContent.replace(/\s+/g, ' ').trim()),
}))
/** Until the tray's latest roll says what the game made of it. */
async function trayMade(who) {
  await until(async () => (await trayLatest(who)).lines.some(line => line.startsWith('At the table:')), 'the tray to say what the game made', 20_000).catch(() => {})
  return trayLatest(who)
}
const atTable = shown => shown.lines.map(line => /^At the table: (\S+)/.exec(line)?.[1]).find(Boolean) ?? null
/** What has focus in the dialog: its name, and the heading of the die's group it's in. */
const focusIn = dialog => dialog.evaluate(el => {
  const active = document.activeElement
  if (!el.contains(active)) return null
  const group = active.closest('[role=group][aria-labelledby]')
  return {
    name: active.getAttribute('aria-label') ?? active.textContent.trim(),
    group: group ? document.getElementById(group.getAttribute('aria-labelledby'))?.textContent.trim() : null,
  }
})
/**
 * Each Skip and Type it in as drawn: each Skip focused in turn, as a keyboard reaches it; then each
 * pressed, and each Type it in focused. For each, its height, whether it's in view, and whether it's
 * clear of the keypad: above it, or on a short screen beside it, in the dice column.
 */
const effectButtons = dialog => dialog.evaluate(async el => {
  const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const pad = el.querySelector('[aria-label="Keypad"]')
  const form = el.querySelector('form')
  const scroller = form.parentElement
  const short = getComputedStyle(form).gridTemplateColumns.split(' ').length === 2
  const buttons = () => [...el.querySelectorAll('button')].filter(b => /^(Skip|Type it in,) /.test(b.getAttribute('aria-label') ?? ''))
  const seen = []
  for (const round of ['Skip', 'Type it in']) {
    for (const button of buttons()) {
      button.focus()
      await frames()
      const b = button.getBoundingClientRect()
      const p = pad.getBoundingClientRect()
      const s = scroller.getBoundingClientRect()
      seen.push({
        name: button.getAttribute('aria-label'), height: Math.round(b.height), focused: document.activeElement === button,
        inView: b.top >= Math.max(s.top, 0) - 1 && b.bottom <= Math.min(s.bottom, innerHeight) + 1 && b.left >= 0 && b.right <= innerWidth,
        clear: short ? b.right <= p.left + 1 : b.bottom <= p.top + 1,
      })
    }
    if (round === 'Skip') {
      for (const button of buttons()) {
        button.click()
        await frames()
      }
    }
  }
  return { short, seen }
})

// ---- Round 0.42.1: Elven Accuracy's own line, and the 2024 Bardic Inspiration offered ----
/** The rapier with advantage's d20s, from app 0.42.1: two, then Elven Accuracy's third on its own line. */
const ELVEN_GROUPS = [{ name: 'd20, advantage', boxes: ['d20 1 of 2', 'd20 2 of 2'] }, { name: 'Elven Accuracy: third d20', boxes: ['d20'] }]
const skipElven = dialog => dialog.getByRole('button', { name: 'Skip Elven Accuracy’s d20', exact: true })
const typeElven = dialog => dialog.getByRole('button', { name: 'Type it in, Elven Accuracy’s d20', exact: true })
const ELVEN_OUT = 'The game rolls Elven Accuracy’s d20.'
/** Every button in a dialog whose name starts "Skip ", as a reader lists them. */
const skips = dialog => dialog.evaluate(el => [...el.querySelectorAll('button')].map(b => b.getAttribute('aria-label') ?? '').filter(name => name.startsWith('Skip ')))
/** A button's description, as a reader hears it after its name. */
const describedBy = button => button.evaluate(el => document.getElementById(el.getAttribute('aria-describedby') ?? '')?.textContent.trim() ?? null)
const strSave = who => sheet(who).getByRole('button', { name: /^Strength saving throw/ }).first()
/** The kinds the module offers Bardic Inspiration on: every d20 roll's but initiative. */
const OFFER_ON = ['attack', 'check', 'save', 'skill', 'tool', 'death', 'concentration']
const OFFER_LINE = 'Add it if your Gamemaster says the roll fails.'
const offered = (effect, faces = 6) => ({ name: 'Bardic Inspiration', effect, faces, count: 1, sign: 1, on: OFFER_ON, offer: true })
/** The dice Thorin's sheet offers, as the app keeps it. */
const storedOffers = () => (storedDice() ?? []).filter(die => die.offer === true)
/**
 * The die offered, as the dialog draws it (round 0.42.1 §2.5): its row's lines; its button's name,
 * words and description; whether the row is in the sticky block, after the keypad and before Done;
 * whether the button is in view, its top at or below the keypad's, and how tall it is; and how far
 * the dice have scrolled. Null where nothing is offered.
 */
const offerLook = dialog => dialog.evaluate(el => {
  const button = [...el.querySelectorAll('button')].find(b => /^(Add|Leave out) /.test(b.getAttribute('aria-label') ?? ''))
  if (!button) return null
  const form = el.querySelector('form')
  const pad = el.querySelector('[aria-label="Keypad"]')
  const done = [...el.querySelectorAll('button')].find(b => b.textContent === 'Done')
  const b = button.getBoundingClientRect()
  const p = pad.getBoundingClientRect()
  const follows = (a, z) => !!(a.compareDocumentPosition(z) & Node.DOCUMENT_POSITION_FOLLOWING)
  return {
    lines: [...button.parentElement.querySelectorAll('p')].map(line => line.textContent.trim()),
    name: button.getAttribute('aria-label'),
    text: button.textContent.trim(),
    described: document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent.trim() ?? null,
    inBlock: form.lastElementChild.contains(button) && follows(pad, button) && follows(button, done),
    inView: b.width > 0 && b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth,
    belowKeypadTop: b.top >= p.top - 1,
    height: Math.round(b.height),
    scrolled: Math.round(form.parentElement.scrollTop),
  }
})
/**
 * The die offered on a short screen (844×390; round 0.42.1's review): whether the dialog is in its
 * two columns; whether the offer's row is in a sticky block at the foot of the dice column, not in
 * the keypad's; whether Add and Done are each whole inside the dice's scroller and the viewport, and
 * the first box whole above the offer's rows; and how far the dice have scrolled. Null where nothing
 * is offered.
 */
const shortOfferLook = dialog => dialog.evaluate(el => {
  const button = [...el.querySelectorAll('button')].find(b => /^(Add|Leave out) /.test(b.getAttribute('aria-label') ?? ''))
  if (!button) return null
  const form = el.querySelector('form')
  const scroller = form.parentElement
  const rows = button.parentElement.parentElement
  const done = [...el.querySelectorAll('button')].find(b => b.textContent === 'Done')
  const s = scroller.getBoundingClientRect()
  const whole = node => {
    const b = node.getBoundingClientRect()
    return b.width > 0 && b.top >= Math.max(s.top, 0) - 0.5 && b.bottom <= Math.min(s.bottom, innerHeight) + 0.5 && b.left >= 0 && b.right <= innerWidth
  }
  const box = el.querySelector('input').getBoundingClientRect()
  return {
    name: button.getAttribute('aria-label'),
    short: getComputedStyle(form).gridTemplateColumns.split(' ').length === 2,
    inDiceColumn: form.firstElementChild.contains(button) && !form.lastElementChild.contains(button),
    sticky: getComputedStyle(rows).position === 'sticky',
    add: whole(button), done: !!done && whole(done),
    box: box.height > 0 && box.top >= Math.max(s.top, 0) - 0.5 && box.bottom <= rows.getBoundingClientRect().top + 0.5,
    scrolled: Math.round(scroller.scrollTop),
  }
})
/**
 * The die offered once added: its group's place among the dice, its first box's name, whether that
 * box has focus and is current, and whether it's in view above what's kept over the dice: the
 * keypad's top, or on a short screen (since round 0.42.1's review) the offer's rows beneath them.
 */
const addedLook = dialog => dialog.evaluate(el => {
  const groups = [...el.querySelectorAll('[role=group][aria-labelledby]')]
  const at = groups.findIndex(group => document.getElementById(group.getAttribute('aria-labelledby'))?.textContent.trim().startsWith('Bardic Inspiration'))
  const box = groups[at]?.querySelector('input')
  if (!box) return null
  const b = box.getBoundingClientRect()
  const form = el.querySelector('form')
  const short = getComputedStyle(form).gridTemplateColumns.split(' ').length === 2
  const button = [...el.querySelectorAll('button')].find(node => /^(Add|Leave out) /.test(node.getAttribute('aria-label') ?? ''))
  const over = (short ? button?.parentElement.parentElement : el.querySelector('[aria-label="Keypad"]'))?.getBoundingClientRect()
  const s = form.parentElement.getBoundingClientRect()
  return {
    last: at === groups.length - 1, box: box.getAttribute('aria-label'), focused: document.activeElement === box,
    current: box.getAttribute('aria-current') === 'true', clear: !!over && b.top >= Math.max(s.top, 0) - 1 && b.bottom <= over.top + 1,
  }
})
/** The changes to Thorin's effects the app kept: each its status and what it asked. */
const effectCommands = () => JSON.parse(sql(`select coalesce(json_agg(json_build_object('status', status, 'effect', payload->'effect') order by "createdAt")::text, '[]') from roll_request where kind = 'effect'`))
const SPENT = {
  removed: 'Bardic Inspiration spent: Inspired removed.',
  removing: 'Bardic Inspiration spent: removing Inspired…',
  ask: 'Bardic Inspiration spent. Ask your Gamemaster to remove Inspired.',
}
const spentLines = lines => lines.filter(line => line.startsWith('Bardic Inspiration spent'))
/** Until the tray's latest roll says what became of the Inspired it spent, as `line`. */
async function traySpent(who, line) {
  await until(async () => (await trayLatest(who)).lines.includes(line), `the tray to say "${line}"`, 30_000).catch(() => {})
  return trayLatest(who)
}
/** Whether the effect is on Thorin in Foundry, by its id. */
const onThorin = id => thorin.effects.some(effect => effect.id === id)
/**
 * The campaign's "Allow Players to disable & remove their own active effects" set in Foundry, and
 * kept so by the app, and Alice's page told so: its seat's view, then two of the page's polls.
 */
async function effectsSwitch(on) {
  await game.settings.set('sending-stone', 'campaigns', [CAMPAIGN({ effects: on })])
  await until(() => sql(`select "effectsEnabled" from campaign where id = '${A}'`) === (on ? 't' : 'f'), `the app to keep effects ${on ? 'on' : 'off'}`, 20_000)
  await until(async () => ((await call(alice.page, '/api/characters/sheet-thorin/table')).json?.effects === true) === on, `the seat's view with effects ${on ? 'on' : 'off'}`, 20_000)
  await wait(7_000)
}

if (SKEW031) {
  // =================================================================================================
  // Module 0.31.0: no gate, so no one types; three d20s are never sent, and `typed` is stripped
  // =================================================================================================
  part('21. module 0.31.0')
  await setPermissions([1, 2, 3, 4])
  await wait(4000)
  const { manual } = await cog(alice)
  check(await manual.count() === 0 && same(roster(), [['thorin', false], ['vex', false]]), 'given Make Manual Rolls by every role, the app still shows no switch, as the module never says he may')
  await closeCog(alice)
  await alice.tab('Actions')
  await panel(alice).getByRole('button', { name: 'Rapier attack, +6' }).click({ button: 'right' })
  const menu = alice.page.getByRole('menu')
  await menu.waitFor()
  const before = { requests: requests(), posts: sentBy.get(alice).length }
  await menu.getByRole('menuitem', { name: 'Roll with advantage' }).click()
  const picker = alice.page.getByRole('dialog', { name: 'Rapier attack' })
  await picker.waitFor()
  await picker.getByRole('button', { name: /^Goblin/ }).click()
  await until(() => requests() > before.requests, 'the attack to be sent')
  const attack = rollRow()
  await until(() => settledRow(rollRow(attack.id)), 'the attack to be made', 30_000)
  check(attack.payload.dice[0].faces === 20 && attack.payload.dice[0].results.length === 2 && !('typed' in attack.payload) && await entryOf(alice).count() === 0,
    `the rapier with advantage throws two of the app's d20s, Elven Accuracy's third Foundry's, no dialog and nothing typed (${JSON.stringify(attack.payload.dice)})`)
  const crafted = await call(alice.page, '/api/characters/sheet-thorin/rolls', { method: 'POST', body: { kind: 'skill', key: 'prc', mode: 0, explicit: false, extras: [], dice: [{ faces: 20, results: [12] }], typed: true } })
  await until(() => settledRow(rollRow()), 'the crafted roll to be made', 30_000)
  const kept = rollRow()
  check(crafted.status === 202 && !('typed' in kept.payload) && kept.status === 'done',
    `a crafted check with typed: true is taken (${crafted.status}), and stored without it (${JSON.stringify(kept.payload)})`)
  await finish()
}

// =================================================================================================
// 2. Turned on
// =================================================================================================
part('2. on')
const tablet = await browse({ width: 768, height: 1024, path: '/characters/sheet-thorin' })
await tablet.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const { manual: tabletSwitch } = await cog(tablet)
await tabletSwitch.waitFor({ timeout: 15_000 })
{
  const { dialog, manual } = await cog(alice)
  check(!(await manual.isChecked()) && await manual.evaluate(el => document.getElementById(el.getAttribute('aria-describedby'))?.textContent) === HINT,
    `at 390, "${MANUAL}" is off, said of as "${HINT}"`)
  await dialog.locator('label').filter({ hasText: MANUAL }).tap()
  await until(() => manual.isChecked(), 'the switch on', 5_000)
  await until(() => stored() === 't', 'the choice stored', 10_000)
  await shoot(alice, 'typed-switch', dialog)
  check(await manual.isChecked() && stored() === 't', 'turned on at 390, it shows on and is kept on her seat')
  const at = Date.now()
  await until(() => tabletSwitch.isChecked(), 'the tablet to follow', 10_000)
  check(await tabletSwitch.isChecked(), `her 768 page shows it on within a poll (${((Date.now() - at) / 1000).toFixed(1)} s)`)
  await closeCog(alice)
  await closeCog(tablet)
}

if (SKEW041) {
  // =================================================================================================
  // Module 0.41.0: no effect's die asked, no rerolls kept, a crafted effectDice and rerolls stripped
  // =================================================================================================
  part('22. module 0.41.0')
  await resultsAs(alice, 'Banner')
  const blessed = await putOn(BLESSED)
  await sheetWith([alice], ['Blessed'])
  {
    const rolls = hello().data.features.rolls
    check(storedDice() === null && !('effectDice' in rolls) && !('keptRerolls' in rolls) && !rollFeatures().includes('effectDice') && !rollFeatures().includes('keptRerolls'),
      `Bless applied, module 0.41.0 lists no effectDice on Thorin's sheet, its hello says neither effectDice nor keptRerolls, and the app keeps neither (${JSON.stringify(Object.keys(rolls))}; ${rollFeatures().join(',')})`)
  }
  await alice.tab('Character')
  faces.push(2)
  let entry = await asked(alice, () => dexSave(alice).click(), 'a Dexterity save, Blessed, with module 0.41.0')
  check(same(await groupsOf(entry.dialog), [{ name: 'd20', boxes: ['d20'] }]) && await entry.dialog.getByRole('button', { name: /^Skip / }).count() === 0,
    `a Dexterity save asks only its d20: no line for Bless, no Skip (${JSON.stringify(await groupsOf(entry.dialog))})`)
  await keys(entry.dialog, '1', '2')
  let made = await done(alice, entry)
  check(!('effectDice' in (made.body ?? {})) && !('rerolls' in (made.body ?? {})) && !('effectDice' in made.request.payload) && same(d4sOf(made.message?.rolls[0]), [[2]]) && faces.length === 0,
    `sent with neither effectDice nor rerolls (${JSON.stringify(made.body)}), Bless's d4 Foundry's, 2 (${made.message?.rolls[0]?.formula})`)
  await paced()
  const crafted = await call(alice.page, '/api/characters/sheet-thorin/rolls', {
    method: 'POST',
    body: { kind: 'save', key: 'dex', mode: 0, explicit: false, extras: [], dice: [{ faces: 20, results: [12] }], typed: true, rerolls: 'kept', effectDice: [{ faces: 4, sign: 1, results: [3] }] },
  })
  await until(() => settledRow(rollRow()), 'the crafted save to be made', 30_000)
  {
    const kept = rollRow()
    const has = key => sql(`select (payload ? '${key}')::text from roll_request where id = '${kept.id}'`)
    check(crafted.status === 202 && kept.payload.typed === true && has('effectDice') === 'false' && has('rerolls') === 'false' && kept.status === 'done',
      `a crafted typed save with effectDice and rerolls kept is taken (${crafted.status}), and stored typed without either, module 0.41.0 taking neither (${JSON.stringify(kept.payload)})`)
  }
  await takeOff(blessed)
  await sheetWith([alice], [])
  // The greatsword's 2d6r<=2 typed 1 and 5: no rerolls sent, so Foundry rerolls the 1, as before 0.42.0.
  await alice.tab('Actions')
  const greatsword = panel(alice).getByRole('button', { name: 'Greatsword attack, +4' })
  const picker = alice.page.getByRole('dialog', { name: 'Greatsword attack' })
  entry = await asked(alice, async () => {
    await greatsword.click()
    await picker.waitFor()
    await picker.getByRole('button', { name: /^Goblin/ }).click()
  }, 'the greatsword')
  await keys(entry.dialog, '1', '5')
  await done(alice, entry)
  await tray(alice).getByRole('button', { name: 'Roll damage' }).waitFor({ timeout: 30_000 })
  entry = await asked(alice, () => tray(alice).getByRole('button', { name: 'Roll damage' }).click(), "the greatsword's damage")
  const note = await entry.dialog.getByText(REROLL_NOTE).count()
  await keys(entry.dialog, '1', '5')
  faces.push(4)
  made = await done(alice, entry)
  const roll = MIDI ? W.midi.made.at(-1)?.damageRolls?.[0] : made.message?.rolls[0]
  await until(async () => (await trayLatest(alice)).total === String(roll?.total), "the tray to show the game's total", 20_000).catch(() => {})
  const later = await trayMade(alice)
  check(note === 0 && made.request.payload.typed === true && !('rerolls' in made.request.payload) && !('rerolls' in (made.body ?? {}))
    && same(roll?.dice[0].results.filter(r => r.rerolled).map(r => r.result), [1]) && roll.formula.includes('r<=2') && roll.total === 10 && faces.length === 0
    && later.total === '10' && atTable(later) === '10',
    `with module 0.41.0 the greatsword's damage has no note, is sent typed without rerolls, Foundry rerolls the typed 1 (a 4: ${roll?.formula} = ${roll?.total}), and the tray shows the game's total once made (${JSON.stringify(later)})`)
  // Round 0.42.1 §7.4: Elven Accuracy's third d20 on its own line, with Skip, against module 0.41.0,
  // which throws the third itself where two are sent, as every module from 0.32.0 does.
  const rapierPicker = alice.page.getByRole('dialog', { name: 'Rapier attack' })
  // The third d20, Foundry's: 19; then the rapier's own magic d4: 3.
  faces.push(19, 3)
  entry = await asked(alice, async () => {
    await fromMenu(alice, panel(alice).getByRole('button', { name: 'Rapier attack, +6' }), 'Roll with advantage')
    await rapierPicker.waitFor()
    await rapierPicker.getByRole('button', { name: /^Goblin/ }).click()
  }, 'the rapier with advantage, with module 0.41.0')
  check(same(await groupsOf(entry.dialog), ELVEN_GROUPS) && await skipElven(entry.dialog).isVisible(),
    `with module 0.41.0, the rapier with advantage asks "d20, advantage" and "Elven Accuracy: third d20", with "Skip Elven Accuracy’s d20" (${JSON.stringify(await groupsOf(entry.dialog))})`)
  await skipElven(entry.dialog).click()
  await keys(entry.dialog, '3', '1', '8')
  made = await done(alice, entry)
  {
    const roll = MIDI ? W.midi.made.at(-1)?.attackRoll : made.message?.rolls[0]
    check(same(made.request.payload.dice[0].results, [3, 18]) && made.request.payload.typed === true && same(d20sOf(roll), [3, 18, 19]) && roll.dice[0].total === 19 && faces.length === 0,
      `Elven Accuracy's d20 skipped: sent as two d20s, [3, 18], and module 0.41.0's card has three, Foundry's 19 the third and kept (${roll?.formula} = ${roll?.total})`)
  }
  // And Inspired on Thorin: module 0.41.0 lists no effectDice, so nothing is offered.
  const inspired = await putOn(inspiring())
  await sheetWith([alice], ['Inspired'])
  await alice.tab('Character')
  entry = await asked(alice, () => strSave(alice).click(), 'a Strength save, Inspired, with module 0.41.0')
  {
    const look = await offerLook(entry.dialog)
    check(storedDice() === null && look === null && await entry.dialog.getByText(OFFER_LINE).count() === 0 && same(await groupsOf(entry.dialog), [{ name: 'd20', boxes: ['d20'] }]),
      `Vex's Inspired on Thorin, module 0.41.0's sheet lists no effectDice, and a Strength save offers nothing: no Add, no "${OFFER_LINE}" (${JSON.stringify(look)})`)
  }
  await entry.dialog.getByRole('button', { name: 'Cancel' }).click()
  await entry.dialog.waitFor({ state: 'hidden' })
  await takeOff(inspired)
  await finish()
}

// =================================================================================================
// 3. A skill check
// =================================================================================================
part('3. a skill check')
await alice.tab('Character')
let entry = await asked(alice, () => perception(alice).click(), 'the Perception check')
{
  const { dialog } = entry
  const title = await dialog.getByRole('heading').first().textContent()
  const groups = await groupsOf(dialog)
  const focused = await firstFocused(dialog, 'd20')
  check(/^Perception/.test(title) && same(groups, [{ name: 'd20', boxes: ['d20'] }]) && focused === 'd20' && await dialog.getByText(SUBTITLE).isVisible(),
    `tapped, Perception asks for its d20: "${title}", "${SUBTITLE}", one box, d20, focused (${JSON.stringify(groups)})`)
  check(await nextDie(dialog).count() === 0 && await keypad(dialog).getByRole('button').count() === 12 && await dialog.getByRole('button', { name: 'Done', exact: true }).isVisible(),
    'a single die\'s keypad has no "Next die", its 12 other keys and Done there')
  await keys(dialog, '1', '7')
  const total = await totalOf(dialog)
  check(total === 'Total 22' && (await focusedBox(dialog)) === 'Done', `typed 1, 7: "${total}" before Done, Perception's +5 on the 17, and Done focused after the 7`)
  await shoot(alice, 'typed-dialog-phone', dialog)
}
const thrownAfterDone = diceShown(alice)
let made = await done(alice, entry, { toast: 'Perception' })
{
  const toast = toasts(alice).filter({ hasText: 'Perception' }).first()
  const thrown = await thrownAfterDone
  check(made.toastIn < 1000 && (await toast.textContent()).includes('22') && !thrown, `Done: the toast shows 22 within ${made.toastIn} ms, and no dice are thrown on the screen`)
  check(made.body?.typed === true && same(made.body?.dice, [{ faces: 20, results: [17] }]) && made.request.payload.typed === true,
    `the post has typed: true and its d20, 17 (${JSON.stringify(made.body)}), and the app keeps it typed`)
  const badge = await badgeOn(made.message, 'typed-badge')
  check(same(d20sOf(made.message?.rolls[0]), [17]) && made.message.rolls[0].total === 22 && made.message.flags['sending-stone'].typed === true && same(badge, TYPED_BADGE),
    `Foundry's card has the d20, 17, flagged typed, with the keyboard badge "Entered by hand on Sending Stone" (${JSON.stringify(badge)})`)
}

// From here the rolls show in the banner, where those that wait on Alice don't cover the sheet.
await resultsAs(alice, 'Banner')

// ---- 4. Advantage and disadvantage, from the menu and from Modify Roll ----
part('4. advantage')
async function fromMenu(who, button, item) {
  await button.click({ button: 'right' })
  const menu = who.page.getByRole('menu')
  await menu.waitFor()
  await menu.getByRole('menuitem', { name: item }).click()
}
entry = await asked(alice, () => fromMenu(alice, perception(alice), 'Roll with advantage'), 'Perception with advantage')
{
  const groups = await groupsOf(entry.dialog)
  const focused = await firstFocused(entry.dialog, 'd20 1 of 2')
  check(same(groups, [{ name: 'd20, advantage', boxes: ['d20 1 of 2', 'd20 2 of 2'] }]) && focused === 'd20 1 of 2',
    `the menu's advantage asks for two, "d20, advantage", the first box focused once the menu closes (${JSON.stringify(groups)}, ${focused})`)
  // Module 0.33.0's feedback: Next die on the first box, gone on the last, back on the first.
  const firstCurrent = await currentBox(entry.dialog)
  const nextFirst = await nextDie(entry.dialog).count()
  await keys(entry.dialog, '4')
  const lastCurrent = await currentBox(entry.dialog)
  const nextLast = await nextDie(entry.dialog).count()
  check(firstCurrent === 'd20 1 of 2' && nextFirst === 1 && lastCurrent === 'd20 2 of 2' && nextLast === 0,
    `"Next die" with the first box current; a 4 typed there, the second, the last, is current and "Next die" is gone (${JSON.stringify([firstCurrent, nextFirst, lastCurrent, nextLast])})`)
  await entry.dialog.getByRole('textbox', { name: 'd20 1 of 2', exact: true }).click()
  check(await currentBox(entry.dialog) === 'd20 1 of 2' && await nextDie(entry.dialog).count() === 1, 'a click on the first box makes it current, and "Next die" is back')
  await entry.dialog.getByRole('textbox', { name: 'd20 2 of 2', exact: true }).click()
  await keys(entry.dialog, '1', '5')
  check(await totalOf(entry.dialog) === 'Total 20', `4 and 15: ${await totalOf(entry.dialog)}, the higher kept`)
}
made = await done(alice, entry)
check(same(made.request.payload.dice[0].results, [4, 15]) && made.request.payload.mode === 1 && same(d20sOf(made.message?.rolls[0]), [4, 15]) && made.message.rolls[0].total === 20,
  `sent as [4, 15], with advantage; the game keeps 15 (${JSON.stringify(made.request.payload)}; ${made.message?.rolls[0].formula} ${JSON.stringify(d20sOf(made.message?.rolls[0]))} = ${made.message?.rolls[0].total})`)
entry = await asked(alice, () => fromMenu(alice, perception(alice), 'Roll with disadvantage'), 'Perception with disadvantage')
await keys(entry.dialog, '4', '1', '5')
check(same(await groupsOf(entry.dialog), [{ name: 'd20, disadvantage', boxes: ['d20 1 of 2', 'd20 2 of 2'] }]) && await totalOf(entry.dialog) === 'Total 9',
  `disadvantage: "d20, disadvantage", 4 and 15 keep the 4 (${await totalOf(entry.dialog)})`)
made = await done(alice, entry)
check(made.request.payload.mode === -1 && made.message.rolls[0].total === 9, `and the game keeps the 4: ${made.message?.rolls[0].total}`)
// Modify Roll: advantage, and a d4 more, its own box.
await clearToasts(alice)
await perception(alice).click({ button: 'right' })
await alice.page.getByRole('menu').getByRole('menuitem', { name: 'Modify roll…' }).click()
const modifyRoll = alice.page.getByRole('dialog', { name: 'Modify roll' })
await modifyRoll.waitFor()
await modifyRoll.getByText('Advantage', { exact: true }).click()
await modifyRoll.getByLabel('Extra dice or modifiers').fill('1d4')
entry = await asked(alice, () => modifyRoll.getByRole('button', { name: /^Roll/ }).last().click(), 'Perception, modified')
{
  const groups = await groupsOf(entry.dialog)
  const focused = await firstFocused(entry.dialog, 'd20 1 of 2')
  check(groups[0]?.name === 'd20, advantage' && groups.some(g => g.name === '+1d4' && same(g.boxes, ['d4'])) && focused === 'd20 1 of 2',
    `Modify Roll's Roll leaves the first box focused, and its +1d4 a box of its own beside the d20s (${JSON.stringify(groups)}, ${focused})`)
  await keys(entry.dialog, '9', '1', '2', '3')
}
made = await done(alice, entry)
check(same(made.request.payload.dice, [{ faces: 20, results: [9, 12] }, { faces: 4, results: [3] }]) && made.message?.rolls[0].dice[1]?.results[0]?.result === 3,
  `sent as d20s [9, 12] and the d4 3, which the game adds (${made.message?.rolls[0].formula} = ${made.message?.rolls[0].total})`)

// ---- 5. Elven Accuracy ----
part('5. elven accuracy')
const sentSheet = () => postsOf('character.updated').filter(p => p.data.character.id === 'thorin').at(-1)?.data.character.sheet
  ?? hello().data.characters.find(c => c.id === 'thorin').sheet
const actionOf = (sheet, item) => JSON.stringify(sheet ?? {}).includes('"elvenAccuracy":true')
check(actionOf(sentSheet(), 'rapier'), "the sheet says the rapier's attack has Elven Accuracy")
await alice.tab('Actions')
const rapier = panel(alice).getByRole('button', { name: 'Rapier attack, +6' })
const rapierPicker = alice.page.getByRole('dialog', { name: 'Rapier attack' })
// Changed on purpose (round 0.42.0 §8.5): the attack's own magic d4, which the game throws itself:
// 3. Bless, an effect, is step 5b's.
faces.push(3)
const rapierWithAdvantage = what => asked(alice, async () => {
  await fromMenu(alice, rapier, 'Roll with advantage')
  await rapierPicker.waitFor()
  await rapierPicker.getByRole('button', { name: /^Goblin/ }).click()
}, what)
entry = await rapierWithAdvantage('the rapier with advantage')
// Changed on purpose (round 0.42.1 §7.4): Elven Accuracy's third d20 on its own line, after the two
// of "d20, advantage", with Skip, as the attack goes to the game.
check(same(await groupsOf(entry.dialog), ELVEN_GROUPS) && await skipElven(entry.dialog).isVisible() && await skipElven(entry.dialog).textContent() === 'Skip',
  `the rapier with advantage asks for two, "d20, advantage", then "Elven Accuracy: third d20", one box, with Skip ("Skip Elven Accuracy’s d20"), and nothing for the attack's own magic d4 (${JSON.stringify(await groupsOf(entry.dialog))})`)
await shootBoth(alice, 'typed-elven', entry.dialog, SHOTS_0421)
await keys(entry.dialog, '3', '1', '8', '7')
made = await done(alice, entry)
{
  const roll = MIDI ? W.midi.made.at(-1)?.attackRoll : made.message?.rolls[0]
  const d4 = roll?.dice?.find(d => d.faces === 4)?.results.map(r => r.result)
  check(same(made.request.payload.dice[0].results, [3, 18, 7]) && same(d20sOf(roll), [3, 18, 7]) && roll.dice[0].total === 18 && same(d4, [3]),
    `typed 3, 18 and the third 7: the card's d20s are [3, 18, 7], 18 kept${MIDI ? ', through Midi-QOL\'s workflow' : ''}, and the attack's own magic d4 is Foundry's, 3 (${roll?.formula} = ${roll?.total})`)
}
// New (round 0.42.1 §7.4): the third skipped, for the game to roll; typed in again, its box back;
// skipped again and sent with two d20s, the card's third Foundry's.
entry = await rapierWithAdvantage('the rapier with advantage, its third skipped')
{
  const { dialog } = entry
  await skipElven(dialog).click()
  const look = {
    groups: await groupsOf(dialog), said: await dialog.getByText(ELVEN_OUT, { exact: true }).isVisible(), total: await totalOf(dialog),
    typeIn: await typeElven(dialog).textContent(), described: await describedBy(typeElven(dialog)),
  }
  check(same(look.groups, [ELVEN_GROUPS[0], { name: 'Elven Accuracy: third d20', boxes: [] }]) && look.said && /^Total \d+, not counting Elven Accuracy’s d20$/.test(look.total)
    && look.typeIn === 'Type it in' && look.described === ELVEN_OUT,
    `Skip: its box goes, "${ELVEN_OUT}" in its place, the total "${look.total}", and "Type it in" ("Type it in, Elven Accuracy’s d20") described by that line (${JSON.stringify(look)})`)
  await shootBoth(alice, 'typed-elven-skipped', dialog, SHOTS_0421)
  await typeElven(dialog).click()
  const back = { groups: await groupsOf(dialog), focus: await focusIn(dialog), current: await currentBox(dialog) }
  check(same(back.groups, ELVEN_GROUPS) && same(back.focus, { name: 'd20', group: 'Elven Accuracy: third d20' }) && back.current === 'd20',
    `Type it in brings its box back, focused and current (${JSON.stringify(back)})`)
  await skipElven(dialog).click()
  // Typed from the first box: the two of "d20, advantage".
  await dialog.getByRole('textbox', { name: 'd20 1 of 2', exact: true }).click()
  await keys(dialog, '3', '1', '8')
  const total = await totalOf(dialog)
  // The third d20, Foundry's: 19; then the rapier's own magic d4: 3.
  faces.push(19, 3)
  made = await done(alice, entry)
  const roll = MIDI ? W.midi.made.at(-1)?.attackRoll : made.message?.rolls[0]
  const own = Number(/^Total (\d+),/.exec(total)?.[1])
  const shown = await trayMade(alice)
  check(same(made.request.payload.dice[0].results, [3, 18]) && same(made.body?.dice?.[0]?.results, [3, 18]) && made.request.payload.mode === 1
    && same(d20sOf(roll), [3, 18, 19]) && roll.dice[0].total === 19 && faces.length === 0,
    `skipped again and typed 3 and 18 ("${total}"): sent with two d20s, [3, 18], and the card's d20s are [3, 18, 19], Foundry's third 19 kept${MIDI ? ", through Midi-QOL's workflow" : ''} (${roll?.formula} = ${roll?.total})`)
  check(shown.total === String(own) && atTable(shown) === String(roll?.total),
    `the tray's own ${shown.total} leaves the third out, as the dialog's did, and its table total is the card's ${roll?.total} (${JSON.stringify(shown)})`)
}
const greataxe = panel(alice).getByRole('button', { name: 'Greataxe attack, +4' })
entry = await asked(alice, async () => {
  await fromMenu(alice, greataxe, 'Roll with advantage')
  const picker = alice.page.getByRole('dialog', { name: 'Greataxe attack' })
  await picker.waitFor()
  await picker.getByRole('button', { name: /^Goblin/ }).click()
}, 'the greataxe with advantage')
check(same(await groupsOf(entry.dialog), [{ name: 'd20, advantage', boxes: ['d20 1 of 2', 'd20 2 of 2'] }]), 'the greataxe, with Strength, asks for two')
await keys(entry.dialog, '6', '5')
made = await done(alice, entry)
check(same(made.request.payload.dice[0].results, [6, 5]), 'and sends two')

// =================================================================================================
// 5b. Module 0.42.0: the dice effects add (its contract §8.5)
// =================================================================================================
part("5b. effects' dice")
const BLESS_ON = ['attack', 'save', 'death', 'concentration']
const blessLine = { name: 'Bless: +1d4', boxes: ['d4'] }
const baneLine = { name: 'Bane: −1d4', boxes: ['d4'] }
const skipBless = dialog => dialog.getByRole('button', { name: 'Skip Bless’s d4', exact: true })
// 1. The Gamemaster applies Vex's Bless to Thorin, as dnd5e's Apply does: from Vex's concentration.
let blessed = await putOn(BLESSED)
await sheetWith([alice], ['Blessed'])
{
  const dice = storedDice()
  const rolls = hello().data.features.rolls
  if (DND5E6) {
    check(dice === null && rolls.effectDice === false && rolls.keptRerolls === true && !rollFeatures().includes('effectDice') && rollFeatures().includes('keptRerolls'),
      `dnd5e 6.0.5: Bless applied, Thorin's sheet lists no effectDice; the hello says effectDice false and keptRerolls true, and the app keeps keptRerolls alone (${JSON.stringify(dice)}; ${rollFeatures().join(',')})`)
  } else {
    check(sameJson(dice, [{ name: 'Bless', effect: 'thorinBlessed', faces: 4, count: 1, sign: 1, on: BLESS_ON }]) && !/Vex|Grukk/.test(JSON.stringify(dice))
      && rolls.effectDice === true && rolls.keptRerolls === true && rollFeatures().includes('effectDice') && rollFeatures().includes('keptRerolls'),
      `Bless applied from Vex's concentration: within a poll the app keeps Thorin's sheet with effectDice naming "Bless", never Vex, a d4 on ${BLESS_ON.join(', ')}; the hello says effectDice and keptRerolls, and the app keeps both (${JSON.stringify(dice)})`)
  }
}
// 2. Perception: Bless isn't on checks.
await alice.tab('Character')
entry = await asked(alice, () => perception(alice).click(), 'Perception, Blessed')
check(same(await groupsOf(entry.dialog), [{ name: 'd20', boxes: ['d20'] }]), `Perception asks only its d20: Bless isn't on checks (${JSON.stringify(await groupsOf(entry.dialog))})`)
await entry.dialog.getByRole('button', { name: 'Cancel' }).click()
await entry.dialog.waitFor({ state: 'hidden' })
// 3. A Dexterity save: Bless's d4 asked, typed.
if (DND5E6) faces.push(2)
entry = await asked(alice, () => dexSave(alice).click(), 'a Dexterity save, Blessed')
{
  const groups = await groupsOf(entry.dialog)
  if (DND5E6) {
    check(same(groups, [{ name: 'd20', boxes: ['d20'] }]) && await skipBless(entry.dialog).count() === 0, `dnd5e 6.0.5: a Dexterity save asks only its d20, no line for Bless (${JSON.stringify(groups)})`)
    await keys(entry.dialog, '1', '2')
    made = await done(alice, entry)
    check(!('effectDice' in (made.body ?? {})) && !('effectDice' in made.request.payload) && same(d4sOf(made.message?.rolls[0]), [[2]]) && faces.length === 0,
      `and sends no effectDice, Bless's d4 Foundry's, 2 (${made.message?.rolls[0]?.formula} = ${made.message?.rolls[0]?.total})`)
  } else {
    check(same(groups, [{ name: 'd20', boxes: ['d20'] }, blessLine]) && await skipBless(entry.dialog).isVisible() && await skipBless(entry.dialog).textContent() === 'Skip',
      `a Dexterity save asks its d20 and "Bless: +1d4", a box and Skip ("Skip Bless’s d4") (${JSON.stringify(groups)})`)
    await keys(entry.dialog, '1', '2', '3')
    const total = await totalOf(entry.dialog)
    made = await done(alice, entry)
    const roll = made.message?.rolls[0]
    check(same(made.body?.effectDice, [{ faces: 4, sign: 1, results: [3] }]) && sameJson(made.request.payload.effectDice, [{ faces: 4, sign: 1, results: [3] }])
      && same(made.request.payload.dice, [{ faces: 20, results: [12] }]) && same(d4sOf(roll), [[3]]) && roll.total === 18 && total === 'Total 18',
      `typed 12 and 3 ("${total}"): sent with effectDice [{ faces: 4, sign: 1, results: [3] }], its dice the d20 alone; the card's d4 is the 3 (${roll?.formula} = ${roll?.total})`)
    const shown = await trayMade(alice)
    check(shown.total === '18' && shown.lines.some(line => /Bless \+1d4 \(3\)$/.test(line)) && atTable(shown) === '18',
      `the tray's breakdown ends with "Bless +1d4 (3)", and its 18 is the table's (${JSON.stringify(shown)})`)
    // Crafted: an effect's d20, or rerolls kept on a roll not typed, refused by the app.
    const before = requests()
    const plain = { kind: 'save', key: 'dex', mode: 0, explicit: false, extras: [], dice: [{ faces: 20, results: [12] }] }
    const twenty = await call(alice.page, '/api/characters/sheet-thorin/rolls', { method: 'POST', body: { ...plain, typed: true, effectDice: [{ faces: 20, sign: 1, results: [12] }] } })
    const untyped = await call(alice.page, '/api/characters/sheet-thorin/rolls', { method: 'POST', body: { ...plain, rerolls: 'kept' } })
    check(twenty.status === 400 && untyped.status === 400 && requests() === before,
      `crafted, a d20 among a save's effectDice is refused (${twenty.status}), and rerolls kept on a roll not typed (${untyped.status}); nothing kept`)
  }
}
if (!DND5E6) {
  // 4. Skipped: the game's, said in the total; typed in again, its box back.
  faces.push(2)
  entry = await asked(alice, () => dexSave(alice).click(), 'a Dexterity save, Bless skipped')
  await keys(entry.dialog, '1', '2')
  await skipBless(entry.dialog).click()
  {
    const look = {
      groups: await groupsOf(entry.dialog), said: await entry.dialog.getByText('The game rolls Bless’s d4.', { exact: true }).isVisible(),
      total: await totalOf(entry.dialog), focus: await focusedBox(entry.dialog), typeIn: await entry.dialog.getByRole('button', { name: 'Type it in, Bless’s d4', exact: true }).textContent(),
    }
    check(same(look.groups, [{ name: 'd20', boxes: ['d20'] }, { name: 'Bless: +1d4', boxes: [] }]) && look.said && look.total === 'Total 15, not counting Bless’s d4' && look.focus === 'Done' && look.typeIn === 'Type it in',
      `Skip: its box goes, "The game rolls Bless’s d4." and "Type it in" ("Type it in, Bless’s d4") in its place, the total "${look.total}", focus on Done (${JSON.stringify(look)})`)
  }
  await entry.dialog.getByRole('button', { name: 'Type it in, Bless’s d4', exact: true }).click()
  {
    const back = { groups: await groupsOf(entry.dialog), focus: await focusIn(entry.dialog), current: await currentBox(entry.dialog), total: await totalOf(entry.dialog) }
    check(same(back.groups, [{ name: 'd20', boxes: ['d20'] }, blessLine]) && same(back.focus, { name: 'd4', group: 'Bless: +1d4' }) && back.current === 'd4' && back.total === 'Total 15',
      `Type it in brings its box back, focused and current, the total "${back.total}" (${JSON.stringify(back)})`)
  }
  await skipBless(entry.dialog).click()
  made = await done(alice, entry)
  {
    const roll = made.message?.rolls[0]
    const shown = await trayMade(alice)
    check(!('effectDice' in (made.body ?? {})) && !('effectDice' in made.request.payload) && same(d4sOf(roll), [[2]]) && roll.total === 17 && faces.length === 0
      && shown.total === '15' && atTable(shown) === '17',
      `skipped again and Done: no effectDice sent, the card's d4 Foundry's, 2 (${roll?.formula} = ${roll?.total}); the tray's own 15 leaves it out, the table's is 17 (${JSON.stringify(shown)})`)
    const earlier = (await tray(alice).locator('details li').first().textContent()).replace(/\s+/g, ' ')
    check(/^Dexterity saving throw ?12 \+3 \+3 = 18 ?· table 18$/.test(earlier), `among the earlier rolls, the typed one reads "${earlier}": Bless's +3 last, and its 18 the table's`)
  }
  // 5. Grukk's Bane too: both asked, by the spells' names, Grukk nowhere.
  let bane = await putOn(BANED)
  await sheetWith([alice], ['Blessed', 'Bane'])
  await alice.tab('Character')
  entry = await asked(alice, () => dexSave(alice).click(), 'a Dexterity save, Blessed and Baned')
  {
    const groups = await groupsOf(entry.dialog)
    const text = await entry.dialog.innerText()
    check(same(groups, [{ name: 'd20', boxes: ['d20'] }, blessLine, baneLine]) && !text.includes('Grukk') && sameJson(storedDice().map(die => [die.name, die.sign]), [['Bless', 1], ['Bane', -1]])
      && !JSON.stringify(storedDice()).includes('Grukk'),
      `Grukk's Bane added: "Bless: +1d4" and "Bane: −1d4", each with its box, and Grukk named nowhere in the dialog nor in the sheet's effectDice (${JSON.stringify(groups)})`)
  }
  await keys(entry.dialog, '1', '2', '4', '1')
  {
    const total = await totalOf(entry.dialog)
    made = await done(alice, entry)
    const roll = made.message?.rolls[0]
    check(sameJson(made.request.payload.effectDice, [{ faces: 4, sign: 1, results: [4] }, { faces: 4, sign: -1, results: [1] }]) && same(d4sOf(roll), [[4], [1]])
      && /\+ 1d4 - 1d4$/.test(roll.formula) && roll.total === 18 && total === 'Total 18',
      `typed 12, 4 and 1 ("${total}"): the card's d4s are 4, added, and 1, taken away (${roll?.formula} = ${roll?.total})`)
  }
  // 6. Bless gone, Bane alone: a lone −1d4.
  await takeOff(blessed)
  await sheetWith([alice], ['Bane'])
  await alice.tab('Character')
  entry = await asked(alice, () => dexSave(alice).click(), 'a Dexterity save, Bane alone')
  check(same(await groupsOf(entry.dialog), [{ name: 'd20', boxes: ['d20'] }, baneLine]), `Bless gone, Bane alone asks "Bane: −1d4" (${JSON.stringify(await groupsOf(entry.dialog))})`)
  await keys(entry.dialog, '1', '2', '1')
  {
    const total = await totalOf(entry.dialog)
    made = await done(alice, entry)
    const roll = made.message?.rolls[0]
    const shown = await trayMade(alice)
    check(sameJson(made.request.payload.effectDice, [{ faces: 4, sign: -1, results: [1] }]) && same(d4sOf(roll), [[1]]) && /- 1d4$/.test(roll.formula) && roll.total === 14
      && total === 'Total 14' && shown.total === '14' && atTable(shown) === '14',
      `typed 12 and 1: the card's lone d4 is the 1, taken away (${roll?.formula} = ${roll?.total}), the tray's 14 the table's (${JSON.stringify(shown)})`)
  }
  // 7. The rapier, Blessed again: Bless's d4 asked, its value the attack's.
  await takeOff(bane)
  blessed = await putOn(BLESSED)
  await sheetWith([alice], ['Blessed'])
  await alice.tab('Actions')
  // The rapier's own magic d4, Foundry's: 2.
  faces.push(2)
  entry = await asked(alice, async () => {
    await rapier.click()
    await rapierPicker.waitFor()
    await rapierPicker.getByRole('button', { name: /^Goblin/ }).click()
  }, 'the rapier, Blessed')
  check(same(await groupsOf(entry.dialog), [{ name: 'd20', boxes: ['d20'] }, blessLine]), `the rapier at the goblin asks its d20 and "Bless: +1d4" (${JSON.stringify(await groupsOf(entry.dialog))})`)
  {
    const earlier = (await tray(alice).locator('details li').first().textContent()).replace(/\s+/g, ' ')
    check(/^Dexterity saving throw ?12 \+3 \+4 −1 = 18 ?· table 18$/.test(earlier), `among the earlier rolls, Bless and Bane's reads "${earlier}": Bless's +4, then Bane's −1`)
  }
  await keys(entry.dialog, '1', '5', '3')
  made = await done(alice, entry)
  {
    const roll = MIDI ? W.midi.made.at(-1)?.attackRoll : made.message?.rolls[0]
    check(sameJson(made.request.payload.effectDice, [{ faces: 4, sign: 1, results: [3] }]) && same(d20sOf(roll), [15]) && same(d4sOf(roll).flat().sort(), [2, 3]) && roll.total === 26 && faces.length === 0,
      `typed 15 and 3: the attack's d4s are Bless's 3 and its own magic one, Foundry's 2${MIDI ? ", through Midi-QOL's workflow" : ''} (${roll?.formula} = ${roll?.total})`)
  }
  // 8. Athletic Guidance: on Athletics, not on Acrobatics.
  const guided = await putOn(GUIDED)
  await sheetWith([alice], ['Blessed', 'Athletic Guidance'])
  await alice.tab('Character')
  entry = await asked(alice, () => skillCheck(alice, 'Athletics').click(), 'Athletics, Guided')
  check(same(await groupsOf(entry.dialog), [{ name: 'd20', boxes: ['d20'] }, { name: 'Guidance: +1d4', boxes: ['d4'] }]),
    `Athletics asks its d20 and "Guidance: +1d4", not Bless's (${JSON.stringify(await groupsOf(entry.dialog))})`)
  await keys(entry.dialog, '1', '2', '3')
  await shootBoth(alice, 'typed-guidance', entry.dialog, SHOTS_042)
  {
    const total = await totalOf(entry.dialog)
    made = await done(alice, entry)
    const roll = made.message?.rolls[0]
    check(sameJson(made.request.payload.effectDice, [{ faces: 4, sign: 1, results: [3] }]) && same(d4sOf(roll), [[3]]) && roll.total === 19 && total === 'Total 19',
      `typed 12 and 3 ("${total}"): the card's d4 is Guidance's 3 (${roll?.formula} = ${roll?.total})`)
  }
  entry = await asked(alice, () => skillCheck(alice, 'Acrobatics').click(), 'Acrobatics')
  check(same(await groupsOf(entry.dialog), [{ name: 'd20', boxes: ['d20'] }]), `Acrobatics asks only its d20 (${JSON.stringify(await groupsOf(entry.dialog))})`)
  await entry.dialog.getByRole('button', { name: 'Cancel' }).click()
  await entry.dialog.waitFor({ state: 'hidden' })
  // 9. From the keyboard at 1280: Skip to the next box, Next die past the skipped die, Enter on the
  // last box shown as Done. Bless and Bane again.
  bane = await putOn(BANED)
  var desk = await browse({ width: 1280, height: 800, path: '/characters/sheet-thorin' })
  await desk.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  watchPosts(desk)
  await sheetWith([alice, desk], ['Blessed', 'Bane', 'Athletic Guidance'])
  await desk.tab('Character')
  entry = await asked(desk, () => skillCheck(desk, 'Athletics').click(), 'Athletics at 1280')
  await shootBoth(desk, 'typed-guidance', entry.dialog, SHOTS_042)
  await entry.dialog.getByRole('button', { name: 'Cancel' }).click()
  await entry.dialog.waitFor({ state: 'hidden' })
  // Bless's d4 Foundry's: 2.
  faces.push(2)
  entry = await asked(desk, () => dexSave(desk).click(), 'a Dexterity save from the keyboard')
  {
    const { dialog } = entry
    const keyboard = desk.page.keyboard
    await firstFocused(dialog, 'd20')
    await keyboard.press('1')
    await keyboard.press('2')
    const onBless = await focusIn(dialog)
    await keyboard.press('Shift+Tab')
    const onSkip = await focusIn(dialog)
    await keyboard.press('Enter')
    const afterSkip = await focusIn(dialog)
    check(same(onBless, { name: 'd4', group: 'Bless: +1d4' }) && same(onSkip, { name: 'Skip Bless’s d4', group: 'Bless: +1d4' }) && same(afterSkip, { name: 'd4', group: 'Bane: −1d4' }),
      `at 1280, 12 typed moves to Bless's box; Shift+Tab reaches its Skip, and Enter skips it, focus on to Bane's box (${JSON.stringify([onBless, onSkip, afterSkip])})`)
    await shootBoth(desk, 'typed-effects', dialog, SHOTS_042)
    await dialog.getByRole('textbox', { name: 'd20', exact: true }).focus()
    await nextDie(dialog).focus()
    await keyboard.press('Enter')
    const afterNext = await focusIn(dialog)
    check(same(afterNext, { name: 'd4', group: 'Bane: −1d4' }) && await currentBox(dialog) === 'd4' && await nextDie(dialog).count() === 0,
      `from the d20's box, Enter on Next die passes the skipped Bless to Bane's box, the last shown: focused, current, no Next die (${JSON.stringify(afterNext)})`)
    await keyboard.press('1')
    await dialog.getByRole('group', { name: 'Bane: −1d4' }).getByRole('textbox').focus()
    made = await done(desk, entry, { submit: () => keyboard.press('Enter') })
    const roll = made.message?.rolls[0]
    check(sameJson(made.request.payload.effectDice, [{ faces: 4, sign: -1, results: [1] }]) && same(made.request.payload.dice, [{ faces: 20, results: [12] }])
      && same(d4sOf(roll), [[2], [1]]) && roll.total === 16 && faces.length === 0,
      `Enter on Bane's box, the last shown, is Done: Bane's 1 sent, Bless's d4 Foundry's 2 (${roll?.formula} = ${roll?.total})`)
  }
  // 10. Phones: the rapier's three d20s (Elven Accuracy), Bless and Bane, at 390×844, 360×640 and 844×390.
  // Changed on purpose (round 0.42.1 §7.4): Elven Accuracy's third on its own line, its Skip and Type
  // it in beside Bless's and Bane's.
  const small = await browse({ width: 360, height: 640, path: '/characters/sheet-thorin' })
  const wide = await browse({ width: 844, height: 390, path: '/characters/sheet-thorin' })
  for (const who of [alice, small, wide]) {
    if (who !== alice) await who.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
    if (who.width < 1024) await who.character().catch(() => {})
    await who.tab('Actions')
    const picker = who.page.getByRole('dialog', { name: 'Rapier attack' })
    const { dialog } = await asked(who, async () => {
      await fromMenu(who, panel(who).getByRole('button', { name: 'Rapier attack, +6' }), 'Roll with advantage')
      await picker.waitFor()
      await picker.getByRole('button', { name: /^Goblin/ }).click()
    }, `the rapier at ${who.width}`)
    await wait(300)
    const groups = await groupsOf(dialog)
    const look = await effectButtons(dialog)
    const sideways_ = await sideways(who.page)
    const phone = who.width < 640
    const { height } = who.page.viewportSize()
    check(same(groups.map(g => g.name), ['d20, advantage', 'Elven Accuracy: third d20', 'Bless: +1d4', 'Bane: −1d4']) && sideways_ === 0 && look.short === (height <= 480)
      && same(look.seen.map(b => b.name), ['Skip Elven Accuracy’s d20', 'Skip Bless’s d4', 'Skip Bane’s d4', 'Type it in, Elven Accuracy’s d20', 'Type it in, Bless’s d4', 'Type it in, Bane’s d4'])
      && look.seen.every(b => b.focused && b.inView && b.clear && (!phone || b.height >= 44)),
      `at ${who.width}×${height}, the rapier's two d20s, Elven Accuracy's third, Bless and Bane: nothing scrolls sideways; each Skip and Type it in, Elven Accuracy's among them, focused, is in view and ${look.short ? 'beside the keypad, in the dice column' : 'above the keypad'}${phone ? ', at least 44 px tall' : ''} (${JSON.stringify(look)})`)
    if (who === alice) {
      await dialog.getByRole('button', { name: 'Type it in, Bane’s d4', exact: true }).click()
      await shootBoth(alice, 'typed-effects', dialog, SHOTS_042)
    }
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await dialog.waitFor({ state: 'hidden' })
    if (who !== alice) await who.view.close()
  }
  for (const effect of [blessed, bane, guided]) await takeOff(effect)
  await sheetWith([alice, desk], [])
  check(!('effectDice' in (storedSheet() ?? { effectDice: 0 })), "all three taken off, Thorin's sheet has no effectDice again")
}
if (DND5E6) {
  await takeOff(blessed)
  await sheetWith([alice], [])
}

// =================================================================================================
// 5c. Module 0.42.1: the 2024 Bardic Inspiration offered, spent and removed (round 0.42.1 §7.4)
// =================================================================================================
part('5c. bardic inspiration')
{
  /** Thorin's effect as the app keeps his sheet, by its name: its row, with its `ops`. */
  const storedEffect = name => (storedSheet()?.effects ?? []).flatMap(section => section.effects).find(row => row.name === name)
  const ADDED = [{ sign: 1, count: 1, sides: 6 }]
  const add = dialog => dialog.getByRole('button', { name: 'Add Bardic Inspiration’s d6', exact: true })
  const cancel = async dialog => {
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await dialog.waitFor({ state: 'hidden' })
  }
  // 1. The Gamemaster applies Vex's Inspired to Thorin, as dnd5e's Apply does: from his feature's effect.
  let inspired = await putOn(inspiring())
  await sheetWith([alice], ['Inspired'])
  if (DND5E6) {
    check(storedDice() === null, `dnd5e 6.0.5: Vex's Inspired on Thorin, his sheet lists no effectDice, so nothing is offered (${JSON.stringify(storedSheet()?.effectDice)})`)
    await takeOff(inspired)
    await sheetWith([alice], [])
  } else {
    check(sameJson(storedDice(), [offered(inspired.id)]) && !JSON.stringify(storedDice()).includes('Vex') && same(storedEffect('Inspired')?.ops, ['disable', 'delete']),
      `Vex's Inspired applied: within a poll the app keeps Thorin's sheet offering {name "Bardic Inspiration", a d6, count 1, sign 1, on ${OFFER_ON.join(', ')}, offer true}, its effect Inspired, Vex named nowhere; and Inspired his to turn off or delete (${JSON.stringify(storedDice())}; ${JSON.stringify(storedEffect('Inspired')?.ops)})`)

    // 2. A Strength save: no die asked for it, its row beside Done, left out; Done sends nothing more.
    await alice.tab('Character')
    entry = await asked(alice, () => strSave(alice).click(), 'a Strength save, Inspired')
    {
      const { dialog } = entry
      const focused = await firstFocused(dialog, 'd20')
      const groups = await groupsOf(dialog)
      const look = await offerLook(dialog)
      check(focused === 'd20' && same(groups, [{ name: 'd20', boxes: ['d20'] }]) && same(look?.lines, ['Bardic Inspiration: +1d6', OFFER_LINE])
        && look.name === 'Add Bardic Inspiration’s d6' && look.text === 'Add' && look.described === OFFER_LINE && look.inBlock && look.inView,
        `a Strength save asks only its d20, no group for Bardic Inspiration; with focus still in its box, the row "Bardic Inspiration: +1d6", "${OFFER_LINE}" and Add ("Add Bardic Inspiration’s d6", described by that line) are in the dialog's sticky block, after the keypad and before Done, in view (${JSON.stringify({ groups, look })})`)
      await keys(dialog, '9')
      const total = await totalOf(dialog)
      made = await done(alice, entry)
      const shown = await trayMade(alice)
      check((made.body?.extras ?? []).length === 0 && (made.request.payload.extras ?? []).length === 0 && same(made.request.payload.dice, [{ faces: 20, results: [9] }])
        && !('effectDice' in made.request.payload) && spentLines(shown.lines).length === 0 && atTable(shown) === String(made.message?.rolls[0]?.total) && onThorin(inspired.id),
        `typed 9 ("${total}") and Done, the die left out: sent with no extras, its one d20; once made, no spent line, and Inspired still on Thorin (${JSON.stringify(shown)})`)
    }

    // 3. From the keyboard at 1280: the typed d20 to Add; Add, Leave out and Add again; the d6
    // typed; Done. Sent as one of the roll's extras; once made, Inspired removed beneath the save.
    await resultsAs(desk, 'Banner')
    await sheetWith([desk], ['Inspired'])
    await desk.tab('Character')
    let commandsBefore = effectCommands().length
    entry = await asked(desk, () => strSave(desk).click(), 'a Strength save from the keyboard, Inspired')
    {
      const { dialog } = entry
      const keyboard = desk.page.keyboard
      await firstFocused(dialog, 'd20')
      await keyboard.press('9')
      const onAdd = await focusIn(dialog)
      await keyboard.press('Enter')
      const added = { groups: await groupsOf(dialog), focus: await focusIn(dialog), current: await currentBox(dialog) }
      check(same(onAdd, { name: 'Add Bardic Inspiration’s d6', group: null }) && same(added.groups, [{ name: 'd20', boxes: ['d20'] }, { name: 'Bardic Inspiration: +1d6', boxes: ['d6'] }])
        && same(added.focus, { name: 'd6', group: 'Bardic Inspiration: +1d6' }) && added.current === 'd6',
        `at 1280, 9 typed moves focus to "Add Bardic Inspiration’s d6", not Done; Enter adds "Bardic Inspiration: +1d6" last among the dice, its box d6 focused and current (${JSON.stringify({ onAdd, added })})`)
      await dialog.getByRole('button', { name: 'Leave out Bardic Inspiration’s d6', exact: true }).focus()
      await keyboard.press('Enter')
      const out = { groups: await groupsOf(dialog), focus: await focusIn(dialog) }
      check(same(out.groups, [{ name: 'd20', boxes: ['d20'] }]) && same(out.focus, { name: 'Add Bardic Inspiration’s d6', group: null }),
        `Leave out, from the keyboard: its group goes, and focus stays on the button, Add again (${JSON.stringify(out)})`)
      await keyboard.press('Enter')
      const again = await focusIn(dialog)
      await keyboard.press('5')
      const onDone = await focusIn(dialog)
      const total = await totalOf(dialog)
      check(same(again, { name: 'd6', group: 'Bardic Inspiration: +1d6' }) && same(onDone, { name: 'Done', group: null }),
        `Enter on Add again focuses its d6; 5 typed there moves focus to Done ("${total}") (${JSON.stringify([again, onDone])})`)
      made = await done(desk, entry, { submit: () => keyboard.press('Enter') })
      const roll = made.message?.rolls[0]
      const d6 = roll?.dice?.find(die => die.faces === 6)?.results.map(r => r.result)
      check(sameJson(made.request.payload.extras, ADDED) && same(made.body?.extras, ADDED)
        && same(made.request.payload.dice, [{ faces: 20, results: [9] }, { faces: 6, results: [5] }]) && !('effectDice' in made.request.payload) && !('effectDice' in (made.body ?? {}))
        && same(d20sOf(roll), [9]) && same(d6, [5]) && total === `Total ${roll?.total}`,
        `Enter on Done: sent with the extras [{ sign: 1, count: 1, sides: 6 }] and the dice [9] and [5], no effectDice; the card's d6 is the typed 5, its total the dialog's "${total}" (${roll?.formula} = ${roll?.total})`)
      const shown = await trayMade(desk)
      check(shown.lines.some(line => /Bardic Inspiration \+1d6 \(5\)/.test(line)) && shown.total === String(roll?.total) && atTable(shown) === String(roll?.total),
        `the tray's breakdown has "Bardic Inspiration +1d6 (5)", and its ${shown.total} is the table's (${JSON.stringify(shown)})`)
      const later = await traySpent(desk, SPENT.removed)
      // Inspired's line, beneath the save, once the game has said it's deleted.
      const LOGGED = /^Inspired ?deleted ?· at the table$/
      const earlierLine = async () => (await tray(desk).locator('details li').first().textContent()).replace(/\s+/g, ' ')
      await until(async () => LOGGED.test(await earlierLine()), "Inspired's line to say it's deleted at the table", 15_000).catch(() => {})
      const earlier = await earlierLine()
      const sent = effectCommands().slice(commandsBefore)
      check(later.lines.includes(SPENT.removed) && /^Strength saving throw/.test(later.lines[0] ?? '') && LOGGED.test(earlier)
        && sameJson(sent, [{ status: 'done', effect: { op: 'delete', id: inspired.id } }]) && !onThorin(inspired.id),
        `once made, the app removes Inspired itself: "${SPENT.removed}" in the tray's latest, still the save; Inspired's line logged beneath it ("${earlier}"); one delete sent, and Inspired gone from Thorin in Foundry (${JSON.stringify({ later, sent })})`)
    }
    entry = await asked(desk, () => strSave(desk).click(), 'the next Strength save, Inspired gone')
    {
      const look = await offerLook(entry.dialog)
      check(look === null && storedOffers().length === 0, `the next Strength save offers nothing (${JSON.stringify(look)})`)
    }
    await cancel(entry.dialog)

    // 4. An attack: Inspired put on again; the rapier, a hit with the die added: once made, Inspired
    // removed beneath it, and its damage still due in the tray's latest, and rolled.
    inspired = await putOn(inspiring())
    await sheetWith([alice], ['Inspired'])
    await alice.tab('Actions')
    // The rapier's own magic d4, Foundry's: 2.
    faces.push(2)
    entry = await asked(alice, async () => {
      await rapier.click()
      await rapierPicker.waitFor()
      await rapierPicker.getByRole('button', { name: /^Goblin/ }).click()
    }, 'the rapier, Inspired')
    {
      const { dialog } = entry
      const groups = await groupsOf(dialog)
      await keys(dialog, '1', '5')
      const onAdd = await focusIn(dialog)
      await add(dialog).click()
      await keys(dialog, '4')
      const total = await totalOf(dialog)
      made = await done(alice, entry)
      const roll = MIDI ? W.midi.made.at(-1)?.attackRoll : made.message?.rolls[0]
      const d6 = roll?.dice?.find(die => die.faces === 6)?.results.map(r => r.result)
      check(same(groups, [{ name: 'd20', boxes: ['d20'] }]) && onAdd?.name === 'Add Bardic Inspiration’s d6' && sameJson(made.request.payload.extras, ADDED)
        && same(made.request.payload.dice, [{ faces: 20, results: [15] }, { faces: 6, results: [4] }]) && same(d20sOf(roll), [15]) && same(d6, [4]) && faces.length === 0,
        `the rapier at the goblin offers the die too: 15 typed moves focus to Add; added, 4 typed ("${total}"): sent among its extras, the card's d6 the 4${MIDI ? ", through Midi-QOL's workflow" : ''} (${roll?.formula} = ${roll?.total})`)
      const damage = tray(alice).getByRole('button', { name: 'Roll damage' })
      await damage.waitFor({ timeout: 30_000 })
      const later = await traySpent(alice, SPENT.removed)
      check(/^Rapier/.test(later.lines[0] ?? '') && later.lines.includes(SPENT.removed) && await damage.isVisible() && !onThorin(inspired.id),
        `a hit: once made, "${SPENT.removed}" and Inspired gone, and the tray's latest is still the attack, its Roll damage there (${JSON.stringify(later)})`)
      entry = await asked(alice, () => damage.click(), "the rapier's damage, Inspired removed")
      check(same(await groupsOf(entry.dialog), [{ name: '1d8 Piercing', boxes: ['d8'] }]), `Roll damage asks for "1d8 Piercing" (${JSON.stringify(await groupsOf(entry.dialog))})`)
      await keys(entry.dialog, '5')
      made = await done(alice, entry)
      check(made.made?.status === 'done' && same(made.request.payload.dice, [{ faces: 8, results: [5] }]), `and its damage is made, the typed 5 (${made.made?.status})`)
    }

    // 5. Spent where the app may not remove it: the campaign's effects switch off.
    await effectsSwitch(false)
    inspired = await putOn(inspiring())
    await sheetWith([alice], ['Inspired'])
    await alice.tab('Character')
    commandsBefore = effectCommands().length
    entry = await asked(alice, () => strSave(alice).click(), "a Strength save, Inspired, the campaign's switch off")
    await keys(entry.dialog, '8')
    await add(entry.dialog).click()
    await keys(entry.dialog, '3')
    made = await done(alice, entry)
    {
      const later = await traySpent(alice, SPENT.ask)
      await wait(3_000)
      check(sameJson(made.request.payload.extras, ADDED) && later.lines.includes(SPENT.ask) && effectCommands().length === commandsBefore && onThorin(inspired.id),
        `with the campaign's effects switch off, the die added and the save made: "${SPENT.ask}", no delete sent, Inspired still on Thorin (${JSON.stringify(later)})`)
    }
    entry = await asked(alice, () => strSave(alice).click(), 'the next Strength save, Inspired still on')
    {
      const look = await offerLook(entry.dialog)
      check(look === null && sameJson(storedOffers(), [offered(inspired.id)]),
        `the next Strength save offers nothing, its die spent on this page, though Inspired is still on Thorin and his sheet still offers it (${JSON.stringify(look)})`)
    }
    await cancel(entry.dialog)
    await takeOff(inspired)
    await sheetWith([alice], [])
    await effectsSwitch(true)

    // 6. As toasts: the save's toast says its die whole and the spent line; Inspired's pops.
    await clearToasts(alice)
    await resultsAs(alice, 'Toasts')
    inspired = await putOn(inspiring())
    await sheetWith([alice], ['Inspired'])
    await alice.tab('Character')
    entry = await asked(alice, () => strSave(alice).click(), 'a Strength save, Inspired, as toasts')
    await keys(entry.dialog, '1', '1')
    await add(entry.dialog).click()
    await keys(entry.dialog, '5')
    made = await done(alice, entry)
    {
      const saveToast = toasts(alice).filter({ hasText: 'Strength saving throw' }).first()
      const SAID = /Bardic Inspiration spent: (removing Inspired…|Inspired removed\.)/
      await until(async () => (await saveToast.count()) > 0 && SAID.test(await saveToast.textContent()), "the save's toast to say its die is spent", 20_000).catch(() => {})
      const look = await saveToast.evaluate(el => {
        const lines = [...el.querySelectorAll('p')]
        const dice = lines.find(p => p.textContent.includes('Bardic Inspiration +1d6'))
        return {
          dice: dice?.textContent.trim() ?? null, clamped: dice?.classList.contains('line-clamp-2') ?? false, whole: !!dice && dice.scrollHeight <= dice.clientHeight + 1,
          spent: lines.map(p => p.textContent.trim()).filter(text => text.startsWith('Bardic Inspiration spent')),
        }
      }).catch(() => null)
      const inspiredToast = toasts(alice).filter({ hasText: 'Inspired' }).filter({ hasNotText: 'saving throw' }).first()
      const popped = await inspiredToast.waitFor({ timeout: 15_000 }).then(() => true, () => false)
      await until(() => !onThorin(inspired.id), 'Inspired to go', 20_000).catch(() => {})
      check(look?.dice?.includes('Bardic Inspiration +1d6 (5)') && look.clamped && look.whole && look.spent.length === 1 && SAID.test(look.spent[0]) && popped && !onThorin(inspired.id),
        `as toasts, the save's toast says "${look?.dice}" whole, on two lines at most, and "${look?.spent?.[0]}"; Inspired's own toast pops, and Inspired is gone (${JSON.stringify(look)})`)
    }
    await clearToasts(alice)
    await resultsAs(alice, 'Banner')

    // 7. Vex's scale a d8: a world-time tick sends Thorin's sheet again, and the offer is a d8.
    inspired = await putOn(inspiring())
    await sheetWith([alice], ['Inspired'])
    await alice.tab('Character')
    {
      const before = storedOffers().map(die => die.faces)
      vex.system.scale.bard.inspiration.faces = 8
      await Hooks.callAll('updateWorldTime', 3_600, 6)
      await until(() => storedOffers()[0]?.faces === 8, "Thorin's sheet sent again with Vex's d8", 20_000).catch(() => {})
      await until(async () => JSON.stringify((await call(alice.page, '/api/characters/sheet-thorin/table')).json?.sheet?.effectDice ?? null).includes('"faces":8'), "the seat's view with the d8", 20_000).catch(() => {})
      await wait(4_000)
      entry = await asked(alice, () => strSave(alice).click(), 'a Strength save, Vex a d8')
      const look = await offerLook(entry.dialog)
      check(same(before, [6]) && sameJson(storedOffers(), [offered(inspired.id, 8)]) && same(look?.lines, ['Bardic Inspiration: +1d8', OFFER_LINE]) && look.name === 'Add Bardic Inspiration’s d8',
        `Vex's scale a d8 and a world-time tick: Thorin's sheet goes again, offering a d8 for the d6 it offered, and the next save's row is "Bardic Inspiration: +1d8" with "Add Bardic Inspiration’s d8" (${JSON.stringify(look)})`)
      await cancel(entry.dialog)
    }
    await takeOff(inspired)
    vex.system.scale.bard.inspiration.faces = 6
    await sheetWith([alice], [])

    // 8. Midi-QOL's save prompt: Bless's die asked, nothing offered, as Midi-QOL's own answers take
    // nothing added.
    if (MIDI) {
      await game.settings.set('sending-stone', 'midiPromptWait', 60_000)
      const blessing = await putOn(BLESSED)
      inspired = await putOn(inspiring())
      await sheetWith([alice], ['Blessed', 'Inspired'])
      await alice.tab('Character')
      const opened = () => postsOf('roll.prompt.opened').map(p => p.data.prompt)
      const count = opened().length
      const item = { id: 'charm5c', name: 'Charm Person', type: 'spell', uuid: 'Actor.goblin.Item.charm5c', flags: {}, system: { description: { value: '' } } }
      const workflow = await midiSaves.saveWorkflow({
        actor: goblin, item, activity: midiSaves.saveActivity({ item, abilities: ['wis'], dc: 14 }), targets: [tokenOf.thorin.object ?? W.placeables.get('tok-thorin')], token: W.placeables.get('tok-goblin'),
      })
      const running = midiSaves.runSaves(workflow)
      await until(() => opened().length > count, "Midi's prompt", 15_000)
      const asks = alice.page.getByRole('region', { name: 'Your Gamemaster asks' })
      const row = asks.getByRole('listitem').filter({ hasText: 'Charm Person' })
      await row.getByRole('button', { name: /^Roll Wisdom saving throw/ }).waitFor({ timeout: 15_000 })
      entry = await asked(alice, () => row.getByRole('button', { name: /^Roll Wisdom saving throw/ }).click(), "Midi's save, Blessed and Inspired")
      {
        const groups = await groupsOf(entry.dialog)
        const look = await offerLook(entry.dialog)
        check(same(groups, [{ name: 'd20', boxes: ['d20'] }, blessLine]) && look === null && await entry.dialog.getByText(OFFER_LINE).count() === 0,
          `Midi-QOL's save asks its d20 and "Bless: +1d4", and offers no Bardic Inspiration (${JSON.stringify({ groups, look })})`)
      }
      await keys(entry.dialog, '1', '2', '3')
      made = await done(alice, entry)
      await running
      await until(async () => (await asks.count()) === 0, 'the banner to go once answered', 15_000).catch(() => {})
      await takeOff(blessing)
      await takeOff(inspired)
      await sheetWith([alice], [])
    }

    // 9. Phones and a computer: the rapier with advantage, Elven Accuracy's line, Bless, Bane and the
    // offer, Add in view with focus in the first box; and at 360×640 a Strength save with Bless and Bane.
    inspired = await putOn(inspiring())
    const blessing = await putOn(BLESSED)
    const baning = await putOn(BANED)
    await sheetWith([alice, desk], ['Blessed', 'Bane', 'Inspired'])
    const small = await browse({ width: 360, height: 640, path: '/characters/sheet-thorin' })
    await small.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
    /** Add, with focus in the first box, and then pressed as the page's device does. */
    async function offerShown(who, dialog, first, groupsWanted, what) {
      const focused = await firstFocused(dialog, first)
      await wait(300)
      const groups = (await groupsOf(dialog)).map(g => g.name)
      const look = await offerLook(dialog)
      const across = await sideways(who.page)
      const phone = who.width < 640
      const { height } = who.page.viewportSize()
      // How much of the dice shows above the sticky block, and of the first box, focused.
      const strip = await dialog.evaluate(el => {
        const form = el.querySelector('form')
        const s = form.parentElement.getBoundingClientRect()
        const block = form.lastElementChild.getBoundingClientRect()
        const box = el.querySelector('input').getBoundingClientRect()
        return {
          dice: Math.round(block.top - s.top), box: Math.round(Math.max(0, Math.min(box.bottom, block.top) - Math.max(box.top, s.top))), of: Math.round(box.height),
          gap: Math.round(block.top - box.bottom),
        }
      })
      note(`at ${who.width}×${height}, ${what}: ${strip.dice} px of the dice show above the sticky block, and ${strip.box} of the focused first box's ${strip.of} px`)
      // Changed on purpose (round 0.42.1's review): the focused first box whole above the sticky block
      // too (§6.5), which was only noted while the offer's row hid it at 360×640; and the dice
      // scrolled as the dialog opens only as far as keeps that box clear, 8 px above the block, as the
      // dialog now does where the block would cover it. The player never scrolls to find Add.
      check(same(groups, groupsWanted) && focused === first && across === 0 && look?.name === 'Add Bardic Inspiration’s d6'
        && look.inBlock && look.inView && look.belowKeypadTop && (look.scrolled === 0 || near(strip.gap, 8)) && (!phone || look.height >= 44)
        && strip.of > 0 && strip.of - strip.box <= 1,
        `at ${who.width}×${height}, ${what}: nothing scrolls sideways; with focus in the first box, Add is found without scrolling, in view in the sticky block, at or below the keypad's top${phone ? `, ${look?.height} px tall` : ''}; and that box whole above the block (${strip.box} of ${strip.of} px), the dice ${look?.scrolled ? `scrolled ${look.scrolled} px to keep it ${strip.gap} px clear` : 'not scrolled'} (${JSON.stringify({ groups, look })})`)
      return phone
    }
    async function added(who, dialog, phone, what) {
      if (phone) await add(dialog).tap()
      else await add(dialog).click()
      await until(async () => (await addedLook(dialog))?.clear === true, 'the d6 box clear of what is kept over the dice', 5_000).catch(() => {})
      const look = await addedLook(dialog)
      const button = await offerLook(dialog)
      check(look?.last && look.box === 'd6' && look.focused && look.current && look.clear && button?.name === 'Leave out Bardic Inspiration’s d6' && button.text === 'Leave out',
        `${what}: Add ${phone ? 'tapped' : 'clicked'} brings "Bardic Inspiration: +1d6" last among the dice, its d6 focused, current and in view above the ${who.page.viewportSize().height <= 480 ? "offer's rows" : "keypad's top"}; the button reads Leave out (${JSON.stringify({ look, button })})`)
    }
    for (const who of [alice, small, desk]) {
      if (who.width < 1024) await who.character().catch(() => {})
      await who.tab('Actions')
      const picker = who.page.getByRole('dialog', { name: 'Rapier attack' })
      const { dialog } = await asked(who, async () => {
        await fromMenu(who, panel(who).getByRole('button', { name: 'Rapier attack, +6' }), 'Roll with advantage')
        await picker.waitFor()
        await picker.getByRole('button', { name: /^Goblin/ }).click()
      }, `the rapier with advantage at ${who.width}, Inspired`)
      const what = 'the rapier with advantage, its two d20s, Elven Accuracy\'s third with Skip, Bless, Bane and the offer'
      const phone = await offerShown(who, dialog, 'd20 1 of 2', ['d20, advantage', 'Elven Accuracy: third d20', 'Bless: +1d4', 'Bane: −1d4'], what)
      await shootBoth(who, 'typed-offer', dialog, SHOTS_0421)
      // Elven Accuracy's line and its Skip, as a keyboard reaches it: scrolled clear of the keypad.
      await skipElven(dialog).focus()
      await shootBoth(who, 'typed-elven-skip', dialog, SHOTS_0421)
      await added(who, dialog, phone, `at ${who.width}, the rapier`)
      await shootBoth(who, 'typed-offer-added', dialog, SHOTS_0421)
      await cancel(dialog)
    }
    await small.tab('Character')
    {
      const { dialog } = await asked(small, () => strSave(small).click(), 'a Strength save at 360×640, Blessed and Inspired')
      await offerShown(small, dialog, 'd20', ['d20', 'Bless: +1d4', 'Bane: −1d4'], 'a Strength save, Bless, Bane and the offer')
      await added(small, dialog, true, 'at 360, the save')
      await cancel(dialog)
    }
    await small.view.close()
    // 9b. A short screen, 844×390 (round 0.42.1's review): the keypad's column has no room left for
    // the offer's row and Done, so the row sits in a sticky block at the foot of the dice column;
    // Add, Done and the focused first box each whole in view, and Add's d6 box clear of that row.
    {
      const wide = await browse({ width: 844, height: 390, path: '/characters/sheet-thorin' })
      await wide.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
      await wide.character().catch(() => {})
      await wide.tab('Actions')
      const picker = wide.page.getByRole('dialog', { name: 'Rapier attack' })
      const { dialog } = await asked(wide, async () => {
        await fromMenu(wide, panel(wide).getByRole('button', { name: 'Rapier attack, +6' }), 'Roll with advantage')
        await picker.waitFor()
        await picker.getByRole('button', { name: /^Goblin/ }).click()
      }, 'the rapier with advantage at 844×390, Inspired')
      const focused = await firstFocused(dialog, 'd20 1 of 2')
      await wait(300)
      const groups = (await groupsOf(dialog)).map(g => g.name)
      const look = await shortOfferLook(dialog)
      const across = await sideways(wide.page)
      check(same(groups, ['d20, advantage', 'Elven Accuracy: third d20', 'Bless: +1d4', 'Bane: −1d4']) && focused === 'd20 1 of 2' && across === 0
        && look?.name === 'Add Bardic Inspiration’s d6' && look.short && look.inDiceColumn && look.sticky && look.add && look.done && look.box,
        `at 844×390, the rapier with advantage, Elven Accuracy's third, Bless, Bane and the offer: nothing scrolls sideways; the offer's row in a sticky block at the foot of the dice column, not the keypad's; with focus in the first box, Add, Done and that box each whole in view (${JSON.stringify({ groups, look })})`)
      await shootBoth(wide, 'typed-offer', dialog, SHOTS_0421)
      await added(wide, dialog, false, 'at 844×390, the rapier')
      await shootBoth(wide, 'typed-offer-added', dialog, SHOTS_0421)
      await cancel(dialog)
      await wide.view.close()
    }
    for (const effect of [inspired, blessing, baning]) await takeOff(effect)
    await sheetWith([alice, desk], [])
    // 10. As every later step's dialog asks: Inspired off, the switch on, Banner, Vex's d6.
    check(!onThorin(inspired.id) && storedOffers().length === 0 && vex.system.scale.bard.inspiration.faces === 6,
      "5c ends with Inspired off Thorin, nothing offered, the campaign's effects switch on, results in the banner, and Vex's scale a d6")
  }
}
await alice.tab('Actions')

// ---- 7. Damage after a hit ----
part('7. damage')
const rollDamage = name => tray(alice).getByRole('button', { name })
// A hit: typed 15.
entry = await asked(alice, async () => {
  await rapier.click()
  await rapierPicker.waitFor()
  await rapierPicker.getByRole('button', { name: /^Goblin/ }).click()
}, 'the rapier')
await keys(entry.dialog, '1', '5')
made = await done(alice, entry)
await rollDamage('Roll damage').waitFor({ timeout: 30_000 })
entry = await asked(alice, () => rollDamage('Roll damage').click(), "the rapier's damage")
check(same(await groupsOf(entry.dialog), [{ name: '1d8 Piercing', boxes: ['d8'] }]), `its damage asks for "1d8 Piercing", one box (${JSON.stringify(await groupsOf(entry.dialog))})`)
await keys(entry.dialog, '5')
made = await done(alice, entry)
check(made.request.payload.typed === true && same(made.request.payload.dice, [{ faces: 8, results: [5] }]), 'sent typed with the d8')
// A natural 20, typed: the game's doubled dice.
entry = await asked(alice, async () => {
  await rapier.click()
  await rapierPicker.waitFor()
  await rapierPicker.getByRole('button', { name: /^Goblin/ }).click()
}, 'the critical hit')
await keys(entry.dialog, '2', '0')
made = await done(alice, entry)
check(made.made?.result?.attack?.critical === true && made.made.result.damage?.rolls?.[0]?.formula === '2d8 + 3',
  `a typed 20 is a critical hit, the game's preview of its damage 2d8 + 3 (${JSON.stringify(made.made?.result?.damage?.rolls?.[0])})`)
await rollDamage('Roll critical damage').waitFor({ timeout: 30_000 })
entry = await asked(alice, () => rollDamage('Roll critical damage').click(), 'the critical damage')
check(same(await groupsOf(entry.dialog), [{ name: '2d8 Piercing', boxes: ['d8 1 of 2', 'd8 2 of 2'] }]), `the critical's damage asks for the game's 2d8, two boxes (${JSON.stringify(await groupsOf(entry.dialog))})`)
await keys(entry.dialog, '4', '6')
made = await done(alice, entry)
{
  const roll = MIDI ? W.midi.made.at(-1)?.damageRolls?.[0] : made.message?.rolls[0]
  check(roll?.formula === '2d8 + 3' && same(roll.dice[0].results.map(r => r.result), [4, 6]) && roll.total === 13,
    `the card's formula is 2d8 + 3${MIDI ? ' under Midi-QOL\'s "Double Rolled Damage" for the Gamemaster too' : ''}, the typed 4 and 6, 13 (${roll?.formula})`)
}
// More dice and another die, from Modify damage: the game lets players change their damage under
// dnd5e 6.0.5's dice as under 5.3.3's, now that the module marks the critical damage dnd5e 6 adds
// unmarked (its load self-test failed on it before, and took Modify damage and Maximum away).
const modifies = sql(`select array_to_string("rollFeatures", ',') from campaign where id = '${A}'`).split(',').includes('modifiers')
check(modifies, `the game lets players change their damage${DND5E6 ? ", under dnd5e 6.0.5's dice too" : ''}: the hello's rolls have modifiers, so Modify damage and Maximum are offered`)
{
entry = await asked(alice, async () => {
  await rapier.click()
  await rapierPicker.waitFor()
  await rapierPicker.getByRole('button', { name: /^Goblin/ }).click()
}, 'another hit')
await keys(entry.dialog, '1', '6')
await done(alice, entry)
await rollDamage('Roll damage').waitFor({ timeout: 30_000 })
await clearToasts(alice)
await rollDamage('Roll damage').click({ button: 'right' })
await alice.page.getByRole('menu').getByRole('menuitem', { name: 'Modify damage…' }).click()
const modifyDamage = alice.page.getByRole('dialog', { name: 'Modify damage' })
await modifyDamage.waitFor()
await modifyDamage.getByRole('button', { name: 'One die more' }).click()
await modifyDamage.getByText('d10', { exact: true }).click()
entry = await asked(alice, () => modifyDamage.getByRole('button', { name: 'Roll', exact: true }).click(), 'the damage, modified')
check(same(await groupsOf(entry.dialog), [{ name: '2d10 Piercing', boxes: ['d10 1 of 2', 'd10 2 of 2'] }]), `a die more, a d10 for its d8: "2d10 Piercing", two boxes (${JSON.stringify(await groupsOf(entry.dialog))})`)
await keys(entry.dialog, '0', '7')
made = await done(alice, entry)
check(same(made.request.payload.dice, [{ faces: 10, results: [10, 7] }]), `a d10's 0 arrives as 10 (${JSON.stringify(made.request.payload.dice)})`)
// Maximum asks for nothing.
entry = null
await paced()
await clearToasts(alice)
await rapier.click()
await rapierPicker.waitFor()
{
  const before = requests()
  const typedBefore = sentBy.get(alice).length
  await rapierPicker.getByRole('button', { name: /^Goblin/ }).click()
  const dialog = entryOf(alice)
  await dialog.waitFor()
  await keys(dialog, '1', '4')
  await dialog.getByRole('button', { name: 'Done' }).click()
  await until(() => requests() > before && settledRow(rollRow()), 'a third hit')
  await rollDamage('Roll damage').waitFor({ timeout: 30_000 })
  await clearToasts(alice)
  await rollDamage('Roll damage').click({ button: 'right' })
  await alice.page.getByRole('menu').getByRole('menuitem', { name: 'Roll maximum damage' }).click()
  await until(() => requests() > before + 1, 'the maximum damage to be sent')
  await wait(500)
  const max = rollRow()
  check(await entryOf(alice).count() === 0 && same(max.payload.modifiers, { maximize: true }) && !('typed' in max.payload) && sentBy.get(alice).length === typedBefore + 2,
    `its maximum opens no dialog, and sends it untyped, the game's every die at its highest (${JSON.stringify(max.payload)})`)
  await until(() => settledRow(rollRow(max.id)), 'the maximum damage to be made')
}
}

// =================================================================================================
// 7b. Module 0.42.0: rerolls at the table (its contract §8.5)
// =================================================================================================
part('7b. rerolls at the table')
{
  await alice.tab('Actions')
  const greatsword = panel(alice).getByRole('button', { name: 'Greatsword attack, +4' })
  const picker = alice.page.getByRole('dialog', { name: 'Greatsword attack' })
  entry = await asked(alice, async () => {
    await greatsword.click()
    await picker.waitFor()
    await picker.getByRole('button', { name: /^Goblin/ }).click()
  }, 'the greatsword')
  await keys(entry.dialog, '1', '5')
  await done(alice, entry)
  await rollDamage('Roll damage').waitFor({ timeout: 30_000 })
  entry = await asked(alice, () => rollDamage('Roll damage').click(), "the greatsword's damage")
  const groups = await groupsOf(entry.dialog)
  check(same(groups, [{ name: '2d6r<=2 Slashing', boxes: ['d6 1 of 2', 'd6 2 of 2'] }]) && await entry.dialog.getByText(REROLL_NOTE, { exact: true }).isVisible(),
    `the greatsword's damage asks for its 2d6r<=2 as written, two boxes, and says "${REROLL_NOTE}" (${JSON.stringify(groups)})`)
  await shootBoth(alice, 'typed-reroll-note', entry.dialog, SHOTS_042)
  await keys(entry.dialog, '1', '5')
  const total = await totalOf(entry.dialog)
  made = await done(alice, entry, { soon: () => trayLatest(alice) })
  const roll = MIDI ? W.midi.made.at(-1)?.damageRolls?.[0] : made.message?.rolls[0]
  check(made.request.payload.typed === true && made.request.payload.rerolls === 'kept' && made.body?.rerolls === 'kept' && same(made.request.payload.dice, [{ faces: 6, results: [1, 5] }])
    && same(roll?.dice[0].results.map(r => [r.result, r.active !== false, r.rerolled === true]), [[1, true, false], [5, true, false]]) && !roll.formula.includes('r<=2') && roll.total === 7,
    `typed 1 and 5: sent with rerolls "kept"; the card's d6s are the 1 and the 5, neither rerolled${MIDI ? ", through Midi-QOL's workflow" : ''}, its formula without r<=2 (${roll?.formula} = ${roll?.total})`)
  check(total === 'Total 7' && made.soon?.total === '7', `the dialog said "${total}", and the tray says ${made.soon?.total} at once: the game's total, nothing to wait for`)
  // A Halfling's 1, typed: it stands, as rerolled at the table.
  thorin.flags.dnd5e.halflingLucky = true
  await alice.tab('Character')
  entry = await asked(alice, () => dexSave(alice).click(), "a Halfling's Dexterity save")
  await keys(entry.dialog, '1')
  made = await done(alice, entry)
  thorin.flags.dnd5e.halflingLucky = false
  const save = made.message?.rolls[0]
  check(made.request.payload.rerolls === 'kept' && same(save?.dice[0].results.map(r => [r.result, r.rerolled === true]), [[1, false]]) && !save.formula.includes('r1=1') && save.total === 4,
    `Thorin a Halfling, a typed 1 on a save, sent with rerolls "kept": the card's one d20, the 1, stands, its formula without r1=1 (${save?.formula} = ${save?.total})`)
  // An exploding die: no note, Foundry's die more, the game's total.
  await alice.tab('Spells')
  faces.push(3)
  entry = await asked(alice, () => panel(alice).getByRole('button', { name: 'Roll Wild Sparks: Burst, 1d6x' }).click(), 'the 1d6x formula')
  const sparks = await groupsOf(entry.dialog)
  const noted = await entry.dialog.getByText(REROLL_NOTE).count()
  await keys(entry.dialog, '6')
  made = await done(alice, entry)
  const burst = made.message?.rolls[0]
  await until(async () => (await trayLatest(alice)).total === String(burst?.total), "the tray to show the game's total", 20_000).catch(() => {})
  const later = await trayMade(alice)
  check(same(sparks, [{ name: '1d6x', boxes: ['d6'] }]) && noted === 0 && made.request.payload.rerolls === 'kept' && same(burst?.dice[0].results.map(r => r.result), [6, 3])
    && burst.total === 9 && faces.length === 0 && later.total === '9' && atTable(later) === '9',
    `Wild Sparks' 1d6x asks one d6 and says no note, as it doesn't reroll; typed 6, Foundry throws its die more, a 3 (${burst?.formula} = ${burst?.total}), and the tray shows the game's 9 once made (${JSON.stringify(later)})`)
  // The note at 1280 too.
  if (desk) {
    await desk.tab('Actions')
    entry = await asked(desk, () => panel(desk).getByRole('button', { name: /^Greatsword damage/ }).first().click(), "the greatsword's damage at 1280")
    check(await entry.dialog.getByText(REROLL_NOTE, { exact: true }).isVisible(), `at 1280 the greatsword's damage says "${REROLL_NOTE}" too`)
    await shootBoth(desk, 'typed-reroll-note', entry.dialog, SHOTS_042)
    await entry.dialog.getByRole('button', { name: 'Cancel' }).click()
    await entry.dialog.waitFor({ state: 'hidden' })
    await desk.view.close()
  }
}

// ---- 8. A use's damage: offered, waiting for a tap ----
part('8. a use')
await resultsAs(alice, 'Toasts')
await alice.tab('Spells')
await panel(alice).getByRole('button', { name: /^Fireball, DEX saving throw/ }).click()
const fireballPicker = alice.page.getByRole('dialog', { name: 'Fireball' })
await fireballPicker.waitFor()
for (const name of [/^Goblin/, /^Ogre/]) await fireballPicker.getByRole('checkbox', { name }).check()
{
  const before = requests()
  await fireballPicker.getByRole('button', { name: /^Cast at 2 targets/ }).click()
  await until(() => requests() > before && settledRow(rollRow()), 'Fireball to be cast', 30_000)
  const cast = rollRow()
  const fireToast = toasts(alice).filter({ hasText: 'Fireball' }).first()
  const offered = fireToast.getByRole('button', { name: /^Roll damage/ })
  await offered.waitFor({ timeout: 30_000 })
  await wait(5000)
  check(await entryOf(alice).count() === 0 && requests() === before + 1 && await offered.isVisible(),
    `Fireball cast at both (${cast.status}): no dialog opens by itself, nothing more is sent, and its toast stays past 4 s, its damage offered`)
  await shoot(alice, 'typed-use-offered')
  // Tapped from the Combat tab, where the sheet's pane is hidden: the dialog shows over the page
  // all the same, never inside the hidden pane, where it would show nothing and leave the page inert.
  await combatTab(alice)
  entry = await asked(alice, () => offered.click(), "Fireball's damage", { clear: false })
  {
    const look = await meets(entry.dialog)
    const focused = await firstFocused(entry.dialog, 'd6 1 of 8')
    check(look.paneHidden && !look.inPane && look.box && look.done && focused === 'd6 1 of 8',
      `at 390, from the Combat tab, the toast's Roll damage opens the dialog over the page, out of the hidden sheet: its first box and Done are what a tap meets, the first box focused (${JSON.stringify(look)}, ${focused})`)
  }
  check(same(await groupsOf(entry.dialog), [{ name: '8d6 Fire', boxes: Array.from({ length: 8 }, (_, i) => `d6 ${i + 1} of 8`) }]), "a tap opens 8 boxes of 8d6 Fire")
  await keys(entry.dialog, '1', '2', '3', '4', '5', '6', '1', '2')
  check(await totalOf(entry.dialog) === 'Total 24', `eight keys fill them: ${await totalOf(entry.dialog)}`)
  made = await done(alice, entry)
  const roll = MIDI ? W.midi.made.at(-1)?.damageRolls?.[0] : madeAllFor(made.request.id).at(-1)?.rolls[0]
  check(made.body?.typed === true && made.request.payload.typed === true && same(made.request.payload.dice, [{ faces: 6, results: [1, 2, 3, 4, 5, 6, 1, 2] }]) && same(roll?.dice[0].results.map(r => r.result), [1, 2, 3, 4, 5, 6, 1, 2]),
    "Done posts them typed, and the card's dice are those eight")
  await alice.character()
}
// The same at 768, from the tablet's Combat tab: Fireball at the goblin alone, its damage tapped in
// its toast there.
watchPosts(tablet)
await tablet.tab('Spells')
await panel(tablet).getByRole('button', { name: /^Fireball, DEX saving throw/ }).click()
{
  const picker = tablet.page.getByRole('dialog', { name: 'Fireball' })
  await picker.waitFor()
  await picker.getByRole('checkbox', { name: /^Goblin/ }).check()
  await paced()
  const before = requests()
  await picker.getByRole('button', { name: /^Cast at 1 target/ }).click()
  await until(() => requests() > before && settledRow(rollRow()), 'Fireball to be cast from the tablet', 30_000)
  const offered = toasts(tablet).filter({ hasText: 'Fireball' }).first().getByRole('button', { name: /^Roll damage/ })
  await offered.waitFor({ timeout: 30_000 })
  await combatTab(tablet)
  entry = await asked(tablet, () => offered.click(), "Fireball's damage at 768", { clear: false })
  const look = await meets(entry.dialog)
  const focused = await firstFocused(entry.dialog, 'd6 1 of 8')
  check(look.paneHidden && !look.inPane && look.box && look.done && focused === 'd6 1 of 8',
    `at 768, from the Combat tab, the same: the dialog over the page, its first box and Done what a tap meets, the first box focused (${JSON.stringify(look)}, ${focused})`)
  await keys(entry.dialog, '6', '5', '4', '3', '2', '1', '6', '5')
  made = await done(tablet, entry)
  check(made.body?.typed === true && made.request.payload.typed === true && same(made.request.payload.dice, [{ faces: 6, results: [6, 5, 4, 3, 2, 1, 6, 5] }]),
    `and Done posts the eight typed (${JSON.stringify(made.body?.dice)})`)
  await tablet.character()
}
await resultsAs(alice, 'Banner')

// ---- 9. Hit dice ----
part('9. hit dice')
await alice.tab('Character')
entry = await asked(alice, () => sheet(alice).getByRole('button', { name: /^Use a d10 hit die/ }).click(), 'a hit die')
check(same(await groupsOf(entry.dialog), [{ name: '1d10', boxes: ['d10'] }]), `a d10 hit die asks for its 1d10, one box (${JSON.stringify(await groupsOf(entry.dialog))})`)
await keys(entry.dialog, '0')
made = await done(alice, entry)
check(made.request.payload.kind === 'hitDie' && same(made.request.payload.dice, [{ faces: 10, results: [10] }]) && made.message?.rolls[0].dice[0].results[0].result === 10,
  `typed 0, it arrives as 10, and the game spends it so (${made.message?.rolls[0].formula} = ${made.message?.rolls[0].total})`)
thorin.system.attributes.hp.value = 10
await Hooks.callAll('updateActor', thorin, { system: { attributes: { hp: { value: 10 } } } })
await clearToasts(alice)
await sheet(alice).getByRole('button', { name: /^Use a d8 hit die/ }).click({ button: 'right' })
const hitDicePopover = alice.page.getByRole('dialog', { name: 'Use hit dice' })
await hitDicePopover.waitFor()
await hitDicePopover.getByRole('button', { name: 'One d10 more' }).click()
await hitDicePopover.getByRole('button', { name: 'One d10 more' }).click()
entry = await asked(alice, () => hitDicePopover.getByRole('button', { name: /^Use 3 hit dice/ }).click(), 'three hit dice')
check(same((await groupsOf(entry.dialog)).map(g => [g.name, g.boxes.length]), [['2d10', 2], ['+1d8', 1]]), `two d10s and the d8 at once: groups "2d10" and "+1d8" (${JSON.stringify(await groupsOf(entry.dialog))})`)
await keys(entry.dialog, '6', '3', '5')
const healTotal = await totalOf(entry.dialog)
made = await done(alice, entry)
check(made.request.payload.kind === 'hitDice' && same(made.request.payload.dice, [{ faces: 10, results: [6, 3] }, { faces: 8, results: [5] }]),
  `sent as typed (${JSON.stringify(made.request.payload.dice)}); the dialog said "${healTotal}"`)
if (DND5E6) {
  note('DND5E6=1: the check, Elven Accuracy, damage, Modify damage, a use\'s damage and hit dice made under dnd5e 6.0.5\'s dice')
  await finish()
}

// ---- 10. A formula, and descriptions ----
part('10. formulas and descriptions')
await alice.tab('Spells')
entry = await asked(alice, () => panel(alice).getByRole('button', { name: 'Roll Light: Glow, 1d4' }).click(), "Light's formula")
check(same((await groupsOf(entry.dialog)).map(g => [g.name, g.boxes.length]), [['1d4', 1]]), "Light's glow asks for its 1d4")
await keys(entry.dialog, '2')
made = await done(alice, entry)
check(made.request.payload.typed === true && same(made.request.payload.dice, [{ faces: 4, results: [2] }]), 'sent typed')
await alice.tab('Inventory')
const journalRow = panel(alice).locator('li', { has: alice.page.locator('summary', { hasText: 'Burning Journal' }) })
await journalRow.locator('summary').first().click()
const journal = journalRow.locator('.sheet-text')
await journal.getByRole('button').first().waitFor({ timeout: 15_000 })
entry = await asked(alice, () => journal.getByRole('button', { name: '1d100, roll it' }).click(), 'the 1d100')
check(same(await groupsOf(entry.dialog), [{ name: '1d100', boxes: ['d100'] }]), 'the inline 1d100 asks for one d100 box')
await keys(entry.dialog, '00')
check(await totalOf(entry.dialog) === 'Total 100', `00 typed: ${await totalOf(entry.dialog)}`)
made = await done(alice, entry)
check(same(made.request.payload.dice, [{ faces: 100, results: [100] }]), 'and it arrives as 100')
await clearToasts(alice)
await journal.getByRole('button', { name: '2d6 Fire, roll damage' }).click({ button: 'right' })
entry = await asked(alice, () => alice.page.getByRole('menu').getByRole('menuitem', { name: 'Roll critical damage' }).click(), "the journal's critical damage")
// A description's damage is named by its link's type as written, as the tray and Modify damage name it.
check(same(await groupsOf(entry.dialog), [{ name: '4d6 fire', boxes: Array.from({ length: 4 }, (_, i) => `d6 ${i + 1} of 4`) }]), `the description's damage as a critical hit's, by the world's rule: 4d6, four boxes (${JSON.stringify(await groupsOf(entry.dialog))})`)
await keys(entry.dialog, '6', '5', '4', '3')
made = await done(alice, entry)
check(made.request.payload.critical === true && made.message?.rolls[0].formula === '4d6' && made.message.rolls[0].total === 18, `the game makes it 4d6, 18 (${made.message?.rolls[0].formula})`)
await clearToasts(alice)
await journal.getByRole('button', { name: 'DC 13 Dexterity', exact: true }).click()
entry = await asked(alice, () => alice.page.getByRole('menu').getByRole('menuitem', { name: /^Roll my Dexterity save/ }).click(), 'the save link')
await keys(entry.dialog, '1', '1')
made = await done(alice, entry)
check(made.request.payload.kind === 'save' && same(made.request.payload.dice, [{ faces: 20, results: [11] }]), `its save link asks for the d20 too (${made.request.payload.kind})`)

// ---- 11. A death save, and initiative ----
part('11. death and initiative')
await alice.tab('Character')
entry = await asked(alice, () => sheet(alice).getByRole('button', { name: /^Initiative, \+3, to roll/ }).click(), 'initiative')
check(same(await groupsOf(entry.dialog), [{ name: 'd20', boxes: ['d20'] }]), 'initiative asks for one d20')
await keys(entry.dialog, '1', '2')
made = await done(alice, entry)
check(made.request.payload.kind === 'initiative' && thorinTurn.initiative === 15, `the game gives Thorin initiative ${thorinTurn.initiative}, the typed 12 and his +3`)
await Hooks.callAll('updateCombatant', thorinTurn, { initiative: thorinTurn.initiative })
thorin.system.attributes.hp.value = 0
await Hooks.callAll('updateActor', thorin, { system: { attributes: { hp: { value: 0 } } } })
await sheet(alice).getByRole('button', { name: 'Death saving throw' }).waitFor({ timeout: 15_000 })
entry = await asked(alice, () => sheet(alice).getByRole('button', { name: 'Death saving throw' }).click(), 'a death save')
check(same(await groupsOf(entry.dialog), [{ name: 'd20', boxes: ['d20'] }]), 'a death save asks for one d20')
await keys(entry.dialog, '1', '3')
made = await done(alice, entry)
check(made.request.payload.kind === 'death' && same(made.request.payload.dice, [{ faces: 20, results: [13] }]), 'and sends it typed')
thorin.system.attributes.hp.value = 20
thorin.system.attributes.death.success = 0
await Hooks.callAll('updateActor', thorin, { system: { attributes: { hp: { value: 20 } } } })

// ---- 12. A save the game asks for: dnd5e's (Midi-QOL's own are step 19's) ----
if (!MIDI) {
part('12. a prompt')
const asks = alice.page.getByRole('region', { name: 'Your Gamemaster asks' })
const shaman = { id: 'hex', name: 'Hex', img: 'hex.webp', uuid: 'Actor.goblin.Item.hex' }
const askedCard = await W.cards.saveCard({ by: goblin, item: shaman, dc: 13, targets: [thorin] })
await asks.waitFor({ timeout: 15_000 })
entry = await asked(alice, () => asks.getByRole('button', { name: /^Roll Dexterity saving throw/ }).click(), 'the asked save')
{
  const timer = await entry.dialog.getByRole('timer').textContent()
  check(/^9:5\d left to answer$/.test(timer.trim()) && await entry.dialog.locator('[aria-live]').filter({ has: entry.dialog.getByRole('timer') }).count() === 0,
    `the dialog shows the time left to answer, a timer, never read out: "${timer.trim()}"`)
  await keys(entry.dialog, '1', '6')
  made = await done(alice, entry)
  check(made.request.payload.prompt === `${askedCard.id}-thorin` && made.request.payload.typed === true && made.message?.flags.dnd5e.originatingMessage === askedCard.id,
    'Done answers it, on the card that asked')
  await until(async () => (await asks.count()) === 0, 'the banner to go once answered', 15_000)
  // ---- 12b. Module 0.42.0: dnd5e's concentration card asks the die only a concentration check adds ----
  const steady = await putOn(STEADY)
  const hex = thorin.concentrateOn('Hex')
  await sheetWith([alice], ['Steady Mind'])
  await alice.tab('Character')
  const concCard = await W.cards.concentrationCardOf(thorin, { dc: 10 })
  await asks.waitFor({ timeout: 15_000 })
  entry = await asked(alice, () => asks.getByRole('button', { name: /^Roll Concentration check/ }).click(), 'the concentration check')
  check(same(await groupsOf(entry.dialog), [{ name: 'd20', boxes: ['d20'] }, { name: 'Steady Mind: +1d4', boxes: ['d4'] }]),
    `dnd5e's concentration card asks its d20 and "Steady Mind: +1d4", a die only a concentration check adds (${JSON.stringify(await groupsOf(entry.dialog))})`)
  await keys(entry.dialog, '1', '5', '3')
  {
    const total = await totalOf(entry.dialog)
    made = await done(alice, entry)
    const roll = made.message?.rolls[0]
    check(made.request.payload.prompt === `${concCard.id}-thorin` && sameJson(made.request.payload.effectDice, [{ faces: 4, sign: 1, results: [3] }]) && same(d4sOf(roll), [[3]])
      && total === `Total ${roll?.total}`,
      `typed 15 and 3: it answers the card, and the game's concentration check takes the 3 ("${total}"; ${roll?.formula} = ${roll?.total})`)
  }
  await until(async () => (await asks.count()) === 0, 'the banner to go once answered', 15_000)
  thorin.effects.splice(thorin.effects.indexOf(hex), 1)
  await takeOff(steady)
  await sheetWith([alice], [])
}
}
const banner = alice.page.getByRole('region', { name: 'Your Gamemaster asks' })

// ---- 13. Validation ----
part('13. validation')
await alice.tab('Actions')
// A hit, whose damage stays due, for Escape below.
entry = await asked(alice, async () => {
  await rapier.click()
  await rapierPicker.waitFor()
  await rapierPicker.getByRole('button', { name: /^Goblin/ }).click()
}, 'a hit for its damage')
await keys(entry.dialog, '1', '5')
await done(alice, entry)
await rollDamage('Roll damage').waitFor({ timeout: 30_000 })
// Starfall's 20d6: a d6 box typed 7.
{
  const before = requests()
  entry = await asked(alice, () => panel(alice).getByRole('button', { name: /^Starfall damage/ }).first().click(), "Starfall's damage")
  await keys(entry.dialog, '7')
  const alert = entry.dialog.getByRole('alert').first()
  check(await alert.textContent() === 'A d6 shows 1 to 6.' && await entry.dialog.getByRole('textbox', { name: 'd6 1 of 20' }).getAttribute('aria-invalid') === 'true',
    '7 in a d6 box says at once "A d6 shows 1 to 6.", the box marked invalid')
  await keys(entry.dialog, 'delete', '4')
  await entry.dialog.getByRole('button', { name: 'Done', exact: true }).click()
  await wait(500)
  check(await entry.dialog.getByText('Type in every die first.').isVisible() && await entry.dialog.isVisible() && requests() === before,
    'Done with boxes empty says "Type in every die first." and posts nothing')
  await shoot(alice, 'typed-validation', entry.dialog)
  await entry.dialog.getByRole('button', { name: 'Cancel' }).click()
  await entry.dialog.waitFor({ state: 'hidden' })
}

// ---- 14. Cancel ----
part('14. cancel')
{
  const before = { requests: requests(), toasts: await toasts(alice).count() }
  entry = await asked(alice, () => rollDamage('Roll damage').first().click(), "the rapier's damage")
  await alice.page.keyboard.press('Escape')
  await entry.dialog.waitFor({ state: 'hidden' })
  await wait(1000)
  check(requests() === before.requests && await toasts(alice).count() <= before.toasts && await rollDamage('Roll damage').count() >= 1,
    "Escape on the rapier's damage posts nothing and toasts nothing, and its damage is still offered")
}

// ---- 15. Send to the table off ----
part('15. send off')
{
  const { dialog } = await cog(alice)
  await dialog.locator('label').filter({ hasText: 'Send to the table' }).tap()
  await closeCog(alice)
  await alice.tab('Character')
  const before = requests()
  entry = await asked(alice, () => perception(alice).click(), 'a local Perception check')
  await keys(entry.dialog, '8')
  await entry.dialog.getByRole('button', { name: 'Done', exact: true }).click()
  await entry.dialog.waitFor({ state: 'hidden' })
  await wait(1500)
  const said = await tray(alice).textContent()
  check(requests() === before && said.includes('Perception check') && /Only you see th(is roll|ese rolls)/.test(said),
    `with Send to the table off the dialog still opens, nothing is posted, and the tray marks it Alice's alone: "${said}"`)
  // Round 0.42.1 §7.4: the rapier with advantage kept to Alice: Elven Accuracy's line, but no Skip,
  // as no game rolls its third.
  await alice.tab('Actions')
  entry = await asked(alice, async () => {
    await fromMenu(alice, rapier, 'Roll with advantage')
    // Its targets asked, where an attack kept to the player still asks them: the picker, which the
    // dice dialog, named by the roll too, isn't.
    await Promise.race([rapierPicker.waitFor({ timeout: 15_000 }), entryOf(alice).waitFor({ timeout: 15_000 })])
    if (!(await entryOf(alice).isVisible())) await rapierPicker.getByRole('button', { name: /^Goblin/ }).click()
  }, 'the rapier with advantage, kept here')
  {
    const look = { groups: await groupsOf(entry.dialog), skips: await skips(entry.dialog) }
    check(same(look.groups, ELVEN_GROUPS) && look.skips.length === 0,
      `with Send to the table off, the rapier with advantage asks Elven Accuracy's third on its own line, but offers no Skip (${JSON.stringify(look)})`)
  }
  await entry.dialog.getByRole('button', { name: 'Cancel' }).click()
  await entry.dialog.waitFor({ state: 'hidden' })
  await wait(500)
  check(requests() === before, 'cancelled, nothing posted')
  // ---- 17. With 40 boxes: Starfall's critical, doubled here ----
  part('17a. many dice')
  await alice.tab('Actions')
  await clearToasts(alice)
  await panel(alice).getByRole('button', { name: /^Starfall damage/ }).first().click({ button: 'right' })
  entry = await asked(alice, () => alice.page.getByRole('menu').getByRole('menuitem', { name: 'Roll critical damage' }).click(), "Starfall's critical, here")
  const boxes = (await groupsOf(entry.dialog)).flatMap(g => g.boxes)
  const look = await entry.dialog.evaluate(el => {
    const inView = node => { const b = node.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && b.width > 0 }
    const scroller = el.querySelector('form').parentElement
    return { keypad: inView(el.querySelector('[aria-label="Keypad"]')), done: inView([...el.querySelectorAll('button')].find(b => b.textContent === 'Done')), scrolls: scroller.scrollHeight > scroller.clientHeight }
  })
  check(boxes.length === 40 && look.keypad && look.done && look.scrolls, `a local 20d6 critical, doubled: 40 boxes, the groups scroll, and the keypad and Done stay in view (${JSON.stringify(look)})`)
  await shoot(alice, 'typed-many-dice')
  const scrolled = await scrolledLook(entry.dialog)
  check(stuckWell(scrolled) && !scrolled.short,
    `scrolled half way and to the end, the keypad and Done stay inside the scroller, their block flush with its bottom, no dice showing below it (${JSON.stringify(scrolled)})`)
  await entry.dialog.getByRole('button', { name: 'Cancel' }).click()
  await entry.dialog.waitFor({ state: 'hidden' })
  const { dialog: again } = await cog(alice)
  await again.locator('label').filter({ hasText: 'Send to the table' }).tap()
  await closeCog(alice)
}

// ---- 17. The dialog at every size, both themes ----
part('17. layout')
for (const [width, height] of [[360, 640], [390, 844], [768, 1024], [1280, 800], [844, 390]]) {
  const who = await browse({ width, height, path: '/characters/sheet-thorin' })
  await who.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  for (const scheme of ['light', 'dark']) {
    await theme(who, scheme)
    if (width < 1024) await who.character().catch(() => {})
    await who.tab('Character').catch(() => {})
    await perception(who).click({ button: 'right' })
    await who.page.getByRole('menu').getByRole('menuitem', { name: 'Roll with advantage' }).click()
    const dialog = entryOf(who)
    await dialog.waitFor()
    await wait(300)
    const look = await dialog.evaluate(el => {
      const inView = node => { const b = node?.getBoundingClientRect(); return !!b && b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth && b.width > 0 }
      const done = [...el.querySelectorAll('button')].find(b => b.textContent === 'Done')
      const box = done.getBoundingClientRect()
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      const keys = [...el.querySelector('[aria-label="Keypad"]').querySelectorAll('button')]
      const firstRow = keys.filter(k => Math.abs(k.getBoundingClientRect().top - keys[0].getBoundingClientRect().top) < 2).length
      const input = el.querySelector('input')
      const groups = el.querySelector('[role=group][aria-labelledby]').getBoundingClientRect()
      const pad = el.querySelector('[aria-label="Keypad"]').getBoundingClientRect()
      return { onTop: !!hit && el.contains(hit), keypad: inView(el.querySelector('[aria-label="Keypad"]')), done: inView(done), box: inView(input), firstRow, sideBySide: pad.left >= groups.right - 1 }
    })
    const wide = await sideways(who.page)
    const short = height <= 480
    check(wide === 0 && look.onTop && look.keypad && look.done && look.box && look.firstRow === (short ? 5 : 3) && look.sideBySide === short,
      `at ${width}×${height}, ${scheme}: nothing scrolls sideways, the dialog is on top, its keypad, Done and box in view${short ? ', two columns, five keys a row' : ', three keys a row'} (${JSON.stringify(look)})`)
    if (width === 390 || width === 768) await shoot(who, 'typed-dialog')
    if (short) await shoot(who, 'typed-sideways')
    // ---- 17c. Module 0.33.0's feedback: the keypad on the last box, without Next die ----
    if (width === 1280 && scheme === 'light') {
      // From the keyboard: Tab from 00 to Next die, then Enter. Tabbing through the boxes would make
      // the last current, which has none.
      await keypad(dialog).getByRole('button', { name: '00', exact: true }).focus()
      await who.page.keyboard.press('Tab')
      const onNext = await dialog.evaluate(() => document.activeElement?.dataset?.key ?? null)
      await who.page.keyboard.press('Enter')
      await wait(200)
      const focusedNow = await dialog.evaluate(() => (document.activeElement === document.body ? 'body' : document.activeElement?.getAttribute('aria-label')))
      check(onNext === 'next' && focusedNow === 'd20 2 of 2' && await currentBox(dialog) === 'd20 2 of 2' && await nextDie(dialog).count() === 0,
        `at 1280, Tab to "Next die" and Enter: the box "d20 2 of 2" has focus and is current, "Next die" gone, focus not on the page (${JSON.stringify([onNext, focusedNow])})`)
    }
    if ((width === 390 && height === 844) || short) {
      const before = await keypadLook(dialog)
      await keys(dialog, '4')
      await until(async () => !(await keypadLook(dialog)).next, 'Next die to go', 5_000).catch(() => {})
      await wait(300)
      const after = await keypadLook(dialog)
      if (!short) {
        note(`at 390×844, ${scheme}, two dice: as the last box comes, the 5 key moves ${moved(before, after).five} px and Done ${moved(before, after).done} px (keypad ${before.pad.h} → ${after.pad.h} px, gap ${before.gap} → ${after.gap} px)`)
        check(lostARow(before, after) && !after.scrolls,
          `at 390×844, ${scheme}, on the last of two boxes: no "Next die", the keypad 50 ± 1 px shorter, every key the same size, the same gap above the buttons, Done still the row's last (${JSON.stringify({ before: before.pad.h, after: after.pad.h, gap: [before.gap, after.gap], keys: after.keys.length, done: after.doneLast })})`)
        await shoot(who, 'typed-keypad-last', dialog, SHOTS_033)
      } else {
        const one = after.keys.find(k => k.key === '1')
        const del = after.keys.find(k => k.key === 'delete')
        const want = 4 * one.w + 3 * after.columnGap
        check(before.next && !after.next && after.keys.length === 12 && near(after.pad.h, before.pad.h) && near(del.w, want, 2) && near(del.x, before.keys.find(k => k.key === 'delete').x)
          && sameBox(after.done, before.done) && sameBox(after.five, before.five),
          `at 844×390, ${scheme}, on the last box: no "Next die", the compact keypad the same height, Delete four keys and three gaps wide from where it was, Done and the 5 key where they were (${JSON.stringify({ pad: [before.pad.h, after.pad.h], delete: [del.w, want], done: [before.done.y, after.done.y], five: [before.five.y, after.five.y] })})`)
        await shoot(who, 'typed-keypad-last-short', dialog, SHOTS_033)
      }
    }
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await dialog.waitFor({ state: 'hidden' })
    // ---- 17d. 40 dice at 390×844, scrolling: the keypad a row shorter on the last box all the same ----
    if (width === 390 && height === 844 && scheme === 'light') {
      await who.tab('Actions')
      await panel(who).getByRole('button', { name: /^Starfall damage/ }).first().click({ button: 'right' })
      await who.page.getByRole('menu').getByRole('menuitem', { name: 'Roll critical damage' }).click()
      const many = entryOf(who)
      await many.waitFor()
      await wait(300)
      const before = await keypadLook(many)
      const count = await many.locator('input').count()
      // The last box made current: a tap there, as a finger would.
      await many.locator('input').last().evaluate(input => input.focus())
      await until(async () => !(await keypadLook(many)).next, 'Next die to go', 5_000).catch(() => {})
      await wait(300)
      const after = await keypadLook(many)
      note(`at 390×844, ${count} dice scrolling: as the last box comes, the 5 key moves ${moved(before, after).five} px and Done ${moved(before, after).done} px (keypad ${before.pad.h} → ${after.pad.h} px)`)
      check(count === 40 && before.scrolls && lostARow(before, after),
        `at 390×844, with ${count} dice that scroll, on the last box: no "Next die", the keypad 50 ± 1 px shorter, every key the same size, the same gap above the buttons, Done still the row's last (${JSON.stringify({ before: before.pad.h, after: after.pad.h, gap: [before.gap, after.gap], scrolls: before.scrolls })})`)
      await many.getByRole('button', { name: 'Cancel' }).click()
      await many.waitFor({ state: 'hidden' })
      await who.tab('Character')
    }
    // ---- 17b. 40 boxes sideways: Starfall's critical, its dice beside the keypad, scrolled ----
    if (short && scheme === 'light') {
      await who.tab('Actions')
      await panel(who).getByRole('button', { name: /^Starfall damage/ }).first().click({ button: 'right' })
      await who.page.getByRole('menu').getByRole('menuitem', { name: 'Roll critical damage' }).click()
      const many = entryOf(who)
      await many.waitFor()
      await wait(300)
      const count = (await groupsOf(many)).flatMap(g => g.boxes).length
      const scrolled = await scrolledLook(many)
      check(count === 40 && scrolled.short && stuckWell(scrolled),
        `at ${width}×${height}, Starfall's critical asks for 40 boxes; scrolled half way and to the end, the keypad and Done stay inside the scroller, their block flush with its top beside the dice (${JSON.stringify(scrolled)})`)
      await shoot(who, 'typed-many-dice')
      await many.getByRole('button', { name: 'Cancel' }).click()
      await many.waitFor({ state: 'hidden' })
      await who.tab('Character')
    }
  }
  await who.view.close()
}

// ---- 18. The Gamemaster's page throws its dice ----
part('18. the Gamemaster')
{
  const before = requests()
  await gmPage.tab('Character').catch(() => {})
  await paced()
  await perception(gmPage).click()
  const thrown = await diceShown(gmPage)
  await until(() => requests() > before, "the Gamemaster's roll to be sent")
  const row = rollRow()
  await wait(500)
  check(thrown && await entryOf(gmPage).count() === 0 && !('typed' in row.payload), "a roll on the Gamemaster's page opens no dialog: its dice are thrown, and it's sent untyped")
  await until(() => settledRow(rollRow(row.id)), "the Gamemaster's roll to be made")
}

// ---- 16. Make Manual Rolls taken away, live ----
part('16. permission removed')
{
  const { manual } = await cog(alice)
  await setPermissions([3, 4])
  await until(async () => (await manual.count()) === 0, 'the switch to go', 15_000)
  check(stored() === 't' && same(roster().find(([id]) => id === 'thorin'), ['thorin', false]), 'Make Manual Rolls taken from Trusted players: the open cog loses the switch within a poll, the stored choice kept')
  await closeCog(alice)
  const before = { requests: requests(), posts: sentBy.get(alice).length }
  await alice.tab('Character')
  await paced()
  await perception(alice).click()
  const thrown = await diceShown(alice)
  await until(() => requests() > before.requests, 'the untyped check to be sent')
  const row = rollRow()
  check(thrown && await entryOf(alice).count() === 0 && !('typed' in row.payload) && !('typed' in (sentBy.get(alice)[before.posts] ?? {})),
    'the next roll opens no dialog: its dice are thrown here, and it is posted without typed')
  await until(() => settledRow(rollRow(row.id)), 'it to be made')
  await setPermissions([2, 3, 4])
  const { manual: back } = await cog(alice)
  await back.waitFor({ timeout: 15_000 })
  check(await back.isChecked(), 'given back, the switch comes back on')
  await closeCog(alice)
}

if (MIDI) {
  // ---- 19. Midi-QOL's prompts ----
  part('19. Midi-QOL')
  await game.settings.set('sending-stone', 'midiPromptWait', 5_000)
  const opened = () => postsOf('roll.prompt.opened').map(p => p.data.prompt)
  let spells = 0
  const monsterSpell = async () => {
    const slug = `hold${++spells}`
    const item = { id: slug, name: 'Hold Person', type: 'spell', uuid: `Actor.goblin.Item.${slug}`, flags: {}, system: { description: { value: '' } } }
    const workflow = await midiSaves.saveWorkflow({ actor: goblin, item, activity: midiSaves.saveActivity({ item, abilities: ['wis'], dc: 14 }), targets: [tokenOf.thorin.object ?? W.placeables.get('tok-thorin')], token: W.placeables.get('tok-goblin') })
    return { workflow, running: midiSaves.runSaves(workflow) }
  }
  let count = opened().length
  let running = (await monsterSpell()).running
  await until(() => opened().length > count, "Midi's prompt", 15_000)
  const row = banner.getByRole('listitem').filter({ hasText: 'Hold Person' })
  await row.waitFor({ timeout: 15_000 })
  const before = requests()
  entry = await asked(alice, () => row.getByRole('button', { name: /^Roll Wisdom saving throw/ }).click(), "Midi's save")
  const timer = (await entry.dialog.getByRole('timer').textContent()).trim()
  check(/^0:0[0-5] left to answer$/.test(timer), `Midi's prompt, its wait shortened to 5 s, shows "${timer}"`)
  await entry.dialog.waitFor({ state: 'hidden', timeout: 10_000 })
  await row.getByText('Midi rolled it').waitFor({ timeout: 15_000 })
  check(requests() === before, 'left alone, the dialog closes by itself, nothing is posted, and the banner says Midi rolled it')
  await running
  // Asked in Foundry too, and rolled there while the dialog is open.
  await game.settings.set('sending-stone', 'midiPromptWait', 60_000)
  game.users.get('alice').active = true
  W.midi.settings.playerRollSaves = 'chat'
  count = opened().length
  const second = await monsterSpell()
  await until(() => opened().length > count, "Midi's second prompt", 15_000)
  const row2 = banner.getByRole('listitem').filter({ hasText: 'Hold Person' })
  await row2.getByRole('timer').waitFor({ timeout: 15_000 })
  entry = await asked(alice, () => row2.getByRole('button', { name: /^Roll Wisdom saving throw/ }).click(), "Midi's second save")
  await until(() => typeof second.workflow.saveRequests?.['tok-thorin'] === 'function', "Midi's chat request")
  await thorin.rollSavingThrow({ ability: 'wis' }, { configure: false }, {})
  await second.running
  await entry.dialog.waitFor({ state: 'hidden', timeout: 15_000 })
  check(requests() === before, 'rolled in Foundry while the dialog is open: the dialog closes, nothing posted')
  game.users.get('alice').active = false
  W.midi.settings.playerRollSaves = 'none'
  // ---- 19b. Module 0.42.0: Midi's save asks Bless's die; its concentration check, made with
  // dnd5e's, asks the die only a concentration check adds too ----
  await game.settings.set('sending-stone', 'midiPromptWait', 60_000)
  const blessedAgain = await putOn(BLESSED)
  const steady = await putOn(STEADY)
  await sheetWith([alice], ['Blessed', 'Steady Mind'])
  await alice.tab('Character')
  count = opened().length
  const third = await monsterSpell()
  await until(() => opened().length > count, "Midi's third prompt", 15_000)
  const row3 = banner.getByRole('listitem').filter({ hasText: 'Hold Person' })
  await row3.getByRole('button', { name: /^Roll Wisdom saving throw/ }).waitFor({ timeout: 15_000 })
  entry = await asked(alice, () => row3.getByRole('button', { name: /^Roll Wisdom saving throw/ }).click(), "Midi's save, Blessed")
  check(same(await groupsOf(entry.dialog), [{ name: 'd20', boxes: ['d20'] }, { name: 'Bless: +1d4', boxes: ['d4'] }]),
    `Midi's save asks its d20 and "Bless: +1d4" (${JSON.stringify(await groupsOf(entry.dialog))})`)
  await keys(entry.dialog, '1', '2', '3')
  {
    const total = await totalOf(entry.dialog)
    made = await done(alice, entry)
    await third.running
    // The save Midi's workflow took for Thorin, which shows no card of its own here.
    const roll = third.workflow.saveResults?.[0]
    check(sameJson(made.request.payload.effectDice, [{ faces: 4, sign: 1, results: [3] }]) && same(d4sOf(roll), [[3]]) && total === `Total ${roll?.total}`,
      `typed 12 and 3: the save Midi's workflow takes has Bless's 3 ("${total}"; ${roll?.formula} = ${roll?.total})`)
  }
  const concentrationMode = W.midi.settings.doConcentrationCheck
  W.midi.settings.doConcentrationCheck = 'item'
  const hex = thorin.concentrateOn('Hex')
  count = opened().length
  const concentration = midiSaves.itemConcentrationCheck(thorin, tokenOf.thorin.object ?? W.placeables.get('tok-thorin'), 10)
  await until(() => opened().length > count, "Midi's concentration check", 15_000)
  const concRow = banner.getByRole('listitem').filter({ hasText: 'Hex' })
  await concRow.getByRole('button', { name: /^Roll Concentration check/ }).waitFor({ timeout: 15_000 })
  entry = await asked(alice, () => concRow.getByRole('button', { name: /^Roll Concentration check/ }).click(), "Midi's concentration check")
  // Changed on purpose (round 0.42.0's review fixes, §2.1 and §8.5 amended): Midi's save for a
  // concentration check is made as dnd5e's concentration check (its roll wrapper's redirect,
  // fvtt/midi-saves.mjs), which adds concentration's own bonus, so Steady Mind's d4 is asked too.
  check(same(await groupsOf(entry.dialog), [{ name: 'd20', boxes: ['d20'] }, { name: 'Bless: +1d4', boxes: ['d4'] }, { name: 'Steady Mind: +1d4', boxes: ['d4'] }]),
    `Midi's concentration check, made with dnd5e's, asks its d20, "Bless: +1d4" and "Steady Mind: +1d4", a die only a concentration check adds (${JSON.stringify(await groupsOf(entry.dialog))})`)
  await keys(entry.dialog, '1', '5', '3', '2')
  {
    const total = await totalOf(entry.dialog)
    made = await done(alice, entry)
    const roll = (await concentration).saveResults?.[0]
    check(sameJson(made.request.payload.effectDice, [{ faces: 4, sign: 1, results: [3] }, { faces: 4, sign: 1, results: [2] }])
      && same(d4sOf(roll).flat().sort(), [2, 3]) && total === `Total ${roll?.total}`,
      `typed 15, 3 and 2: the check Midi's workflow takes has Bless's 3 and Steady Mind's 2, and its total is the dialog's ("${total}"; ${roll?.formula} = ${roll?.total})`)
  }
  W.midi.settings.doConcentrationCheck = concentrationMode
  thorin.effects.splice(thorin.effects.indexOf(hex), 1)
  await takeOff(steady)
  await takeOff(blessedAgain)
  await sheetWith([alice], [])
}

check(midiCritical === null || midiCritical.gm === 'doubleDice', "Midi-QOL's rule for the Gamemaster stayed Double Rolled Damage throughout")
await finish()
