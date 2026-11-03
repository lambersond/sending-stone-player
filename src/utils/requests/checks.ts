import { slotPools, outOfSlots } from '@/utils/action-groups'
import { alonePlan, alonePicks } from '@/utils/alone-choices'
import { castIndex, castOf, castAtLevel } from '@/utils/casts'
import { formulaDice } from '@/utils/formulas'
import {
  checkTypeOf,
  checkLinked,
  checkEnchant,
  checkAloneChoices,
  throws,
} from '@/utils/requests/check-linked'
import { isDying, sameCounter } from '@/utils/requests/status'
import {
  isSeatCombatant,
  sheetUses,
  checkDamageDice,
} from '@/utils/roll-requests'
import { sheetActions } from '@/utils/sheet-actions'
import { allItems } from '@/utils/sheet-texts'
import { mostTargets } from '@/utils/uses'
import { isShaped } from '@/utils/wild-shape'
import type { RollRequestInput, AttackTarget, RollKind } from '@/types/roll'
import type {
  CharacterSheet,
  CombatSnapshot,
  FoundLink,
  SheetAction,
  SheetEnchantment,
  CastIndex,
} from '@/types/sending-stone'
import type { RollRefusal } from '@/utils/requests/types'

/**
 * Can the character make this roll, as its sheet and the encounter stand? A skill, ability or
 * tool must be on its sheet, but for a tool check a description calls for, which dnd5e makes with
 * any tool; it must be dying to roll a death saving throw; it must be in the combat, without
 * initiative yet, to roll initiative; and it must have a hit die of the size it spends left, or of
 * hit dice spent at once, as many of each size as it spends. What a link in a description asks for
 * must be what that link is, in a description on its sheet; and a check an activity asks for, one
 * of the ways that activity may be made, as `checkActivityRoll` says.
 * @param links - For a roll from a link in a description, the links the game acts on in that
 *   description, as held here; none where it isn't held.
 * @param features - What else the campaign's game does with its players' rolls, as its hello
 *   said, such as `signedDice`; none, as a module before 0.21.0, unless said.
 * @returns Why not, or nothing when it can.
 */
export function checkRoll(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
  combats: CombatSnapshot[],
  actorId: string,
  links?: ReadonlyMap<number, FoundLink>,
  features: readonly string[] = [],
): RollRefusal | undefined {
  if (input.item !== undefined && checkTypeOf(input.kind)) {
    return checkActivityRoll(input, sheet)
  }
  const check = Object.hasOwn(CHECKS, input.kind)
    ? CHECKS[input.kind]
    : undefined
  return check?.(input, sheet, combats, actorId, links, features)
}

/**
 * Each kind's check, by its group, given what `checkRoll` is. A kind with none needs nothing of
 * the sheet or the encounter here: damage is checked against its attack or use, by `checkDamage`,
 * and the rest by their own creators.
 */
const CHECKS: Partial<
  Record<
    RollKind,
    (
      input: RollRequestInput,
      sheet: CharacterSheet | undefined,
      combats: CombatSnapshot[],
      actorId: string,
      links: ReadonlyMap<number, FoundLink> | undefined,
      features: readonly string[],
    ) => RollRefusal | undefined
  >
> = {
  // What the sheet has, or a link in a description calls for.
  skill: (input, sheet, _combats, _actorId, links, features) =>
    known(sheet?.skills.some(({ id }) => id === input.key) === true) ??
    linked(input, sheet, links, features),
  ability: checkAbility,
  save: checkAbility,
  tool: checkTool,
  // What only a link in a description asks for.
  ask: checkText,
  textDamage: checkText,
  textRoll: checkText,
  // The encounter.
  death: (_input, sheet) => (isDying(sheet) ? undefined : 'not-dying'),
  initiative: checkInitiative,
  // What the sheet's actions, favorites, spells, features or items are used through.
  attack: (input, sheet, combats) =>
    sheet ? checkAttack(input, sheet, combats) : 'unknown',
  use: (input, sheet, combats, actorId, _links, features) =>
    sheet ? checkUse(input, sheet, combats, actorId, features) : 'unknown',
  formula: (input, sheet) => (sheet ? checkFormula(input, sheet) : 'unknown'),
  itemDamage: (input, sheet, _combats, _actorId, _links, features) =>
    checkItemDamage(input, sheet, features),
  recharge: checkRecharge,
  // Hit dice.
  hitDie: checkHitDie,
  hitDice: checkHitDice,
  // What the character ends, prepares, spends or is inspired by.
  endEnchantment: checkEnding,
  endConcentration: checkConcentration,
  prepare: checkPrepare,
  spend: checkSpend,
  inspiration: checkInspiration,
  spellSlot: checkSpellSlot,
}

