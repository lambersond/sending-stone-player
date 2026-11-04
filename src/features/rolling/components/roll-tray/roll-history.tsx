import { useId } from 'react'
import clsx from 'clsx'
import { Dices } from 'lucide-react'
import { breakdown } from '../../utils/brief'
import { reachOf, rechargeTitle } from '../../utils/tray-words'
import { DamageDue } from './damage-due'
import { GmPill } from './gm-pill'
import { LatestResult } from './latest-result'
import { TableMark } from './table-mark'
import { earlierTotal, movesAlone, offersDamage } from './utils'
import { damageDue } from '@/features/rolling/utils/damage-due'
import { useTableRole } from '@/hooks/use-table-api'
import type { TableRolls } from '../../types'
import type { LocalRoll, TableRollState } from '@/types/roll'

/**
 * The player's rolls, newest first: the latest in full, the rest on request. It says whether they
 * reach the table, so no one expects one to have reached it that didn't: when the Gamemaster's
 * game takes the player's rolls, it makes them too, with the same dice, and this says what it made
 * of each. Where each roll also pops up as a toast, which says it, its status is left unannounced
 * (`announce`), so that a screen reader hears each roll once.
 */
export function RollHistory({
  rolls,
  rolling,
  table,
  announce = true,
  className,
}: Readonly<{
  rolls: LocalRoll[]
  rolling: boolean
  table?: TableRolls
  announce?: boolean
  className?: string
}>) {
  const [latest, ...earlier] = rolls
  const role = useTableRole()
  // The roll whose damage is offered here: the latest's own, or the player's latest beneath one of
  // the Gamemaster's (`offersDamage`); none while dice roll in the latest's place.
  const offered = rolling ? undefined : offersDamage(rolls)
  // Where rolls go, said of none beneath items and coins moved alone.
  const reach = movesAlone(rolls) ? undefined : reachOf(table, role)
  let status = (
    <p className='flex items-center gap-2 text-sm text-text-secondary'>
      <Dices aria-hidden className='size-5 shrink-0 text-primary' />
      <span>
        Tap an ability, skill or attack to roll it. Right-click or long-press it
        for more ways to roll.
      </span>
    </p>
  )
  if (rolling) {
    status = (
      <p className='flex items-center gap-2 text-sm font-semibold'>
        <Dices
          aria-hidden
          className='size-5 shrink-0 text-primary motion-safe:animate-spin'
        />
        Rolling…
      </p>
    )
  } else if (latest) {
    status = <LatestResult roll={latest} table={table} />
  }

  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      <div role='status' aria-live={announce ? 'polite' : 'off'}>
        {status}
      </div>
      {offered && offered !== latest && table && (
        <DamageBehind roll={offered} table={table} />
      )}
      {earlier.length > 0 && (
        <details className='group text-sm'>
          <summary className='cursor-pointer text-xs font-semibold text-text-secondary hover:text-text-primary'>
            Earlier rolls ({earlier.length})
          </summary>
          <ol className='mt-2 flex max-h-40 flex-col gap-1.5 overflow-y-auto'>
            {earlier.map(roll => (
              <EarlierRoll
                key={roll.id}
                roll={roll}
                state={table?.states.get(roll.id)}
              />
            ))}
          </ol>
        </details>
      )}
      {reach !== undefined && (
        <p className='text-[11px] text-text-secondary'>{reach}</p>
      )}
    </div>
  )
}

/** An earlier roll, in a row: what it was, what it came to, and its way to the game, in brief. */
function EarlierRoll({
  roll,
  state,
}: Readonly<{ roll: LocalRoll; state?: TableRollState }>) {
  const total = earlierTotal(roll, state)
  return (
    <li className='flex items-baseline justify-between gap-3'>
      <span className='flex min-w-0 items-baseline gap-1.5'>
        <span className='truncate'>{rechargeTitle(roll, state)}</span>
        {roll.kind === 'gm' && <GmPill />}
      </span>
      <span className='shrink-0 text-xs text-text-secondary tabular-nums'>
        {breakdown(roll, state)}
        {total !== undefined && (
          <>
            {' = '}
            <span className='text-sm font-semibold text-text-primary'>
              {total}
            </span>
          </>
        )}
        <TableMark state={state} roll={roll} />
      </span>
    </li>
  )
}

/**
 * The damage of the player's own latest roll, while it's due, beneath one of the Gamemaster's as
 * the character that came after it (#156): named by its roll, as the rolls' button names those it
 * offers, as their buttons all say "Roll damage".
 */
function DamageBehind({
  roll,
  table,
}: Readonly<{ roll: LocalRoll; table: TableRolls }>) {
  const name = useId()
  const state = table.states.get(roll.id)
  if (!table.rollDamage || !damageDue(roll, state)) return
  return (
    <div role='group' aria-labelledby={name}>
      <p id={name} className='truncate text-sm font-semibold'>
        {roll.label}
      </p>
      <DamageDue
        roll={roll}
        state={state}
        onRollDamage={table.rollDamage}
        modifies={table.modifies}
      />
    </div>
  )
}
