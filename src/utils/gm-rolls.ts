import { createHash } from 'node:crypto'
import { rollStatus } from '@/utils/requests/status'
import { toGmRollView } from '@/utils/requests/views'
import type { HeldRollRequest } from '@/utils/requests/types'

// The rolls the campaign's Gamemaster made as a player's character (#156) that its player is shown,
// beside their own, and what tells them apart (src/db/table.ts, src/db/companions.ts). Server-side:
// the key is a node:crypto digest.

/**
 * What changes whenever any of the Gamemaster's rolls a player is shown does: its status, as time
 * moves it too, or what the game said of it. None for none.
 */
export function gmRollsKey(
  rolls: (Pick<HeldRollRequest, 'id' | 'status' | 'createdAt' | 'claimedAt'> & {
    completedAt: Date | null
  })[],
  now: number,
): string | undefined {
  if (rolls.length === 0) return undefined
  const states = rolls.map(
    roll =>
      `${roll.id}:${rollStatus(roll, now)}:${roll.completedAt?.getTime() ?? ''}`,
  )
  return createHash('sha256')
    .update(states.join(','))
    .digest('base64url')
    .slice(0, 16)
}

/**
 * The Gamemaster's rolls as the character its player is shown (#156), with what tells them
 * apart.
 * @param made - The Gamemaster's rolls as the character, newest first, as kept.
 * @param heals - The attacks and uses their damage follows that the game said healing follows.
 */
export function gmRollParts(
  made: (HeldRollRequest & {
    label: string | null
    useId: string | null
    completedAt: Date | null
  })[],
  heals: ReadonlySet<string>,
  now: number,
) {
  return made.length > 0
    ? {
        gmRolls: made.map(roll =>
          toGmRollView(roll, now, !!roll.useId && heals.has(roll.useId)),
        ),
        gmRollsKey: gmRollsKey(made, now),
      }
    : {}
}
