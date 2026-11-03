import clsx from 'clsx'
import { ActionChip } from './action-chip'
import { ACTIONS, CAPTION } from './constants'
import { Targets } from './targets'
import { bubble } from './utils'
import type { TableMessage } from '@/types/table'

/** A card's body: an item or ability used, marked as the combat roll it is, and who at. */
export function UsedBody({
  message,
  mine,
}: Readonly<{ message: TableMessage; mine: boolean }>) {
  const { whisper, label, action, targets, summary } = message
  return (
    <div
      className={clsx(
        bubble(whisper, mine),
        'flex flex-col gap-1.5',
        action && ['border-l-4', ACTIONS[action].accent],
      )}
    >
      {action ? (
        <ActionChip action={action} />
      ) : (
        <span className={CAPTION}>Used</span>
      )}
      <span className='font-semibold'>{label ?? 'An item or ability'}</span>
      <Targets targets={targets} summary={summary} />
    </div>
  )
}
