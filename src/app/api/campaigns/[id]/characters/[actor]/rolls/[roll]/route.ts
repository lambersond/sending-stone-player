import { getGmSeat } from '@/db/seats'
import { rollGetResponse } from '@/lib/seat-routes'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * Where a roll the Gamemaster sent as one of their campaign's characters (#156) stands: only
 * their own as this character, never its player's.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/rolls/[roll]'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id, actor, roll } = await context.params
  const seat = await getGmSeat(user.id, id, actor)
  if (!seat) return new Response(undefined, { status: 404, headers })

  return rollGetResponse(seat, roll)
}
