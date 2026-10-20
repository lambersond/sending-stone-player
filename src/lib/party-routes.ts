import {
  allowedGroup,
  getGroupView,
  getPartyStatus,
  type PartySeat,
} from '@/db/party'
import { notePlayersSeen } from '@/db/roll-requests'
import { getGroupText } from '@/db/sheet-texts'
import { noting } from '@/lib/seat-routes'
import { TEXT_HASH } from '@/schemas/sending-stone'
import type { NextRequest } from 'next/server'

// What a party sheet's routes answer (module 0.30.0), once they know who is at it: a player,
// through their character, or the campaign's Gamemaster, through the campaign they own. Each
// route resolves the seat itself, answering 401 signed out; every answer here checks the seat may
// see the group now, and answers 404 where it may not, saying no more. A party sheet's page notes
// its player present, as a character's table does, so the Gamemaster's module waits for their
// moves.

const headers = { 'Cache-Control': 'no-store' }

/**
 * A party sheet as the seat may see it, for its page or panel to poll. Pass the version and the
 * liveness as last seen, as `?version=7&live=1`, and from module 0.31.0 `&moves=1` where the seat
 * might take from it, to get 204 No Content while none has changed, and the sheet's version as
 * `&sheet=` to have an unchanged sheet left out. Whether the seat may see it is checked first,
 * every time, so that one whose access was taken away is never told nothing changed.
 */
export async function partyResponse(
  request: NextRequest,
  seat: PartySeat,
  groupId: string,
): Promise<Response> {
  const status = await getPartyStatus(seat, groupId)
  if (!status) return new Response(undefined, { status: 404, headers })
  // Whoever is at it may take from it, so the Gamemaster's module waits for their moves. A
  // failure to note it is only logged.
  const { campaignId } = seat
  if (campaignId) {
    await noting(
      () => notePlayersSeen(campaignId),
      'Failed to note a player at the table',
    )
  }

  const known = request.nextUrl.searchParams
  if (
    known.has('version') &&
    Number(known.get('version')) === status.version &&
    (known.get('live') === '1') === status.live &&
    (known.get('moves') === '1') === status.moves
  ) {
    return new Response(undefined, { status: 204, headers })
  }
  const view = await getGroupView(seat, groupId, {
    sheetVersion: known.get('sheet') ?? undefined,
  })
  if (!view) return new Response(undefined, { status: 404, headers })
  return Response.json(view, { headers })
}

/**
 * A description on a party sheet: `{ html }`, already sanitised. Only that group's own sheet's
 * descriptions are served, never a character's. The same hash always names the same description,
 * so the browser may keep it.
 */
export async function partyTextResponse(
  seat: PartySeat,
  groupId: string,
  hash: string,
): Promise<Response> {
  const group = TEXT_HASH.test(hash)
    ? await allowedGroup(seat, groupId)
    : undefined
  const html = group ? await getGroupText(group, hash) : undefined
  if (html === undefined) {
    return new Response(undefined, { status: 404, headers })
  }
  return Response.json(
    { html },
    { headers: { 'Cache-Control': 'private, max-age=86400' } },
  )
}
