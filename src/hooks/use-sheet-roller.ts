'use client'

import { useCallback, useState } from 'react'
import {
  CUSTOM_COLORSET_KEY,
  executeRoll,
  themeToBoxConfig,
  toDiceBoxNotation,
  type Advantage,
  type DiePool,
  type DieSides,
  type ExecuteRollOptions,
  type RollResult,
} from '@lambersond/3d-dice-core'
import { useDiceRenderer } from '@lambersond/3d-dice-react'
import {
  criticalParts,
  EVERY_DIE_TWICE,
  withModifiers,
  type CriticalAdds,
  type DamageModifiers,
} from '@/utils/damage-modifiers'
import { throwTerm, type ThrownDie } from '@/utils/dice-modifiers'
import {
  formatExtraTerm,
  type ExtraDice,
  type ExtraTerm,
} from '@/utils/roll-modifiers'
import { d20Count, d20Label, typedResult } from '@/utils/typed-dice'
import type { DiceEntryTerm, EnterDice } from '@/types/dice-entry'
import type {
  FormulaSource,
  RollKind,
  RollSource,
  TextLink,
} from '@/types/roll'
import type { CriticalRule, TableDamagePlan } from '@/types/sending-stone'

/** The dice, in the app's jade. */
const DICE_THEME = themeToBoxConfig({
  colorset: CUSTOM_COLORSET_KEY,
  material: 'glass',
  customColor: '#00805a',
})

/** How long the dice may tumble before the result is shown regardless, in milliseconds. */
export const ANIMATION_TIMEOUT = 15_000

/** How many of this page's rolls are kept. */
export const ROLL_HISTORY = 20

/** The rolls that are checks, which pass a DC, rather than save against it. */
const CHECKS = new Set<RollSource['kind']>(['skill', 'tool', 'ability'])

/** A random source that lands every die on its highest face, for damage at its highest. */
const HIGHEST = () => 1 - Number.EPSILON

/** A d20 roll from the character's sheet, such as a skill check or a saving throw. */
export type SheetRoll = {
  /** What is rolled, such as "Perception check". */
  label: string
  modifier: number
  advantage?: Advantage
  /** What the player adds, such as +1d4 for Bless. */
  extras?: ExtraTerm[]
  /** What it is, for the Gamemaster's game to make it too. */
  source?: RollSource
  /**
   * Whether the player chose how to roll it, as in dnd5e's roll dialog, rather than tapping it to
   * roll as the sheet has it.
   */
  explicit?: boolean
  /** For an area attack, the names of the combatants it's made at, by their ids. */
  targetNames?: Record<string, string>
  /**
   * For a saving throw or check a description calls for, the DC it names, which it's made against;
   * or for a check an activity asks for, the activity's.
   */
  dc?: number
  /**
   * For an attack a spell an item casts makes, such as a staff's Guiding Bolt: cast at a level the
   * item offers, rather than with a spell slot.
   */
  itemCast?: boolean
  /**
   * dnd5e gives this attack Elven Accuracy, as its sheet says: a third d20 with advantage, typed
   * in.
   */
  elvenAccuracy?: true
  /** For an answer to what the game asks, when it stops waiting, as an ISO time. */
  until?: string
  /** For an answer to what the game asks, aborted once it's answered or closed elsewhere. */
  signal?: AbortSignal
}

/** Damage or healing from the character's sheet, such as a weapon's. */
export type SheetDamageRoll = {
  /** What is rolled, such as "Longsword damage". */
  label: string
  /** Each part of the formula, with its kind of damage, such as "Slashing". */
  parts: { terms: ExtraTerm[]; type: string | null }[]
  /** A critical hit, which rolls every die twice, unless the game's or its rules say otherwise. */
  critical?: boolean
  /** Healing, or temporary hit points, rather than damage. */
  healing?: boolean
  /** The attack it's the damage of: its item and attack activity. */
  source?: { item: string; activity: string }
  /**
   * The attack or use made in the Gamemaster's game whose damage this is, to be rolled there too.
   */
  use?: string
  /** For the game, the kind of damage chosen for each of its rolls that offers a choice. */
  types?: (string | null)[]
  /** Its dice are the game's, a critical hit's already doubled. */
  exact?: boolean
  /** How the player changed it: more of its first die, another size of it, its highest. */
  modifiers?: DamageModifiers
  /**
   * For dice that are the game's, how many it throws for each die added, as a critical hit's
   * doubled dice take two.
   */
  perDie?: number
  /**
   * Its dice can't be changed: the game's preview has no first die to change, or one a module
   * before 0.21.0 would change otherwise.
   */
  fixed?: true
  /** For damage or healing a description deals, its link, for the game to roll it too. */
  text?: TextLink
  /**
   * For a description's damage the game rolls too, how the world's rules make a critical hit's, for
   * one to be thrown so here, once changed as the player chose, rather than every die twice.
   */
  criticalRule?: CriticalRule
  /**
   * For a description's damage, what a critical hit adds to each of its parts, where one is
   * offered, such as a weapon's extra dice and critical damage: thrown with it, as the world's
   * rules make one, or as dnd5e does by default where none are given.
   */
  criticalAdds?: CriticalAdds
  /** The game's total counts, once it says, as where its formula couldn't be read. */
  gameTotal?: true
  /**
   * Damage or healing on its own (module 0.36.0): its item and activity, the game's plan of its
   * dice, and whether this is a critical hit's.
   */
  alone?: {
    item: string
    activity: string
    plan?: TableDamagePlan
    critical?: boolean
  }
}

