import { slotPools } from '@/utils/action-groups'
import { castOf, castAtLevel } from '@/utils/casts'
import {
  changes,
  criticalOffered,
  linkDamage,
  diceTakenAway,
  unmaximizable,
  modifiedDice,
} from '@/utils/damage-modifiers'
import { formulaDice } from '@/utils/formulas'
import { sheetTextRefs } from '@/utils/sheet-texts'
import type { RollRequestInput, RollKind, ExtraDice } from '@/types/roll'
import type {
  SheetAction,
  CharacterSheet,
  CastIndex,
  FoundLink,
  CheckOption,
} from '@/types/sending-stone'
import type { RollRefusal } from '@/utils/requests/types'

/**
 * Damage on its own's choices, from module 0.41.0, as the row's: the slot named wherever the spell
 * has a pool to cast it with, so that the game rolls and spends at its level, one of its pools,
 * with one left where it spends one; none for anything else, nor for a spell with no pool at or
 * above its level, which the game rolls at its own; the attack mode one of the weapon's, which the
 * sheet lists only where it has more than one; the ammunition one of its, with some left where it
 * fires it spent; and spending only where its use would spend anything.
 * @param spends - What the row says its use would spend.
 */
export function checkAloneChoices(
  input: RollRequestInput,
  action: SheetAction,
  sheet: CharacterSheet,
  spends: string[],
): RollRefusal | undefined {
  const consume = input.consume === true
  const pools = slotPools(action, sheet.spells)
  // A spell its character has no slot of its level or higher for, such as a Fighter's Magic
  // Initiate spell, has no pool to name: none named, the game rolls it at its own level, and finds
  // none left where it's asked to spend one.
  if (pools && pools.length > 0) {
    const pool = pools.find(({ id }) => id === input.slot)
    if (!pool) return 'slot'
    if (consume && spends.includes('slot') && pool.value <= 0) return 'slots'
  } else if (input.slot !== undefined) {
    return 'slot'
  }
  const { attackMode, ammunition } = input
  if (
    attackMode !== undefined &&
    !action.attackModes?.some(({ value }) => value === attackMode)
  ) {
    return 'mode'
  }
  if (ammunition !== undefined) {
    const fired = action.ammunition?.find(({ id }) => id === ammunition)
    if (!fired) return 'ammo'
    if (consume && spends.includes('ammunition') && fired.quantity <= 0) {
      return 'ammo'
    }
  }
  if (consume && spends.length === 0) return 'consume'
  return undefined
}

/**
 * Can the character use this enchant activity so: at no one, as it enchants an item; in one of the
 * ways it offers, chosen, and for one offered only at some spell levels, such as Magic Weapon's
 * +2, at the level it's cast at, with the slot, or a spell an item casts at the level, chosen,
 * where there's a choice; and on one of the items it may enchant, or none, to leave on its card,
 * but never another for one that enchants its own item, nor in the way it's on its own item in
 * already, which only a sheet out of date offers, and which dnd5e would take as ending it, at a
 * cost? Whether the item may take it still is the game's to check, as dnd5e's rules for it say.
 */
export function checkEnchant(
  input: RollRequestInput,
  action: SheetAction,
  sheet: CharacterSheet,
  casts: CastIndex,
): RollRefusal | undefined {
  const enchant = action.activity?.enchant
  if (!enchant) return 'unknown'
  if ((input.targets ?? []).length > 0) return 'target'
  const chosen = input.enchant
  if (!chosen) return 'profile'
  const profile = enchant.profiles.find(({ id }) => id === chosen.profile)
  if (!profile) return 'profile'
  if (profile.min !== null || profile.max !== null) {
    const chooses =
      (slotPools(action, sheet.spells)?.length ?? 0) > 0 ||
      (castOf(action, casts)?.levels?.length ?? 0) > 0
    if (chooses && !input.slot) return 'profile'
    const level = castAtLevel(action, sheet.spells, input.slot, casts)
    if (
      level === null ||
      (profile.min !== null && level < profile.min) ||
      (profile.max !== null && level > profile.max)
    ) {
      return 'profile'
    }
  }
  const { item } = chosen
  const offered = enchant.self
    ? item === undefined
    : item === undefined || enchant.items.includes(item)
  if (!offered) return 'enchant-target'
  const on =
    enchant.self &&
    enchant.applied.some(applied => applied.profile === chosen.profile)
  return on ? 'applied' : undefined
}

/**
 * Is what a roll from a link in a description asks for what the link is, in a description on the
 * character's sheet now, held here? The table is asked for a saving throw or check the link calls
 * for, but never one in a secret, which would be posted for everyone; the player's own saving
 * throw is rolled with one of the abilities it names, or Constitution for a concentration check
 * that names none, as the game takes it; the player's own check is one of the link's, by its kind
 * and its skill's, tool's or ability's key; damage or healing is rolled as its parts' formulas
 * throw, each as a kind of damage the part offers, where chosen, changed as the player chose, as an
 * attack's damage may be, where the game takes it so, its first die, where the game changes only
 * one it adds (`signedDice`), else only where that's its first die whatever its sign, and damage,
 * never healing nor damage the game marks as never one, as a critical hit's, its dice thrown as
 * many times as the world's rules say, where the sheet says, with the dice a critical hit adds, as
 * they throw them; and a roll of its own as its formula throws. The game reads the link again from
 * its own copy, so nothing it asks for is taken from the app.
 */
