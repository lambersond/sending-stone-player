import { DAMAGE_WITHIN } from '@/constants/sending-stone'
import { rollStatus } from '@/utils/requests/status'
import { checkDamageDice } from '@/utils/roll-requests'
import type { RollRequestInput } from '@/types/roll'
import type { CommandResult } from '@/types/sending-stone'
import type { HeldRollRequest, RollRefusal } from '@/utils/requests/types'

/**
 * Can this damage be rolled: does it follow the character's own attack or use, made in the game
 * lately, that said damage or healing follows; is no other damage for it on its way or made; are
 * its dice those it said its damage throws, in order, each die's first throw, changed as the player
 * chose, if they did, never at its highest where it takes a die away, or a die explodes or is
 * rerolled on its highest face; and is each kind of damage chosen one its roll offers?
 * @param use - The attack or use, if it's the character's.
 * @param others - The other damage asked for the same attack or use.
 * @param actorId - The seat's actor: from module 0.36.0, damage follows only that actor's own
 *   attack or use, never its character's or another companion's, whose seats share a player.
 */
export function checkDamage(
  input: RollRequestInput,
  use: HeldRollRequest | null | undefined,
  others: Pick<HeldRollRequest, 'status' | 'createdAt' | 'claimedAt'>[],
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
    ['sending', 'rolling', 'done'].includes(rollStatus(other, now)),
  )
  if (taken) return 'damaged'
  return checkDamageDice(input, damage)
}
