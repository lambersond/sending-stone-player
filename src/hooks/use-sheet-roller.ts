'use client'

import { useCallback, useState } from 'react'
import {
  CUSTOM_COLORSET_KEY,
  executeRoll,
  themeToBoxConfig,
  toDiceBoxNotation,
  type Advantage,
  type RollResult,
} from '@lambersond/3d-dice-core'
import { useDiceRenderer } from '@lambersond/3d-dice-react'
import { withModifiers, type DamageModifiers } from '@/utils/damage-modifiers'
import { formatExtraTerm, type ExtraTerm } from '@/utils/roll-modifiers'
import type { FormulaSource, RollSource, TextLink } from '@/types/roll'

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
   * For a saving throw or check a description calls for, the DC it names, which it's made against.
   */
  dc?: number
}

/** Damage or healing from the character's sheet, such as a weapon's. */
export type SheetDamageRoll = {
  /** What is rolled, such as "Longsword damage". */
  label: string
  /** Each part of the formula, with its kind of damage, such as "Slashing". */
  parts: { terms: ExtraTerm[]; type: string | null }[]
  /** A critical hit, which rolls every die twice. */
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
  /** For damage or healing a description deals, its link, for the game to roll it too. */
  text?: TextLink
}

/**
 * Dice and numbers with no d20, from the character's sheet: a hit die spent, or an item's
 * activity's own formula, such as a light's radius.
 */
export type SheetFormulaRoll = {
  /** What is rolled, such as "Hit die (d10)". */
  label: string
  /** Its terms, in order, such as 1d10 and +2. */
  terms: ExtraTerm[]
  /** Hit points given back, as a hit die's are. */
  healing?: boolean
  /** The least it comes to, as a hit die spent gives back at least 1. */
  minimum?: number
  /**
   * How many of it are thrown together, each coming to its own total, at least its least, as hit
   * dice spent at once are; one unless said.
   */
  times?: number
  /** What it is, for the Gamemaster's game to make it too. */
  source?: FormulaSource
}

/** Something the player added to a roll, or a term of a damage roll, and what it came to. */
export type LocalExtra = {
  /** As written, with its sign: +1d4, −1d6, +5. */
  text: string
  /** Each die's result; empty for a flat number. */
  values: number[]
  /** What it adds to the total: negative for a term taken away. */
  value: number
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
  /** For a saving throw or check a description calls for, the DC it names. */
  dc?: number
  /**
   * For a saving throw or check a description calls for, what it's said to do when it reaches its
   * DC: a saving throw is saved, as one is unless it says, and a check passed.
   */
  verdict?: 'save' | 'check'
  /** Rolled from a link in a description. */
  described?: boolean
  at: number
}

/** A damage or healing roll as this page keeps it. */
export type LocalDamage = {
  kind: 'damage'
  id: string
  label: string
  total: number
  critical: boolean
  healing: boolean
  /** Every die at its highest, as the player chose. */
  maximized?: boolean
  /** Each part of the formula, with what it came to. */
  parts: { type: string | null; total: number; terms: LocalExtra[] }[]
  /** Rolled from a link in a description. */
  described?: boolean
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
  at: number
}

