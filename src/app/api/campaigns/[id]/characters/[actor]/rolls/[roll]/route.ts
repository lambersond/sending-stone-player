import { getGmSeat } from '@/db/seats'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import { rollGetResponse } from '@/lib/routes/seat-routes'
import type { NextRequest } from 'next/server'

/**
 * Where a roll the Gamemaster sent as one of their campaign's characters (#156) stands: only
 * their own as this character, never its player's.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/rolls/[roll]'>,
) {
  return seatAnswer(
    context.params,
    (userId, { id, actor }) => getGmSeat(userId, id, actor),
    (seat, { roll }) => rollGetResponse(seat, roll),
  )
}
