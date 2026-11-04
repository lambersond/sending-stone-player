import { playerCompanionRollSeat } from '@/lib/routes/companion-routes'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import { rollGetResponse } from '@/lib/routes/seat-routes'
import type { NextRequest } from 'next/server'

/**
 * Where a roll the player sent for their character's companion stands, and what the game made of
 * it (module 0.36.0): only its character's player, and only their own rolls for it from that
 * character. Answered whether or not the module lists it now, so a roll sent a moment before its
 * token went is still followed to what the game made of it: made, or refused as no longer that
 * character's companion; 404 for anything else, saying no more.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/characters/[id]/companions/[companion]/rolls/[roll]'>,
) {
  return seatAnswer(
    context.params,
    (userId, { id, companion }) =>
      playerCompanionRollSeat(userId, id, companion),
    (seat, { roll }) => rollGetResponse(seat, roll),
  )
}