/** A hit die spent, or a formula rolled, as this page keeps it. */
export type LocalFormula = {
  kind: 'formula'
  id: string
  label: string
  total: number
  healing: boolean
  /** Each term, with what it came to: for several thrown together, all of theirs as one. */
  terms: LocalExtra[]
  /**
   * The least it comes to, when its dice and numbers came to less; for several thrown together,
   * the least each does, when one of them came to less.
   */
  minimum?: number
  /** How many of it were thrown together, as hit dice spent at once, where more than one. */
  times?: number
  /** Rolled from a link in a description. */
  described?: boolean
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

/** A roll as this page keeps it, or a use, or an ask. */
export type LocalRoll =
  LocalCheck | LocalDamage | LocalUse | LocalFormula | LocalAsk

/** How many uses and asks this page has kept, for their ids. */
let uses = 0

/**
 * Rolls checks, saves, attacks and damage from the player's character sheet, tumbling 3D dice
 * across the screen. Each result is revealed once the dice land on it, and kept on this page, as
 * are the spells and features used, which throw no dice. Must be used within a
 * DiceRendererProvider.
 * @param onThrown - Told of each check or save as its dice are thrown, before they land, with
 * what they came to: to have the Gamemaster's game make it too.
 * @param onDamageThrown - The same, for damage.
 * @param onFormulaThrown - The same, for a hit die or a formula.
 */
export function useSheetRoller(
  onThrown?: (roll: SheetRoll, check: LocalCheck) => void,
  onDamageThrown?: (roll: SheetDamageRoll, damage: LocalDamage) => void,
  onFormulaThrown?: (roll: SheetFormulaRoll, rolled: LocalFormula) => void,
) {
  const renderer = useDiceRenderer()
  const [rolls, setRolls] = useState<LocalRoll[]>([])
  const [inFlight, setInFlight] = useState(0)

  // Throws the dice already rolled, then keeps what they came to.
  const land = useCallback(
    async (thrown: RollResult, kept: LocalRoll) => {
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
    async (request: SheetRoll) => {
      const { label, modifier, advantage, extras = [] } = request
      const result = executeRoll({
        pools: [{ sides: 20, count: 1 }],
        modifier,
        advantage,
      })
      // Extra dice are rolled on their own, since advantage applies only to the check's d20,
      // and thrown with it.
      const dice = extras.filter(term => 'sides' in term)
      const extra =
        dice.length > 0
          ? executeRoll({
              pools: dice.map(({ count, sides }) => ({ count, sides })),
              modifier: 0,
            })
          : undefined
      const thrown = extra
        ? { ...result, pools: [...result.pools, ...extra.pools] }
        : result
      const check = toLocalRoll(label, result, extras, extra)
      const { source } = request
      if (request.dc !== undefined) check.dc = request.dc
      if (source && 'text' in source && source.text) {
        check.described = true
        // Against its DC, which the game may know where the description keeps it from the player.
        if (CHECKS.has(source.kind)) check.verdict = 'check'
      }
      onThrown?.(request, check)
      await land(thrown, check)
    },
    [land, onThrown],
  )

  const rollDamage = useCallback(
    async (request: SheetDamageRoll) => {
      const {
        label,
        critical = false,
        healing = false,
        exact = false,
        modifiers,
        perDie = 1,
      } = request
      // Changed as the player chose: the game's dice take as many more for each die added as it
      // throws for each; those rolled here are doubled after, for a critical hit.
      const parts = withModifiers(request.parts, modifiers, exact ? perDie : 1)
      // As dnd5e rolls a critical hit by default: twice the dice, the same numbers added. Dice
      // the game gave are thrown as they are.
      const doubled = critical && !exact
      const dice = parts.flatMap(({ terms }) =>
        terms.filter(term => 'sides' in term),
      )
      const maximized = modifiers?.maximize === true
      const result = executeRoll(
        {
          pools: dice.map(({ count, sides }) => ({
            count: doubled ? count * 2 : count,
            sides,
          })),
          modifier: 0,
        },
        maximized ? { rng: HIGHEST } : undefined,
      )
      const damage = toLocalDamage(label, parts, result, {
        critical,
        healing,
        doubled,
        maximized,
      })
      if (request.text) damage.described = true
      onDamageThrown?.({ ...request, parts }, damage)
      await land(result, damage)
    },
    [land, onDamageThrown],
  )

  const rollFormula = useCallback(
    async (request: SheetFormulaRoll) => {
      const { label, terms, healing = false, minimum, times = 1 } = request
      const dice = terms.filter(term => 'sides' in term)
      // Several thrown together throw each term's dice that many times, in one throw.
      const result = executeRoll({
        pools: dice.map(({ count, sides }) => ({
          count: count * times,
          sides,
        })),
        modifier: 0,
      })
      // The dice's pools are in the order their terms were written, each with every copy's dice,
      // the first's first.
      const pools = [...result.pools]
      const thrown = terms.map(term =>
        'sides' in term ? (pools.shift()?.kept ?? []) : [],
      )
      // What each copy came to, at least its least.
      const totals = Array.from({ length: times }, (_, copy) => {
        let sum = 0
        for (const [index, term] of terms.entries()) {
          const amount =
            'sides' in term
              ? thrown[index]
                  .slice(copy * term.count, (copy + 1) * term.count)
                  .reduce((sum, value) => sum + value, 0)
              : term.flat
          sum += term.sign * amount
        }
        return minimum === undefined ? sum : Math.max(minimum, sum)
      })
      const kept = terms.map((term, index) => {
        const values = thrown[index]
        const amount =
          'sides' in term
            ? values.reduce((sum, value) => sum + value, 0)
            : term.flat * times
        const all =
          'sides' in term
            ? { ...term, count: term.count * times }
            : { ...term, flat: term.flat * times }
        return {
          text: damageTerm(all, { first: index === 0, doubled: false }),
          values,
          value: term.sign * amount,
        }
      })
      const sum = kept.reduce((total, { value }) => total + value, 0)
      const total = totals.reduce((all, each) => all + each, 0)
      const rolled: LocalFormula = {
        kind: 'formula',
        id: result.id,
        label,
        total,
        healing,
        terms: kept,
        ...(total !== sum && { minimum }),
        ...(times > 1 && { times }),
        ...(request.source?.kind === 'textRoll' && { described: true }),
        at: result.at,
      }
      onFormulaThrown?.(request, rolled)
      await land(result, rolled)
    },
    [land, onFormulaThrown],
  )

  // Keeps a spell or feature used, first among the rolls.
  const logUse = useCallback((label: string, spell: boolean): LocalUse => {
    const used: LocalUse = {
      kind: 'use',
      id: `use-${Date.now()}-${++uses}`,
      label,
      spell,
      at: Date.now(),
    }
    setRolls(earlier => keeping(earlier, used))
    return used
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
): LocalDamage {
  // The dice's pools are in the order their terms were written.
  const pools = [...result.pools]
  let first = true
  const kept = parts.map(({ terms, type }) => {
    const done = terms.map(term => {
      const values = 'sides' in term ? (pools.shift()?.kept ?? []) : []
      const amount =
        'sides' in term
          ? values.reduce((sum, value) => sum + value, 0)
          : term.flat
      const text = damageTerm(term, { first, doubled })
      first = false
      return { text, values, value: term.sign * amount }
    })
    return {
      type,
      total: done.reduce((sum, { value }) => sum + value, 0),
      terms: done,
    }
  })
  return {
    kind: 'damage',
    id: result.id,
    label,
    total: kept.reduce((sum, part) => sum + part.total, 0),
    critical,
    healing,
    ...(maximized && { maximized }),
    parts: kept,
    at: result.at,
  }
}

/** A term of a damage roll as thrown: 1d8 first, then +4 or −1d4, its dice doubled on a crit. */
function damageTerm(
  term: ExtraTerm,
  { first, doubled }: { first: boolean; doubled: boolean },
): string {
  let sign = first ? '' : '+'
  if (term.sign < 0) sign = '−'
  if ('flat' in term) return `${sign}${term.flat}`
  return `${sign}${doubled ? term.count * 2 : term.count}d${term.sides}`
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
