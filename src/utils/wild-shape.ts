import {
  BRIDGE_POLLED_WITHIN,
  ENDING_STATUSES,
} from '@/constants/sending-stone'
import type { WildShapeInput } from '@/types/roll'
import type { CharacterSheet, KnownForm } from '@/types/sending-stone'

// How this app reads a druid's Wild Shape (module 0.40.0) before the Gamemaster's module is sent a
// change, a return or a form learned: whether the campaign lets its players now, and whether the
// sheet, as last sent, lets her do it. The module checks it all again, live, in the game, by the
// 2024 rules and the campaign's compendiums; these checks only spare a player one the game would
// refuse, and tell them why before a round trip. And the few words the server and the screens both
// need: "a" or "an" before a form, its hours, and the time it has left.

/** What these checks read of a sheet, as last sent. */
type ShapedSheet = Partial<
  Pick<CharacterSheet, 'form' | 'wildShape' | 'hp' | 'conditions'>
>

/** Why the sheet, as last sent, says the game would refuse a Wild Shape command. */
export type WildShapeRefusal =
  | 'gone'
  | 'form'
  | 'transformed'
  | 'incapacitated'
  | 'consume'
  | 'not-shaped'
  | 'full'
  | 'shaped'
  | 'swap'

/**
 * Whether a campaign's players may use Wild Shape from here now: its module says the campaign lets
 * them, and is fetching, as `effectsAvailable` reads it of effects.
 */
export function wildShapeAvailable(
  campaign: { wildShapeEnabled: boolean; bridgePolledAt: Date | null },
  now = Date.now(),
): boolean {
  const polled = campaign.bridgePolledAt?.getTime()
  return (
    campaign.wildShapeEnabled === true &&
    !!polled &&
    now - polled < BRIDGE_POLLED_WITHIN
  )
}

/** Whether the character is transformed now, as its sheet says: its numbers are the form's. */
export function isShaped(sheet?: ShapedSheet | null): boolean {
  return !!sheet?.form
}

/**
 * Whether the character can take no Bonus Action now, as its sheet says, so can't use Wild Shape:
 * at 0 hit points, or with a condition that leaves it Incapacitated, or dead.
 */
export function isIncapacitated(sheet?: ShapedSheet | null): boolean {
  const hp = sheet?.hp?.value
  if (typeof hp === 'number' && hp <= 0) return true
  return (sheet?.conditions ?? []).some(
    ({ id }) =>
      id === 'dead' || (ENDING_STATUSES as readonly string[]).includes(id),
  )
}

/**
 * Whether a known form can be taken from here: one from the campaign's compendiums, that fits the
 * rules for her now, and that the game still finds. Any other is used only in Foundry.
 */
export function usableForm(known: KnownForm): boolean {
  return known.pool && known.fits === true && known.found !== false
}

/**
 * Whether the seat may return the character from here, as far as its sheet says: a 2024 Wild Shape
 * the module times, on a druid whose sheet has her Wild Shape. Any other form ends in Foundry.
 */
export function canReturn(sheet?: ShapedSheet | null): boolean {
  const form = sheet?.form
  return (
    form?.kind === 'wildShape' && form.hours != undefined && !!sheet?.wildShape
  )
}

/**
 * Whether the sheet, as last sent, lets the character's player do this, in the order the app's
 * refusals are given (round 0.40.0 §6.8): the druid's Wild Shape on the sheet, else it's gone;
 * then, for a change, a known form usable from here that isn't the one the druid is in (`form`),
 * not from another kind of transformation (`transformed`), not while Incapacitated
 * (`incapacitated`, before the uses, so a druid at 0 hit points with none left is told that), and
 * a use left (`consume`); for a return, a form (`not-shaped`) the module times (`transformed`);
 * for a Beast learned, a known form to replace (`form`), else a free place (`full`), never the
 * form the druid is in (`shaped`), and only after a Long Rest (`swap`). The Beasts to learn are
 * listed wherever the druid has Wild Shape. A Beast learned that the druid knows already is let
 * through, for the module to answer done with nothing written. No sheet at all, nothing either.
 */
export function checkWildShape(
  input: WildShapeInput,
  sheet?: ShapedSheet | null,
): WildShapeRefusal | undefined {
  const block = sheet?.wildShape
  if (!block) return 'gone'
  const form = sheet.form
  switch (input.op) {
    case 'transform': {
      const known = block.known.find(({ id }) => id === input.form)
      if (!known || !usableForm(known) || form?.profile === input.form) {
        return 'form'
      }
      if (form && form.hours == undefined) return 'transformed'
      if (isIncapacitated(sheet)) return 'incapacitated'
      if (!(block.uses.value > 0)) return 'consume'
      return undefined
    }
    case 'revert': {
      if (!form) return 'not-shaped'
      if (form.hours == undefined) return 'transformed'
      return undefined
    }
    case 'learn': {
      if (input.replace === null) {
        return block.known.length >= block.limits.count ? 'full' : undefined
      }
      if (!block.known.some(({ id }) => id === input.replace)) return 'form'
      if (form?.profile === input.replace) return 'shaped'
      if (!block.swap) return 'swap'
      return undefined
    }
    default: {
      return undefined
    }
  }
}

/**
 * A form's name with "a" or "an" before it, by its first letter alone: "an" before a vowel, in
 * either case, as "an Ape", "an elk"; else "a", as "a Wolf", "a Giant Elk".
 */
export function articled(name: string): string {
  return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`
}

/** A Wild Shape's duration in words: "1 hour", "2 hours". */
export function hoursWords(hours: number): string {
  return hours === 1 ? '1 hour' : `${hours} hours`
}

/**
 * The world time a form has left, in whole minutes as the module last sent it: "1 h 58 m left",
 * "30 m left", or "Less than a minute left"; none where the module doesn't time it. Never counted
 * down here: world time jumps as the Gamemaster moves it.
 */
export function timeLeftWords(minutes?: number | null): string | undefined {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return
  const left = Math.max(0, Math.floor(minutes))
  if (left === 0) return 'Less than a minute left'
  if (left < 60) return `${left} m left`
  return `${Math.floor(left / 60)} h ${left % 60} m left`
}
