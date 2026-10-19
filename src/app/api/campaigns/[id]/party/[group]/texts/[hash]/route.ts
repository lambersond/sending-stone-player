import { partyTextResponse } from '@/lib/party-routes'
import { getCurrentUser } from '@/lib/session'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/**
 * A description on a party sheet of the Gamemaster's campaign: only that group's own sheet's
 * descriptions, and only for the campaign's owner.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/party/[group]/texts/[hash]'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id, group, hash } = await context.params
  return partyTextResponse(
    { role: 'gm', campaignId: id, userId: user.id },
    group,
    hash,
  )
}
