import { BRIDGE_POLLED_WITHIN } from '@/constants/sending-stone'
import type { EffectInput } from '@/types/roll'
import type { CharacterSheet } from '@/types/sending-stone'

// How this app reads one of a character's own effects turned off, on or deleted (module 0.39.0)
// before the Gamemaster's module is sent it: whether the campaign lets its players now, and whether
// the sheet, as last sent, lists that effect and lets its player do that to it, or shows it so
// already. The module decides which effects its player may change, `ops`, and checks it all again,
// live, in the game; these checks only spare a player one the game would refuse.

/**
 * Whether a campaign's players may turn off, turn on and delete their own characters' effects now:
 * its module says the campaign lets them, and is fetching, as `favoritesAvailable` reads it of
 * favorites.
 */
export function effectsAvailable(
  campaign: { effectsEnabled: boolean; bridgePolledAt: Date | null },
  now = Date.now(),
): boolean {
  const polled = campaign.bridgePolledAt?.getTime()
  return (
    campaign.effectsEnabled === true &&
    !!polled &&
    now - polled < BRIDGE_POLLED_WITHIN
  )
}

/**
 * Whether the sheet, as last sent, lets its player do this to the effect, in the module's own
 * order: one of its effects of that id, in any of its sections, the character's own "<id>" or an
 * item's "<itemId>.<id>", else it's gone; with some `ops`, as the module lists them, else it's not
 * theirs to change; and the op among them, else it's not theirs to do now. One that's already so is
 * let through, for the module to answer done with nothing written, as the page may be showing an
 * older sheet than this, the change made from another device or in the game: Turn off of one off,
 * Turn on of one on, Delete of one gone. A sheet from a module that lists no `ops` lets them do
 * nothing, and no sheet at all, nothing either.
 */
export function checkEffect(
  effect: EffectInput,
  sheet?: Pick<CharacterSheet, 'effects'>,
): 'gone' | 'effect' | undefined {
  const rows = (sheet?.effects ?? []).flatMap(section => section.effects)
  const row = rows.find(({ id }) => id === effect.id)
  if (!row) {
    if (!sheet || effect.op !== 'delete') return 'gone'
    // Deleted already, unless every effect the sheet lists comes without `ops`, from a module
    // before 0.39.0, which has no command for it. A sheet with no effects left, as once the last
    // is deleted, is let through: only a 0.39.0 module's hello lets players change effects.
    const older = rows.length > 0 && !rows.some(({ ops }) => Array.isArray(ops))
    return older ? 'effect' : undefined
  }
  const ops = row.ops ?? []
  if (ops.length === 0) return 'effect'
  if (effect.op === 'disable' && row.disabled) return undefined
  if (effect.op === 'enable' && !row.disabled) return undefined
  if (!ops.includes(effect.op)) return 'effect'
  return undefined
}
