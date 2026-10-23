import { playerCompanionSeat } from '@/lib/companion-routes'
import { rollPostResponse } from '@/lib/seat-routes'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * Have a roll the player made here for their character's companion made in the Gamemaster's game,
 * as the companion, with the same dice (module 0.36.0): only its character's player, while the
 * module lists it as that character's; 404 for anyone else, saying no more. Answered as the
 * character's own rolls are: 202 with the roll's id, to ask after at ./[roll], or why not.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/characters/[id]/companions/[companion]/rolls'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id, companion } = await context.params
  const seat = await playerCompanionSeat(user.id, id, companion)
  if (!seat) return new Response(undefined, { status: 404, headers })

  return rollPostResponse(request, seat)
}
