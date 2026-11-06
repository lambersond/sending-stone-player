import { MOST_HIT_POINTS } from '@/constants/sending-stone'
import type { HitPointsKey, HitPointsPair } from './types'
import type { HitPointsInput } from '@/types/roll'
import type { HitPointsNow } from '@/types/sending-stone'

// The rules and words of the hit points editor (module 0.44.0): the numbers each field takes, the
// change Save sends, from what the tile showed, and what its live line and its tile say.

/**
 * The most a field takes: hit points their maximum, where the sheet has one, never below what
 * they are now, so that opening the editor over a sheet above its maximum changes nothing;
 * temporary hit points, as many as the game takes, 9999.
 */
export function mostOf(key: HitPointsKey, hp: HitPointsNow): number {
  if (key === 'temp' || hp.max === null) return MOST_HIT_POINTS
  return Math.min(MOST_HIT_POINTS, Math.max(hp.max, hp.value))
}

/**
 * What a field's text comes to, as a number from 0 to its most; a text with no number in it, as
 * one cleared to type another, what the field was.
 */
export function clampDraft(text: string, was: number, most: number): number {
  const typed = Number.parseInt(text, 10)
  if (Number.isNaN(typed)) return was
  return Math.min(Math.max(typed, 0), most)
}

/**
 * The change Save sends, of the fields whose number differs from the sheet's, each with what the
 * sheet said of it (`from`), as the game makes it only from those; none where nothing changed.
 */
export function hitPointsEdit(
  hp: HitPointsNow,
  wanted: HitPointsPair<number>,
): HitPointsInput | undefined {
  const value = wanted.value === hp.value ? undefined : wanted.value
  const temp = wanted.temp === hp.temp ? undefined : wanted.temp
  if (value === undefined && temp === undefined) return
  return {
    op: 'set',
    ...(value !== undefined && { value }),
    ...(temp !== undefined && { temp }),
    from: {
      ...(value !== undefined && { value: hp.value }),
      ...(temp !== undefined && { temp: hp.temp }),
    },
  }
}

/** The numbers as the editor's line says them: "22 / 30 · 3 temporary", "22 · 0 temporary". */
function numbersOf({ value, max, temp }: HitPointsNow): string {
  return `${value}${max === null ? '' : ` / ${max}`} · ${temp} temporary`
}

/**
 * A change as the editor's line says it, each field set from what to what: "22 → 21 · temporary
 * 3 → 0", "22 → 21", or temporary ones alone, "Temporary 3 → 0".
 */
function changeOf({ value, temp, from }: HitPointsInput): string {
  const temporary = temp === undefined ? '' : `${from.temp} → ${temp}`
  if (value === undefined) return `Temporary ${temporary}`
  const hp = `${from.value} → ${value}`
  return temporary ? `${hp} · temporary ${temporary}` : hp
}

/**
 * What the editor's live line says: the change, once there is one; else, where the game's numbers
 * changed while it was open, that they did, and what they are now, "Changed in the game: now 15 /
 * 30 · 0 temporary"; else what they are, "Now 22 / 30 · 3 temporary".
 */
export function editorLine(
  hp: HitPointsNow,
  change: HitPointsInput | undefined,
  rebased: boolean,
): string {
  if (change) return changeOf(change)
  if (rebased) return `Changed in the game: now ${numbersOf(hp)}`
  return `Now ${numbersOf(hp)}`
}

/**
 * The tile's name, as a button that opens the editor: "Hit points: 22 of 30, 3 temporary. Change
 * hit points", leaving out a maximum the sheet hasn't, and temporary ones it has none of.
 */
export function tileName({ value, max, temp }: HitPointsNow): string {
  const of = max === null ? '' : ` of ${max}`
  const temporary = temp > 0 ? `, ${temp} temporary` : ''
  return `Hit points: ${value}${of}${temporary}. Change hit points`
}

/** Whether the game's numbers differ from those the editor was opened at, or last reset to. */
export function movedFrom(hp: HitPointsNow, base: HitPointsNow): boolean {
  return hp.value !== base.value || hp.temp !== base.temp || hp.max !== base.max
}
