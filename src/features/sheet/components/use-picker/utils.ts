import {
  aloneSelection,
  type AloneChoice,
} from '@/features/sheet/utils/damage-alone'
import { enchantOf, offeredProfiles } from '@/features/sheet/utils/enchantments'
import { slotPools, ordinal, defaultPool } from '@/utils/action-groups'
import { castOf, castAtLevel } from '@/utils/casts'
import { offersSelf, picksTargets, friendly, selfDefault } from '@/utils/uses'
import { articled } from '@/utils/wild-shape'
import type { Picked, Picking } from './types'
import type { AloneSelection } from '@/types/roll'
import type {
  CastIndex,
  SheetAction,
  SheetSpellSection,
  SheetCastLevel,
  SlotPool,
} from '@/types/sending-stone'
import type { TableCombatant, TableCombat } from '@/types/table'

/** No spell an item casts, as for a sheet that lists none. */
export const NO_CASTS: CastIndex = new Map()

/**
 * The player's user as a target of a use, where they aren't among the combatants: the game makes it
 * at them as asked (`Picked.self`).
 */
export const SELF: TableCombatant = {
  id: '@self',
  name: 'Self',
  initiative: null,
  defeated: false,
  side: 'me',
}

/** The combatants an attack can be made at: everyone in the combat but the attacker. */
export function targetsOf(combat?: TableCombat): TableCombatant[] {
  return combat?.combatants.filter(combatant => combatant.side !== 'me') ?? []
}

/**
 * Where a use offered at its user, as Self, is made at them: their own combatant, in the combat;
 * or else, where the game makes a use at its user as asked, from module 0.22.0, at `SELF`. None for
 * a use not offered so, or one used on its user alone, which has none to pick, or where neither
 * holds.
 * @param selfTargets - Whether the game makes a use at its user as asked.
 */
export function selfTarget(
  action: SheetAction,
  combat?: TableCombat,
  selfTargets = false,
): TableCombatant | undefined {
  if (!offersSelf(action) || action.activity?.targets.self) return undefined
  const me = combat?.combatants.find(({ side }) => side === 'me')
  if (me) return me
  return selfTargets ? SELF : undefined
}

/**
 * The combatants a use can be made at, in a combat, in turn order: for one that helps, its user
 * first, as Self, and their allies, then everyone else; for one that harms, everyone but its user,
 * then its user, where it may be made at them; and first, where it's made at them by default, as a
 * potion. None for a use with no targets to pick, or out of a combat.
 * @param selfTargets - Whether the game makes a use at its user as asked.
 */
export function targetsFor(
  action: SheetAction,
  combat?: TableCombat,
  selfTargets = false,
): TableCombatant[] {
  const use = action.activity
  if (!use || !picksTargets(use) || !combat) return []
  const all = combat.combatants
  const self = selfTarget(action, combat, selfTargets)
  const first = self && (friendly(use) || selfDefault(action))
  const others = friendly(use)
    ? [
        ...all.filter(({ side }) => side === 'party'),
        ...all.filter(({ side }) => side === 'other'),
      ]
    : all.filter(({ side }) => side !== 'me')
  if (!self) return others
  return first ? [self, ...others] : [...others, self]
}

/**
 * How a use made at its user by default is made there where there's no one to pick, as out of a
 * combat: at no one, for one used on its user alone, which the game makes at them; at their own
 * combatant, in the combat; or at `self`, where the game makes it so, from module 0.22.0. None
 * where none holds, or for any other use, which is made at no one.
 */
export function selfPick(
  action: SheetAction,
  combat?: TableCombat,
  selfTargets = false,
): Pick<Picked, 'targets' | 'self'> | undefined {
  if (!selfDefault(action)) return undefined
  if (action.activity?.targets.self) return { targets: [] }
  const me = combat?.combatants.find(({ side }) => side === 'me')
  if (me) return { targets: [me] }
  return selfTargets ? { targets: [], self: true } : undefined
}

