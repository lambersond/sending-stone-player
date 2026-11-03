import { gmCompanionRollSeat } from '@/lib/routes/companion-routes'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import { rollGetResponse } from '@/lib/routes/seat-routes'
import type { NextRequest } from 'next/server'

/**
 * Where a roll the Gamemaster sent as one of their campaign's characters' companions stands
 * (module 0.36.0): only their own as this companion from this character, never its player's, nor
 * theirs as the character. Answered whether or not the module lists it now, so a roll sent a
 * moment before its token went is still followed to what the game made of it; 404 for anything
 * else, saying no more.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/companions/[companion]/rolls/[roll]'>,
) {
  return seatAnswer(
    context.params,
    (userId, { id, actor, companion }) =>
      gmCompanionRollSeat(userId, id, actor, companion),
    (seat, { roll }) => rollGetResponse(seat, roll),
  )
}
