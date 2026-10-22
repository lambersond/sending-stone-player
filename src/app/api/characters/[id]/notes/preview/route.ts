import { notePreviewResponse, notesSeat } from '@/lib/notes-routes'
import type { NextRequest } from 'next/server'

/**
 * A note's Markdown as the book draws it (module 0.34.0), `{ html, headings }`, for its editor's
 * preview: nothing is stored. Only its player: 404 for anyone else, saying no more.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/characters/[id]/notes/preview'>,
) {
  const { id } = await context.params
  const place = await notesSeat({
    kind: 'personal',
    role: 'player',
    character: id,
  })
  if (place instanceof Response) return place
  return notePreviewResponse(request, place)
}
