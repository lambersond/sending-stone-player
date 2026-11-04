import { partyAt, partyTextResponse } from '@/lib/routes/party-routes'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import type { NextRequest } from 'next/server'

/**
 * A description on a party sheet of the character's campaign, for its player: `{ html }`, already
 * sanitised. Only that group's own sheet's descriptions, and only while its player may see it.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/characters/[id]/party/[group]/texts/[hash]'>,
) {
  return seatAnswer(
    context.params,
    (userId, { id }) => partyAt(userId, id),
    (seat, { group, hash }) => partyTextResponse(seat, group, hash),
  )
}