/**
 * The choices an attack or a use offers beyond its targets: slots, or the levels a spell an item
 * casts may be cast at, from module 0.20.0, which has no slots; ammunition and modes.
 */
export function choicesOf(
  picking: Picking,
  spellbook: SheetSpellSection[],
  casts: CastIndex,
) {
  const { action } = picking
  if (picking.kind === 'alone') return aloneChoicesOf(action, spellbook)
  const levels = castOf(action, casts)?.levels ?? []
  const pools = levels.length > 0 ? [] : (slotPools(action, spellbook) ?? [])
  const attack = picking.kind === 'attack'
  return {
    pools: pools.length > 1 ? pools : [],
    levels,
    ammunition:
      attack && (action.ammunition?.length ?? 0) > 1 ? action.ammunition! : [],
    modes:
      attack && (action.attackModes?.length ?? 0) > 1
        ? action.attackModes!
        : [],
  }
}

/**
 * The choices damage on its own offers, from module 0.41.0, where the game sends them (round 0.41.0
 * §2.3.2, §2.11.2): the slots it may be rolled at, where there's more than one and the level or the
 * slot matters, some plan of the game's being at a level or its use spending a slot; and for its
 * weapon's attack, its ammunition and modes, where there's more than one. Never whom at.
 */
export function aloneChoicesOf(
  action: SheetAction,
  spellbook: SheetSpellSection[],
) {
  const plan = action.tableDamage
  const levelled =
    !!plan?.choices?.some(({ level }) => level !== undefined) ||
    !!plan?.spends?.includes('slot')
  const pools = levelled ? (slotPools(action, spellbook) ?? []) : []
  // A weapon's choices are its attack's, which its damage on its own is the damage of.
  const attack = !!action.attackId
  return {
    pools: pools.length > 1 ? pools : [],
    levels: [] as SheetCastLevel[],
    ammunition:
      attack && (action.ammunition?.length ?? 0) > 1 ? action.ammunition! : [],
    modes:
      attack && (action.attackModes?.length ?? 0) > 1
        ? action.attackModes!
        : [],
  }
}

/**
 * What damage on its own is rolled with before the player picks anything, as the game would have
 * it (module 0.41.0): what they chose already, else its slot, as dnd5e would pick it, and its
 * ammunition, the first with any left, as `aloneSelection` has them; and its weapon's first mode,
 * where the picker offers its modes, as the attack picker presets it.
 */
export function alonePicksOf(
  action: SheetAction,
  spellbook: SheetSpellSection[],
  choice: AloneChoice = {},
): AloneSelection {
  const plan = action.tableDamage
  if (!plan) return {}
  const { slot, ammunition } = aloneSelection(
    plan,
    { action, spells: spellbook },
    choice,
  )
  const { modes } = aloneChoicesOf(action, spellbook)
  const attackMode = choice.attackMode ?? modes[0]?.value
  return {
    ...(slot && { slot }),
    ...(attackMode && { attackMode }),
    ...(ammunition && { ammunition }),
  }
}

/**
 * What damage on its own would spend as picked, from module 0.41.0, as the Spend switch names it
 * (round 0.41.0 §2.4.1, §2.11.2), each only where the game says its use spends it: the slot chosen,
 * "a 2nd-level spell slot", or "a pact slot (3rd level)"; "a use of Second Wind"; the ammunition
 * fired, "an Arrow of Fire"; and the weapon itself thrown, in a thrown mode with no ammunition,
 * "the Dagger", or in its only mode where that one is thrown, "the Dart". None for a pick that
 * spends nothing, which shows no switch.
 */
