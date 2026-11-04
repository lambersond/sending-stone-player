import { useState } from 'react'
import { sameGroup } from '@/features/table/utils/party-groups'
import type { TableGroup } from '@/types/party'

/**
 * The party sheet open in its side panel, by its group's id (module 0.30.0). Once open, it stays
 * open as the group was last listed, should the group leave the list, as when the player's
 * access to it is taken away: the panel then says so, rather than vanishing.
 * @param groups - The groups the table's view lists now.
 * @returns The group open, if any, and `setPartyOpen`, which opens one by its id, or closes it.
 */
export function usePartyOpen(groups: readonly TableGroup[] | undefined) {
  const [partyOpen, setPartyOpen] = useState<string>()
  const listedParty = groups?.find(({ id }) => id === partyOpen)
  const [lastParty, setLastParty] = useState<TableGroup>()
  if (listedParty && !sameGroup(listedParty, lastParty)) {
    setLastParty(listedParty)
  }
  const party =
    listedParty ?? (lastParty?.id === partyOpen ? lastParty : undefined)
  return { party, setPartyOpen }
}
