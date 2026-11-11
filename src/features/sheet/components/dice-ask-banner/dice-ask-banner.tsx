'use client'

import { type Ref } from 'react'
import { Dices, Timer } from 'lucide-react'
import { useSecondsLeft } from '../prompt-banner/use-seconds-left'
import { clock } from '../prompt-banner/utils'
import { askName, diceWords } from '@/features/rolling/utils/dice-ask-entry'
import { useSheetId } from '@/features/sheet/hooks/use-sheet-ids'
import type { TableDiceAsk } from '@/types/table'

/**
 * The dice the game asks the player for, for later rolls in their typed rolls' runs, from module
 * 0.44.0, at the top of every tab of their sheet, under the saves it asks: on the devices that
 * didn't send the roll, or where the dialog didn't open by itself, as while they were typing in
 * the chat. Each says what rolls, its dice and how long is left, with Type in, which opens the
 * dice dialog, and Let the game roll; once its time is up, that the game rolls it.
 */
export function DiceAskBanner({
  ref,
  asks,
  onTypeIn,
  onLeave,
}: Readonly<{
  /** The banner, which the rolls' toasts start below while it shows. */
  ref?: Ref<HTMLElement>
  asks: TableDiceAsk[]
  onTypeIn: (ask: TableDiceAsk) => void
  onLeave: (ask: TableDiceAsk) => void
}>) {
  const heading = useSheetId('dice-asks-heading')
  return (
    <section
      ref={ref}
      aria-labelledby={heading}
      className='shrink-0 border-b border-primary/30 bg-primary/5 px-3 py-2.5 md:px-6 lg:px-7'
    >
      <h2
        id={heading}
        className='flex items-center gap-1.5 text-xs font-semibold text-primary-text'
      >
        <Dices aria-hidden className='size-3.5' />
        The game asks for your dice
      </h2>
      <ul className='mt-1.5 grid gap-2'>
        {asks.map(ask => (
          <AskRow
            key={ask.id}
            ask={ask}
            onTypeIn={onTypeIn}
            onLeave={onLeave}
          />
        ))}
      </ul>
    </section>
  )
}

const BUTTON =
  'h-9 touch-manipulation rounded-xl px-3 text-sm transition-colors'

/** One ask: what rolls, its dice, the time left, and its two answers; or that the game rolls it. */
function AskRow({
  ask,
  onTypeIn,
  onLeave,
}: Readonly<{
  ask: TableDiceAsk
  onTypeIn: (ask: TableDiceAsk) => void
  onLeave: (ask: TableDiceAsk) => void
}>) {
  const left = useSecondsLeft(ask.expiresAt)
  const dice = diceWords(ask)
  const name = askName(ask)
  return (
    <li className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5'>
      <div className='min-w-0'>
        <p className='text-sm font-semibold'>{name}</p>
        <p className='text-xs text-text-secondary'>
          {ask.critical ? `${dice} · Critical hit` : dice}
        </p>
      </div>
      {left > 0 ? (
        <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5'>
          <p
            role='timer'
            className='flex items-center gap-1.5 text-xs text-text-secondary'
          >
            <Timer aria-hidden className='size-3.5 shrink-0' />
            <span className='tabular-nums'>{clock(left)} left</span>
          </p>
          <div className='flex flex-wrap gap-1.5'>
            <button
              type='button'
              aria-label={`Type in ${dice} for ${name}`}
              onClick={() => onTypeIn(ask)}
              className={`${BUTTON} bg-primary font-semibold text-on-primary hover:bg-primary-hover`}
            >
              Type in
            </button>
            <button
              type='button'
              aria-label={`Let the game roll ${dice} for ${name}`}
              onClick={() => onLeave(ask)}
              className={`${BUTTON} border border-border font-medium hover:border-primary/50 hover:bg-primary/5`}
            >
              Let the game roll
            </button>
          </div>
        </div>
      ) : (
        <p className='text-xs text-text-secondary'>The game rolls them</p>
      )}
    </li>
  )
}
