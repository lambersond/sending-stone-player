import { dishPostResponse } from '@/lib/cookbook-routes'

// Where the Magical Recipe Book's server posts each dish a player eats there, from module 0.38.0,
// with the player's link code as `Authorization: Bearer <code>`, server to server.
//
// No CORS, no OPTIONS export and no Forge-origin check: the module routes' gate needs a Forge
// Origin, which a server never sends. Without an OPTIONS export Next answers one itself with
// `Allow` alone, so a page on another site can't use a code from a visitor's browser, as a bearer
// header needs that preflight to allow it. That doesn't protect a stolen code, which works from
// any server or curl; revoking it does.
//
// Never redirect. The cookbook's fetch follows redirects: one to another origin, such as http to
// https or the apex to www, drops `Authorization`, so the cookbook would be told the code is
// unknown, and a 301 or 302 makes the POST a GET, which this route doesn't export, answered 405,
// which the cookbook reads as "couldn't take this dish just now". So the origin the cookbook is
// given must answer at this path itself.
//
// The body is parsed with a reviver that cleans what Postgres can't store, U+0000 and half a
// surrogate pair, never refusing it: either would otherwise fail every insert of the dish with a
// 500, and the cookbook would send it again for ever.
//
// A failed database step is logged by `attempt()`. Prisma's messages may print a body's fields,
// but never a code: only its hash is ever a query's argument.

/** A dish from the Magical Recipe Book's server, for the seat its link code names. */
export async function POST(request: Request) {
  return dishPostResponse(request)
}