/**
 * Dice and numbers with no d20, from the character's sheet: a hit die spent, or several at once, or
 * an item's activity's own formula, such as a light's radius.
 */
export type SheetFormulaRoll = {
  /** What is rolled, such as "Hit die (d10)". */
  label: string
  /** Its terms, in order, such as 1d10 and +2; none where it's thrown in sets. */
  terms: ExtraTerm[]
  /**
   * Thrown in sets, all at once, each set's terms so many times, each time coming to its own total,
   * at least its least: as hit dice spent at once are, a set of each size, the largest first, each
   * die with the character's Constitution modifier.
   */
  sets?: { terms: ExtraTerm[]; times: number }[]
  /** Hit points given back, as a hit die's are. */
  healing?: boolean
  /** The least it comes to, as a hit die spent gives back at least 1; thrown in sets, each time. */
  minimum?: number
  /** What it is, for the Gamemaster's game to make it too. */
  source?: FormulaSource
}

/** Something the player added to a roll, or a term of a damage roll, and what it came to. */
export type LocalExtra = {
  /** As written, with its sign: +1d4, −1d6, +5, or a sheet's +2d6r<=2. */
  text: string
  /**
   * Each die's result, as first thrown, which is what the game is sent; empty for a flat number.
   * Foundry throws again itself any die it rerolls or explodes.
   */
  values: number[]
  /** What it adds to the total: negative for a term taken away. */
  value: number
  /**
   * For a term whose dice Foundry works out once thrown, such as 2d6r<=2's: every die thrown, the
   * first throw and then any rerolled or exploded, and what became of each.
   */
  thrown?: ThrownDie[]
}

/** A d20 roll as this page keeps it. */
export type LocalCheck = {
  kind: 'check'
  id: string
  label: string
  total: number
  modifier: number
  advantage?: Advantage
  /** Every d20 thrown: two with advantage or disadvantage. */
  d20s: number[]
  /** The d20 that counts. */
  natural: number
  extras: LocalExtra[]
  /** For a saving throw or check a description calls for, the DC it names; or an activity's. */
  dc?: number
  /**
   * For a saving throw or check a description or an activity calls for, what it's said to do when
   * it reaches its DC: a saving throw is saved, as one is unless it says, and a check passed.
   */
  verdict?: 'save' | 'check'
  /** Rolled from a link in a description. */
  described?: boolean
  /** The player typed its dice in. */
  typed?: true
  at: number
}

/** A damage or healing roll as this page keeps it. */
export type LocalDamage = {
  kind: 'damage'
  id: string
  label: string
  /**
   * As dnd5e's card adds damage up: each kind's parts together, each kind at least 0, then every
   * kind.
   */
  total: number
  critical: boolean
  healing: boolean
  /** Every die at its highest, as the player chose. */
  maximized?: boolean
  /** Each part of the formula, with what it came to, below 0 where it took more away. */
  parts: { type: string | null; total: number; terms: LocalExtra[] }[]
  /** Rolled from a link in a description. */
  described?: boolean
  /**
   * A critical hit's whose dice the world's rules change as only the game can add them up, such as
   * Midi-QOL's at their highest; or one with a die rerolled or exploded, which Foundry throws again
   * itself: its total is the game's, once it says.
   */
  gameTotal?: boolean
  /** The player typed its dice in. */
  typed?: true
  at: number
}

/**
 * A spell or feature used in the Gamemaster's game, as this page keeps it: it throws no dice of
 * its own, but follows its way to the game.
 */