export function checkLinked(
  input: RollRequestInput,
  sheet: CharacterSheet | undefined,
  links: ReadonlyMap<number, FoundLink> | undefined,
  features: readonly string[],
): RollRefusal | undefined {
  if (!sheet) return 'unknown'
  const { text, link: number } = input
  if (!text || number === undefined || !links) return 'gone'
  if (!sheetTextRefs(sheet).includes(text)) return 'gone'
  const found = links.get(number)
  switch (input.kind) {
    case 'ask': {
      if (found?.link.kind !== 'save' && found?.link.kind !== 'check') {
        return 'link'
      }
      return found.secret ? 'secret' : undefined
    }
    case 'save': {
      // A concentration check that names no ability holds Constitution, which the game takes too.
      if (found?.link.kind !== 'save') return 'link'
      return found.link.abilities.includes(input.key ?? '') ? undefined : 'link'
    }
    case 'skill':
    case 'tool':
    case 'ability': {
      if (found?.link.kind !== 'check') return 'link'
      const type = CHECK_TYPES[input.kind]
      const offered = found.link.checks.some(
        option =>
          option.type === type && (option.key ?? option.ability) === input.key,
      )
      return offered ? undefined : 'link'
    }
    case 'textDamage': {
      if (found?.link.kind !== 'damage') return 'link'
      const damage = found.link
      // Healing is never a critical hit's, nor damage the game marks as never one, without what
      // one adds, which a module from 0.20.0 marks so only for apps before.
      if (input.critical && (damage.healing || damage.critical === false)) {
        return 'link'
      }
      const { parts } = damage
      const types = input.types ?? []
      const offered =
        types.length <= parts.length &&
        types.every(
          (type, index) => type === null || parts[index].types.includes(type),
        )
      if (!offered) return 'type'
      // Changed only where the game takes it so, from module 0.19.0, whose sheets say how it makes
      // a critical hit's, or that it can't.
      if (changes(input.modifiers) && sheet.critical === undefined) {
        return 'unavailable'
      }
      // A critical hit's only as the world's rules make it, where the sheet says how, and where
      // one is offered, as where they say how they throw the dice it adds; then with what it adds.
      const rule = input.critical ? sheet.critical : undefined
      if (input.critical && !rule) return 'dice'
      const adds = rule ? criticalOffered(damage, rule) : undefined
      if (adds === false) return 'dice'
      // A part the app can't read, it couldn't have rolled.
      const preview = linkDamage(damage, rule ?? undefined, adds)
      // Never at its highest where it takes a die away, which that would take the most of, nor
      // where a die explodes, or is rerolled on its highest face, whose highest isn't known.
      if (
        input.modifiers?.maximize &&
        preview &&
        (diceTakenAway(preview) || unmaximizable(preview))
      ) {
        return 'dice'
      }
      // Its first die changed only where the game changes that one, as a module before 0.21.0,
      // which changes its first die whatever its sign, does only where that's one it adds.
      const planned =
        preview &&
        modifiedDice(preview, input.modifiers, features.includes('signedDice'))
      return planned && matchesPlanned(input, planned) ? undefined : 'dice'
    }
    case 'textRoll': {
      if (found?.link.kind !== 'roll') return 'link'
      const thrown = formulaDice(found.link.formula)
      return thrown && throws(input, thrown) ? undefined : 'dice'
    }
    default: {
      return 'link'
    }
  }
}

/**
 * The kind of option a check a description or an activity calls for has, for each kind of roll
 * that makes one.
 */
export const CHECK_TYPES = {
  skill: 'skill',
  tool: 'tool',
  ability: 'check',
} as const satisfies Partial<Record<RollKind, CheckOption['type']>>

/**
 * Are a roll's dice those a formula throws, in order: the same kinds of dice, as many of each, as
 * first thrown? Foundry throws again itself any die it rerolls or explodes.
 */
export function throws(input: RollRequestInput, thrown: ExtraDice[]): boolean {
  return (
    input.dice.length === thrown.length &&
    input.dice.every(
      ({ faces, results }, index) =>
        faces === thrown[index].sides && results.length === thrown[index].count,
    )
  )
}

/**
 * Are a roll's dice those its damage was planned to throw, in order: the same kinds of dice, as
 * many of each?
 */
export function matchesPlanned(
  input: RollRequestInput,
  planned: { faces: number; number: number }[],
): boolean {
  return (
    input.dice.length === planned.length &&
    input.dice.every(
      ({ faces, results }, index) =>
        faces === planned[index].faces &&
        results.length === planned[index].number,
    )
  )
}
