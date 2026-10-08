import { getCharacter } from '@/db/characters'
import { notePlayersSeen } from '@/db/roll-requests'
import { getCampaignStatus, getTableView } from '@/db/table'
import { getCurrentUser } from '@/lib/session'
import { rollsKey } from '@/utils/roll-requests'
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

  // A player at the table may roll, so the Gamemaster's module waits for their rolls.
  if (character.campaignId) {
    try {
      await notePlayersSeen(character.campaignId)
    } catch (error) {
      console.error('Failed to note a player at the table', error)
    }
  }

  const known = request.nextUrl.searchParams
  if (known.has('version')) {
    const { version, live, rollsToTable, rollFeatures } =
      await getCampaignStatus(character)
    if (
      Number(known.get('version')) === version &&
      (known.get('live') === '1') === live &&
      (known.get('rolls') ?? '') === rollsKey(rollsToTable, rollFeatures)
    ) {
      return new Response(undefined, { status: 204, headers })
    }
  }
  const sheetVersion = known.get('sheet') ?? undefined
  return Response.json(await getTableView(character, { sheetVersion }), {
    headers,
  })
}
