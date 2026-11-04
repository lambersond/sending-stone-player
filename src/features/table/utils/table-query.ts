import { rollsKey } from '@/utils/requests/availability'
import { seenQuery } from '@/utils/seen-query'
import type { ViewSeen } from '@/features/table/types'
import type { TableView } from '@/types/table'

/** What the viewer has of a view, which the server compares to say nothing is new. */
export function seenOf(view: TableView): ViewSeen {
  return {
    version: view.version,
    live: view.live,
    sheetVersion: view.sheetVersion,
    rolls: rollsKey(view.rollsToTable, view.rollFeatures),
    // For the Gamemaster's seat (#156): where their rolls go.
    gm: view.gm?.rolls,
    // For the player's: where the Gamemaster's rolls as their character stand.
    gmRolls: view.gmRollsKey,
    // From module 0.31.0: whether the seat may move its character's items and coins.
    moves: view.moves !== undefined,
    // From module 0.32.0: whether the player types in their own dice, which another of their
    // devices may change.
    typed: view.manualDice?.on === true,
    // From module 0.33.0: whether the seat may remove its character's items.
    removes: view.removes === true,
    // From module 0.37.0: whether the player may change its character's favorites.
    favorites: view.favorites === true,
    // From module 0.39.0: whether the player may change its character's own effects.
    effects: view.effects === true,
    // From module 0.40.0: whether the player may use Wild Shape.
    wildShape: view.wildShape === true,
  }
}

/**
 * The table's poll's query, from what the viewer has of its view: each key by its name on the
 * wire, in seenQuery's order, which is the wire's, and those it has none of left out.
 */
export function tableQuery({
  version,
  live,
  sheetVersion,
  rolls,
  gm,
  gmRolls,
  moves,
  typed,
  removes,
  favorites,
  effects,
  wildShape,
}: ViewSeen): URLSearchParams {
  return seenQuery({
    version,
    live,
    rolls,
    gm,
    gmrolls: gmRolls,
    moves,
    typed,
    removes,
    favorites,
    effects,
    wildshape: wildShape,
    sheet: sheetVersion,
  })
}
