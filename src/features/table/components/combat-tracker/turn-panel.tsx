'use client'

import clsx from 'clsx'
import { TriangleAlert } from 'lucide-react'
import { EndTurnButton } from '../end-turn-button/end-turn-button'
import { useTurnFocus } from './use-turn-focus'
import { refusalLine, turnHeading } from './utils'
import {
  currentCombatant,
  nextUp,
  seatTurn,
} from '@/features/table/utils/combat'
import { END_TURN_HINT, turnKey } from '@/features/table/utils/end-turn'
import { useTableRole } from '@/hooks/use-table-api'
import type { PanelEnding } from '@/features/table/types'
import type { TableCombat, TableCombatant } from '@/types/table'

/**
 * Whose turn it is, above the initiative order, in an encounter under way, the only one the tracker
 * draws it for: the round and who's next; the heading; on the seat's turn, End Turn, and why the
 * last one wasn't made; and on a companion's turn, a way to its tab, which it's rolled for on.
 * @param onOpen - Shows a companion's tab, by its key.
 * @param keys - The companions whose tabs the page shows.
 */
export function TurnPanel({
  combat,
  onOpen,
  keys,
  ending,
  via,
  refused,
  onEnd,
  focusTurn,
}: Readonly<
  {
    combat: TableCombat
    onOpen?: (key: string) => void
    keys?: ReadonlySet<string>
  } & PanelEnding
>) {
  const role = useTableRole()
  const current = currentCombatant(combat)
  const next = nextUp(combat)
  // The turn of one of the player's own creatures: their character's, or from module 0.36.0 one of
  // its companions', which is rolled for on its own tab.
  const own = current && seatTurn(current)
  const companion = own?.companion
  const mine = own !== undefined
  const heading = turnHeading(combat)

  // End Turn, on the seat's turn as the panel shows it (module 0.36.0).
  const turn =
    ending?.turn && ending.turn.combatantId === current?.id
      ? ending.turn
      : undefined
  const shown = turn && turnKey(turn)
  // Why the last End Turn wasn't made, while the panel still shows its turn.
  const line = refusalLine(refused, shown, role)
  const { titled, button, handOn } = useTurnFocus({
    combat,
    current,
    via,
    sent: ending?.sent,
    focusTurn,
  })

  return (
    <section
      aria-labelledby='turn-heading'
      className={clsx(
        'flex flex-col gap-2 rounded-2xl border bg-card p-4',
        mine ? 'border-primary' : 'border-border',
      )}
    >
      <RoundLine combat={combat} next={next} />
      <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-2'>
        <h2
          ref={titled}
          id='turn-heading'
          tabIndex={-1}
          className={clsx(
            'text-2xl font-semibold tracking-tight outline-none',
            mine && 'text-primary',
          )}
        >
          {heading}
        </h2>
        {turn && ending && (
          <EndTurnButton
            ref={button}
            turn={turn}
            offered={ending.offered}
            way={ending.way}
            onEnd={given => onEnd?.(given)}
            onGone={handOn}
          />
        )}
      </div>
      {line && (
        <p
          role='alert'
          className='flex items-start gap-1.5 text-[13px] text-warning'
        >
          <TriangleAlert aria-hidden className='mt-0.5 size-4 shrink-0' />
          <span>{line}</span>
        </p>
      )}
      {turn && <p className='text-xs text-text-secondary'>{END_TURN_HINT}</p>}
      {mine && companion && (
        <CompanionTurn companion={companion} onOpen={onOpen} keys={keys} />
      )}
      {!mine && next?.side === 'me' && (
        <p className='text-sm text-text-secondary'>You are up next.</p>
      )}
    </section>
  )
}

/**
 * The round, and who acts next: a long name cut short, the round kept whole, on one line,
 * beside it.
 */
function RoundLine({
  combat,
  next,
}: Readonly<{ combat: TableCombat; next?: TableCombatant }>) {
  return (
    <div className='flex items-baseline justify-between gap-2 text-xs text-text-secondary'>
      <span className='shrink-0 font-semibold tracking-wider uppercase'>
        {`Round ${combat.round}`}
      </span>
      {next && (
        <span className='truncate'>
          Next: {next.side === 'me' ? 'you' : next.name}
        </span>
      )}
    </div>
  )
}

/** On a companion's turn (module 0.36.0): it's rolled for on its own tab, which this opens. */
function CompanionTurn({
  companion,
  onOpen,
  keys,
}: Readonly<{
  companion: string
  onOpen?: (key: string) => void
  keys?: ReadonlySet<string>
}>) {
  return (
    <p className='text-sm text-text-secondary'>
      Roll for it on{' '}
      {onOpen && keys?.has(companion) ? (
        <button
          type='button'
          onClick={() => onOpen(companion)}
          className='inline-flex min-h-11 min-w-11 items-center justify-center font-semibold text-primary-text underline underline-offset-2'
        >
          its tab
        </button>
      ) : (
        'its tab'
      )}
      .
    </p>
  )
}
