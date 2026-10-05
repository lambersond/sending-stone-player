import { getCharacter } from '@/db/characters'
import { getSheetText } from '@/db/sheet-texts'
import { getCurrentUser } from '@/lib/session'
import { TEXT_HASH } from '@/schemas/sending-stone'
import type { NextRequest } from 'next/server'

/**
 * A description on a character's sheet, such as a feature's, for its player: `{ html }`, already
 * sanitised. Only the character's own sheet's descriptions are served. The same hash always names
 * the same description, so the browser may keep it.
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext<'/api/characters/[id]/texts/[hash]'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401 })

  const { id, hash } = await context.params
  if (!TEXT_HASH.test(hash)) return new Response(undefined, { status: 404 })
  const character = await getCharacter(user.id, id)
  if (!character) return new Response(undefined, { status: 404 })

  const html = await getSheetText(character, hash)
  if (html === undefined) {
    return new Response(undefined, {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
  return Response.json(
    { html },
    { headers: { 'Cache-Control': 'private, max-age=86400' } },
  )
}
