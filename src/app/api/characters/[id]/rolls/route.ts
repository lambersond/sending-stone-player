import { getPlayerSeat } from '@/db/seats'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import { rollPostResponse } from '@/lib/routes/seat-routes'
import type { NextRequest } from 'next/server'

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
  return seatAnswer(
    context.params,
    (userId, { id }) => getPlayerSeat(userId, id),
    seat => rollPostResponse(request, seat),
  )
}
