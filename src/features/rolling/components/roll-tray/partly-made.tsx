import type { TableRollState } from '@/types/roll'

/**
 * Of hit dice spent at once, sent one after another or as one, those the game made before one it
 * didn't: how many, and the hit points they gave back, where the player may see them, before why
 * the rest weren't made.
 */
export function PartlyMade({
  state,
  together: { count, made },
}: Readonly<{
  state: TableRollState
  together: NonNullable<TableRollState['together']>
}>) {
  return (
    <span>
      {made} of {count} made at the table
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
