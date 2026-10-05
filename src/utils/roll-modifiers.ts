import { DIE_SIDES, type DieSides } from '@lambersond/3d-dice-core'

/** Dice added to or taken from a roll, such as +1d4 for Bless or −1d6. */
export type ExtraDice = { sign: 1 | -1; count: number; sides: DieSides }

/** A flat number added to or taken from a roll. */
export type ExtraFlat = { sign: 1 | -1; flat: number }

export type ExtraTerm = ExtraDice | ExtraFlat

export type ParseExtrasResult =
  { ok: true; terms: ExtraTerm[] } | { ok: false; error: string }

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
    const signed = sign === '-' ? -1 : 1
    if (flat === undefined) {
      const dice = count ? Number(count) : 1
      const die = Number(sides)
      if (!(DIE_SIDES as readonly number[]).includes(die)) {
        return {
          ok: false,
          error: `There's no d${die}. Use d4, d6, d8, d10, d12, d20 or d100.`,
        }
      }
      if (dice < 1 || dice > MAX_DICE) {
        return {
          ok: false,
          error: `Roll between 1 and ${MAX_DICE} of a die at once.`,
        }
      }
      terms.push({ sign: signed, count: dice, sides: die as DieSides })
    } else {
      const value = Number(flat)
      if (value > MAX_FLAT) {
        return { ok: false, error: `Add at most ${MAX_FLAT} at once.` }
      }
      terms.push({ sign: signed, flat: value })
    }
    index = TERM.lastIndex
  }
  return { ok: true, terms }
}

/** A term as the player would write it, with a sign: +1d4, −1d6, +5. */
export function formatExtraTerm(term: ExtraTerm): string {
  const sign = term.sign < 0 ? '−' : '+'
  return 'flat' in term
    ? `${sign}${term.flat}`
    : `${sign}${term.count}d${term.sides}`
}

function unreadable(rest: string): string {
  const shown = rest.trim().split(/\s+/, 1)[0]
  return `Couldn't read “${shown}”. Try 1d4, -1d6 or +5.`
}
