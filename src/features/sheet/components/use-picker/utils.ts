import { verbOf } from '../action-entry/utils'
import { chargesOf } from '../action-info/utils'
import { PILLS } from './constants'
import { MAX_USE_TARGETS } from '@/constants/sending-stone'
import { enchantOf, offeredProfiles } from '@/features/sheet/utils/enchantments'
import { slotPools, ordinal, defaultPool } from '@/utils/action-groups'
import { aloneSelection } from '@/utils/alone-choices'
import { castOf, castAtLevel } from '@/utils/casts'
import { listed } from '@/utils/roll-reasons'
import {
  offersSelf,
  picksTargets,
  friendly,
  mostTargets,
  selfDefault,
} from '@/utils/uses'
import { articled } from '@/utils/wild-shape'
import type { Picked, Picking, Section, Whom } from './types'
import type { AloneChoice } from '@/features/sheet/utils/types'
import type { AloneSelection } from '@/types/roll'
import type {
  AloneSpend,
  CastIndex,
  SheetAction,
  SheetEnchant,
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
function spendParts(
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
  const slot = defaultSlot(action, spellbook, casts)
  const level = castAtLevel(action, spellbook, slot, casts)
  const [profile] = offeredProfiles(enchant, level)
  return {
    ...(slot && { slot }),
    ...(profile && { enchant: { profile: profile.id } }),
  }
}

export function pillOf(
  combatant: TableCombatant,
): keyof typeof PILLS | undefined {
  if (combatant.side === 'me') return 'you'
  if (allied(combatant)) return 'ally'
  return combatant.stance === 'neutral' ? 'neutral' : undefined
}

/**
 * Whether a combatant is on the player's side: they themselves, one of the party, or one the game
 * has as an ally, as a hireling the Gamemaster marked Friendly, from module 0.29.0.
 */
function allied(combatant: TableCombatant): boolean {
  return combatant.side !== 'other' || combatant.stance === 'ally'
}

/**
 * Combatants to pick from in two sections, the player and their allies and then everyone else,
 * each in turn order: for an attack, or a use that harms, everyone else first, with the player's
 * own row last of their allies; for a use that helps, or one made at its user by default, as a
 * potion, the player first, then their allies, then everyone else.
 * @param combat - Whose turn order it is.
 * @param first - Who goes first in their section, such as the last attacked.
 */
export function sectionsOf(
  targets: TableCombatant[],
  combat: TableCombat | undefined,
  { helpful, first }: { helpful: boolean; first?: string },
): Section[] {
  const turn = new Map(combat?.combatants.map(({ id }, index) => [id, index]))
  const inTurn = (one: TableCombatant, other: TableCombatant) =>
    (turn.get(one.id) ?? 0) - (turn.get(other.id) ?? 0)
  const self = targets.filter(({ side }) => side === 'me')
  const rest = targets.filter(({ side }) => side !== 'me').toSorted(inTurn)
  const lead = (rows: TableCombatant[]) => [
    ...rows.filter(({ id }) => id === first),
    ...rows.filter(({ id }) => id !== first),
  ]
  const friends = rest.filter(combatant => allied(combatant))
  const allies: Section = {
    key: 'allies',
    label: 'Allies',
    rows: lead(helpful ? [...self, ...friends] : [...friends, ...self]),
  }
  const others: Section = {
    key: 'others',
    label: 'Others',
    rows: lead(rest.filter(combatant => !allied(combatant))),
  }
  return helpful ? [allies, others] : [others, allies]
}

/**
 * What of a combatant's row a search matches: the name it shows, and on the player's own, shown as
 * Self, their own name too. Nothing else, such as a pill, nor anything the row doesn't show, so a
 * search hints at no one hidden.
 */
export function shownOf(combatant: TableCombatant): string[] {
  return combatant.side === 'me' ? ['Self', combatant.name] : [combatant.name]
}

/** The combatants picked, as the game is asked: its user as `self` where they're `SELF`. */
export function picked(
  targets: TableCombatant[],
): Pick<Picked, 'targets' | 'self'> {
  const self = targets.includes(SELF)
  return {
    targets: targets.filter(target => target !== SELF),
    ...(self && { self: true as const }),
  }
}

/**
 * What the Spend switch says as picked, such as "Spend a 2nd-level spell slot"; none where it
 * spends nothing.
 */
export function spendLabel(
  action: SheetAction,
  spellbook: SheetSpellSection[],
  picks: AloneSelection,
): string | undefined {
  const parts = spendParts(action, spellbook, picks)
  return parts.length > 0 ? `Spend ${listed(parts)}` : undefined
}

/** What to tick, and how many. */
export function leadFor(area: boolean, most: number): string {
  const limit = Number.isFinite(most) ? ` Up to ${most}.` : ''
  return area
    ? `Tick who is caught in the area.${limit}`
    : `Tick who to target.${limit}`
}

/** A pool of slots, as a screen reader is told: such as "3rd Level, 2 slots left". */
export function poolLabel(pool: SlotPool): string {
  return `${pool.label}, ${pool.value} ${pool.value === 1 ? 'slot' : 'slots'} left`
}

/**
 * A level a spell an item casts may be cast at, as a screen reader is told: such as "2nd Level,
 * 2 charges", for one that spends them; or "2nd Level".
 */
export function levelLabel(level: SheetCastLevel, spends: boolean): string {
  const name = `${ordinal(level.level)} Level`
  return spends && level.charges !== null
    ? `${name}, ${chargesOf(level.charges)}`
    : name
}

/**
 * The slot an attack or a use is preset to: for a spell an item casts at more than one level, the
 * level it's cast at by default, as "spell" and the level; else the pool dnd5e would choose.
 */
export function defaultSlot(
  action: SheetAction,
  spellbook: SheetSpellSection[],
  casts: CastIndex = NO_CASTS,
): string | undefined {
  const cast = castOf(action, casts)
  return cast?.levels && cast.levels.length > 0
    ? `spell${cast.level}`
    : defaultPool(action, spellbook)?.id
}

/**
 * Where damage on its own's picks move as its Spend switch is turned on: off a slot or an
 * ammunition with none left, where it spends them, to the one dnd5e would choose with some left,
 * where there is one.
 */
export function movedOff(
  action: SheetAction,
  spellbook: SheetSpellSection[],
  picks: AloneSelection,
  spends: AloneSpend[],
): AloneSelection {
  const moved: AloneSelection = {}
  const pool = slotPools(action, spellbook)?.find(({ id }) => id === picks.slot)
  if (spends.includes('slot') && pool && pool.value <= 0) {
    const left = defaultPool(action, spellbook)
    if (left) moved.slot = left.id
  }
  const fired = action.ammunition?.find(({ id }) => id === picks.ammunition)
  if (spends.includes('ammunition') && fired && fired.quantity <= 0) {
    const left = action.ammunition?.find(({ quantity }) => quantity > 0)
    if (left) moved.ammunition = left.id
  }
  return moved
}

/**
 * What an attack or a use is asked with beyond whom at, of what there's a choice of: the slot, or
 * the level, and always for one that enchants, as the ways it may enchant may hang on it; the
 * ammunition; and the attack mode.
 */
export function optionsOf(
  {
    pools,
    levels,
    ammunition,
    modes,
  }: {
    pools: readonly unknown[]
    levels: readonly unknown[]
    ammunition: readonly unknown[]
    modes: readonly unknown[]
  },
  {
    slot,
    ammo,
    mode,
    enchanting,
  }: { slot?: string; ammo?: string; mode?: string; enchanting: boolean },
): Pick<Picked, 'slot' | 'ammunition' | 'attackMode'> {
  return {
    ...((pools.length > 0 || levels.length > 0 || enchanting) &&
      slot && { slot }),
    ...(ammunition.length > 0 && ammo && { ammunition: ammo }),
    ...(modes.length > 0 && mode && { attackMode: mode }),
  }
}

/**
 * Whom an attack or a use is made at, as the picker asks it: an area attack at those ticked, as
 * many as it takes at the level chosen; one that enchants at no one, with what it enchants; an
 * attack at the one tapped, the last attacked first; and a use as `whomOfUse` has it. An attack
 * with no one to make it at is made at no one.
 * @param base - The level it's cast at by default; `castAt` the level chosen.
 */
export function whomOf({
  picking,
  combat,
  last,
  areas,
  enchant,
  ...use
}: {
  picking: Exclude<Picking, { kind: 'alone' }>
  combat?: TableCombat
  last?: string
  areas: boolean
  enchant?: SheetEnchant
  selfTargets: boolean
  preset?: TableCombatant
  helpful: boolean
  base: number | null
  castAt: number | null
}): Whom {
  const { action } = picking
  const area =
    areas && picking.kind === 'attack' ? action.attackArea : undefined
  if (area) {
    const targets = targetsOf(combat)
    return targets.length > 0
      ? {
          kind: 'tick',
          targets,
          area: true,
          most: mostTargets(area, use.base, use.castAt),
          verb: 'Attack',
          helps: false,
        }
      : { kind: 'attack' }
  }
  if (enchant) return { kind: 'enchant', enchant, verb: verbOf(action) }
  if (picking.kind === 'attack') {
    const targets = targetsOf(combat)
    return targets.length > 0
      ? {
          kind: 'tap',
          lead: 'Choose who to attack.',
          sections: sectionsOf(targets, combat, {
            helpful: false,
            first: last,
          }),
          last,
        }
      : { kind: 'attack' }
  }
  return whomOfUse(action, { combat, ...use })
}

/**
 * Whom a use is made at: with no one to pick, at its user where it's made there by default
 * (`selfPick`), else at no one; at one, the one tapped, the default marked; at more, or at an
 * area, at those ticked, as many as it takes at the level chosen.
 */
function whomOfUse(
  action: SheetAction,
  {
    combat,
    selfTargets,
    preset,
    helpful,
    base,
    castAt,
  }: {
    combat?: TableCombat
    selfTargets: boolean
    preset?: TableCombatant
    helpful: boolean
    base: number | null
    castAt: number | null
  },
): Whom {
  const use = action.activity!
  const targets = targetsFor(action, combat, selfTargets)
  const most = mostTargets(use.targets, base, castAt)
  const verb = verbOf(action)
  if (targets.length === 0) {
    // One made at its user by default goes there, as it says, where it may.
    return { kind: 'use', verb, at: selfPick(action, combat, selfTargets) }
  }
  if (most === 1) {
    return {
      kind: 'tap',
      lead: `Choose who to ${verb.toLowerCase()} it at.`,
      sections: sectionsOf(targets, combat, { helpful }),
      preset: preset?.id,
    }
  }
  return {
    kind: 'tick',
    targets,
    area: use.targets.area,
    most,
    verb: `${verb} at`,
    helps: helpful,
  }
}

/**
 * Those ticked that count, as many as a use or an area attack takes, as the game takes them: no
 * more than it's sent. Only those still in the combat count, so one gone from it while picking
 * frees a place.
 * @param takes - How many it takes; `most` is that, or as many as the game is sent.
 */
export function tickedOf(
  ticked: string[],
  targets: TableCombatant[],
  takes: number,
): { most: number; chosen: string[] } {
  const most = Math.min(takes, MAX_USE_TARGETS)
  const present = new Set(targets.map(({ id }) => id))
  return { most, chosen: ticked.filter(id => present.has(id)).slice(0, most) }
}

/** What the button that makes it at those ticked says: such as "Bless at 2 targets", or "Bless". */
export function tickGo(verb: string, count: number): string {
  return count > 0
    ? `${verb} ${count} ${count === 1 ? 'target' : 'targets'}`
    : verb.replace(/ at$/, '')
}

/**
 * What damage on its own is asked with, as picked: its slot, its attack mode where there's a
 * choice of it, its ammunition, and only where the switch shows, and is on, that it spends what
 * its use would.
 */
export function alonePicked(
  picks: AloneSelection,
  {
    modes,
    label,
    on,
  }: { modes: readonly unknown[]; label?: string; on: boolean },
): Picked {
  return {
    targets: [],
    ...(picks.slot && { slot: picks.slot }),
    ...(modes.length > 0 &&
      picks.attackMode && { attackMode: picks.attackMode }),
    ...(picks.ammunition && { ammunition: picks.ammunition }),
    // Only where the switch shows, and is on: no part, nothing to spend.
    ...(label && on && { consume: true as const }),
  }
}
