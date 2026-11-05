import type { Seen } from '@/lib/routes/types'

// How the seat routes answer: never cached, as each answer is the seat's own and changes as its
// game does; a description is the one answer the browser may keep.

/** The header of every seat route's answer but a description's: never cached. */
export const NO_STORE = { 'Cache-Control': 'no-store' }

/** An answer saying nothing more than its status. */
export function bare(status: number, headers: HeadersInit = NO_STORE) {
  return new Response(undefined, { status, headers })
}

/**
 * A description on a sheet: `{ html }`, already sanitised, which the browser may keep, as the same
 * hash always names the same description; 404 where the seat has none of that hash.
 */
export function textAnswer(html: string | undefined): Response {
  if (html === undefined) return bare(404)
  return Response.json(
    { html },
    { headers: { 'Cache-Control': 'private, max-age=86400' } },
  )
}

/**
 * Whether a page's query says it last saw what's current, by key: a number as sent, text as sent
 * (or none for none), and a flag sent as `1` while it's on; and of what a page may leave out, the
 * value as sent or its absence for none.
 */
export function seenAs(
  known: URLSearchParams,
  current: Seen,
  optional: Record<string, string | undefined> = {},
): boolean {
  return (
    Object.entries(current).every(([key, value]) => {
      const said = known.get(key)
      if (typeof value === 'number') return Number(said) === value
      if (typeof value === 'string') return (said ?? '') === value
      return (said === '1') === value
    }) &&
    Object.entries(optional).every(
      ([key, value]) => (known.get(key) ?? undefined) === value,
    )
  )
}
