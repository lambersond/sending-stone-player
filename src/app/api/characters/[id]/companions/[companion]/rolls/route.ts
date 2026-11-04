import { playerCompanionSeat } from '@/lib/routes/companion-routes'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import { rollPostResponse } from '@/lib/routes/seat-routes'
import type { NextRequest } from 'next/server'

/**
 * Have a roll the player made here for their character's companion made in the Gamemaster's game,
 * as the companion, with the same dice (module 0.36.0): only its character's player, while the
 * module lists it as that character's; 404 for anyone else, saying no more. Answered as the
 * character's own rolls are: 202 with the roll's id, to ask after at ./[roll], or why not.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/characters/[id]/companions/[companion]/rolls'>,
) {
  return seatAnswer(
    context.params,
    (userId, { id, companion }) => playerCompanionSeat(userId, id, companion),
    seat => rollPostResponse(request, seat),
  )
}
