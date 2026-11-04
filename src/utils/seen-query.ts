/** The flags a view may hold, each sent as `1` while it's set, in the order they're sent. */
const FLAGS = [
  'moves',
  'typed',
  'removes',
  'favorites',
  'effects',
  'wildshape',
] as const

/**
 * What a page holds of a view, as the query it polls with, which the server compares to say
 * nothing is new (204): the version and whether the game was live as each view has them, then
 * whatever else that view sends back, each left out while it's unset, in one order for every view
 * (the table's, which the party's and a companion's follow). The order is the wire's: the same
 * names in another order would make a new query string.
 * @param seen - What the page holds: a view's version, whether it was live, its rolls' and the
 *   Gamemaster's keys, its flags, and its sheet's version.
 */
export function seenQuery(seen: {
  version?: number | string
  live?: boolean
  rolls?: string
  gm?: string
  gmrolls?: string
  moves?: boolean
  typed?: boolean
  removes?: boolean
  favorites?: boolean
  effects?: boolean
  wildshape?: boolean
  sheet?: string
}): URLSearchParams {
  const query = new URLSearchParams()
  if (seen.version !== undefined) query.set('version', String(seen.version))
  if (seen.live !== undefined) query.set('live', seen.live ? '1' : '0')
  if (seen.rolls) query.set('rolls', seen.rolls)
  if (seen.gm) query.set('gm', seen.gm)
  if (seen.gmrolls) query.set('gmrolls', seen.gmrolls)
  for (const flag of FLAGS) if (seen[flag]) query.set(flag, '1')
  if (seen.sheet) query.set('sheet', seen.sheet)
  return query
}
