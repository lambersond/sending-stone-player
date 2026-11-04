import { getGmSeat } from '@/db/seats'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import { tableResponse } from '@/lib/routes/seat-routes'
import type { NextRequest } from 'next/server'

/**
 * The Gamemaster's view of one of their campaign's characters (#156), as its player sees it, for
 * their page to poll: as the player's own view is polled, with where their rolls go as `&gm=` too.
 * Only the campaign's owner, and only for a character in its roster: 404 otherwise, saying no more.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/table'>,
) {
  return seatAnswer(
    context.params,
    (userId, { id, actor }) => getGmSeat(userId, id, actor),
    seat => tableResponse(request, seat),
  )
}
