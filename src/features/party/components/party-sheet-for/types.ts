import type { PartySheetProps } from '../party-sheet/types'
import type { PartyState } from '@/features/party/types'
import type { PartyView } from '@/types/party'

export type PartySheetForProps = Omit<PartySheetProps, 'view'> & {
  view?: PartyView
  state: PartyState
}