/** What a link in a description asks for, where the roll is from one; nothing where it isn't. */
function linked(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
  links: ReadonlyMap<number, FoundLink> | undefined,
  features: readonly string[],
): RollRefusal | undefined {
  return input.text === undefined
    ? undefined
    : checkLinked(input, sheet, links, features)
}

/** An ability check or a saving throw: the ability on the sheet, or as its link calls for it. */
function checkAbility(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
  _combats: CombatSnapshot[],
  _actorId: string,
  links: ReadonlyMap<number, FoundLink> | undefined,
  features: readonly string[],
): RollRefusal | undefined {
  return (
    known(sheet?.abilities.some(({ id }) => id === input.key) === true) ??
    linked(input, sheet, links, features)
  )
}

/** What a link in a description asks of the table, or damage or a roll of its own it throws. */
function checkText(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
  _combats: CombatSnapshot[],
  _actorId: string,
  links: ReadonlyMap<number, FoundLink> | undefined,
  features: readonly string[],
): RollRefusal | undefined {
  return checkLinked(input, sheet, links, features)
}

/** A tool check: a tool the sheet lists, or a description's, made with the tool or without it. */
function checkTool(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
  _combats: CombatSnapshot[],
  _actorId: string,
  links: ReadonlyMap<number, FoundLink> | undefined,
  features: readonly string[],
): RollRefusal | undefined {
  // A description's tool check is made as dnd5e makes one, with the tool or without it.
  if (input.text !== undefined) {
    return checkLinked(input, sheet, links, features)
  }
  // The sheet lists tools among its tools, from module 0.18.0, and its favorites.
  return known(
    (sheet?.tools ?? []).some(({ id }) => id === input.key) ||
      (sheet?.favorites ?? []).some(
        ({ type, id }) => type === 'tool' && id === input.key,
      ),
  )
}

/** Initiative: the seat's own combatant in the combat, without initiative yet. */
function checkInitiative(
  input: RollRequestInput,
  _sheet: CharacterSheet | undefined,
  combats: CombatSnapshot[],
  actorId: string,
): RollRefusal | undefined {
  const combat = combats.find(({ id }) => id === input.combatId)
  const combatant = combat?.combatants.find(each =>
    isSeatCombatant(each, actorId),
  )
  if (!combatant) return 'not-in-combat'
  return combatant.initiative === null ? undefined : 'already-rolled'
}

/** A concentration ended: one the character keeps. */
function checkConcentration(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
): RollRefusal | undefined {
  const effect = input.concentration?.effect
  const kept = (sheet?.concentration?.effects ?? []).some(
    ({ id }) => id === effect,
  )
  return kept ? undefined : 'concentration'
}

/** Heroic Inspiration: used with it, or gained without it. */
function checkInspiration(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
): RollRefusal | undefined {
  if (input.inspiration === 'use') {
    return sheet?.inspiration === true ? undefined : 'not-inspired'
  }
  return sheet?.inspiration === false ? undefined : 'inspired'
}

/**
 * Can this spell be prepared or unprepared from here, from module 0.42.1, as the sheet last showed
 * it: not while the character is transformed, whose sheet is then its form's; one the sheet lists,
 * at 0 or 1. Already so passes: the game says so.
 */