export type LocalUse = {
  kind: 'use'
  id: string
  /** What was used, such as "Fireball". */
  label: string
  /** A spell, which is cast, rather than used. */
  spell: boolean
  /**
   * A spell an item casts, or one of its activities, such as a wand's Magic Missile: cast at a
   * level the item offers, rather than with a spell slot.
   */
  itemCast?: boolean
  /**
   * An enchantment ended, such as Magic Weapon's on a longsword, rather than anything used, from
   * module 0.21.0: what it's called is the label; or from module 0.29.0, a concentration ended.
   */
  ending?: boolean
  /**
   * Charges spent directly, rather than anything used, from module 0.29.0: how many; what they're
   * of, such as "Sorcery Points", is the label.
   */
  spent?: number
  /** Heroic Inspiration used, or gained, rather than anything used, from module 0.29.0. */
  inspiration?: 'use' | 'gain'
  /**
   * Items or coins moved, rather than anything used, from module 0.31.0: what moved, as the chat
   * line says it, is the label.
   */
  move?: LocalMove
  at: number
}

/**
 * Items or coins moved, as a page keeps the move: given, taken, or from module 0.32.0 sent from a
 * party or distributed among its characters, and between whom; or from module 0.33.0 removed from
 * the character.
 */
export type LocalMove = {
  verb: 'give' | 'take' | 'send' | 'distribute' | 'remove'
  /**
   * As the chat line says it, such as "2 Potion of Healing", or for a distribution, all it shares,
   * "100 gp".
   */
  things: string
  /**
   * The other end's name: who it's given or sent to, or the party it's taken or distributed from;
   * for a removal, the character it's removed from.
   */
  other: string
  /** Who moved it, for the Gamemaster's words: the character's name. Unset for a player. */
  mover?: string
  /** The item moved, if one, to disable its control while pending. */
  item?: string
  /** A send's: the party it's sent from, from module 0.32.0. */
  source?: string
  /**
   * A distribution's: who shares it, as the line lists them, such as "Bram, Lia, Thorin, and Vex".
   */
  among?: string
  /** A distribution's: each one's share, such as "25 gp". */
  each?: string
}

/** A hit die spent, or a formula rolled, as this page keeps it. */
export type LocalFormula = {
  kind: 'formula'
  id: string
  label: string
  total: number
  healing: boolean
  /**
   * Each term, with what it came to; thrown in sets, as hit dice spent at once, each set's dice as
   * one term, in order, then all of their numbers as one.
   */
  terms: LocalExtra[]
  /**
   * The least it comes to, when its dice and numbers came to less; for several thrown together,
   * the least each does, when one of them came to less.
   */
  minimum?: number
  /** How many dice were thrown together, each to its own total, as hit dice spent at once. */
  times?: number
  /** Rolled from a link in a description. */
  described?: boolean
  /**
   * A die of it was rerolled or exploded, which Foundry throws again itself: its total is the
   * game's, once it says.
   */
  gameTotal?: boolean
  /** The player typed its dice in. */
  typed?: true
  at: number
}

/**
 * The table asked for a saving throw or check a description calls for, as this page keeps it: it
 * throws no dice, but follows its way to the game.
 */
export type LocalAsk = {
  kind: 'ask'
  id: string
  /** What was asked for, such as "DC 15 Dexterity saving throw" or "Strength (Athletics) check". */
  label: string
  at: number
}

/**
 * A roll the campaign's Gamemaster made as the player's character from their page (#156), shown on
 * the player's beside their own: it throws no dice here, but follows its way to the game, as the
 * player's table view tells it.
 */
export type LocalGmRoll = {
  kind: 'gm'
  /** Apart from this page's own: `gm:` and its id at the table. */
  id: string
  /** As the Gamemaster's page called it, such as "Perception check". */
  label: string
  /** What it is, such as "skill" or "attack". */
  rolled: RollKind
  /** Of damage, healing, as the game said it is. */
  healing?: true
  /**
   * When this page first heard of it, by this device's clock, as its own rolls are made by
   * (`useGmRolls`).
   */
  at: number
}

/**
 * A roll as this page keeps it, or a use, or an ask; or one of the Gamemaster's as the character.
 */
export type LocalRoll =
  LocalCheck | LocalDamage | LocalUse | LocalFormula | LocalAsk | LocalGmRoll

/** How many uses and asks this page has kept, for their ids. */
let uses = 0

/**
 * Rolls checks, saves, attacks and damage from the player's character sheet, tumbling 3D dice
 * across the screen. Each result is revealed once the dice land on it, and kept on this page, as
 * are the spells and features used, which throw no dice. While the player types in their own
 * dice (module 0.32.0), each roll asks for them once its dice are known, in place of throwing any,
 * and is kept at once, with nothing to animate. Must be used within a DiceRendererProvider.
 * @param onThrown - Told of each check or save as its dice are thrown, before they land, with
 * what they came to: to have the Gamemaster's game make it too.
 * @param onDamageThrown - The same, for damage.
 * @param onFormulaThrown - The same, for a hit die or a formula.
 * @returns With `roll`, `rollDamage` and `rollFormula`, each resolving true once its roll is kept,
 * or false where the player cancelled typing its dice in.
 */
