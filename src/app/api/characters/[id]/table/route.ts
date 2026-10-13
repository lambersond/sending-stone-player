import { getCharacter } from '@/db/characters'
import { playerSeat } from '@/db/seats'
import { tableResponse } from '@/lib/seat-routes'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * A character's view of its campaign, for the player's page to poll. Pass the version, the
 * liveness and the rolls the game takes, with what else it does with them, as last seen, as
 * `?version=7&live=1&rolls=skill,save;modifiers` to get 204 No Content while none has changed, and
 * the sheet's version as `&sheet=` to have an unchanged sheet left out.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/characters/[id]/table'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id } = await context.params
  const character = await getCharacter(user.id, id)
  if (!character) return new Response(undefined, { status: 404, headers })

  return tableResponse(request, playerSeat(character, user.id))
}