function checkPrepare(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
): RollRefusal | undefined {
  // Read as the pane reads it, not by `isShaped`, so that preparing needs nothing of the spell
  // slots' own check: either can be taken out alone.
  if (sheet?.form) return 'shaped'
  const id = input.prepare?.id
  const spell = (sheet?.spells ?? [])
    .flatMap(({ spells }) => spells)
    .find(each => each.id === id)
  if (!spell) return 'gone'
  return spell.prepared === 0 || spell.prepared === 1 ? undefined : 'prepare'
}

/**
 * Can these charges be spent directly, from module 0.29.0: are they of a counter the sheet shows,
 * as a row's, an activity's or a favorite's uses, that it says the player may spend so, with as
 * many left? The game reads the counter again as it stands, and spends it so.
 */
function checkSpend(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
): RollRefusal | undefined {
  const { counter, count = 0 } = input
  if (!sheet || !counter) return 'uses'
  const shown = sheetUses(sheet).find(
    uses => uses.spendable === true && sameCounter(uses.counter, counter),
  )
  if (!shown) return 'uses'
  return count <= shown.value ? undefined : 'short'
}

/**
 * Can one of the character's spell slots be spent or restored, from module 0.42.1, as the sheet
 * last showed them: not while the character is transformed, whose sheet is then its form's; a pool
 * of its spellbook's with slots; still at the count the page showed, so that a slot spent in
 * Foundry meanwhile is never spent again, nor a cast there undone, by a page that hadn't heard of
 * it; and one left to spend, or one used to restore. A pool above its maximum, as dnd5e's temporary
 * slots leave it, can be spent, never restored. The game reads the pool again as it stands, and
 * checks the same.
 */
function checkSpellSlot(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
): RollRefusal | undefined {
  const { spellSlot } = input
  if (isShaped(sheet)) return 'shaped'
  const slots =
    spellSlot &&
    (sheet?.spells ?? []).find(({ id }) => id === spellSlot.id)?.slots
  if (!spellSlot || !slots || !(slots.max > 0)) return 'slot'
  if (slots.value !== spellSlot.from) return 'changed'
  if (spellSlot.op === 'spend') return slots.value > 0 ? undefined : 'slots'
  return slots.value < slots.max ? undefined : 'full'
}

/**
 * Can the character make this attack: is it one of its actions, favorites, spells, features or
 * inventory items, identified, with a spell slot left for a spell, in the attack mode and with the
 * ammunition chosen, if they're the weapon's, at a combatant its player can see, or for an area
 * attack, at no more combatants than it takes, all of them ones its player can see? Whatever else
 * it spends, such as its uses, the game checks as it would spend it.
 */
function checkAttack(
  input: RollRequestInput,
  sheet: CharacterSheet,
  combats: CombatSnapshot[],
): RollRefusal | undefined {
  const action = sheetActions(sheet).find(
    ({ id, attackId }) =>
      id === input.item && !!attackId && attackId === input.activity,
  )
  if (!action || !action.identified) return 'unknown'
  // A third d20 only where dnd5e gives the attack Elven Accuracy, as its sheet says.
  if (input.dice[0]?.results.length === 3 && action.elvenAccuracy !== true) {
    return 'dice'
  }
  const casts = castIndex(sheet)
  const slot = checkSlot(input, action, sheet, casts)
  if (slot) return slot
  const { attackMode, ammunition } = input
  if (
    attackMode &&
    !action.attackModes?.some(({ value }) => value === attackMode)
  ) {
    return 'mode'
  }
  if (ammunition) {
    const fired = action.ammunition?.find(({ id }) => id === ammunition)
    if (!fired || fired.quantity <= 0) return 'ammo'
  }
  // An area attack is made at those in its area, as many as it takes at the level it's cast at.
  if (input.targets !== undefined) {
    const area = action.attackArea
    if (!area) return 'target'
    const { base, level } = levelsOf(input, action, sheet, casts)
    if (input.targets.length > mostTargets(area, base, level)) {
      return 'target'
    }
    return checkTargets(input.targets, combats)
  }
  return checkTargets(input.target ? [input.target] : [], combats)
}

