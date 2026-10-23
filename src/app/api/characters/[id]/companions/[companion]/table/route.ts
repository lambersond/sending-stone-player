import {
  companionTableResponse,
  playerCompanionSeat,
} from '@/lib/companion-routes'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * A character's companion's view of its campaign, for its pane to poll (module 0.36.0): only its
 * character's player, while the module lists it as that character's; 404 for anyone else, saying
 * no more. Pass what was last seen, as the character's table is polled, to get 204 No Content
 * while nothing has changed.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/characters/[id]/companions/[companion]/table'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id, companion } = await context.params
  const seat = await playerCompanionSeat(user.id, id, companion)
  if (!seat) return new Response(undefined, { status: 404, headers })

  return companionTableResponse(request, seat)
}
