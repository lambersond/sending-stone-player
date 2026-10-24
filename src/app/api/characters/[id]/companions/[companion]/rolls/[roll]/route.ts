import { playerCompanionRollSeat } from '@/lib/companion-routes'
import { rollGetResponse } from '@/lib/seat-routes'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * Where a roll the player sent for their character's companion stands, and what the game made of
 * it (module 0.36.0): only its character's player, and only their own rolls for it from that
 * character. Answered whether or not the module lists it now, so a roll sent a moment before its
 * token went is still followed to what the game made of it: made, or refused as no longer that
 * character's companion; 404 for anything else, saying no more.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/characters/[id]/companions/[companion]/rolls/[roll]'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id, companion, roll } = await context.params
  const seat = await playerCompanionRollSeat(user.id, id, companion)
  if (!seat) return new Response(undefined, { status: 404, headers })

  return rollGetResponse(seat, roll)
}