export function spendParts(
  action: SheetAction,
  spellbook: SheetSpellSection[],
  picks: AloneSelection,
): string[] {
  const spends = action.tableDamage?.spends ?? []
  const pool = picks.slot
    ? slotPools(action, spellbook)?.find(({ id }) => id === picks.slot)
    : undefined
  const ammunition = picks.ammunition
    ? action.ammunition?.find(({ id }) => id === picks.ammunition)
    : undefined
  // A weapon of one mode, such as a Dart, has no mode to pick: the game says it spends it thrown
  // only where that one mode is thrown, and throws it so with none named.
  const thrown =
    !ammunition &&
    (!!picks.attackMode?.startsWith('thrown') ||
      (spends.includes('thrown') && (action.attackModes?.length ?? 0) < 2))
  return [
    ...(spends.includes('slot') && pool ? [slotWords(pool)] : []),
    ...(spends.includes('uses') ? [`a use of ${action.name}`] : []),
    ...(spends.includes('ammunition') && ammunition
      ? [articled(ammunition.name)]
      : []),
    ...(spends.includes('thrown') && thrown ? [`the ${action.name}`] : []),
  ]
}

/** A slot spent, in words: "a 2nd-level spell slot", or pact magic's "a pact slot (3rd level)". */
function slotWords(pool: SlotPool): string {
  if (pool.level === null) return 'a spell slot'
  return pool.id === 'pact'
    ? `a pact slot (${ordinal(pool.level)} level)`
    : `a ${ordinal(pool.level)}-level spell slot`
}

/**
 * Does an attack or a use ask anything before it's made: whom at, in a combat with anyone to pick,
 * or with which slot, ammunition or mode, where there's more than one, or at which level a spell an
 * item casts is cast, where it may be cast higher? One that enchants another item always asks
 * which, or to leave it on its card; one that enchants its own, how, where it may more ways than
 * one.
 * @param casts - How each spell an item casts is cast, by its copy's id.
 * @param selfTargets - Whether the game makes a use at its user as asked, from module 0.22.0.
 */
export function asks(
  picking: Picking,
  combat: TableCombat | undefined,
  spellbook: SheetSpellSection[],
  casts: CastIndex = NO_CASTS,
  selfTargets = false,
): boolean {
  const { pools, levels, ammunition, modes } = choicesOf(
    picking,
    spellbook,
    casts,
  )
  // Damage on its own asks where it has chips to choose from, or a switch to show for what it'd
  // spend as the game would preset it; never whom at.
  if (picking.kind === 'alone') {
    return (
      pools.length > 0 ||
      ammunition.length > 0 ||
      modes.length > 0 ||
      spendParts(
        picking.action,
        spellbook,
        alonePicksOf(picking.action, spellbook, picking.choice),
      ).length > 0
    )
  }
  const enchant =
    picking.kind === 'use' ? enchantOf(picking.action.activity) : undefined
  if (enchant) {
    const { slot } = enchantPicks(picking.action, spellbook, casts)
    const level = castAtLevel(picking.action, spellbook, slot, casts)
    return (
      !enchant.self ||
      pools.length > 0 ||
      levels.length > 0 ||
      offeredProfiles(enchant, level).length > 1
    )
  }
  const targets =
    picking.kind === 'attack'
      ? targetsOf(combat)
      : targetsFor(picking.action, combat, selfTargets)
  return (
    targets.length > 0 ||
    pools.length > 0 ||
    levels.length > 0 ||
    ammunition.length > 0 ||
    modes.length > 0
  )
}

/**
 * How an enchant activity is used where nothing is asked, as dnd5e would use it: at the level a
 * spell is cast at by default, with its slot, or for one an item casts, the level, so that the game
 * casts it there; in the first way it may enchant there. Nothing for anything else, or for one with
 * no way to enchant left, which the game then refuses.
 */
export function enchantPicks(
  action: SheetAction,
  spellbook: SheetSpellSection[],
  casts: CastIndex = NO_CASTS,
): Pick<Picked, 'slot' | 'enchant'> {
  const enchant = enchantOf(action.activity)
  if (!enchant) return {}
  const cast = castOf(action, casts)
  const slot =
    cast?.levels && cast.levels.length > 0
      ? `spell${cast.level}`
      : defaultPool(action, spellbook)?.id
  const level = castAtLevel(action, spellbook, slot, casts)
  const [profile] = offeredProfiles(enchant, level)
  return {
    ...(slot && { slot }),
    ...(profile && { enchant: { profile: profile.id } }),
  }
}
