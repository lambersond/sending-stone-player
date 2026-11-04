'use client'

import { PartyPanel } from '@/features/party/components/party-panel/party-panel'
import { seatPartyApi, seatPartyPage } from '@/features/table/utils/party-urls'
import type { Character, TableSeat } from '@/types/character'
import type { TableGroup } from '@/types/party'
import type { TableView } from '@/types/table'

/**
 * A party sheet, over the character's, never part of it: read through the seat's own API, its own
 * page as the seat opens it, and the player's own sheet linked from its members.
 * @param group - The group open, if any.
 * @param sheet - The character's sheet, which nothing is taken into while it's transformed.
 */
export function TablePartyPanel({
  seat,
  character,
  sheet,
  group,
  onClose,
}: Readonly<{
  seat: TableSeat
  character: Character
  sheet?: TableView['sheet']
  group?: TableGroup
  onClose: () => void
}>) {
  return (
    <PartyPanel
      group={group}
      api={seatPartyApi(seat, character, group?.id)}
      pageHref={seatPartyPage(seat, character, group?.id)}
      role={seat.role}
      ownSheetHref={
        seat.role === 'gm' ? undefined : `/characters/${character.id}`
      }
      // Taken into the character at this table, through this seat's own API (module 0.31.0).
      // Never while the character is transformed, as by Wild Shape (module 0.40.0), its gear
      // not on its form.
      takeInto={
        character.actorId && !sheet?.form
          ? {
              kind: 'own',
              actorId: character.actorId,
              name: character.name,
              api: seat.api,
            }
          : undefined
      }
      onClose={onClose}
    />
  )
}
