import { seatWords } from '@/utils/seat-words'
import type { HitPointsLogged } from '@/types/roll'
import type { SeatRole } from '@/types/seats'
import type { HitPointsNow } from '@/types/sending-stone'

// How hit points and temporary hit points set from the app (module 0.44.0) are told, in English:
// the change asked, on its way, made, as the game says the numbers are, and refused, with why it
// wasn't made where that differs from a roll's. A companion's name its creature; the character's
// say "your".

/**
 * What was asked, as the tray's line says it, each field set from what to what: "Hit points 22 →
 * 21 · temporary 3 → 0", "Hit points 22 → 21", or temporary ones alone, "Temporary hit points 3 →
 * 0".
 */
export function hitPointsLine({ value, temp, from }: HitPointsLogged): string {
  const temporary = temp === undefined ? '' : `${from.temp} → ${temp}`
  if (value === undefined) return `Temporary hit points ${temporary}`
  const hp = `Hit points ${from.value} → ${value}`
  return temporary ? `${hp} · temporary ${temporary}` : hp
}

/**
 * Whose hit points they are, at the start of a sentence: "Hit points", or a companion's, by name,
 * "Wolf’s hit points".
 */
function whose(name?: string): string {
  return name ? `${name}’s hit points` : 'Hit points'
}

/**
 * What the game says the hit points are once set, as the toast says it: "Hit points now 21 / 30",
 * "Wolf’s hit points now 7 / 11", with " · 3 temporary" where there are any, and no maximum where
 * the sheet has none; "Hit points set" where the game says nothing of them.
 * @param name - A companion's name, at its own pane; none for the character's.
 */
export function hitPointsNowWords(now?: HitPointsNow, name?: string): string {
  if (!now) return name ? `${name}’s hit points set` : 'Hit points set'
  const max = now.max === null ? '' : ` / ${now.max}`
  const temp = now.temp > 0 ? ` · ${now.temp} temporary` : ''
  return `${whose(name)} now ${now.value}${max}${temp}`
}

/**
 * A change of hit points' way to the game, in words: on its way, "Setting it"; made, as the game
 * says the numbers are; and not made, "Couldn’t set your hit points", or a companion's,
 * "Couldn’t set Wolf’s hit points".
 */
export function hitPointsWords(
  now?: HitPointsNow,
  name?: string,
): { doing: string; done: string; not: string } {
  return {
    doing: 'Setting it',
    done: hitPointsNowWords(now, name),
    not: `Couldn’t set ${name ? `${name}’s` : 'your'} hit points`,
  }
}

/**
 * Why hit points weren't set, as the seat reads it, where it differs from a roll's (module 0.44.0):
 * the game doesn't take them, its switch off or its module not fetching; they changed in Foundry
 * since the page showed them, which the page already shows; a module in Foundry stopped the write;
 * or a change to the same hit points is still on its way, as from a second tap. A companion no
 * longer its character's keeps a creature's words.
 */
export function hitPointsReasons(role: SeatRole): Record<string, string> {
  const off = `${seatWords(role).game} doesn’t take hit points from here now`
  return {
    off,
    unavailable: off,
    changed: 'they changed in Foundry; look again',
    cancelled: 'a module in Foundry stopped it',
    moving: 'a change to these hit points is still on its way',
  }
}
