import { getPlayerSeat } from '@/db/seats'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import { rollGetResponse } from '@/lib/routes/seat-routes'
import type { NextRequest } from 'next/server'

/** Where a roll the player sent to the Gamemaster's game stands, and what the game made of it. */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/characters/[id]/rolls/[roll]'>,
) {
  return seatAnswer(
    context.params,
    (userId, { id }) => getPlayerSeat(userId, id),
    (seat, { roll }) => rollGetResponse(seat, roll),
  )
}
