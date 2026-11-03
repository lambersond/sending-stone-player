import { getPlayerSeat } from '@/db/seats'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import { tableResponse } from '@/lib/routes/seat-routes'
import type { NextRequest } from 'next/server'

/**
 * A character's view of its campaign, for the player's page to poll. Pass the version, the
 * liveness and the rolls the game takes, with what else it does with them, as last seen, as
 * `?version=7&live=1&rolls=skill,save;modifiers` to get 204 No Content while none has changed, and
 * the sheet's version as `&sheet=` to have an unchanged sheet left out.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/characters/[id]/table'>,
) {
  return seatAnswer(
    context.params,
    (userId, { id }) => getPlayerSeat(userId, id),
    seat => tableResponse(request, seat),
  )
}
