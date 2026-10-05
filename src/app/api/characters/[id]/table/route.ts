import { getCharacter } from '@/db/characters'
import { getCampaignStatus, getTableView } from '@/db/table'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * A character's view of its campaign, for the player's page to poll. Pass the version and the
 * liveness last seen as `?version=7&live=1` to get 204 No Content while neither has changed, and
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

  const known = request.nextUrl.searchParams
  if (known.has('version')) {
    const { version, live } = await getCampaignStatus(character)
    if (
      Number(known.get('version')) === version &&
      (known.get('live') === '1') === live
    ) {
      return new Response(undefined, { status: 204, headers })
    }
  }
  const sheetVersion = known.get('sheet') ?? undefined
  return Response.json(await getTableView(character, { sheetVersion }), {
    headers,
  })
}
