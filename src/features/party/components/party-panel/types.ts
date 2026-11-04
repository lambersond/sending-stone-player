import type { TakeInto } from '@/features/transfers/types'
import type { TableGroup } from '@/types/party'
import type { SeatRole } from '@/types/seats'

export type PartyPanelProps = {
  /** The group whose sheet is open, as the table last listed it; unset while it's closed. */
  group?: TableGroup
  /** Its party sheet's API, such as `/api/characters/<id>/party/<group>`. */
  api: string
  /** Its own page, which the panel's link opens it as. */
  pageHref: string
  role: SeatRole
  /** The player's own character's sheet, which its name in the members links to. */
  ownSheetHref?: string
  /** Where it takes into, where the seat may take from it (module 0.31.0). */
  takeInto?: TakeInto
  onClose: () => void
}
