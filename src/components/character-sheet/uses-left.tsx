import clsx from 'clsx'
import type { SheetUses } from '@/types/sending-stone'

/** Uses left of a limited feature: 1/3, in ruby when none are left. */
export function UsesLeft({ uses }: Readonly<{ uses: SheetUses }>) {
  return (
    <span
      className={clsx(
        'shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums',
        uses.value === 0 ? 'border-ruby/40 text-ruby' : 'border-border',
      )}
    >
      <span aria-hidden>
        {uses.value}/{uses.max}
      </span>
      <span className='sr-only'>
        {uses.value} of {uses.max} uses left
      </span>
    </span>
  )
}
