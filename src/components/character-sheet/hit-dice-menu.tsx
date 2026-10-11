'use client'

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type Ref,
} from 'react'
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import { Minus, Plus } from 'lucide-react'
import { HitDieIcon } from './hit-die-icon'
import { placing, pointOn, type MenuPoint } from './roll-menu'
import { usePortalRoot, useTopmostEscape } from '@/components/modal'
import { MOST_HIT_DICE } from '@/constants/sending-stone'
import type { HitDiceCount, HitDicePool } from '@/utils/formulas'

type Props = {
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
}

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
}: Readonly<Props>) {
  const [chosen, setChosen] = useState<ReadonlyMap<string, number>>(
    () => new Map([[die, 1]]),
  )
  // One size alone is spent from 1; of several, any may be left at none.
  const single = pools.length === 1
  const least = single ? 1 : 0
  const counts = pools.map(pool => ({
    die: pool.die,
    count: chosen.get(pool.die) ?? 0,
  }))
  // No more than are left, should the sheet say fewer are while it's open; nor more again, should
  // it then say more are.
  const over = pools.some(
    pool => (chosen.get(pool.die) ?? 0) > Math.max(least, mostOf(pool)),
  )
  if (over) {
    setChosen(
      new Map(
        pools.map(pool => [
          pool.die,
          Math.min(chosen.get(pool.die) ?? 0, Math.max(least, mostOf(pool))),
        ]),
      ),
    )
  }
  const total = counts.reduce((all, { count }) => all + count, 0)
  const more = useRef<HTMLButtonElement>(null)
  const spend = useRef<HTMLButtonElement>(null)
  const title = useId()
  const root = usePortalRoot()
  useTopmostEscape(true)
  const { placement, gap, across } = placing(point)
  const { refs, floatingStyles, context } = useFloating({
    open: true,
    onOpenChange: open => {
      if (!open) onClose()
    },
    elements: { reference: anchor },
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(gap),
      flip({ padding: 8 }),
      shift({ padding: 8, crossAxis: across }),
    ],
  })
  useLayoutEffect(() => {
    refs.setPositionReference(point ? pointOn(anchor, point) : anchor)
  }, [anchor, point, refs])
  const { getFloatingProps } = useInteractions([
    useDismiss(context),
    useRole(context, { role: 'dialog' }),
  ])
  // Whether one more of a size can be spent: one more is left, and there are fewer than the most
  // at once in all.
  const roomFor = (pool: HitDicePool) =>
    (chosen.get(pool.die) ?? 0) < mostOf(pool) && total < MOST_HIT_DICE
  // Kept within the least and as many as are left, no more than the most in all; its buttons stay
  // where they can't go further, so that focus isn't lost from one.
  const step = (pool: HitDicePool, by: number) => {
    const count = chosen.get(pool.die) ?? 0
    if (by > 0 ? !roomFor(pool) : count <= least) return
    setChosen(new Map(chosen).set(pool.die, count + by))
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (total === 0) return
    onSpend(counts.filter(({ count }) => count > 0))
  }
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
          ref={refs.setFloating}
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
        className={STEP}
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
        className={STEP}
      >
        <Plus aria-hidden className='size-4' />
      </button>
    </div>
  )
}

/**
 * How many of a size may be spent at once: as many as are left, or where the sheet doesn't say, as
 * many as there are.
 */
function mostOf({ value, max }: HitDicePool): number {
  return value ?? max ?? 1
}

/** What spending these of one size is, after how many, for a screen reader: " d8 hit dice". */
function spentOne(die: string, count: number): string {
  return ` ${die} hit ${count === 1 ? 'die' : 'dice'}`
}

/**
 * What spending these of every size is, after how many, for a screen reader: " hit dice: 2d10 and
 * 1d8", or of one die alone, " d10 hit die".
 */
function spentOf(counts: HitDiceCount[], total: number): string {
  const spent = counts.filter(({ count }) => count > 0)
  if (total === 1) return spentOne(spent[0].die, 1)
  const dice = spent.map(({ die, count }) => `${count}${die}`)
  if (dice.length === 0) return ' hit dice'
  const listed =
    dice.length > 1
      ? `${dice.slice(0, -1).join(', ')} and ${dice.at(-1)}`
      : dice[0]
  return ` hit dice: ${listed}`
}

const STEP =
  'flex size-10 items-center justify-center rounded-xl border border-border transition-colors hover:border-primary/50 hover:bg-primary/5 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-border aria-disabled:hover:bg-transparent'
