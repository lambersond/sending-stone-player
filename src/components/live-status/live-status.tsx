import clsx from 'clsx'
import { statesOf } from './utils'
import { useTableRole } from '@/hooks/use-table-api'
import { seatWords } from '@/utils/seat-words'
import type { LiveState } from './types'

export function LiveStatus({ state }: Readonly<{ state: LiveState }>) {
  const { label, dot, hint } = statesOf(seatWords(useTableRole()))[state]
  return (
    <span
      role='status'
      title={hint}
      className='inline-flex shrink-0 items-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs font-semibold'
    >
      <span aria-hidden className={clsx('size-2 rounded-full', dot)} />
      {label}
      <span className='sr-only'>. {hint}</span>
    </span>
  )
}
