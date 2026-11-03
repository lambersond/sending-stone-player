import { getCharacter } from '@/db/characters'
import { cookbookViewResponse } from '@/lib/routes/cookbook-routes'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import type { NextRequest } from 'next/server'

/**
 * A player's Magical Recipe Book card for one of their characters, from module 0.38.0: its link
 * and what became of the dishes it sent, for their page to poll. Pass its version as last seen,
 * as `?version=9f2c41d0aa1e`, to get 204 No Content while nothing has changed.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/characters/[id]/cookbook'>,
) {
  return seatAnswer(
    context.params,
    (userId, { id }) => getCharacter(userId, id),
    character => cookbookViewResponse(request, character),
  )
}
