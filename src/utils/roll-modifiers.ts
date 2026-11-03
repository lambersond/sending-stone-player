import { isDieSides } from '@/utils/dice'
import type { ParseExtrasResult, ExtraTerm } from '@/types/roll'

/** The most of one die a term may throw. */
export const MAX_DICE = 20

/** The largest flat number a term may add. */
export const MAX_FLAT = 100

// A sign or a comma (or the start) and then dice such as 2d6, or a number.
const TERM = /\s*(,)?\s*([+-])?\s*(?:(\d*)\s*d\s*(\d+)|(\d+))\s*/iy

/**
 * Read what a player adds to a roll, such as "1d4", "-1d6", "+5" or "1d4 + 2, -1". Terms after the
 * first need a sign or a comma between them, which counts as a plus.
 */
export function parseExtraTerms(input: string): ParseExtrasResult {
  const text = input.replaceAll('−', '-').trim()
  const terms: ExtraTerm[] = []
  let index = 0
  while (index < text.length) {
    TERM.lastIndex = index
    const match = TERM.exec(text)
    const [, comma, sign, count, sides, flat] = match ?? []
    const joined = terms.length === 0 ? !comma : Boolean(comma || sign)
    if (!match || !joined) {
      return { ok: false, error: unreadable(text.slice(index)) }
    }
    const term = extraTerm(sign === '-' ? -1 : 1, { count, sides, flat })
    if ('error' in term) return { ok: false, error: term.error }
    terms.push(term)
    index = TERM.lastIndex
  }
  return { ok: true, terms }
}

/**
 * A term the player added, as `TERM` reads it: its dice or its number, with its sign; or why it
 * can't be rolled: a die there's none of, too many dice, or too large a number.
 */
function extraTerm(
  signed: 1 | -1,
  { count, sides, flat }: { count?: string; sides?: string; flat?: string },
): ExtraTerm | { error: string } {
  if (flat === undefined) {
    const dice = count ? Number(count) : 1
    const die = Number(sides)
    if (!isDieSides(die)) {
      return {
        error: `There's no d${die}. Use d4, d6, d8, d10, d12, d20 or d100.`,
      }
    }
    if (dice < 1 || dice > MAX_DICE) {
      return { error: `Roll between 1 and ${MAX_DICE} of a die at once.` }
    }
    return { sign: signed, count: dice, sides: die }
  }
  const value = Number(flat)
  if (value > MAX_FLAT) {
    return { error: `Add at most ${MAX_FLAT} at once.` }
  }
  return { sign: signed, flat: value }
}

/** A term as the player would write it, with a sign: +1d4, −1d6, +5, or a sheet's +2d6r<=2. */
export function formatExtraTerm(term: ExtraTerm): string {
  const sign = term.sign < 0 ? '−' : '+'
  return 'flat' in term
    ? `${sign}${term.flat}`
    : `${sign}${term.count}d${term.sides}${term.modifiers?.join('') ?? ''}`
}

function unreadable(rest: string): string {
  const shown = rest.trim().split(/\s+/, 1)[0]
  return `Couldn't read “${shown}”. Try 1d4, -1d6 or +5.`
}
