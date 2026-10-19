import { getCharacter } from '@/db/characters'
import { partySeat } from '@/db/party'
import { playerSeat } from '@/db/seats'
import { partyTextResponse } from '@/lib/party-routes'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * A description on a party sheet of the character's campaign, for its player: `{ html }`, already
 * sanitised. Only that group's own sheet's descriptions, and only while its player may see it.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/characters/[id]/party/[group]/texts/[hash]'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id, group, hash } = await context.params
  const character = await getCharacter(user.id, id)
  if (!character) return new Response(undefined, { status: 404, headers })

  return partyTextResponse(
    partySeat(playerSeat(character, user.id)),
    group,
    hash,
  )
}