export function useSheetRoller(
  onThrown?: (roll: SheetRoll, check: LocalCheck) => void,
  onDamageThrown?: (roll: SheetDamageRoll, damage: LocalDamage) => void,
  onFormulaThrown?: (roll: SheetFormulaRoll, rolled: LocalFormula) => void,
  /** While the player types in their own dice: asks for them, once a roll's dice are known. */
  enter?: EnterDice,
) {
  const renderer = useDiceRenderer()
  const [rolls, setRolls] = useState<LocalRoll[]>([])
  const [inFlight, setInFlight] = useState(0)

  // Throws the dice already rolled, then keeps what they came to; or, for dice the player typed
  // in, which they threw themselves, keeps it at once.
  const land = useCallback(
    async (thrown: RollResult, kept: LocalRoll, animate = true) => {
      if (!animate) {
        setRolls(earlier => keeping(earlier, kept))
        return
      }
      setInFlight(count => count + 1)
      try {
        // The animation is only decoration: if it fails or never settles, the result stands.
        if (renderer.isReady && thrown.pools.length > 0) {
          await within(
            renderer.roll(toDiceBoxNotation(thrown), { theme: DICE_THEME }),
            ANIMATION_TIMEOUT,
          )
        }
      } catch (error) {
        console.error('Dice animation failed', error)
      } finally {
        setInFlight(count => count - 1)
      }
      setRolls(earlier => keeping(earlier, kept))
    },
    [renderer],
  )

  const roll = useCallback(
    async (request: SheetRoll): Promise<boolean> => {
      const { label, modifier, advantage, extras = [] } = request
      // Extra dice are rolled on their own, since advantage applies only to the check's d20,
      // and thrown with it.
      const dice = extras.filter(term => 'sides' in term)
      const pools = dice.map(({ count, sides }) => ({ count, sides }))
      let result: RollResult
      let extra: RollResult | undefined
      let typed = false
      if (enter) {
        // The player's own d20s: a third with advantage, where dnd5e gives the attack Elven
        // Accuracy; then each die they added. The d20s typed so far count for what the higher
        // of them shows, or the lower, and nothing while none is.
        const count = d20Count(advantage, request.elvenAccuracy)
        const typedCheck = (values: number[][]) => {
          const [d20s = [], ...added] = values
          return {
            result: typedResult([{ sides: 20, count: 1 }], [d20s], {
              advantage,
              modifier,
            }),
            extra: pools.length > 0 ? typedResult(pools, added) : undefined,
          }
        }
        const values = await enter({
          title: label,
          terms: [
            { sides: 20, count, label: d20Label(advantage, count) },
            ...dice.map(term => ({
              sides: term.sides,
              count: term.count,
              label: formatExtraTerm(term),
            })),
          ],
          total: values => {
            const [d20s = [], ...added] = typedSoFar(values)
            const shown = typedCheck([d20s.length > 0 ? d20s : [0], ...added])
            return toLocalRoll(label, shown.result, extras, shown.extra).total
          },
          until: request.until,
          signal: request.signal,
        })
        if (!values) return false
        ;({ result, extra } = typedCheck(values))
        typed = true
      } else {
        result = executeRoll({
          pools: [{ sides: 20, count: 1 }],
          modifier,
          advantage,
        })
        extra =
          pools.length > 0 ? executeRoll({ pools, modifier: 0 }) : undefined
      }
      const thrown = extra
        ? { ...result, pools: [...result.pools, ...extra.pools] }
        : result
      const check = toLocalRoll(label, result, extras, extra)
      if (typed) check.typed = true
      const { source } = request
      if (request.dc !== undefined) check.dc = request.dc
      if (source && 'text' in source && source.text) {
        check.described = true
        // Against its DC, which the game may know where the description keeps it from the player.
        if (CHECKS.has(source.kind)) check.verdict = 'check'
      }
      // A check an activity asks for is passed or failed against its DC, as the game says, as is
      // one Midi-QOL asks for.
      if (
        source &&
        ('activity' in source || 'prompt' in source) &&
        CHECKS.has(source.kind)
      ) {
        check.verdict = 'check'
      }
      onThrown?.(request, check)
      await land(thrown, check, !typed)
      return true
    },
    [land, onThrown, enter],
  )

  const rollDamage = useCallback(
    async (request: SheetDamageRoll): Promise<boolean> => {
      const {
        label,
        critical = false,
        healing = false,
        exact = false,
        modifiers,
        perDie = 1,
      } = request
      // Changed as the player chose: the game's dice take as many more for each die added as it
      // throws for each; those rolled here are doubled after, for a critical hit, or made a
      // critical hit's as the world's rules make one, where they're given, or as dnd5e makes one
      // by default, where it adds anything; with what it adds, either way.
      const changed = withModifiers(
        request.parts,
        modifiers,
        exact ? perDie : 1,
      )
      const { criticalAdds } = request
      const rule = critical
        ? (request.criticalRule ?? (criticalAdds && EVERY_DIE_TWICE))
        : undefined
      const parts = rule ? criticalParts(changed, rule, criticalAdds) : changed
      // As dnd5e rolls a critical hit by default: twice the dice, the same numbers added. Dice
      // the game gave, or made as its rules make them, are thrown as they are.
      const doubled = critical && !exact && !rule
      const dice = parts.flatMap(({ terms }) =>
        terms.filter(term => 'sides' in term),
      )
      const maximized = modifiers?.maximize === true
      const pools = dice.map(({ count, sides }) => ({
        count: doubled ? count * 2 : count,
        sides,
      }))
      const flags = { critical, healing, doubled, maximized }
      // The player's own dice, every one the app would throw; but none at their highest, which the
      // game makes so itself, nor of damage whose dice only the game knows.
      if (enter && !maximized && dice.length > 0) {
        const typedDamage = (values: number[][]) => {
          const none = noRethrows()
          const result = typedResult(pools, values)
          const damage = toLocalDamage(label, parts, result, flags, none.more)
          return { result, damage, asked: none.asked }
        }
        const values = await enter({
          title: label,
          terms: damageEntryTerms(parts, doubled),
          total: values => typedDamage(typedSoFar(values)).damage.total,
        })
        if (!values) return false
        const { result, damage, asked } = typedDamage(values)
        damage.typed = true
        if (request.text) damage.described = true
        if (rule?.altered || asked() || request.gameTotal) {
          damage.gameTotal = true
        }
        onDamageThrown?.({ ...request, parts }, damage)
        await land(result, damage, false)
        return true
      }
      const options = maximized ? { rng: HIGHEST } : undefined
      const result = executeRoll({ pools, modifier: 0 }, options)
      // The dice Foundry would throw again, rerolled or exploded, thrown after the first throw.
      const again = rethrows(options)
      const damage = toLocalDamage(label, parts, result, flags, again.more)
      if (request.text) damage.described = true
      if (
        rule?.altered ||
        damage.parts.some(part => rethrown(part.terms)) ||
        request.gameTotal
      ) {
        damage.gameTotal = true
      }
      onDamageThrown?.({ ...request, parts }, damage)
      await land(again.with(result), damage)
      return true
    },
    [land, onDamageThrown, enter],
  )

  const rollFormula = useCallback(
    async (request: SheetFormulaRoll): Promise<boolean> => {
      // A formula is a set of one, thrown once.
      const sets = request.sets ?? [{ terms: request.terms, times: 1 }]
      // Every set's dice in one throw, each set's terms' dice thrown as many times as it is.
      const pools = sets.flatMap(({ terms, times }) =>
        terms.flatMap(term =>
          'sides' in term
            ? [{ count: term.count * times, sides: term.sides }]
            : [],
        ),
      )
      // The player's own dice, each set's as many times as it's thrown.
      if (enter && pools.length > 0) {
        const typedFormula = (values: number[][]) => {
          const none = noRethrows()
          const result = typedResult(pools, values)
          const rolled = toLocalFormula(request, sets, result, none.more)
          return { result, rolled, asked: none.asked }
        }
        const values = await enter({
          title: request.label,
          terms: formulaEntryTerms(request, sets),
          total: values => typedFormula(typedSoFar(values)).rolled.total,
        })
        if (!values) return false
        const { result, rolled, asked } = typedFormula(values)
        rolled.typed = true
        if (asked()) rolled.gameTotal = true
        onFormulaThrown?.(request, rolled)
        await land(result, rolled, false)
        return true
      }
      const result = executeRoll({ pools, modifier: 0 })
      // The dice Foundry would throw again, rerolled or exploded, thrown after the first throw:
      // only a formula thrown once has any, never hit dice.
      const again = rethrows()
      const rolled = toLocalFormula(request, sets, result, again.more)
      onFormulaThrown?.(request, rolled)
      await land(again.with(result), rolled)
      return true
    },
    [land, onFormulaThrown, enter],
  )

  // Keeps a spell or feature used, first among the rolls.
  const logUse = useCallback(
    (label: string, spell: boolean, itemCast?: boolean): LocalUse => {
      const used: LocalUse = {
        kind: 'use',
        id: `use-${Date.now()}-${++uses}`,
        label,
        spell,
        ...(itemCast && { itemCast }),
        at: Date.now(),
      }
      setRolls(earlier => keeping(earlier, used))
      return used
    },
    [],
  )

  // Keeps an enchantment ended, first among the rolls, as a use is.
  const logEnd = useCallback((label: string): LocalUse => {
    const ended: LocalUse = {
      kind: 'use',
      id: `use-${Date.now()}-${++uses}`,
      label,
      spell: false,
      ending: true,
      at: Date.now(),
    }
    setRolls(earlier => keeping(earlier, ended))
    return ended
  }, [])

  // Keeps charges spent, or Heroic Inspiration used or gained, first among the rolls, as a use is.
  const logCharge = useCallback(
    (
      label: string,
      change: Pick<LocalUse, 'spent' | 'inspiration'>,
    ): LocalUse => {
      const changed: LocalUse = {
        kind: 'use',
        id: `use-${Date.now()}-${++uses}`,
        label,
        spell: false,
        ...(change.spent !== undefined && { spent: change.spent }),
        ...(change.inspiration && { inspiration: change.inspiration }),
        at: Date.now(),
      }
      setRolls(earlier => keeping(earlier, changed))
      return changed
    },
    [],
  )

  // Keeps items or coins moved, from module 0.31.0, first among the rolls, as a use is.
  const logMove = useCallback((move: LocalMove): LocalUse => {
    const moved: LocalUse = {
      kind: 'use',
      id: `use-${Date.now()}-${++uses}`,
      label: move.things,
      spell: false,
      move,
      at: Date.now(),
    }
    setRolls(earlier => keeping(earlier, moved))
    return moved
  }, [])

  // Keeps the table asked for a saving throw or check, first among the rolls.
  const logAsk = useCallback((label: string): LocalAsk => {
    const asked: LocalAsk = {
      kind: 'ask',
      id: `ask-${Date.now()}-${++uses}`,
      label,
      at: Date.now(),
    }
    setRolls(earlier => keeping(earlier, asked))
    return asked
  }, [])

  return {
    roll,
    rollDamage,
    rollFormula,
    logUse,
    logEnd,
    logCharge,
    logMove,
    logAsk,
    rolls,
    rolling: inFlight > 0,
  }
}

