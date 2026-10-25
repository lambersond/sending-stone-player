import { createHash } from 'node:crypto'
import {
  COOKBOOK_REFUSAL,
  COOKBOOK_VERSIONS,
  MAX_DISH_BYTES,
  MOST_DISHES_WAITING,
  type CookbookRefusalReason,
} from '@/constants/cookbook'
import {
  acceptDish,
  deleteCookbookLink,
  findCookbookLink,
  getCookbookView,
} from '@/db/cookbook'
import { attempt } from '@/lib/bridge-http'
import { bearerSecret } from '@/lib/campaign-secret'
import { hashCookbookCode, isCookbookCode } from '@/lib/cookbook-code'
import { cookbookDishSchema } from '@/schemas/cookbook'
import type { Character } from '@/types/character'
import type { NextRequest } from 'next/server'

// What the Magical Recipe Book's routes answer, from module 0.38.0: its server's post of a dish,
// by a player's link code alone, and the player's card of what became of their dishes. The
// cookbook shows a refusal's `message` to its player, trimmed and cut to 200 characters, and reads
// any 2xx as taken, its body unread, so every answer is JSON, never cached, never a 404 (which it
// reads as "Sending Stone doesn't take dishes yet"), and every message is under 200 characters.
// `refuse()` isn't used: it adds CORS, and its reasons are the module's.

/** Why the cookbook's post was refused, as its answer says. */
type CookbookRefusal = {
  reason: CookbookRefusalReason
  message: string
  /** The largest body taken, in bytes. */
  limit?: number
  /** The first part of the dish that couldn't be read, as `effect.changes.0`. */
  field?: string
}

const UNKNOWN_CODE =
  'Sending Stone doesn’t know this link code. Make a new one on your character’s page in Sending Stone and link again.'

const NO_CODE: CookbookRefusal = {
  reason: COOKBOOK_REFUSAL.NO_CODE,
  message: UNKNOWN_CODE,
}
const UNLINKED: CookbookRefusal = {
  reason: COOKBOOK_REFUSAL.UNLINKED,
  message: UNKNOWN_CODE,
}
const MOVED: CookbookRefusal = {
  reason: COOKBOOK_REFUSAL.MOVED,
  message:
    'This link code is for a character you no longer play in Sending Stone. Make a new one and link again.',
}
const NOT_JSON: CookbookRefusal = {
  reason: COOKBOOK_REFUSAL.NOT_JSON,
  message: 'Sending Stone takes dishes as JSON.',
}
const TOO_LARGE: CookbookRefusal = {
  reason: COOKBOOK_REFUSAL.TOO_LARGE,
  message: 'This dish is larger than Sending Stone takes.',
  limit: MAX_DISH_BYTES,
}
const NOT_READ: CookbookRefusal = {
  reason: COOKBOOK_REFUSAL.INVALID,
  message: 'Sending Stone couldn’t read this dish (not JSON).',
}
const VERSION: CookbookRefusal = {
  reason: COOKBOOK_REFUSAL.VERSION,
  message:
    'This dish comes from a newer Magical Recipe Book than Sending Stone reads.',
}
const OFF: CookbookRefusal = {
  reason: COOKBOOK_REFUSAL.OFF,
  message:
    'Your Gamemaster hasn’t turned on dishes from the Magical Recipe Book for this game.',
}
const UPDATE: CookbookRefusal = {
  reason: COOKBOOK_REFUSAL.UPDATE,
  message:
    'Your Gamemaster’s Sending Stone module needs updating to take this dish.',
}
const BUSY: CookbookRefusal = {
  reason: COOKBOOK_REFUSAL.BUSY,
  message: 'That’s a lot of dishes at once. Wait a minute and send again.',
}
// The user's words (round 0.38.0).
const DAILY: CookbookRefusal = {
  reason: COOKBOOK_REFUSAL.DAILY,
  message:
    'That’s the most dishes Sending Stone takes from one link in a day. Try again tomorrow.',
}
const FULL: CookbookRefusal = {
  reason: COOKBOOK_REFUSAL.FULL,
  message: `Your Gamemaster already has ${MOST_DISHES_WAITING} dishes waiting for Foundry. Try again once they’ve served some.`,
}
const UNAVAILABLE: CookbookRefusal = {
  reason: COOKBOOK_REFUSAL.UNAVAILABLE,
  message:
    'Sending Stone couldn’t take this dish just now. Try again in a moment.',
}

const FAILED = 'Failed to take a dish from the Magical Recipe Book'

/** A refusal to the cookbook's server: JSON, never cached, no CORS. */
function cookbookRefusal(
  status: number,
  refusal: CookbookRefusal,
  headers?: Record<string, string>,
): Response {
  return Response.json(refusal, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers },
  })
}

/** A dish taken, new (202) or already held (200). */
function cookbookAnswer(
  status: 200 | 202,
  body: { id: string; status: string },
): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

