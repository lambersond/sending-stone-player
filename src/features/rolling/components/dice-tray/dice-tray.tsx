'use client'

import { useId, useState } from 'react'
import clsx from 'clsx'
import { ChevronDown, Dices } from 'lucide-react'
import { FormulaResult } from '../roll-tray/formula-result'
import { RollingLine } from '../roll-tray/rolling-line'
import { BonusStepper } from './bonus-stepper'
import { DieButtons } from './die-buttons'
import { TrayChips } from './tray-chips'
import { useDiceTray } from './use-dice-tray'
import { useTrayFocus } from './use-tray-focus'
import { diceSaid, rollName } from './utils'
import type { RollFeature, RollKind } from '@/types/roll'

/**
 * The dice tray (v0.44), a bar under the chat, for what the Gamemaster asks: Roll dice opens it,
 * and closes it again. In it, a button for each size of die, d4 to d100, a tap adding one; the dice
 * picked, a chip each size with one fewer and one more; the number added; Clear; and Roll, which
 * throws them over the page and keeps them for the next roll. Beneath, "Rolling…" as they tumble,
 * then the latest roll, as the game made it too, or not, its card coming in the chat above; and
 * whether the game makes these at all, and why not. It rolls as the character, whichever creature
 * the sheet shows.
 * @param characterId - The character it rolls as, or for the Gamemaster's seat its key.
 * @param kinds - The rolls the game takes from the seat now.
 * @param features - What else the game does with them.
 * @param typing - Whether the player types in what their own dice show.
 */
export function DiceTray({
  characterId,
  kinds,
  features,
  typing,
}: Readonly<{
  characterId: string
  kinds?: readonly RollKind[]
  features?: readonly RollFeature[]
  typing: boolean
}>) {
  const [open, setOpen] = useState(false)
  const panel = useId()
  const tray = useDiceTray({ characterId, kinds, features, typing })
  const focus = useTrayFocus(tray.dice, tray.remove)
  const empty = tray.dice.length === 0
  return (
    <div className='@container shrink-0 border-t border-border bg-card'>
      <div className='flex items-center gap-2 px-3 py-1.5'>
        <h2 className='min-w-0 flex-1'>
          <button
            type='button'
            aria-expanded={open}
            aria-controls={panel}
            onClick={() => setOpen(!open)}
            className='flex h-11 w-full items-center gap-2 rounded-xl px-2 text-left font-semibold transition-colors hover:bg-primary/10'
          >
            <Dices aria-hidden className='size-5 shrink-0 text-primary' />
            <span className='flex-1'>Roll dice</span>
            <ChevronDown
              aria-hidden
              className={clsx(
                'size-5 shrink-0 text-text-secondary transition-transform',
                !open && 'rotate-180',
              )}
            />
          </button>
        </h2>
        {open && (
          <button
            type='button'
            aria-disabled={empty && tray.bonus === 0}
            onClick={tray.clear}
            className='h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-primary-text transition-colors hover:bg-primary/10 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent'
          >
            Clear
          </button>
        )}
      </div>
      <div
        id={panel}
        hidden={!open}
        className='relative max-h-[60dvh] overflow-y-auto px-4 pb-4'
      >
        <div className='flex flex-col gap-3'>
          <DieButtons room={tray.room} onAdd={tray.add} addRef={focus.addRef} />
          {empty ? (
            <p className='text-sm text-text-secondary'>
              Tap a die to add it. Add as many as you need, of any size.
            </p>
          ) : (
            <TrayChips
              dice={tray.dice}
              room={tray.room}
              onAdd={tray.add}
              onRemove={focus.remove}
              fewerRef={focus.fewerRef}
            />
          )}
          {/* The dice, said as they're added and taken away, and only then: the region's words
              change with them alone. Placed in the panel, which holds it as it scrolls. */}
          <output
            aria-live='polite'
            aria-label='Dice picked'
            className='sr-only'
          >
            {diceSaid(tray.dice)}
          </output>
          <BonusStepper bonus={tray.bonus} onStep={tray.step} />
          <button
            type='button'
            aria-disabled={empty}
            onClick={tray.roll}
            className='h-12 rounded-xl bg-primary px-4 font-semibold text-on-primary transition-colors hover:bg-primary-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-primary'
          >
            {rollName(tray.dice, tray.bonus)}
          </button>
          {/* The dice tumbling, then the latest roll, said as it lands and as the game makes it, or
              not. */}
          <div role='status' aria-label='Latest roll'>
            {tray.rolling && <RollingLine />}
            {!tray.rolling && tray.latest && (
              <FormulaResult
                roll={tray.latest.roll}
                state={tray.latest.state}
              />
            )}
          </div>
          <p className='text-xs text-text-secondary'>{tray.reach}</p>
        </div>
      </div>
      {tray.dialog}
    </div>
  )
}
