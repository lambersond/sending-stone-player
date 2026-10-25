import { getCharacter } from '@/db/characters'
import { cookbookViewResponse } from '@/lib/cookbook-routes'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * A player's Magical Recipe Book card for one of their characters, from module 0.38.0: its link
 * and what became of the dishes it sent, for their page to poll. Pass its version as last seen,
 * as `?version=9f2c41d0aa1e`, to get 204 No Content while nothing has changed.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/characters/[id]/cookbook'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id } = await context.params
  const character = await getCharacter(user.id, id)
  if (!character) return new Response(undefined, { status: 404, headers })

  return cookbookViewResponse(request, character)
}
