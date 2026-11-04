import clsx from 'clsx'
import { shownTotal } from '../../utils/brief'
import {
  byTheGame,
  damageBadge,
  thrownAgainThere,
  thrownAgainWords,
} from '../../utils/tray-words'
import { BADGES } from './constants'
import { OnlyYou } from './only-you'
import { TableStatus } from './table-status'
import { Terms } from './terms'
import { useTableRole } from '@/hooks/use-table-api'
import { seatWords } from '@/utils/seat-words'
import type { LocalDamage, TableRollState } from '@/types/roll'

/**
 * Damage or healing: the total, and each part of it with its dice and kind, a critical hit's in
 * the gold of a natural 20. Damage the game rolls itself, which throws no dice here, shows the
 * game's total; so does a critical hit's whose dice the game's rules change as only it can add
 * them up, once it says.
 */
export function DamageResult({
  roll,
  state,
}: Readonly<{ roll: LocalDamage; state?: TableRollState }>) {
  const { game } = seatWords(useTableRole())
  const rolledThere = byTheGame(roll)
  const again = thrownAgainThere(roll, state)
  const total = shownTotal(roll, state)
  return (
    <div className='flex items-center gap-3'>
      <span
        className={clsx(
          'flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl font-bold tabular-nums',
          BADGES[damageBadge(roll.healing, roll.critical)],
        )}
      >
        {total}
      </span>
      <div className='min-w-0'>
        <p className='truncate font-semibold'>{roll.label}</p>
        <p className='text-xs text-text-secondary tabular-nums'>
          {rolledThere && `Its dice are rolled in ${game}`}
          {!rolledThere &&
            roll.parts.map((part, index) => (
              <span key={index}>
                {index > 0 && ' '}
                <Terms terms={part.terms} firstThrow={again} />
                {part.type && ` ${part.type}`}
              </span>
            ))}
          {roll.critical && ' · Critical hit'}
          {roll.maximized && ' · Maximum'}
          {again && thrownAgainWords(game)}
        </p>
        {state && <TableStatus state={state} />}
        {!state && roll.described && <OnlyYou />}
      </div>
    </div>
  )
}
