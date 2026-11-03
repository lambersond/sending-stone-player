import {
  gmCompanionSeat,
  companionTextResponse,
} from '@/lib/routes/companion-routes'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import { TEXT_HASH } from '@/schemas/sending-stone'
import type { NextRequest } from 'next/server'

/**
 * A description on one of the Gamemaster's campaign's characters' companions' sheets (module
 * 0.36.0), as its character's player is served it: only that sheet's own descriptions.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/companions/[companion]/texts/[hash]'>,
) {
  return seatAnswer(
    context.params,
    async (userId, { id, actor, companion, hash }) =>
      TEXT_HASH.test(hash)
        ? gmCompanionSeat(userId, id, actor, companion)
        : undefined,
    (seat, { hash }) => companionTextResponse(seat, hash),
  )
}
