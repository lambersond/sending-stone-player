import { gmCompanionSeat } from '@/lib/routes/companion-routes'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import { rollPostResponse } from '@/lib/routes/seat-routes'
import type { NextRequest } from 'next/server'

/**
 * Have a roll the Gamemaster made here as one of their campaign's characters' companions made in
 * their game, as the companion, marked as theirs (module 0.36.0): only the campaign's owner, for a
 * character in its roster, while the module lists the companion as that character's. Answered as
 * their rolls as the character are.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/companions/[companion]/rolls'>,
) {
  return seatAnswer(
    context.params,
    (userId, { id, actor, companion }) =>
      gmCompanionSeat(userId, id, actor, companion),
    seat => rollPostResponse(request, seat),
  )
}
