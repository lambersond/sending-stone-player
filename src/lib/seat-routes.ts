import {
  createRollRequest,
  getRollRequestView,
  notePlayersSeen,
} from '@/db/roll-requests'
import { getSheetText } from '@/db/sheet-texts'
import { getCampaignStatus, getTableView } from '@/db/table'
import { rollRequestSchema } from '@/schemas/roll-request'
import { TEXT_HASH } from '@/schemas/sending-stone'
import { rollsKey } from '@/utils/roll-requests'
import type { SheetSeat } from '@/types/character'
import type { NextRequest } from 'next/server'

// What a character's table routes answer once they know who is at its sheet (#156): its player,
// through their Character, or its campaign's Gamemaster, through the campaign they own. Each
// route resolves the seat itself, answering 401 signed out and 404 for a sheet that isn't the
// user's to see, and everything here is scoped by that seat alone, never by ids in a body.

const headers = { 'Cache-Control': 'no-store' }

/** The largest roll read. One with every die it may throw is well under. */
const MAX_ROLL_BYTES = 16_384

/**
 * A seat's view of its character's campaign, for its page to poll. Pass the version, the liveness
 * and the rolls the game takes, with what else it does with them, as last seen, as
 * `?version=7&live=1&rolls=skill,save;modifiers` to get 204 No Content while none has changed,
 * for the Gamemaster's seat where their rolls go, as `&gm=made`, and for the player's the
 * Gamemaster's rolls as their character as last seen, as `&gmrolls=` and the view's `gmRollsKey`;
 * and the sheet's version as `&sheet=` to have an unchanged sheet left out.
 */
export async function tableResponse(
  request: NextRequest,
  seat: SheetSeat,
): Promise<Response> {
  // Whoever is at the table may roll, so the Gamemaster's module waits for their rolls.
  if (seat.campaignId) {
    try {
      await notePlayersSeen(seat.campaignId)
    } catch (error) {
      console.error('Failed to note a player at the table', error)
    }
  }

  const known = request.nextUrl.searchParams
  if (known.has('version')) {
    const { version, live, rollsToTable, rollFeatures, gm, gmRollsKey } =
      await getCampaignStatus(seat)
    if (
      Number(known.get('version')) === version &&
      (known.get('live') === '1') === live &&
      (known.get('rolls') ?? '') === rollsKey(rollsToTable, rollFeatures) &&
      (known.get('gm') ?? undefined) === gm?.rolls &&
      (known.get('gmrolls') ?? undefined) === gmRollsKey
    ) {
      return new Response(undefined, { status: 204, headers })
    }
  }
  const sheetVersion = known.get('sheet') ?? undefined
  return Response.json(await getTableView(seat, { sheetVersion }), {
    headers,
  })
}

/**
 * Have a roll made at a sheet made in the Gamemaster's game, with the same dice. Answers 202
 * Accepted with the roll's id, to ask after at ./[roll]; 415 for anything but JSON, 413 for too
 * much and 400 for what isn't a roll, such as one that says whose it is; 409 Conflict while the
 * game can't take the roll; 422 when the character can't make it, such as a death saving throw
 * while not dying; and 429 when the seat is sending too many. Each refusal says why as `{reason}`.
 */
export async function rollPostResponse(
  request: NextRequest,
  seat: SheetSeat,
): Promise<Response> {
  // Asked for only as JSON, which a page on another site can't send without asking first.
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return new Response(undefined, { status: 415, headers })
  }
  const body = await request.text()
  if (Buffer.byteLength(body) > MAX_ROLL_BYTES) {
    return new Response(undefined, { status: 413, headers })
  }
  let input
  try {
    input = rollRequestSchema.parse(JSON.parse(body))
  } catch {
    return new Response(undefined, { status: 400, headers })
  }

  const created = await createRollRequest(seat, input)
  if ('reason' in created) {
    return Response.json(
      { reason: created.reason },
      { status: created.status, headers },
    )
  }
  return Response.json({ id: created.id }, { status: 202, headers })
}

/** Where a roll the seat sent to the Gamemaster's game stands, and what the game made of it. */
export async function rollGetResponse(
  seat: SheetSeat,
  roll: string,
): Promise<Response> {
  const view = await getRollRequestView(seat, roll)
  if (!view) return new Response(undefined, { status: 404, headers })
  return Response.json(view, { headers })
}

/**
 * A description on the character's sheet: `{ html }`, already sanitised. Only its own sheet's
 * descriptions are served. The same hash always names the same description, so the browser may
 * keep it.
 */
export async function textResponse(
  seat: SheetSeat,
  hash: string,
): Promise<Response> {
  const html = TEXT_HASH.test(hash) ? await getSheetText(seat, hash) : undefined
  if (html === undefined) {
    return new Response(undefined, { status: 404, headers })
  }
  return Response.json(
    { html },
    { headers: { 'Cache-Control': 'private, max-age=86400' } },
  )
}
