import { getCharacter } from '@/db/characters'
import { getGameVersion, getTableView } from '@/db/table'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * A character's view of its game, for the player's page to poll. Pass the version last seen as
 * `?version=` to get 204 No Content while nothing has changed.
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

  const known = request.nextUrl.searchParams.get('version')
  if (known && Number(known) === (await getGameVersion(character.gameUrl))) {
    return new Response(undefined, { status: 204, headers })
  }
  return Response.json(await getTableView(character), { headers })
}
