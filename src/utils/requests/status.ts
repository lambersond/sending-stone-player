import { ROLL_PENDING_FOR, ROLL_ANSWER_WITHIN } from '@/constants/sending-stone'
import type { RollStatus } from '@/types/roll'
import type { SheetCounter, CharacterSheet } from '@/types/sending-stone'
import type { HeldRollRequest } from '@/utils/requests/types'

/**
 * Are these the same counter, as the module names them: the same item's own uses, the same
 * activity's of it, or the same resource? None is the same as none.
 */
export function sameCounter(
  a: SheetCounter | undefined,
  b: SheetCounter | undefined,
): boolean {
  if (!a || !b) return false
  if ('resource' in a || 'resource' in b) {
    return 'resource' in a && 'resource' in b && a.resource === b.resource
  }
  return a.item === b.item && a.activity === b.activity
}

/**
 * Is the character dying, so that it rolls death saving throws: down to 0 hit points, with
 * neither three successes nor three failures yet, as dnd5e has it?
 */
export function isDying(sheet?: Partial<CharacterSheet>): boolean {
  const saves = sheet?.deathSaves
  return (
    !!saves && sheet?.hp?.value === 0 && saves.success < 3 && saves.failure < 3
  )
}

/**
 * Where a roll stands. One the module hasn't fetched in time no longer goes to the game, and one
 * it fetched but never answered for is taken as lost; an answer that comes late still counts. From
 * module 0.45.0, the time the game held a typed roll asking its player for its run's later dice
 * isn't counted against it (`held`), as the module doesn't count it either.
 * @param held - How long, in milliseconds, its dice asks held it.
 */
export function rollStatus(
  request: Pick<HeldRollRequest, 'status' | 'createdAt' | 'claimedAt'>,
  now = Date.now(),
  held = 0,
): RollStatus {
  switch (request.status) {
    case 'pending': {
      return now - request.createdAt.getTime() < ROLL_PENDING_FOR
        ? 'sending'
        : 'expired'
    }
    case 'claimed': {
      const claimed = (request.claimedAt ?? request.createdAt).getTime()
      return now - claimed - held < ROLL_ANSWER_WITHIN ? 'rolling' : 'lost'
    }
    default: {
      return request.status
    }
  }
}
