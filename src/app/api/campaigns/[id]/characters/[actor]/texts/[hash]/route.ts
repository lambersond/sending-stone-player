import { getGmSeat } from '@/db/seats'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import { textResponse } from '@/lib/routes/seat-routes'
import type { NextRequest } from 'next/server'

/**
 * A description on one of the Gamemaster's campaign's characters' sheets (#156), as its player is
 * served it: only that sheet's own descriptions.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/texts/[hash]'>,
) {
  return seatAnswer(
    context.params,
    (userId, { id, actor }) => getGmSeat(userId, id, actor),
    (seat, { hash }) => textResponse(seat, hash),
  )
}
