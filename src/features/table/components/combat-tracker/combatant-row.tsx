'use client'

import clsx from 'clsx'
import { HitPoints } from './hit-points'
import { formatInitiative } from './utils'
import type { Side, TableCombatant } from '@/types/table'

const INITIATIVE: Record<Side, string> = {
  me: 'bg-primary text-on-primary',
  party: 'bg-party/15 text-party',
  other: 'bg-foe/15 text-foe',
}

const ROLE: Record<Side, string | undefined> = {
  me: 'You',
  party: 'Ally',
  other: undefined,
}

/**
 * How one not of the party is drawn where the game has its token disposed, from module 0.29.0:
 * one marked Friendly as the party's allies are, and a neutral one in grey, not as a foe.
 */
const STANCES: Record<
  NonNullable<TableCombatant['stance']>,
  { initiative: string; role: string }
> = {
  ally: { initiative: INITIATIVE.party, role: 'Ally' },
  neutral: {
    initiative: 'bg-text-secondary/15 text-text-secondary',
    role: 'Neutral',
  },
}

/**
 * One combatant in the initiative order: its initiative, name and role, its hit points where
 * players may see them, and whether it acts now or is defeated.
 */
export function CombatantRow({
  combatant,
  current,
}: Readonly<{ combatant: TableCombatant; current: boolean }>) {
  const { name, initiative, defeated, side, hp } = combatant
  const stance = combatant.stance && STANCES[combatant.stance]
  // One of the player's own creatures, as a companion of their character's (module 0.36.0).
  let role = ROLE[side]
  if (stance) role = stance.role
  else if (combatant.yours) role = 'Yours'
  return (
    <li
      aria-current={current ? 'step' : undefined}
      className={clsx(
        'flex items-center gap-3 rounded-2xl border p-3',
        current ? 'border-primary bg-primary/5' : 'border-border bg-card',
        defeated && 'opacity-60',
      )}
    >
      <span
        className={clsx(
          // Wide enough for a tiebreaker such as 18.25, so every row's box lines up.
          'flex h-10 w-15 shrink-0 items-center justify-center rounded-[10px] font-bold tabular-nums',
          stance ? stance.initiative : INITIATIVE[side],
        )}
      >
        <span className='sr-only'>Initiative </span>
        {formatInitiative(initiative)}
      </span>
      <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1'>
          <span
            className={clsx(
              'truncate font-semibold',
              side === 'me' && 'text-primary-text',
              defeated && 'line-through',
            )}
          >
            {name}
          </span>
          {current && (
            <span className='rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold tracking-wide text-on-primary'>
              NOW
            </span>
          )}
        </div>
        {role && <span className='text-xs text-text-secondary'>{role}</span>}
      </div>
      <div className='flex shrink-0 flex-col items-end gap-1.5'>
        {hp && <HitPoints hp={hp} />}
        {defeated && (
          <span className='text-xs font-semibold text-text-secondary'>
            Defeated
          </span>
        )}
      </div>
    </li>
  )
}
