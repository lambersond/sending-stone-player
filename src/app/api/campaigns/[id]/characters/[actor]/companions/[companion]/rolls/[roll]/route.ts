import { gmCompanionRollSeat } from '@/lib/companion-routes'
import { rollGetResponse } from '@/lib/seat-routes'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * Where a roll the Gamemaster sent as one of their campaign's characters' companions stands
 * (module 0.36.0): only their own as this companion from this character, never its player's, nor
 * theirs as the character. Answered whether or not the module lists it now, so a roll sent a
 * moment before its token went is still followed to what the game made of it; 404 for anything
 * else, saying no more.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/companions/[companion]/rolls/[roll]'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id, actor, companion, roll } = await context.params
  const seat = await gmCompanionRollSeat(user.id, id, actor, companion)
  if (!seat) return new Response(undefined, { status: 404, headers })

  return rollGetResponse(seat, roll)
}