function toLocalRoll(
  label: string,
  result: RollResult,
  extras: ExtraTerm[],
  extra: RollResult | undefined,
): LocalCheck {
  const [d20] = result.pools
  // The extra dice's pools are in the order their terms were written.
  const pools = [...(extra?.pools ?? [])]
  const added = extras.map(term => {
    const values = 'sides' in term ? (pools.shift()?.kept ?? []) : []
    const amount =
      'sides' in term
        ? values.reduce((sum, value) => sum + value, 0)
        : term.flat
    return {
      text: formatExtraTerm(term),
      values,
      value: term.sign * amount,
    }
  })
  return {
    kind: 'check',
    id: result.id,
    label,
    total: added.reduce((total, { value }) => total + value, result.total),
    modifier: result.modifier,
    advantage: result.advantage,
    d20s: d20.rolls[0],
    natural: d20.kept[0],
    extras: added,
    at: result.at,
  }
}

/**
 * A hit die spent, or a formula rolled, as this page keeps it, from its dice as thrown: each set's
 * pools in the order their sets and terms were written, each with every time's dice, the first's
 * first.
 * @param more - Throws the dice Foundry would throw again, rerolled or exploded.
 */
function toLocalFormula(
  request: SheetFormulaRoll,
  sets: NonNullable<SheetFormulaRoll['sets']>,
  result: RollResult,
  more: More,
): LocalFormula {
  const { label, healing = false, minimum } = request
  const pools = [...result.pools]
  const thrown = sets.map(({ terms }) =>
    terms.map(term => ('sides' in term ? (pools.shift()?.kept ?? []) : [])),
  )
  // Only a formula thrown once has dice thrown again, never hit dice.
  const kept: LocalExtra[] = request.sets
    ? setTerms(sets, thrown)
    : request.terms.map((term, index) => {
        const text = damageTerm(term, {
          first: index === 0,
          doubled: false,
        })
        if (!('sides' in term)) {
          return { text, values: [], value: term.sign * term.flat }
        }
        const done = landTerm(term, thrown[0][index], more)
        return { text, ...done.extra, value: term.sign * done.amount }
      })
  const sum = kept.reduce((total, { value }) => total + value, 0)
  const totals = request.sets
    ? formulaTotals(sets, thrown, minimum)
    : [minimum === undefined ? sum : Math.max(minimum, sum)]
  const total = totals.reduce((all, each) => all + each, 0)
  return {
    kind: 'formula',
    id: result.id,
    label,
    total,
    healing,
    terms: kept,
    ...(total !== sum && { minimum }),
    ...(totals.length > 1 && { times: totals.length }),
    ...(request.source?.kind === 'textRoll' && { described: true }),
    ...(rethrown(kept) && { gameTotal: true }),
    at: result.at,
  }
}

