import { getGmSeat } from '@/db/seats'
import { rollPostResponse } from '@/lib/seat-routes'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * Have a roll the Gamemaster made here as one of their campaign's characters (#156) made in their
 * game as that character's, marked as theirs: answered as a player's roll is, with 409 Conflict
 * besides while the game can't make the Gamemaster's rolls so, or for ending an enchantment.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/rolls'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id, actor } = await context.params
  const seat = await getGmSeat(user.id, id, actor)
  if (!seat) return new Response(undefined, { status: 404, headers })

  return rollPostResponse(request, seat)
}
