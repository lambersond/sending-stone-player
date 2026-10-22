import { notePreviewResponse, notesSeat } from '@/lib/notes-routes'
import type { NextRequest } from 'next/server'

/**
 * A note's Markdown as the book draws it (module 0.34.0), `{ html, headings }`, for its editor's
 * preview: nothing is stored. Only the campaign's owner, and only for a character in its roster:
 * 404 otherwise, saying no more.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/campaigns/[id]/characters/[actor]/notes/preview'>,
) {
  const { id, actor } = await context.params
  const place = await notesSeat({
    kind: 'personal',
    role: 'gm',
    campaign: id,
    actor,
  })
  if (place instanceof Response) return place
  return notePreviewResponse(request, place)
}
