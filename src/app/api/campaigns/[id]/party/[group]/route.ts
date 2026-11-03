import { partyResponse } from '@/lib/routes/party-routes'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import type { PartySeat } from '@/db/types'
import type { NextRequest } from 'next/server'

/**
 * A party sheet of the Gamemaster's campaign, for their page or panel to poll, as a player's is,
 * whoever may see it in Foundry. Only the campaign's owner: 404 otherwise, saying no more.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/party/[group]'>,
) {
  return seatAnswer(
    context.params,
    async (userId, { id }): Promise<PartySeat> => ({
      role: 'gm',
      campaignId: id,
      userId,
    }),
    (seat, { group }) => partyResponse(request, seat, group),
  )
}
