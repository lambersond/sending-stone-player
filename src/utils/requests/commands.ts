import { kindsWhere, ROLL_KIND_INFO } from '@/constants/roll-kinds'
import type { RollRequestInput } from '@/types/roll'
import type { HeldRollRequest, RollCommand } from '@/utils/requests/types'

/**
 * What the campaign's Gamemaster never sends as a character (#156): an end of an enchantment or,
 * from module 0.29.0, of a concentration, which post nothing in the game, so would leave no mark of
 * theirs; and from module 0.36.0 a turn ended, or taken back, which posts nothing either: the
 * Gamemaster ends one, or goes back to it, in Foundry; and from module 0.37.0 a favorite added or
 * removed, which posts nothing either; and from module 0.39.0 a character's own effect turned off,
 * on or deleted, which posts nothing either; and from module 0.40.0 Wild Shape, which the game
 * would make as the player's, past dnd5e's own Allow Polymorphing: the Gamemaster changes a druid
 * in Foundry. Charges spent and Heroic Inspiration post a line marked as theirs, as from module
 * 0.42.1 a spell slot spent or restored does. From module 0.42.1, a spell prepared or unprepared
 * isn't sent either: it posts nothing.
 */
export const GM_UNSENT: ReadonlySet<string> = new Set(
  kindsWhere(kind => 'gm' in ROLL_KIND_INFO[kind]),
)

/** A held roll as the module is sent it. */
export function toCommand(request: HeldRollRequest): RollCommand {
  return {
    ...(request.payload as RollRequestInput),
    id: request.id,
    actorId: request.actorId,
    // A companion's names its character (module 0.36.0).
    ...(request.ofActorId ? { of: request.ofActorId } : {}),
    ...(request.role === 'gm' ? { by: 'gm' as const } : {}),
  }
}
