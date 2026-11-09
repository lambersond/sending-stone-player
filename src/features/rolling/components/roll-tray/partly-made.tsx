import { partlyWords } from '../../utils/tray-words'
import type { TableRollState } from '@/types/roll'
import type { SeatRole } from '@/types/seats'

/**
 * Of hit dice spent at once, sent one after another or as one, those the game made before one it
 * didn't: how many, and the hit points they gave back, where the player may see them, before why
 * the rest weren't made; or how many were sent, where any couldn't be followed.
 */
export function PartlyMade({
  state,
  together,
  role,
}: Readonly<{
  state: TableRollState
  together: NonNullable<TableRollState['together']>
  role: SeatRole
}>) {
  return (
    <span>
      {partlyWords(together, role)}
      {state.healed !== undefined && (
        <span className='font-semibold text-text-primary'>
          {' · '}
          {state.healed} HP regained
        </span>
      )}
      . Not the rest
    </span>
  )
}