/**
 * What each time each set is thrown came to, at least its least, as hit dice spent at once each
 * give back at least 1.
 * @param thrown - Each set's dice, term by term, every time's together, the first's first.
 */
function formulaTotals(
  sets: NonNullable<SheetFormulaRoll['sets']>,
  thrown: number[][][],
  minimum: number | undefined,
): number[] {
  return sets.flatMap(({ terms, times }, set) =>
    Array.from({ length: times }, (_, time) => {
      let sum = 0
      for (const [index, term] of terms.entries()) {
        const amount =
          'sides' in term
            ? thrown[set][index]
                .slice(time * term.count, (time + 1) * term.count)
                .reduce((sum, value) => sum + value, 0)
            : term.flat
        sum += term.sign * amount
      }
      return minimum === undefined ? sum : Math.max(minimum, sum)
    }),
  )
}

/** What's typed in so far, each term's dice as typed, those not yet left out. */
function typedSoFar(values: (number | undefined)[][]): number[][] {
  return values.map(term =>
    term.filter((value): value is number => value !== undefined),
  )
}

/**
 * Damage's dice for the player to type in: each term's, its count doubled where the app doubles
 * it, named as the tray writes it, with its part's kind, such as "2d6 Slashing" or "−1d4".
 */
function damageEntryTerms(
  parts: SheetDamageRoll['parts'],
  doubled: boolean,
): DiceEntryTerm[] {
  let first = true
  return parts.flatMap(({ terms, type }) =>
    terms.flatMap(term => {
      const text = damageTerm(term, { first, doubled })
      first = false
      if (!('sides' in term)) return []
      return [
        {
          sides: term.sides,
          count: doubled ? term.count * 2 : term.count,
          label: type ? `${text} ${type}` : text,
        },
      ]
    }),
  )
}

