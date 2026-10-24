import { companionTableResponse, gmCompanionSeat } from '@/lib/companion-routes'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * The Gamemaster's view of one of their campaign's characters' companions (module 0.36.0), as its
 * character's player sees it, for their page to poll, with where their rolls go as `&gm=` too:
 * only the campaign's owner, for a character in its roster, while the module lists the companion
 * as that character's; 404 otherwise, saying no more.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/companions/[companion]/table'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id, actor, companion } = await context.params
  const seat = await gmCompanionSeat(user.id, id, actor, companion)
  if (!seat) return new Response(undefined, { status: 404, headers })

  return companionTableResponse(request, seat)
}
