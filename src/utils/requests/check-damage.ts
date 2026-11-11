import { DAMAGE_WITHIN } from '@/constants/sending-stone'
import {
  diceTakenAway,
  modifiedDice,
  unmaximizable,
} from '@/utils/damage-modifiers'
import { matchesPlanned } from '@/utils/requests/check-linked'
import { rollStatus } from '@/utils/requests/status'
import type { RollRequestInput } from '@/types/roll'
import type { CommandResult, DamagePreview } from '@/types/sending-stone'
import type {
  HeldRollRequest,
  OtherRoll,
  RollRefusal,
} from '@/utils/requests/types'

/**
 * Can this damage be rolled: does it follow the character's own attack or use, made in the game
 * lately, that said damage or healing follows; is no other damage for it on its way or made; are
 * its dice those it said its damage throws, in order, each die's first throw, changed as the player
 * chose, if they did, never at its highest where it takes a die away, or a die explodes or is
 * rerolled on its highest face; and is each kind of damage chosen one its roll offers?
 * @param use - The attack or use, if it's the character's.
 * @param others - The other damage asked for the same attack or use, each with the time its dice
 *   asks held it, where they may have (module 0.44.0).
 * @param actorId - The seat's actor: from module 0.36.0, damage follows only that actor's own
 *   attack or use, never its character's or another companion's, whose seats share a player.
 */
export function checkDamage(
  input: RollRequestInput,
  use: HeldRollRequest | null | undefined,
  others: OtherRoll[],
  now = Date.now(),
  actorId?: string,
): RollRefusal | undefined {
  const follows = use?.kind === 'attack' || use?.kind === 'use'
  if (!use || !follows || use.status !== 'done') return 'gone'
  if (actorId !== undefined && use.actorId !== actorId) return 'gone'
  if (now - use.createdAt.getTime() > DAMAGE_WITHIN) return 'gone'
  const damage = (use.result as CommandResult | null)?.damage
  if (!damage) return 'no-damage'
  const taken = others.some(other =>
    ['sending', 'rolling', 'done'].includes(rollStatus(other, now, other.held)),
  )
  if (taken) return 'damaged'
  return checkDamageDice(input, damage)
}

/**
 * Are damage's dice those the game said it throws, in order, each die's first throw, changed as
 * the player chose, if they did, never at its highest where it takes a die away, or a die explodes
 * or is rerolled on its highest face; and is each kind of damage chosen one its roll offers? For an
 * attack's or a use's damage, and from module 0.36.0 an action's on its own.
 */
export function checkDamageDice(
  input: RollRequestInput,
  damage: DamagePreview,
): RollRefusal | undefined {
  // Never at its highest where it takes a die away, nor where a die explodes, or is rerolled on its
  // highest face, whose highest isn't known.
  if (
    input.modifiers?.maximize &&
    (diceTakenAway(damage) || unmaximizable(damage))
  ) {
    return 'dice'
  }
  const planned = modifiedDice(damage, input.modifiers)
  if (!planned || !matchesPlanned(input, planned)) return 'dice'
  const types = input.types ?? []
  const offered =
    types.length <= damage.rolls.length &&
    types.every(
      (type, index) =>
        type === null ||
        (damage.rolls[index].types ?? []).some(({ key }) => key === type),
    )
  return offered ? undefined : 'type'
}
