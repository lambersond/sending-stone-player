import { getGmSeat } from '@/db/seats'
import { tableResponse } from '@/lib/seat-routes'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * The Gamemaster's view of one of their campaign's characters (#156), as its player sees it, for
 * their page to poll: as the player's own view is polled, with where their rolls go as `&gm=` too.
 * Only the campaign's owner, and only for a character in its roster: 404 otherwise, saying no more.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/table'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id, actor } = await context.params
  const seat = await getGmSeat(user.id, id, actor)
  if (!seat) return new Response(undefined, { status: 404, headers })

  return tableResponse(request, seat)
}
