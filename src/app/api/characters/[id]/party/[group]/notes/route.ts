import { notesPostResponse, notesResponse, notesSeat } from '@/lib/notes-routes'
import type { NextRequest } from 'next/server'

/**
 * A book of journal notes (module 0.34.0): a party's notes, which every character who may see the
 * party shares, for its page to poll. Pass the version and the liveness as last seen, as
 * `?version=7&live=1`, to get 204 No Content while neither has changed. Only while the player's
 * Foundry user may see the party: 404 otherwise, saying no more.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/characters/[id]/party/[group]/notes'>,
) {
  const { id, group } = await context.params
  const place = await notesSeat({
    kind: 'party',
    role: 'player',
    character: id,
    group,
  })
  if (place instanceof Response) return place
  return notesResponse(request, place)
}

/**
 * Add a note or chapter to the book, kept here at once and sent to Foundry when the game takes
 * notes: 201 Created with its id and stamp, or why not as `{reason}`.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/characters/[id]/party/[group]/notes'>,
) {
  const { id, group } = await context.params
  const place = await notesSeat({
    kind: 'party',
    role: 'player',
    character: id,
    group,
  })
  if (place instanceof Response) return place
  return notesPostResponse(request, place)
}