/**
 * Can the character use this spell or feature: is it what one of its actions, favorites, spells,
 * features or inventory items is used through, identified, with a spell slot left for a spell, at
 * no more combatants than it takes at the level it's cast at, all of them combatants its player
 * can see? An enchant activity is used at no one, its user neither, as `checkEnchant` says. One
 * made at its user too, from module 0.22.0, is only where the game makes it so, of one with
 * targets beyond its user, whose own combatant isn't among them too, and counts as one of them.
 * Whatever else it spends, such as its uses, the game checks as it would spend it.
 * @param actorId - The character's actor, whose combatant is its user.
 * @param features - What else the campaign's game does with its players' rolls.
 */
function checkUse(
  input: RollRequestInput,
  sheet: CharacterSheet,
  combats: CombatSnapshot[],
  actorId: string,
  features: readonly string[],
): RollRefusal | undefined {
  const action = sheetActions(sheet).find(
    ({ id, activity }) => id === input.item && activity?.id === input.activity,
  )
  if (!action?.activity || !action.identified) return 'unknown'
  const casts = castIndex(sheet)
  const slot = checkSlot(input, action, sheet, casts)
  if (slot) return slot
  if (action.activity.type === 'enchant') {
    // It's used at no one, its user neither, as the game refuses.
    if (input.self) return 'target'
    return checkEnchant(input, action, sheet, casts)
  }
  // Only an enchant activity enchants.
  if (input.enchant !== undefined) return 'unknown'
  const targets = input.targets ?? []
  const { base, level } = levelsOf(input, action, sheet, casts)
  const self = input.self === true
  if (self && checkSelf(targets, action, combats, actorId, features)) {
    return 'target'
  }
  const most = mostTargets(action.activity.targets, base, level)
  if (targets.length + (self ? 1 : 0) > most) return 'target'
  return checkTargets(targets, combats)
}

/**
 * Can't a use be made at its user too, besides these targets: where the game doesn't make one so,
 * as before module 0.22.0; where it's one used on its user alone, which needs no asking; or where
 * the character's own combatant is among its targets already?
 */
function checkSelf(
  targets: AttackTarget[],
  action: SheetAction,
  combats: CombatSnapshot[],
  actorId: string,
  features: readonly string[],
): boolean {
  if (!features.includes('selfTargets') || action.activity?.targets.self) {
    return true
  }
  return targets.some(target => {
    const combatant = combats
      .find(({ id }) => id === target.combatId)
      ?.combatants.find(({ id }) => id === target.combatantId)
    return !!combatant && isSeatCombatant(combatant, actorId)
  })
}

/**
 * Can this action's damage or healing go on its own, from module 0.36.0: is it one of the sheet's
 * actions, favorites, spells, features or inventory items, by its item and its attack's or use's
 * activity, whose damage the game would roll on its own; as a critical hit's only where the game
 * makes one of it; and are its dice those the game said it throws, changed as the player chose,
 * each kind chosen one it offers? Not once only: it follows no attack or use. From module 0.41.0,
 * its choices only where the game sends them for the row and takes them (`slot`, `mode`, `ammo`,
 * `consume`): the slot always where the spell has a pool to cast it with, one of its pools, with
 * one left where it spends one (`slots`); the attack mode one of the weapon's; the ammunition one
 * of its, with some left where it's spent; spending only where its use spends anything; and its
 * dice those of the plan its choices pick.
 * @param features - What else the campaign's game does with its players' rolls, as its hello said:
 *   its choices only with `aloneChoices`.
 */
function checkItemDamage(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
  features: readonly string[],
): RollRefusal | undefined {
  if (!sheet) return 'gone'
  const action = sheetActions(sheet).find(
    ({ id, attackId, activity }) =>
      id === input.item &&
      (attackId === input.activity || activity?.id === input.activity),
  )
  if (!action) return 'gone'
  const plan = action.tableDamage
  if (!plan) return 'no-damage'
  // The sheet may still hold the choices of a game that no longer takes them, a module rolled back
  // from 0.41.0, until that game sends it again: then it's the row's own plan, as the page rolls.
  const choices =
    plan.choices === undefined || !features.includes('aloneChoices')
      ? checkUnchosen(input)
      : checkAloneChoices(input, action, sheet, plan.spends ?? [])
  if (choices) return choices
  const picked = alonePlan(plan, alonePicks(action, sheet.spells, input))
  const preview = input.critical ? picked.critical : picked.normal
  if (!preview) return 'critical'
  return checkDamageDice(input, preview)
}

