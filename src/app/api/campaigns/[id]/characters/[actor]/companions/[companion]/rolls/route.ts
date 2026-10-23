import { gmCompanionSeat } from '@/lib/companion-routes'
import { rollPostResponse } from '@/lib/seat-routes'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * Have a roll the Gamemaster made here as one of their campaign's characters' companions made in
 * their game, as the companion, marked as theirs (module 0.36.0): only the campaign's owner, for a
 * character in its roster, while the module lists the companion as that character's. Answered as
 * their rolls as the character are.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/companions/[companion]/rolls'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id, actor, companion } = await context.params
  const seat = await gmCompanionSeat(user.id, id, actor, companion)
  if (!seat) return new Response(undefined, { status: 404, headers })

  return rollPostResponse(request, seat)
}
