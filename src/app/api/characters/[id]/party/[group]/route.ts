import { partyAt, partyResponse } from '@/lib/routes/party-routes'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import type { NextRequest } from 'next/server'

/**
 * A party sheet of the character's campaign, for its player's page or panel to poll: only while
 * their Foundry user has Observer or Owner on the group, and 404 otherwise, saying no more. Pass
 * the version and the liveness as last seen, as `?version=7&live=1`, to get 204 No Content while
 * neither has changed, and the sheet's version as `&sheet=` to have an unchanged sheet left out.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/characters/[id]/party/[group]'>,
) {
  return seatAnswer(
    context.params,
    (userId, { id }) => partyAt(userId, id),
    (seat, { group }) => partyResponse(request, seat, group),
  )
}
