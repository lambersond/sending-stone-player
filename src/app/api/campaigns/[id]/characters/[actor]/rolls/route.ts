import { getGmSeat } from '@/db/seats'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import { rollPostResponse } from '@/lib/routes/seat-routes'
import type { NextRequest } from 'next/server'

/**
 * Have a roll the Gamemaster made here as one of their campaign's characters (#156) made in their
 * game as that character's, marked as theirs: answered as a player's roll is, with 409 Conflict
 * besides while the game can't make the Gamemaster's rolls so, or for ending an enchantment.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/rolls'>,
) {
  return seatAnswer(
    context.params,
    (userId, { id, actor }) => getGmSeat(userId, id, actor),
    seat => rollPostResponse(request, seat),
  )
}