/**
 * A formula's dice for the player to type in: each term's, as the tray writes it; or, thrown in
 * sets, as hit dice spent at once are, each set's term's every time's together, such as "2d10".
 */
function formulaEntryTerms(
  request: SheetFormulaRoll,
  sets: NonNullable<SheetFormulaRoll['sets']>,
): DiceEntryTerm[] {
  if (!request.sets) {
    return request.terms.flatMap((term, index) =>
      'sides' in term
        ? [
            {
              sides: term.sides,
              count: term.count,
              label: damageTerm(term, { first: index === 0, doubled: false }),
            },
          ]
        : [],
    )
  }
  const terms: DiceEntryTerm[] = []
  for (const { terms: each, times } of sets) {
    for (const term of each) {
      if (!('sides' in term)) continue
      const count = term.count * times
      terms.push({
        sides: term.sides,
        count,
        label: damageTerm(
          { ...term, count },
          { first: terms.length === 0, doubled: false },
        ),
      })
    }
  }
  return terms
}

/**
 * Throws so many more of a die, for one Foundry rerolls or explodes, which `throwTerm` asks for one
 * at a time.
 */
type More = (sides: DieSides) => (count: number) => number[]

/**
 * No dice thrown again: the player's are typed in, and Foundry throws its rerolls itself. Whether
 * any was asked for says the game's total counts, once it says.
 */
function noRethrows() {
  let asked = false
  const none = (): number[] => {
    asked = true
    return []
  }
  const more: More = () => none
  return { more, asked: () => asked }
}

/**
 * The dice thrown again, rerolled or exploded, after the first throw: `more` throws them, as the
 * first throw was, and `with` adds them to it, to be thrown with it, as extra dice are.
 */
function rethrows(options?: ExecuteRollOptions) {
  const pools: DiePool[] = []
  const more: More = sides => count => {
    const thrown = executeRoll(
      { pools: [{ sides, count }], modifier: 0 },
      options,
    )
    pools.push(...thrown.pools)
    return thrown.pools[0]?.kept ?? []
  }
  return {
    more,
    with: (result: RollResult): RollResult =>
      pools.length > 0
        ? { ...result, pools: [...result.pools, ...pools] }
        : result,
  }
}

/**
 * A term of dice as it landed: what its dice count for, as Foundry works out any modifiers they
 * have, such as 2d6r<=2's reroll, which throws more after; its first throw, and every die thrown
 * where it has modifiers.
 */
