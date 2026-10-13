import { getGmSeat } from '@/db/seats'
import { textResponse } from '@/lib/seat-routes'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

/**
 * A description on one of the Gamemaster's campaign's characters' sheets (#156), as its player is
 * served it: only that sheet's own descriptions.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/texts/[hash]'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401 })

  const { id, actor, hash } = await context.params
  const seat = await getGmSeat(user.id, id, actor)
  if (!seat) {
    return new Response(undefined, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  return textResponse(seat, hash)
}
