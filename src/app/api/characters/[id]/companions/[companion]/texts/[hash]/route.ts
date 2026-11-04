import {
  playerCompanionSeat,
  companionTextResponse,
} from '@/lib/routes/companion-routes'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import { TEXT_HASH } from '@/schemas/sending-stone'
import type { NextRequest } from 'next/server'

/**
 * A description on a character's companion's sheet (module 0.36.0), for its character's player:
 * `{ html }`, already sanitised. Only the companion's own sheet's descriptions are served, while
 * the module lists it as that character's. The same hash always names the same description, so
 * the browser may keep it.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/characters/[id]/companions/[companion]/texts/[hash]'>,
) {
  return seatAnswer(
    context.params,
    async (userId, { id, companion, hash }) =>
      TEXT_HASH.test(hash)
        ? playerCompanionSeat(userId, id, companion)
        : undefined,
    (seat, { hash }) => companionTextResponse(seat, hash),
  )
}
