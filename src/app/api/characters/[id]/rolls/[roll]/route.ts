import { getCharacter } from '@/db/characters'
import { getRollRequestView } from '@/db/roll-requests'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/** Where a roll the player sent to the Gamemaster's game stands, and what the game made of it. */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/characters/[id]/rolls/[roll]'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id, roll } = await context.params
  const character = await getCharacter(user.id, id)
  if (!character) return new Response(undefined, { status: 404, headers })

  const view = await getRollRequestView(character.id, roll)
  if (!view) return new Response(undefined, { status: 404, headers })
  return Response.json(view, { headers })
}
