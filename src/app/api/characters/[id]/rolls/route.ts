import { getCharacter } from '@/db/characters'
import { createRollRequest } from '@/db/roll-requests'
import { getCurrentUser } from '@/lib/session'
import { rollRequestSchema } from '@/schemas/roll-request'
import type { NextRequest } from 'next/server'

const headers = { 'Cache-Control': 'no-store' }

/** The largest roll read. One with every die it may throw is well under. */
const MAX_ROLL_BYTES = 16_384

/**
 * Have a roll the player made here made in the Gamemaster's game, with the same dice, when the
 * Gamemaster lets players do so. Answers 202 Accepted with the roll's id, to ask after at
 * ./[roll]; 409 Conflict while the game can't take the roll; 422 when the character can't
 * make it, such as a death saving throw while not dying; and 429 when the player is sending too
 * many. Each refusal says why as `{reason}`.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext<'/api/characters/[id]/rolls'>,
) {
  const user = await getCurrentUser()
  if (!user) return new Response(undefined, { status: 401, headers })

  const { id } = await context.params
  const character = await getCharacter(user.id, id)
  if (!character) return new Response(undefined, { status: 404, headers })

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

  const created = await createRollRequest(character, input)
  if ('reason' in created) {
    return Response.json(
      { reason: created.reason },
      { status: created.status, headers },
    )
  }
  return Response.json({ id: created.id }, { status: 202, headers })
}
