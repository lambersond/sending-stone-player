import {
  gmCompanionSeat,
  companionTableResponse,
} from '@/lib/routes/companion-routes'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import type { NextRequest } from 'next/server'

/**
 * The Gamemaster's view of one of their campaign's characters' companions (module 0.36.0), as its
 * character's player sees it, for their page to poll, with where their rolls go as `&gm=` too:
 * only the campaign's owner, for a character in its roster, while the module lists the companion
 * as that character's; 404 otherwise, saying no more.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/companions/[companion]/table'>,
) {
  return seatAnswer(
    context.params,
    (userId, { id, actor, companion }) =>
      gmCompanionSeat(userId, id, actor, companion),
    seat => companionTableResponse(request, seat),
  )
}
