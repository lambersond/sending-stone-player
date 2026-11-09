import { partyTextResponse } from '@/lib/routes/party-routes'
import { seatAnswer } from '@/lib/routes/seat-resolver'
import type { PartySeat } from '@/types/party'
import type { NextRequest } from 'next/server'

/**
 * A description on a party sheet of the Gamemaster's campaign: only that group's own sheet's
 * descriptions, and only for the campaign's owner.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/party/[group]/texts/[hash]'>,
) {
  return seatAnswer(
    context.params,
    async (userId, { id }): Promise<PartySeat> => ({
      role: 'gm',
      campaignId: id,
      userId,
    }),
    (seat, { group, hash }) => partyTextResponse(seat, group, hash),
  )
}
