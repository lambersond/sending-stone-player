import clsx from 'clsx'

/** Slots shown as pips up to this many; past it, as a number alone. */
const MAX_PIPS = 9

/**
 * Spell slots, such as a spell level's: a pip for each, filled for each left, and how many are
 * left of how many.
 */
export function SpellSlots({
  value,
  max,
}: Readonly<{ value: number; max: number }>) {
  return (
    <span className='flex shrink-0 items-center gap-2'>
      {max <= MAX_PIPS && (
        <span aria-hidden className='flex gap-1'>
          {Array.from({ length: max }, (_, index) => (
            <span
              key={index}
              className={clsx(
                'size-2.5 rounded-full border-2 border-primary',
                index < value && 'bg-primary',
              )}
            />
          ))}
        </span>
      )}
      <span
        aria-hidden
        className='text-xs font-semibold text-text-secondary tabular-nums'
      >
        {value}/{max}
      </span>
      <span className='sr-only'>
        {value} of {max} spell slots left
      </span>
    </span>
  )
}
