import clsx from 'clsx'
import { ActionChip } from './action-chip'
import { Badge } from './badge'
import { ACTIONS } from './constants'
import { DiceList } from './dice-list'
import { Targets } from './targets'
import { bubble } from './utils'
import type { TableRoll } from '@/types/roll'
import type { TableAction, TableTarget } from '@/types/table'

/** A roll's card: what it was for, its marks, who it was aimed at, its formula, dice and total. */
export function RollCard({
  roll,
  label,
  action,
  targets,
  summary,
  whisper,
  mine,
}: Readonly<{
  roll: TableRoll
  label?: string
  action?: TableAction
  targets: TableTarget[]
  summary?: string
  whisper: boolean
  mine: boolean
}>) {
  return (
    <div
      className={clsx(
        bubble(whisper, mine, roll.critical),
        'flex w-full max-w-sm flex-col gap-2 p-3',
        action && ['border-l-4', ACTIONS[action].accent],
      )}
    >
      <div className='flex items-start justify-between gap-2'>
        <span className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
          {action && <ActionChip action={action} />}
          {(label ?? !action) && (
            <span className='text-sm font-semibold'>{label ?? 'Roll'}</span>
          )}
        </span>
        <div className='flex shrink-0 flex-wrap justify-end gap-1'>
          {roll.critical && (
            <Badge className='bg-gold text-on-gold'>Critical</Badge>
          )}
          {roll.fumble && (
            <Badge className='bg-danger/15 text-danger'>Nat 1</Badge>
          )}
          {roll.advantage && (
            <Badge className='bg-primary text-on-primary'>Advantage</Badge>
          )}
          {roll.disadvantage && (
            <Badge className='bg-ruby text-on-ruby'>Disadvantage</Badge>
          )}
        </div>
      </div>
      <Targets targets={targets} summary={summary} />
      <div className='flex items-end justify-between gap-3'>
        <div className='flex min-w-0 flex-col gap-1.5'>
          <span className='font-mono text-sm break-all text-text-secondary'>
            {roll.formula}
          </span>
          <DiceList dice={roll.dice} />
        </div>
        <span
          className={clsx(
            'text-3xl leading-none font-semibold tabular-nums',
            roll.critical && 'text-gold-text',
            roll.fumble && 'text-danger',
          )}
        >
          <span className='sr-only'>Total </span>
          {roll.total ?? '–'}
        </span>
      </div>
    </div>
  )
}
