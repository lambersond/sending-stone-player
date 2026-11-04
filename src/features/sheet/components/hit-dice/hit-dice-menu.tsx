'use client'

import { useId, useLayoutEffect, useRef, type Ref } from 'react'
import {
  FloatingFocusManager,
  FloatingPortal,
  useDismiss,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import { Minus, Plus } from 'lucide-react'
import { HitDieIcon } from './hit-die-icon'
import { useHitDiceChoice } from './use-hit-dice-choice'
import { mostOf, spentOf, spentOne } from './utils'
import { STEP_BUTTON } from '@/constants/buttons'
import { MOST_HIT_DICE } from '@/constants/sending-stone'
import { placing, pointOn } from '@/features/rolling/utils/menu-points'
import { usePopover } from '@/hooks/use-popover'
import type { MenuPoint } from '@/features/rolling/types'
import type { HitDiceCount, HitDicePool } from '@/types/roll'

/** Why no more hit dice are spent at once, as a button for one more says once there are as many. */
const AT_MOST = `At most ${MOST_HIT_DICE} at once`

/**
 * How many hit dice to spend at once, chosen where the player right-clicked or long-pressed a Use
 * button, as a roll's menu opens there: of its size, from 1 to as many as are left, or, where the
 * character has more than one size, of each, from none, the size it opened for starting at 1; no
 * more than 20 in all. With what they give back as a formula, the character's Constitution added
 * for each, and a button that spends them. Escape, or a click or tap elsewhere, closes it. Inside a
 * modal dialog, it opens in the dialog, as the page behind it is inert, and Escape closes only it.
 */
export function HitDiceMenu({
  anchor,
  point,
  die,
  pools,
  formula,
  onSpend,
  onClose,
}: Readonly<{
  /** The Use button it opened from. */
  anchor: HTMLElement
  /** Where on it the player clicked or pressed. With none, as from a key, it goes below it. */
  point?: MenuPoint
  /** The size of die it opened for, such as "d8". */
  die: string
  /**
   * The character's hit dice by size, largest first, every class's of a size together, as many
   * as are left of each to spend.
   */
  pools: HitDicePool[]
  /** What spending this many of each size gives back, as a formula, such as "2d10 + 1d8 + 9". */
  formula: (counts: HitDiceCount[]) => string
  /** Spends this many of each size. */
  onSpend: (counts: HitDiceCount[]) => void
  onClose: () => void
}>) {
  const { chosen, single, least, counts, total, roomFor, step, submit } =
    useHitDiceChoice({ die, pools, onSpend })
  const more = useRef<HTMLButtonElement>(null)
  const spend = useRef<HTMLButtonElement>(null)
  const title = useId()
  const { placement, gap, across } = placing(point)
  const { setFloating, setPositionReference, floatingStyles, context, root } =
    usePopover({
      open: true,
      onOpenChange: open => {
        if (!open) onClose()
      },
      anchor,
      placement,
      gap,
      across,
    })
  useLayoutEffect(() => {
    setPositionReference(point ? pointOn(anchor, point) : anchor)
  }, [anchor, point, setPositionReference])
  const { getFloatingProps } = useInteractions([
    useDismiss(context),
    useRole(context, { role: 'dialog' }),
  ])
  const opened = pools.find(pool => pool.die === die)

  return (
    <FloatingPortal root={root}>
      <FloatingFocusManager
        context={context}
        // One more of the size it opened for, which is what it's opened for, unless there's no
        // more of it to spend.
        initialFocus={opened && roomFor(opened) ? more : spend}
        modal={false}
      >
        <form
          ref={setFloating}
          style={floatingStyles}
          aria-labelledby={title}
          onSubmit={submit}
          noValidate
          className='z-50 flex max-w-[calc(100vw-1rem)] min-w-56 flex-col gap-3 rounded-xl border border-border bg-card p-3 text-text-primary shadow-xl'
          {...getFloatingProps()}
        >
          <p id={title} className='text-xs font-semibold text-text-secondary'>
            {single ? `Use ${die} hit dice` : 'Use hit dice'}
          </p>
          {single ? (
            <Stepper
              pool={pools[0]}
              count={total}
              least={least}
              room={roomFor(pools[0])}
              total={total}
              moreRef={more}
              onStep={by => step(pools[0], by)}
            />
          ) : (
            <ul className='flex flex-col gap-2'>
              {pools.map(pool => (
                <li key={pool.die} className='flex items-center gap-2'>
                  <HitDieIcon die={pool.die} className='size-5 text-primary' />
                  <span className='w-8 text-sm font-semibold'>{pool.die}</span>
                  <Stepper
                    pool={pool}
                    count={chosen.get(pool.die) ?? 0}
                    least={least}
                    room={roomFor(pool)}
                    total={total}
                    named
                    moreRef={pool.die === die ? more : undefined}
                    onStep={by => step(pool, by)}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className='text-sm text-text-secondary'>
            Heals{' '}
            <output
              aria-live='polite'
              className='font-mono font-semibold text-text-primary'
            >
              {formula(counts)}
            </output>
          </p>
          <button
            ref={spend}
            type='submit'
            aria-disabled={total === 0}
            className='h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-primary'
          >
            Use {total}
            <span className='sr-only'>
              {single ? spentOne(die, total) : spentOf(counts, total)}
            </span>
          </button>
        </form>
      </FloatingFocusManager>
    </FloatingPortal>
  )
}

/**
 * One fewer and one more of a size, and how many of it are chosen, of how many are left: its
 * buttons named for the size, where there's more than one, and for a die otherwise.
 */
function Stepper({
  pool,
  count,
  least,
  room,
  total,
  named = false,
  moreRef,
  onStep,
}: Readonly<{
  pool: HitDicePool
  count: number
  least: number
  /** Whether one more can be chosen. */
  room: boolean
  /** How many of every size are chosen. */
  total: number
  named?: boolean
  moreRef?: Ref<HTMLButtonElement>
  onStep: (by: number) => void
}>) {
  const what = named ? pool.die : 'die'
  const most = mostOf(pool)
  // Held back by the most at once, rather than by how many are left.
  const capped = !room && count < most && total >= MOST_HIT_DICE
  return (
    <div className='flex items-center gap-3'>
      <button
        type='button'
        aria-label={`One ${what} fewer`}
        aria-disabled={count <= least}
        onClick={() => onStep(-1)}
        className={STEP_BUTTON}
      >
        <Minus aria-hidden className='size-4' />
      </button>
      <span className='min-w-12 text-center text-lg font-bold tabular-nums'>
        <output aria-live='polite'>{count}</output>
        <span className='text-sm font-normal text-text-secondary'>
          {' '}
          of {most}
        </span>
      </span>
      <button
        ref={moreRef}
        type='button'
        aria-label={`One ${what} more`}
        aria-disabled={!room}
        title={capped ? AT_MOST : undefined}
        onClick={() => onStep(1)}
        className={STEP_BUTTON}
      >
        <Plus aria-hidden className='size-4' />
      </button>
    </div>
  )
}
