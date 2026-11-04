import {
  playerCompanionSeat,
  companionTableResponse,
} from '@/lib/routes/companion-routes'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import type { NextRequest } from 'next/server'

/**
 * A character's companion's view of its campaign, for its pane to poll (module 0.36.0): only its
 * character's player, while the module lists it as that character's; 404 for anyone else, saying
 * no more. Pass what was last seen, as the character's table is polled, to get 204 No Content
 * while nothing has changed.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/characters/[id]/companions/[companion]/table'>,
) {
  return seatAnswer(
    context.params,
    (userId, { id, companion }) => playerCompanionSeat(userId, id, companion),
    seat => companionTableResponse(request, seat),
  )
}
