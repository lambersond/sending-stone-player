import { partyResponse } from '@/lib/party-routes'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * A party sheet of the Gamemaster's campaign, for their page or panel to poll, as a player's is,
 * whoever may see it in Foundry. Only the campaign's owner: 404 otherwise, saying no more.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/party/[group]'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id, group } = await context.params
  return partyResponse(
    request,
    { role: 'gm', campaignId: id, userId: user.id },
    group,
  )
}
