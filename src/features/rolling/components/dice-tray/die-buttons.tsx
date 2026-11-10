import { useId, type Ref } from 'react'
import { DIE_SIDES, type DieSides } from '@lambersond/3d-dice-core'
import { AT_MOST } from './constants'
import { iconSides } from './utils'
import { DieIcon } from '@/components/icons/die'

/**
 * A button for each size of die, d4 to d100, each tap adding one: its shape, a d100's a d10's, and
 * its size, "d6". Four to a row in a narrow tray, all seven in a wide one. Once the tray holds as
 * many dice as it may, each says so, and adds none.
 * @param room - Whether one more die may be added.
 * @param addRef - The ref of a size's button, which focus may be moved to.
 */
export function DieButtons({
  room,
  onAdd,
  addRef,
}: Readonly<{
  room: boolean
  onAdd: (sides: DieSides) => void
  addRef: (sides: DieSides) => Ref<HTMLButtonElement>
}>) {
  const full = useId()
  return (
    <div className='flex flex-col gap-1'>
      <div
        role='group'
        aria-label='Add a die'
        className='grid grid-cols-4 gap-1.5 @md:grid-cols-7'
      >
        {DIE_SIDES.map(sides => (
          <button
            key={sides}
            ref={addRef(sides)}
            type='button'
            aria-label={`Add a d${sides}`}
            aria-disabled={!room}
            aria-describedby={room ? undefined : full}
            onClick={() => onAdd(sides)}
            className='flex h-11 min-w-11 items-center justify-center gap-1 rounded-xl border border-border bg-page text-sm font-semibold transition-colors hover:border-primary/50 hover:bg-primary/5 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-border aria-disabled:hover:bg-page'
          >
            <DieIcon
              sides={iconSides(sides)}
              className='size-4 shrink-0 text-primary'
            />
            d{sides}
          </button>
        ))}
      </div>
      {!room && (
        <p id={full} className='text-xs text-text-secondary'>
          {AT_MOST}
        </p>
      )}
    </div>
  )
}
