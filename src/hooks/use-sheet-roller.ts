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
import { formatExtraTerm, type ExtraTerm } from '@/utils/roll-modifiers'
import type { RollSource } from '@/types/roll'

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
  /** Each part of the formula, with what it came to. */
  parts: { type: string | null; total: number; terms: LocalExtra[] }[]
  at: number
}

/** A roll as this page keeps it. */
export type LocalRoll = LocalCheck | LocalDamage

/**
 * Rolls checks, saves, attacks and damage from the player's character sheet, tumbling 3D dice
 * across the screen. Each result is revealed once the dice land on it, and kept on this page.
 * Must be used within a DiceRendererProvider.
 * @param onThrown - Told of each check or save as its dice are thrown, before they land, with
 * what they came to: to have the Gamemaster's game make it too.
 */
export function useSheetRoller(
  onThrown?: (roll: SheetRoll, check: LocalCheck) => void,
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
      setRolls(earlier => [kept, ...earlier].slice(0, ROLL_HISTORY))
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
      onThrown?.(request, check)
      await land(thrown, check)
    },
    [land, onThrown],
  )

  const rollDamage = useCallback(
    async ({
      label,
      parts,
      critical = false,
      healing = false,
    }: SheetDamageRoll) => {
      // As dnd5e rolls a critical hit by default: twice the dice, the same numbers added.
      const dice = parts.flatMap(({ terms }) =>
        terms.filter(term => 'sides' in term),
      )
      const result = executeRoll({
        pools: dice.map(({ count, sides }) => ({
          count: critical ? count * 2 : count,
          sides,
        })),
        modifier: 0,
      })
      await land(
        result,
        toLocalDamage(label, parts, result, { critical, healing }),
      )
    },
    [land],
  )

  return { roll, rollDamage, rolls, rolling: inFlight > 0 }
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
  { critical, healing }: { critical: boolean; healing: boolean },
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
      const text = damageTerm(term, { first, critical })
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
    parts: kept,
    at: result.at,
  }
}

/** A term of a damage roll as thrown: 1d8 first, then +4 or −1d4, its dice doubled on a crit. */
function damageTerm(
  term: ExtraTerm,
  { first, critical }: { first: boolean; critical: boolean },
): string {
  let sign = first ? '' : '+'
  if (term.sign < 0) sign = '−'
  if ('flat' in term) return `${sign}${term.flat}`
  return `${sign}${critical ? term.count * 2 : term.count}d${term.sides}`
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
