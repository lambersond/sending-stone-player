import { getPlayerSeat } from '@/db/seats'
import { NO_HEADERS } from '@/lib/routes/http'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import { textResponse } from '@/lib/routes/seat-routes'
import { TEXT_HASH } from '@/schemas/sending-stone'
import type { NextRequest } from 'next/server'

/**
 * A description on a character's sheet, such as a feature's, for its player: `{ html }`, already
 * sanitised. Only the character's own sheet's descriptions are served. The same hash always names
 * the same description, so the browser may keep it.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/characters/[id]/texts/[hash]'>,
) {
  return seatAnswer(
    context.params,
    async (userId, { id, hash }) =>
      TEXT_HASH.test(hash) ? getPlayerSeat(userId, id) : undefined,
    (seat, { hash }) => textResponse(seat, hash),
    { headers: NO_HEADERS },
  )
}
