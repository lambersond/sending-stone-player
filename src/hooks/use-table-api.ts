import { createContext, useContext } from 'react'
import type { TableSeat } from '@/types/character'

/**
 * The seat a table page is for (#156): a character's player, or its campaign's Gamemaster rolling
 * as it, with the API base it reads and rolls through. Unset on a player's page, which reads and
 * rolls through its character's own API, so nothing needs to provide it there.
 */
export const TableApiContext = createContext<TableSeat | undefined>(undefined)

/**
 * Where a table page reads a character's descriptions and sends its rolls: the Gamemaster's seat's
 * own API, or else the character's.
 * @param characterId - The character, for a player's page.
 */
export function useTableApi(characterId: string): string {
  const seat = useContext(TableApiContext)
  return seat?.api ?? `/api/characters/${characterId}`
}

/** Whose page this is: its player's, unless a Gamemaster's seat is provided. */
export function useTableRole(): TableSeat['role'] {
  return useContext(TableApiContext)?.role ?? 'player'
}