/**
 * Damage on its own of a row the game sends no choices for, as before module 0.41.0, or past its
 * most, or to a game that takes none: rolled at its own level, in its first mode, with no
 * ammunition, spending nothing; so it names none.
 */
function checkUnchosen(input: RollRequestInput): RollRefusal | undefined {
  if (input.slot !== undefined) return 'slot'
  if (input.attackMode !== undefined) return 'mode'
  if (input.ammunition !== undefined) return 'ammo'
  if (input.consume !== undefined) return 'consume'
  return undefined
}

/**
 * Can these uses be recharged, from module 0.36.0: are they a counter the sheet shows, an item's
 * own or one of its activities', as named, that recharges, with some of them spent, as dnd5e rolls
 * a recharge only then? Its one d6 the request's schema checked.
 */
function checkRecharge(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
): RollRefusal | undefined {
  if (!sheet || !input.item) return 'gone'
  const counter = {
    item: input.item,
    ...(input.activity && { activity: input.activity }),
  }
  const uses = sheetUses(sheet).find(
    shown => sameCounter(shown.counter, counter) && !!shown.recharge,
  )
  if (!uses) return 'gone'
  return uses.value >= uses.max ? 'charged' : undefined
}

/**
 * Can the character end this enchantment: is it on one of its inventory items, spells, features or
 * actions' items, as the sheet lists the enchantments on them, and one the player may end?
 */
function checkEnding(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
): RollRefusal | undefined {
  const { enchantment } = input
  if (!sheet || !enchantment) return 'enchantment'
  const enchanted: { id: string; enchantments?: SheetEnchantment[] }[] = [
    ...allItems(sheet),
    ...sheet.spells.flatMap(section => section.spells),
    ...sheet.features.flatMap(section => section.features),
    ...sheet.actions.flatMap(section => section.actions),
  ]
  const endable = enchanted.some(
    ({ id, enchantments }) =>
      id === enchantment.item &&
      !!enchantments?.some(
        ({ id: effect, endable }) => effect === enchantment.effect && endable,
      ),
  )
  return endable ? undefined : 'enchantment'
}

/**
 * The level a spell is cast at, and the level more targets are counted from, cast higher: its
 * own, or for a spell an item casts, the level it's cast at by default.
 */
function levelsOf(
  input: RollRequestInput,
  action: SheetAction,
  sheet: CharacterSheet,
  casts: CastIndex,
): { base: number | null; level: number | null } {
  return {
    base: castOf(action, casts)?.level ?? action.level,
    level: castAtLevel(action, sheet.spells, input.slot, casts),
  }
}

/**
 * Can a spell be cast with the slot chosen: one of the spell's pools, with one left? With none
 * chosen, has it any slot, or use of its own, left? A slot chosen for a spell cast without slots,
 * such as an innate one, is the game's to leave out. One of its activities used without spending a
 * slot, such as Spirit Guardians' save each turn, may be used at any of its pools' levels. A spell
 * an item casts, and each of its activities, is cast at one of the levels the item offers, from
 * module 0.20.0, and never with a slot otherwise; whether the item has the charges for it is the
 * game's to check, as it spends them.
 */
