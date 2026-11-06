import { Minus, Plus } from 'lucide-react'
import { AT_MOST, TRAY_STEP } from './constants'
import type { TrayDie } from './types'
import type { DieSides } from '@lambersond/3d-dice-core'

/**
 * The dice picked, a chip each size, smallest first, "2d6", with one fewer and one more of it: the
 * last one fewer takes the size away; none more once the tray holds as many dice as it may.
 * @param room - Whether one more die may be added.
 */
export function TrayChips({
  dice,
  room,
  onAdd,
  onRemove,
}: Readonly<{
  dice: readonly TrayDie[]
  room: boolean
  onAdd: (sides: DieSides) => void
  onRemove: (sides: DieSides) => void
}>) {
  return (
    <ul aria-label='Dice to roll' className='flex flex-wrap gap-2'>
      {dice.map(({ sides, count }) => (
        <li
          key={sides}
          className='flex items-center rounded-full border border-border bg-page'
        >
          <button
            type='button'
            aria-label={`One d${sides} fewer`}
            onClick={() => onRemove(sides)}
            className={TRAY_STEP}
          >
            <Minus aria-hidden className='size-4' />
          </button>
          <span className='min-w-10 text-center text-sm font-semibold tabular-nums'>
            {count}d{sides}
          </span>
          <button
            type='button'
            aria-label={`One d${sides} more`}
            aria-disabled={!room}
            title={room ? undefined : AT_MOST}
            onClick={() => onAdd(sides)}
            className={TRAY_STEP}
          >
            <Plus aria-hidden className='size-4' />
          </button>
        </li>
      ))}
    </ul>
  )
}
