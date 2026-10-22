import {
  noteDeleteResponse,
  notePatchResponse,
  notesSeat,
} from '@/lib/notes-routes'
import type { NextRequest } from 'next/server'

/**
 * Change a note or chapter in the book (module 0.34.0), from the stamp its page last saw, or settle
 * a change the game didn't take, as `{resolve, stamp}`: 200 with its stamp now, or why not as
 * `{reason}`. Only the campaign's owner: 404 otherwise, saying no more.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/party/[group]/notes/[note]'>,
) {
  const { id, group, note } = await context.params
  const place = await notesSeat({
    kind: 'party',
    role: 'gm',
    campaign: id,
    group,
  })
  if (place instanceof Response) return place
  return notePatchResponse(request, place, note)
}

/** Delete an entry from the book, from the stamp its page last saw, as `?stamp=`. */
export async function DELETE(
  request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/party/[group]/notes/[note]'>,
) {
  const { id, group, note } = await context.params
  const place = await notesSeat({
    kind: 'party',
    role: 'gm',
    campaign: id,
    group,
  })
  if (place instanceof Response) return place
  return noteDeleteResponse(request, place, note)
}
