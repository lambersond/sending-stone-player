import type { TakeInto } from '@/features/transfers/types'
import type { PartyView } from '@/types/party'
import type { SeatRole } from '@/types/seats'

export type PartyPageProps = {
  /** The party sheet's API, such as `/api/characters/<id>/party/<group>`. */
  api: string
  role: SeatRole
  /** The view the page was rendered with. */
  initialView: PartyView
  /** Where its back arrow goes, and what it's called. */
  back: { href: string; label: string }
  /** The player's own character's sheet, which its name in the members links to. */
  ownSheetHref?: string
  /**
   * Where it takes into, where the seat may take from it (module 0.31.0): only data, as a server
   * page passes it.
   */
  takeInto?: TakeInto
}
