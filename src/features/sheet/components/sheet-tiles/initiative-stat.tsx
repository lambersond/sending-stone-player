'use client'

import clsx from 'clsx'
import { Zap } from 'lucide-react'
import { Stat } from './stat'
import { RollButton } from '@/features/rolling/components/roll-button/roll-button'
import { afterWords } from '@/utils/creature-words'
import { formatModifier } from '@/utils/format-modifier'
import type { RollActions } from '@/features/rolling/types'

/**
 * The tile of a character's or a creature's initiative. While its combatant waits to roll, a
 * button that rolls it for the combat, with the Roll badge; else one that rolls it as a check. A
 * companion that acts right after its character, while that one's in the combat (module 0.36.0),
 * rolls none: the tile says so, with the "After Thorin" badge, as a group named for it.
 * @param combatId - The combat its combatant waits to roll initiative in.
 * @param follows - The character it acts right after.
 */
export function InitiativeStat({
  modifier,
  combatId,
  follows,
  actions,
  tag,
}: Readonly<{
  modifier: number
  combatId?: string
  follows?: string
  actions: RollActions
  /** Whose it is, where it's a form's, from module 0.40.0 (`Stat`'s `tag`). */
  tag?: string
}>) {
  const shown = formatModifier(modifier)
  if (follows) {
    return (
      <Stat
        label='Initiative'
        short='Init'
        group={`Initiative, ${shown}, acts right after ${follows}`}
      >
        <Zap aria-hidden className='size-4 text-text-secondary' />
        {shown}
        <span className='truncate rounded bg-primary/10 px-1 text-[10px] font-bold tracking-wide text-primary-text uppercase'>
          {afterWords(follows)}
        </span>
      </Stat>
    )
  }
  return (
    <Stat label='Initiative' short='Init' tag={tag}>
      <RollButton
        target={{
          label: 'Initiative',
          modifier,
          mode: 0,
          source: combatId ? { kind: 'initiative', combatId } : undefined,
        }}
        {...actions}
        label={`Initiative, ${shown}${combatId ? ', to roll for the combat' : ''}`}
        // Its Roll badge goes under the number in a tile too narrow for both, rather than
        // under the tile beside it.
        className='-mx-1 inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 rounded-lg px-1 transition-colors hover:bg-primary/10 focus-visible:bg-primary/10'
      >
        <Zap
          aria-hidden
          className={clsx(
            'size-4',
            combatId ? 'text-primary' : 'text-text-secondary',
          )}
        />
        {shown}
        {combatId && (
          <span
            aria-hidden
            className='rounded bg-primary px-1 text-[10px] font-bold tracking-wide text-on-primary uppercase'
          >
            Roll
          </span>
        )}
      </RollButton>
    </Stat>
  )
}
