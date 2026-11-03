import clsx from 'clsx'
import { savedHere } from '../../utils/tray-words'
import { DamageDue } from './damage-due'
import { Dice } from './dice'
import { OnlyYou } from './only-you'
import { SpentLines } from './spent-lines'
import { TableStatus } from './table-status'
import { formatModifier } from '@/utils/format-modifier'
import type { RollDue } from '../../types'
import type { LocalCheck, TableRollState } from '@/types/roll'

/**
 * A d20 roll, a saving throw, check or attack: its total, coloured for a natural 20 or 1, its dice
 * and what was added, and its way to the game; the damage that follows it, while it's due; and
 * what became of the effects a die it was given spent.
 */
export function CheckResult({
  roll,
  state,
  onRollDamage,
  modifies,
}: Readonly<{
  roll: LocalCheck
  state?: TableRollState
  onRollDamage?: RollDue
  modifies?: boolean
}>) {
  const critical = roll.natural === 20
  const fumble = roll.natural === 1
  const here = savedHere(roll, state)
  let extra = ''
  if (roll.advantage === 'adv') extra = 'Advantage'
  if (roll.advantage === 'dis') extra = 'Disadvantage'
  return (
    <div className='flex items-center gap-3'>
      <span
        className={clsx(
          'flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl font-bold tabular-nums',
          critical && 'bg-gold text-on-gold',
          fumble && 'bg-ruby text-on-ruby',
          !critical && !fumble && 'bg-primary/10 text-primary',
        )}
      >
        {roll.total}
      </span>
      <div className='min-w-0'>
        <p className='truncate font-semibold'>{roll.label}</p>
        <p className='text-xs text-text-secondary tabular-nums'>
          <Dice roll={roll} /> {formatModifier(roll.modifier)}
          {roll.extras.map(({ text, values }, index) => (
            <span key={index}>
              {' '}
              {text}
              {values.length > 0 && ` (${values.join(', ')})`}
            </span>
          ))}
          {extra && ` · ${extra}`}
          {critical && ' · Natural 20'}
          {fumble && ' · Natural 1'}
          {roll.dc !== undefined && ` · DC ${roll.dc}`}
          {here && (
            <span className='font-semibold text-text-primary'>
              {' · '}
              {here}
            </span>
          )}
        </p>
        {state && (
          <TableStatus state={state} dc={roll.dc} verdict={roll.verdict} />
        )}
        {!state && roll.described && <OnlyYou />}
        <DamageDue
          roll={roll}
          state={state}
          onRollDamage={onRollDamage}
          modifies={modifies}
        />
        <SpentLines roll={roll} state={state} />
      </div>
    </div>
  )
}
