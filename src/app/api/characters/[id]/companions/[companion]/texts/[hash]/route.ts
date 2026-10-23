import {
  companionTextResponse,
  playerCompanionSeat,
} from '@/lib/companion-routes'
import { getCurrentUser } from '@/lib/session'
import { TEXT_HASH } from '@/schemas/sending-stone'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

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
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id, companion, hash } = await context.params
  if (!TEXT_HASH.test(hash)) {
    return new Response(undefined, { status: 404, headers })
  }
  const seat = await playerCompanionSeat(user.id, id, companion)
  if (!seat) return new Response(undefined, { status: 404, headers })

  return companionTextResponse(seat, hash)
}
