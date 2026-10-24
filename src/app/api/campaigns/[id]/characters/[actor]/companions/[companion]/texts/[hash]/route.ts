import { companionTextResponse, gmCompanionSeat } from '@/lib/companion-routes'
import { getCurrentUser } from '@/lib/session'
import { TEXT_HASH } from '@/schemas/sending-stone'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * A description on one of the Gamemaster's campaign's characters' companions' sheets (module
 * 0.36.0), as its character's player is served it: only that sheet's own descriptions.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/companions/[companion]/texts/[hash]'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id, actor, companion, hash } = await context.params
  if (!TEXT_HASH.test(hash)) {
    return new Response(undefined, { status: 404, headers })
  }
  const seat = await gmCompanionSeat(user.id, id, actor, companion)
  if (!seat) return new Response(undefined, { status: 404, headers })

  return companionTextResponse(seat, hash)
}