function checkSlot(
  input: RollRequestInput,
  action: SheetAction,
  sheet: CharacterSheet,
  casts: CastIndex,
): RollRefusal | undefined {
  const cast = castOf(action, casts)
  if (cast && input.slot) {
    const { slot } = input
    const offered =
      /^spell[1-9]$/.test(slot) &&
      !!cast.levels?.some(({ level }) => `spell${level}` === slot)
    return offered ? undefined : 'slot'
  }
  const pools = slotPools(action, sheet.spells)
  if (!input.slot) return outOfSlots(action, pools) ? 'slots' : undefined
  if (!pools) return undefined
  const pool = pools.find(({ id }) => id === input.slot)
  // An activity used without spending a slot is used at its level, whether any is left or not.
  const spends = action.consumesSlot !== false
  return pool && (pool.value > 0 || !spends) ? undefined : 'slot'
}

/**
 * Has the character a class with hit dice of this size, with one of them left? How many are left
 * of a class whose sheet doesn't say is the game's to check.
 */
function checkHitDie(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
): RollRefusal | undefined {
  const sized = (sheet?.classes ?? []).flatMap(({ hitDice }) =>
    hitDice && hitDice.die === input.denomination ? [hitDice] : [],
  )
  if (sized.length === 0) return 'unknown'
  return sized.some(({ value }) => value === null || value > 0)
    ? undefined
    : 'no-hit-dice'
}

/**
 * Has the character, for each size of hit die spent at once, classes with hit dice of that size,
 * with as many of them left as are spent, all together? How many are left of a class whose sheet
 * doesn't say is the game's to check, for that size; and whether the character is at full hit
 * points, which the game checks as it spends them.
 */
function checkHitDice(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
): RollRefusal | undefined {
  for (const { denomination, count } of input.hitDice ?? []) {
    const sized = (sheet?.classes ?? []).flatMap(({ hitDice }) =>
      hitDice && hitDice.die === denomination ? [hitDice] : [],
    )
    if (sized.length === 0) return 'unknown'
    if (sized.some(({ value }) => value === null)) continue
    const left = sized.reduce((all, { value }) => all + (value ?? 0), 0)
    if (left < count) return 'no-hit-dice'
  }
  return undefined
}

/**
 * Is this the formula of one of the character's actions, favorites, spells, features or inventory
 * items, identified, that the game may use, and are its dice those the formula throws, in order?
 */
function checkFormula(
  input: RollRequestInput,
  sheet: CharacterSheet,
): RollRefusal | undefined {
  const action = sheetActions(sheet).find(
    ({ id, activity, rollFormula }) =>
      id === input.item && activity?.id === input.activity && !!rollFormula,
  )
  if (!action?.rollFormula || !action.identified) return 'unknown'
  const thrown = formulaDice(action.rollFormula.formula)
  if (!thrown) return 'unknown'
  return throws(input, thrown) ? undefined : 'dice'
}

/**
 * Is this a check an activity asks for that the character makes itself: the activity of one of its
 * actions, favorites, spells, features or inventory items, identified, whose check is its own to
 * make, rolled one of the ways that check may be made, by its kind and its skill's, tool's or
 * ability's key? The sheet's own skills and tools aren't looked at: dnd5e makes a tool's check with
 * the tool or without it, and the game reads the check again from the activity.
 */
function checkActivityRoll(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
): RollRefusal | undefined {
  if (!sheet) return 'unknown'
  const type = checkTypeOf(input.kind)
  const offered = sheetActions(sheet).some(
    ({ id, activity, check, identified }) =>
      id === input.item &&
      activity?.id === input.activity &&
      identified &&
      check?.own === true &&
      check.checks.some(
        option =>
          option.type === type && (option.key ?? option.ability) === input.key,
      ),
  )
  return offered ? undefined : 'unknown'
}

/** Are these combatants of a combat their player can see, as picked? */
function checkTargets(
  targets: AttackTarget[],
  combats: CombatSnapshot[],
): RollRefusal | undefined {
  for (const target of targets) {
    const combatant = combats
      .find(({ id }) => id === target.combatId)
      ?.combatants.find(({ id }) => id === target.combatantId)
    if (!combatant || combatant.hidden === true) return 'target'
  }
  return undefined
}

/** Nothing, for what the sheet has; or that it doesn't. */
function known(found: boolean): RollRefusal | undefined {
  return found ? undefined : 'unknown'
}
