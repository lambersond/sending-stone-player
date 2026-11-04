import clsx from 'clsx'
import { ACTIONS } from './constants'
import type { TableAction } from '@/types/table'

/** A chip naming a kind of combat roll, in its colour. */
export function ActionChip({ action }: Readonly<{ action: TableAction }>) {
  const { label, icon: Icon, chip } = ACTIONS[action]
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase',
        chip,
      )}
    >
      <Icon aria-hidden className='size-3' />
      {label}
    </span>
  )
}
