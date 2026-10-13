import { getCharacter } from '@/db/characters'
import { playerSeat } from '@/db/seats'
import { rollPostResponse } from '@/lib/seat-routes'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * Have a roll the player made here made in the Gamemaster's game, with the same dice, when the
 * Gamemaster lets players do so. Answers 202 Accepted with the roll's id, to ask after at
 * ./[roll]; 409 Conflict while the game can't take the roll; 422 when the character can't
 * make it, such as a death saving throw while not dying; and 429 when the player is sending too
 * many. Each refusal says why as `{reason}`.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/characters/[id]/rolls'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id } = await context.params
  const character = await getCharacter(user.id, id)
  if (!character) return new Response(undefined, { status: 404, headers })

  return rollPostResponse(request, playerSeat(character, user.id))
}
