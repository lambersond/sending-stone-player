import { bare, NO_STORE } from '@/lib/routes/http'
import { getCurrentUser } from '@/lib/session'
import type { SeatHeaders } from '@/lib/routes/types'

// How a sheet's routes find who is at it (#156): its player, through their own Character
// (`getPlayerSeat`), or the campaign's Gamemaster, through the campaign they own (`getGmSeat`); a
// companion's and a party's from those. Every route resolves the seat itself, from the session and
// its address alone, answering 401 signed out and 404 for a sheet that isn't the user's to see,
// saying no more; what it answers then is scoped by that seat alone.

/**
 * A route's answer once it knows who is at it: 401 signed out, then its address read, 404 where
 * `find` finds no seat there for the user, else `answer`. Neither refusal is cached, but where a
 * route's own carry no headers (bug B16).
 * @param params - The route's address, as Next.js gives it.
 */
export async function seatAnswer<P, S>(
  params: Promise<P>,
  find: (userId: string, address: P) => Promise<S | undefined>,
  answer: (seat: S, address: P) => Promise<Response>,
  { headers = NO_STORE, signedOut = headers }: SeatHeaders = {},
): Promise<Response> {
  const user = await getCurrentUser()
  if (!user) return bare(401, signedOut)
  const address = await params
  const seat = await find(user.id, address)
  if (!seat) return bare(404, headers)
  return answer(seat, address)
}
