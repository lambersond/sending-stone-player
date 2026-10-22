import {
  noteOrderResolveResponse,
  noteOrderResponse,
  notesSeat,
} from '@/lib/notes-routes'
import type { NextRequest } from 'next/server'

/**
 * A new order of a chapter's notes, or of those in no chapter (module 0.35.0), `{ chapterId, ids,
 * stamp }`, from the stamp its page last saw of the group: 200 with the group's stamp now, or why
 * not as `{reason}`. Only the campaign's owner: 404 otherwise, saying no more.
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/party/[group]/notes/order'>,
) {
  const { id, group } = await context.params
  const place = await notesSeat({
    kind: 'party',
    role: 'gm',
    campaign: id,
    group,
  })
  if (place instanceof Response) return place
  return noteOrderResponse(request, place)
}

/**
 * Settle an order the game didn't take, as `{ chapterId, resolve, stamp }`: 200 with the group's
 * stamp now, or why not.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/party/[group]/notes/order'>,
) {
  const { id, group } = await context.params
  const place = await notesSeat({
    kind: 'party',
    role: 'gm',
    campaign: id,
    group,
  })
  if (place instanceof Response) return place
  return noteOrderResolveResponse(request, place)
}
