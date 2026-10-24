import { getCharacter } from '@/db/characters'
import {
  companionRollSeat,
  companionSeat,
  getCompanionStatus,
  getCompanionText,
  getCompanionView,
} from '@/db/companions'
import { notePlayersSeen, type RollSeat } from '@/db/roll-requests'
import { getGmSeat, playerSeat } from '@/db/seats'
import { noting } from '@/lib/seat-routes'
import { TEXT_HASH } from '@/schemas/sending-stone'
import { rollsKey } from '@/utils/roll-requests'
import type { SheetSeat } from '@/types/character'
import type { NextRequest } from 'next/server'

// What a character's companion's routes answer (module 0.36.0), once they know who is at it: the
// character's player, through their Character, or the campaign's Gamemaster, through the campaign
// they own, and then only while the campaign's stored list says the companion is that
// character's. Each route resolves the seat itself, answering 401 signed out and 404 for anything
// that isn't the user's to see, saying no more; a companion's rolls go through the character's
// own responders, given the companion's seat. Where a roll sent for it stands is answered whether
// or not it's listed now, of the seat's own rolls for it alone, so that one sent a moment before
// the module stopped listing it is still followed to what the game made of it.

const headers = { 'Cache-Control': 'no-store' }

/**
 * The seat at a character's companion, for the character's player: their own Character, then the
 * companion, while it's that character's.
 * @returns Undefined for a character that isn't the user's, or a companion that isn't its.
 */
export async function playerCompanionSeat(
  userId: string,
  characterId: string,
  key: string,
): Promise<SheetSeat | undefined> {
  const character = await getCharacter(userId, characterId)
  return character
    ? companionSeat(playerSeat(character, userId), key)
    : undefined
}

/**
 * The seat at a character's companion, for the campaign's Gamemaster: the campaign's owner at one
 * of its characters, then the companion, while it's that character's.
 * @returns Undefined for anyone else, a character not in the roster, or a companion not its.
 */
export async function gmCompanionSeat(
  userId: string,
  campaignId: string,
  actorId: string,
  key: string,
): Promise<SheetSeat | undefined> {
  const seat = await getGmSeat(userId, campaignId, actorId)
  return seat ? companionSeat(seat, key) : undefined
}

/**
 * The seat the character's player asks after a roll they sent for its companion from: their own
 * Character, then the companion's key, listed now or not; only their own rolls for it from that
 * character are served at it.
 * @returns Undefined for a character that isn't the user's, or a key that can't be a companion's.
 */
export async function playerCompanionRollSeat(
  userId: string,
  characterId: string,
  key: string,
): Promise<RollSeat | undefined> {
  const character = await getCharacter(userId, characterId)
  return character
    ? companionRollSeat(playerSeat(character, userId), key)
    : undefined
}

/**
 * The seat the campaign's Gamemaster asks after a roll they sent as one of its characters'
 * companions from: the campaign's owner at the character, then the companion's key, listed now or
 * not; only their own rolls as it from that character are served at it.
 * @returns Undefined for anyone else, a character not in the roster, or a key that can't be a
 * companion's.
 */
export async function gmCompanionRollSeat(
  userId: string,
  campaignId: string,
  actorId: string,
  key: string,
): Promise<RollSeat | undefined> {
  const seat = await getGmSeat(userId, campaignId, actorId)
  return seat ? companionRollSeat(seat, key) : undefined
}

/**
 * A companion's own view, for its pane to poll (module 0.36.0). Pass the version, the liveness and
 * the rolls the game takes for it, with what else it does with them, as last seen, as
 * `?version=7&live=1&rolls=attack,damage;modifiers` to get 204 No Content while none has changed;
 * for the Gamemaster's seat where their rolls go, as `&gm=made`; for the player's, the
 * Gamemaster's rolls as it as last seen, as `&gmrolls=`, and `&typed=1` where their typed dice were
 * on; and the sheet's version as `&sheet=` to have an unchanged sheet left out. The seat was
 * resolved first, so a companion no longer listed is never told nothing changed. Whoever is at it
 * may roll, so the Gamemaster's module waits for their rolls; its character's page notes it open.
 */
export async function companionTableResponse(
  request: NextRequest,
  seat: SheetSeat,
): Promise<Response> {
  const { campaignId } = seat
  if (campaignId) {
    await noting(
      () => notePlayersSeen(campaignId),
      'Failed to note a player at the table',
    )
  }

  const known = request.nextUrl.searchParams
  if (known.has('version')) {
    const { version, live, rollsToTable, rollFeatures, gm, gmRollsKey, typed } =
      await getCompanionStatus(seat)
    if (
      Number(known.get('version')) === version &&
      (known.get('live') === '1') === live &&
      (known.get('rolls') ?? '') === rollsKey(rollsToTable, rollFeatures) &&
      (known.get('gm') ?? undefined) === gm?.rolls &&
      (known.get('gmrolls') ?? undefined) === gmRollsKey &&
      (known.get('typed') === '1') === typed
    ) {
      return new Response(undefined, { status: 204, headers })
    }
  }
  const sheetVersion = known.get('sheet') ?? undefined
  return Response.json(await getCompanionView(seat, { sheetVersion }), {
    headers,
  })
}

/**
 * A description on a companion's sheet: `{ html }`, already sanitised. Only its own sheet's
 * descriptions are served, never its character's. The same hash always names the same
 * description, so the browser may keep it.
 */
export async function companionTextResponse(
  seat: SheetSeat,
  hash: string,
): Promise<Response> {
  const html = TEXT_HASH.test(hash)
    ? await getCompanionText(seat, hash)
    : undefined
  if (html === undefined) {
    return new Response(undefined, { status: 404, headers })
  }
  return Response.json(
    { html },
    { headers: { 'Cache-Control': 'private, max-age=86400' } },
  )
}