/**
 * A dish posted by the Magical Recipe Book's server, answered in this order: the link code first,
 * so a caller without one learns nothing of the body; then the body, its version before its
 * schema, so a newer cookbook is told why; then a dish held already, before any gate, as a refusal
 * would make the cookbook's player send it again for ever; then the campaign's switch, its
 * module's versions and the limits. Whether Foundry is open is no gate: a dish waits here for it.
 */
export async function dishPostResponse(request: Request): Promise<Response> {
  const code = bearerSecret(request.headers.get('authorization'))
  // Only its hash is ever a query's argument, so a code never reaches a log.
  if (!isCookbookCode(code)) return cookbookRefusal(401, NO_CODE)
  const link = await attempt(
    () => findCookbookLink(hashCookbookCode(code)),
    FAILED,
  )
  if (link === undefined) return cookbookRefusal(500, UNAVAILABLE)
  if (link === null) return cookbookRefusal(401, UNLINKED)
  // Bound to the seat's actor and campaign when made: following the seat to another actor could
  // put a bane on the wrong character.
  if (
    link.character.campaignId !== link.campaignId ||
    link.character.actorId !== link.actorId
  ) {
    await attempt(() => deleteCookbookLink(link.id), FAILED)
    return cookbookRefusal(401, MOVED)
  }

  const type = request.headers.get('content-type')?.toLowerCase()
  if (!type?.startsWith('application/json')) {
    return cookbookRefusal(415, NOT_JSON)
  }
  const declared = Number(request.headers.get('content-length'))
  if (declared > MAX_DISH_BYTES) return cookbookRefusal(413, TOO_LARGE)
  const text = await request.text()
  if (Buffer.byteLength(text) > MAX_DISH_BYTES) {
    return cookbookRefusal(413, TOO_LARGE)
  }
  let body: unknown
  try {
    body = JSON.parse(text, cleanText)
  } catch {
    return cookbookRefusal(400, NOT_READ)
  }
  const version = (body as { version?: unknown } | null)?.version
  if (
    typeof version === 'number' &&
    !(COOKBOOK_VERSIONS as readonly number[]).includes(version)
  ) {
    return cookbookRefusal(400, VERSION)
  }
  const parsed = cookbookDishSchema.safeParse(body)
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join('.') || 'body'
    return cookbookRefusal(400, {
      reason: COOKBOOK_REFUSAL.INVALID,
      message: `Sending Stone couldn’t read this dish (${field}).`,
      field,
    })
  }

  const accepted = await attempt(() => acceptDish(link, parsed.data), FAILED)
  if (!accepted) return cookbookRefusal(500, UNAVAILABLE)
  switch (accepted.kind) {
    case 'repeat': {
      return cookbookAnswer(200, { id: accepted.id, status: accepted.status })
    }
    case 'new': {
      return cookbookAnswer(202, { id: accepted.id, status: accepted.status })
    }
    case 'busy': {
      return cookbookRefusal(429, BUSY, { 'Retry-After': '60' })
    }
    case 'daily': {
      return cookbookRefusal(429, DAILY, { 'Retry-After': '3600' })
    }
    case 'off': {
      return cookbookRefusal(409, OFF)
    }
    case 'update': {
      return cookbookRefusal(409, UPDATE)
    }
    case 'full': {
      return cookbookRefusal(409, FULL)
    }
  }
}

/**
 * JSON.parse's reviver for a dish: Postgres stores neither U+0000 nor half of a surrogate pair in
 * text, so either would fail every insert of the dish, which the cookbook would send again for
 * ever. So each string drops U+0000 and is made well formed, and a property whose name holds
 * either is dropped. Cleaned, never refused, as the cookbook's player can't fix it.
 */
function cleanText(key: string, value: unknown): unknown {
  if (key.includes('\u0000') || !key.isWellFormed()) return undefined
  return typeof value === 'string'
    ? value.replaceAll('\u0000', '').toWellFormed()
    : value
}

const headers = { 'Cache-Control': 'no-store' }

const bare = (status: number) => new Response(undefined, { status, headers })

/**
 * A player's Magical Recipe Book card, for their page to poll. Pass its version as last seen, as
 * `?version=9f2c41d0aa1e`, to get 204 No Content while nothing has changed. Only for a character
 * playing in a campaign: another is answered 404, saying no more. Its dishes never touch the
 * table's version, which every page of the campaign watches.
 */
export async function cookbookViewResponse(
  request: NextRequest,
  character: Pick<Character, 'id' | 'campaignId' | 'actorId'>,
): Promise<Response> {
  const { id, campaignId, actorId } = character
  if (!campaignId || !actorId) return bare(404)
  const view = await getCookbookView({ id, campaignId, actorId })
  if (!view) return bare(404)
  const version = createHash('sha256')
    .update(JSON.stringify(view))
    .digest('hex')
    .slice(0, 12)
  if (request.nextUrl.searchParams.get('version') === version) return bare(204)
  return Response.json({ version, ...view }, { headers })
}
