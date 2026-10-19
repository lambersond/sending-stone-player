import { getCharacter } from '@/db/characters'
import { partySeat } from '@/db/party'
import { playerSeat } from '@/db/seats'
import { partyResponse } from '@/lib/party-routes'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * A party sheet of the character's campaign, for its player's page or panel to poll: only while
 * their Foundry user has Observer or Owner on the group, and 404 otherwise, saying no more. Pass
 * the version and the liveness as last seen, as `?version=7&live=1`, to get 204 No Content while
 * neither has changed, and the sheet's version as `&sheet=` to have an unchanged sheet left out.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/characters/[id]/party/[group]'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id, group } = await context.params
  const character = await getCharacter(user.id, id)
  if (!character) return new Response(undefined, { status: 404, headers })

  return partyResponse(
    request,
    partySeat(playerSeat(character, user.id)),
    group,
  )
}
