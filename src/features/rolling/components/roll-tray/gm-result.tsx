import clsx from 'clsx'
import {
  GM_WORDS,
  gmBadge,
  gmHidden,
  gmLine,
  gmOutcomeOf,
  gmShape,
} from '../../utils/gm-words'
import { BADGE_ICONS, BADGES } from './constants'
import { GmPill } from './gm-pill'
import { StatusLine } from './status-line'
import { useCreature } from '@/hooks/use-creature'
import { useTableRole } from '@/hooks/use-table-api'
import type { LocalGmRoll, TableRollState } from '@/types/roll'

/**
 * A roll the Gamemaster made as the player's character (#156), as the latest of the player's
 * rolls: marked as theirs, with the game's result, or where it stands, as the player's own of its
 * kind; and nothing to roll after it, as its damage is the Gamemaster's.
 */
export function GmResult({
  roll,
  state,
}: Readonly<{ roll: LocalGmRoll; state?: TableRollState }>) {
  const role = useTableRole()
  const creature = useCreature()
  const { badge, total } = gmBadge(roll, state)
  const Icon = BADGE_ICONS[badge]
  const line = gmLine(roll, state, role, creature)
  const shape = gmShape(roll)
  const told =
    state?.status === 'done' &&
    state.visible &&
    ['check', 'damage'].includes(shape)
  const outcome = told ? gmOutcomeOf(roll, state, role) : undefined
  return (
    <div data-gm-roll={roll.id} className='flex items-center gap-3'>
      <span
        className={clsx(
          'flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl font-bold tabular-nums',
          BADGES[badge],
        )}
      >
        {Icon ? <Icon aria-hidden className='size-6' /> : total}
      </span>
      <div className='min-w-0'>
        <p className='flex items-center gap-1.5'>
          <span className='truncate font-semibold'>{roll.label}</span>
          <GmPill />
        </p>
        <p className='text-xs text-text-secondary'>{GM_WORDS}</p>
        {line && (
          <StatusLine tone={line.tone} hidden={gmHidden(roll, state)}>
            {told ? (
              <span>
                At the table:{' '}
                <span className='font-semibold text-text-primary tabular-nums'>
                  {state.total ?? '?'}
                </span>
                {outcome && (
                  <span className='font-semibold text-text-primary'>
                    {' · '}
                    {outcome}
                  </span>
                )}
              </span>
            ) : (
              <span>{line.text}</span>
            )}
          </StatusLine>
        )}
      </div>
    </div>
  )
}
