import { notePreviewResponse, notesSeat } from '@/lib/notes-routes'
import type { NextRequest } from 'next/server'

/**
 * A note's Markdown as the book draws it (module 0.34.0), `{ html, headings }`, for its editor's
 * preview: nothing is stored. Only the campaign's owner: 404 otherwise, saying no more.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/party/[group]/notes/preview'>,
) {
  const { id, group } = await context.params
  const place = await notesSeat({
    kind: 'party',
    role: 'gm',
    campaign: id,
    group,
  })
  if (place instanceof Response) return place
  return notePreviewResponse(request, place)
}
