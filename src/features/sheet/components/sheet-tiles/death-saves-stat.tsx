'use client'

import clsx from 'clsx'
import { Dices } from 'lucide-react'
import { Stat } from './stat'
import { isShowingDeathSaves } from './utils'
import { RollButton } from '@/features/rolling/components/roll-button/roll-button'
import { isDying } from '@/utils/requests/status'
import type { RollActions } from '@/features/rolling/types'
import type { TableSheet } from '@/types/table'

/**
 * The death saving throws made, on a row of their own, while the sheet shows them, with a button
 * that rolls the next while the character is dying.
 */
export function DeathSavesStat({
  sheet,
  actions,
}: Readonly<{ sheet: TableSheet; actions: RollActions }>) {
  const { deathSaves } = sheet
  if (!deathSaves || !isShowingDeathSaves(sheet)) return
  return (
    <Stat label='Death saves' wide='row'>
      <span className='flex items-center justify-between gap-2'>
        <DeathSaves saves={deathSaves} />
        {isDying(sheet) && (
          <RollButton
            target={{
              label: 'Death saving throw',
              modifier: 0,
              mode: 0,
              source: { kind: 'death' },
            }}
            {...actions}
            label='Death saving throw'
            className='inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:bg-primary/5 focus-visible:border-primary'
          >
            <Dices aria-hidden className='size-4 text-primary' />
            Roll
          </RollButton>
        )}
      </span>
    </Stat>
  )
}

/** Death saving throws made: successes and failures, three of either ending them. */
function DeathSaves({
  saves,
}: Readonly<{ saves: { success: number; failure: number } }>) {
  return (
    <span className='flex flex-col gap-1 text-xs font-semibold'>
      <SaveMarks label='Successes' count={saves.success} mark='bg-primary' />
      <SaveMarks label='Failures' count={saves.failure} mark='bg-danger' />
    </span>
  )
}

function SaveMarks({
  label,
  count,
  mark,
}: Readonly<{ label: string; count: number; mark: string }>) {
  return (
    <span className='flex items-center gap-2'>
      <span className='w-16 text-text-secondary'>{label}</span>
      <span aria-hidden className='flex gap-1'>
        {[0, 1, 2].map(index => (
          <span
            key={index}
            className={clsx(
              'size-3 rounded-full border-2 border-border',
              index < count && clsx('border-transparent', mark),
            )}
          />
        ))}
      </span>
      <span className='sr-only'>{Math.min(count, 3)} of 3</span>
    </span>
  )
}