function landTerm(
  term: ExtraDice,
  values: number[],
  more: More,
): { amount: number; extra: Pick<LocalExtra, 'values' | 'thrown'> } {
  if (!term.modifiers?.length) {
    return {
      amount: values.reduce((sum, value) => sum + value, 0),
      extra: { values },
    }
  }
  const thrown = throwTerm(term, values, more(term.sides))
  return {
    amount: thrown.total,
    extra: { values, thrown: thrown.dice },
  }
}

/** Was any die of these terms rerolled or exploded, which Foundry throws again itself? */
function rethrown(terms: LocalExtra[]): boolean {
  return terms.some(({ thrown }) =>
    thrown?.some(die => die.rerolled || die.exploded),
  )
}

function toLocalDamage(
  label: string,
  parts: SheetDamageRoll['parts'],
  result: RollResult,
  {
    critical,
    healing,
    doubled,
    maximized,
  }: {
    critical: boolean
    healing: boolean
    doubled: boolean
    maximized: boolean
  },
  more: More,
): LocalDamage {
  // The dice's pools are in the order their terms were written.
  const pools = [...result.pools]
  let first = true
  const kept = parts.map(({ terms, type }) => {
    const done = terms.map((term): LocalExtra => {
      const text = damageTerm(term, { first, doubled })
      first = false
      if (!('sides' in term)) {
        return { text, values: [], value: term.sign * term.flat }
      }
      const landed = landTerm(term, pools.shift()?.kept ?? [], more)
      return { text, ...landed.extra, value: term.sign * landed.amount }
    })
    return {
      type,
      total: done.reduce((sum, { value }) => sum + value, 0),
      terms: done,
    }
  })
  // As dnd5e's card adds damage up: each kind's parts together, each kind at least 0, then every
  // kind; each part's own total as it came.
  const kinds = new Map<string | null, number>()
  for (const { type, total } of kept) {
    kinds.set(type, (kinds.get(type) ?? 0) + total)
  }
  return {
    kind: 'damage',
    id: result.id,
    label,
    total: [...kinds.values()].reduce(
      (sum, kind) => sum + Math.max(0, kind),
      0,
    ),
    critical,
    healing,
    ...(maximized && { maximized }),
    parts: kept,
    at: result.at,
  }
}

/**
 * Sets thrown at once, as hit dice spent at once, term by term: each set's dice, every time's
 * together, such as 2d10, then +1d8, in order; then all of their numbers added up, such as +9,
 * where they come to any.
 */
function setTerms(
  sets: NonNullable<SheetFormulaRoll['sets']>,
  thrown: number[][][],
): LocalExtra[] {
  const dice: LocalExtra[] = []
  let flat = 0
  for (const [set, { terms, times }] of sets.entries()) {
    for (const [index, term] of terms.entries()) {
      if (!('sides' in term)) {
        flat += term.sign * term.flat * times
        continue
      }
      const values = thrown[set][index]
      dice.push({
        text: damageTerm(
          { ...term, count: term.count * times },
          { first: dice.length === 0, doubled: false },
        ),
        values,
        value: term.sign * values.reduce((sum, value) => sum + value, 0),
      })
    }
  }
  if (flat === 0) return dice
  return [
    ...dice,
    {
      text: damageTerm(
        { sign: flat < 0 ? -1 : 1, flat: Math.abs(flat) },
        { first: dice.length === 0, doubled: false },
      ),
      values: [],
      value: flat,
    },
  ]
}

/**
 * A term of a damage roll as thrown: 1d8 first, then +4 or −1d4, its dice doubled on a crit, with
 * what Foundry does with them, such as 2d6r<=2.
 */
function damageTerm(
  term: ExtraTerm,
  { first, doubled }: { first: boolean; doubled: boolean },
): string {
  let sign = first ? '' : '+'
  if (term.sign < 0) sign = '−'
  if ('flat' in term) return `${sign}${term.flat}`
  const count = doubled ? term.count * 2 : term.count
  return `${sign}${count}d${term.sides}${term.modifiers?.join('') ?? ''}`
}

/**
 * The rolls kept, and another, newest first by when each was thrown rather than when its dice
 * landed: a roll thrown while the dice of one before it still tumble is the latest, should they
 * land after it.
 */
function keeping(earlier: LocalRoll[], roll: LocalRoll): LocalRoll[] {
  return [roll, ...earlier]
    .toSorted((a, b) => b.at - a.at)
    .slice(0, ROLL_HISTORY)
}

/** Wait for a promise, but no longer than this many milliseconds. */
async function within(promise: Promise<unknown>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise(resolve => {
    timer = setTimeout(resolve, ms)
  })
  try {
    await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}
