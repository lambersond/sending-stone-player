'use client'

import clsx from 'clsx'
import { Skull } from 'lucide-react'
import { PILLS } from './constants'
import { pillOf } from './utils'
import type { TableCombatant } from '@/types/table'

/**
 * A combatant's name, with whose side they're on and whether they're down; the player's own, as a
 * use's target, Self, marked where it's the default. Each mark is said apart from the name, as
 * "Vex, Ally".
 */
export function Who({
  combatant,
  last,
  preset,
}: Readonly<{ combatant: TableCombatant; last?: string; preset?: string }>) {
  const pill = pillOf(combatant)
  return (
    <>
      <span
        className={clsx(
          'min-w-0 flex-1 truncate font-semibold',
          combatant.defeated && 'text-text-secondary line-through',
        )}
      >
        {combatant.side === 'me' ? 'Self' : combatant.name}
      </span>
      {pill && (
        <span
          className={clsx(
            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            PILLS[pill].look,
          )}
        >
          <span className='sr-only'>, </span>
          {PILLS[pill].label}
        </span>
      )}
      {combatant.defeated && (
        <span className='flex shrink-0 items-center gap-1 text-xs text-text-secondary'>
          <Skull aria-hidden className='size-3.5' />
          Defeated
        </span>
      )}
      {combatant.id === last && (
        <span className='shrink-0 text-xs font-semibold text-primary'>
          Last target
        </span>
      )}
      {combatant.id === preset && (
        <span className='shrink-0 text-xs font-semibold text-primary'>
          Default
        </span>
      )}
    </>
  )
}
