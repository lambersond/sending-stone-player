import { notesPostResponse, notesResponse, notesSeat } from '@/lib/notes-routes'
import type { NextRequest } from 'next/server'

/**
 * A book of journal notes (module 0.34.0): one of the Gamemaster's campaign's characters' notes,
 * which its player and they see, for its page to poll. Pass the version and the liveness as last
 * seen, as `?version=7&live=1`, to get 204 No Content while neither has changed. Only the
 * campaign's owner, and only for a character in its roster: 404 otherwise, saying no more.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/notes'>,
) {
  const { id, actor } = await context.params
  const place = await notesSeat({
    kind: 'personal',
    role: 'gm',
    campaign: id,
    actor,
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
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/notes'>,
) {
  const { id, actor } = await context.params
  const place = await notesSeat({
    kind: 'personal',
    role: 'gm',
    campaign: id,
    actor,
  })
  if (place instanceof Response) return place
  return notesPostResponse(request, place)
}
