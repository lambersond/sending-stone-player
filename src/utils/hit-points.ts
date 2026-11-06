import { switchOn } from '@/utils/features'
import type { HitPointsInput } from '@/types/roll'
import type { CharacterSheet } from '@/types/sending-stone'

// How this app reads hit points and temporary hit points set from the app (module 0.44.0) before
// the Gamemaster's module is sent them: whether the campaign lets its players now, and whether the
// sheet, as last sent, has hit points, and still shows each number the page showed. The module
// checks it all again, live, in the game, and keeps the hit points within their maximum; these
// checks only spare a player one the game would refuse.

/**
 * Whether a campaign's players may set their characters', forms' and companions' hit points now:
 * its module says the campaign lets them, and is fetching, as `effectsAvailable` reads it of
 * effects.
 */
export function hitPointsAvailable(
  campaign: { hitPointsEnabled: boolean; bridgePolledAt: Date | null },
  now = Date.now(),
): boolean {
  return switchOn(campaign, 'hitPointsEnabled', now)
}

/**
 * Whether the sheet, as last sent, lets these hit points be set: it has hit points, else there's
 * no actor of them to set (`unknown`); and each field set still holds what the page showed of it
 * (`from`), else they changed in the game since (`changed`), as a spell slot's count does.
 */
export function checkHitPoints(
  hitPoints: HitPointsInput,
  sheet?: Pick<CharacterSheet, 'hp'>,
): 'unknown' | 'changed' | undefined {
  const hp = sheet?.hp
  if (!hp) return 'unknown'
  const { from } = hitPoints
  const moved =
    (from.value !== undefined && from.value !== hp.value) ||
    (from.temp !== undefined && from.temp !== hp.temp)
  return moved ? 'changed' : undefined
}
