import type { TakeInto } from '@/features/transfers/types'
import type { PartyView } from '@/types/party'
import type { SeatRole } from '@/types/seats'

export type PartySheetProps = {
  /** The party sheet's API, such as `/api/characters/<id>/party/<group>`. */
  api: string
  role: SeatRole
  view: PartyView
  /** The player's own character's sheet, which its name in the members links to. */
  ownSheetHref?: string
  /** Where it takes into, where the seat may take from it (module 0.31.0). */
  takeInto?: TakeInto
  /**
   * Whether it shows the party's journal notes (module 0.34.0), through its own API: first on its
   * Description tab, or under why there's no sheet.
   */
  notes?: boolean
}

export type PartyTab = 'inventory' | 'description'
