'use client'

import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
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
import { placing, pointOn, type MenuPoint } from './roll-menu'
import { usePortalRoot, useTopmostEscape } from '@/components/modal'

type Props = {
  /** The Use button it opened from. */
  anchor: HTMLElement
  /** Where on it the player clicked or pressed. With none, as from a key, it goes below it. */
  point?: MenuPoint
  /** The size of die, such as "d8". */
  die: string
  /** How many may be spent at once: as many as are left. */
  most: number
  /** What spending this many gives back, as a formula, such as "3d8 + 9". */
  formula: (count: number) => string
  /** Spends this many. */
  onSpend: (count: number) => void
  onClose: () => void
}

/**
 * How many hit dice of one size to spend at once, chosen where the player right-clicked or
 * long-pressed its Use button, as a roll's menu opens there: from 1 to as many as are left, with
 * what they give back as a formula, the character's Constitution added for each, and a button that
 * spends them. Escape, or a click or tap elsewhere, closes it. Inside a modal dialog, it opens in
 * the dialog, as the page behind it is inert, and Escape closes only it.
 */
export function HitDiceMenu({
  anchor,
  point,
  die,
  most,
  formula,
  onSpend,
  onClose,
}: Readonly<Props>) {
  const [count, setCount] = useState(1)
  // No more than are left, should the sheet say fewer are while it's open; nor more again, should
  // it then say more are.
  if (count > most) setCount(most)
  const more = useRef<HTMLButtonElement>(null)
  const spend = useRef<HTMLButtonElement>(null)
  const title = useId()
  const root = usePortalRoot()
  useTopmostEscape(true)
  const { placement, gap } = placing(point)
  const { refs, floatingStyles, context } = useFloating({
    open: true,
    onOpenChange: open => {
      if (!open) onClose()
    },
    elements: { reference: anchor },
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [offset(gap), flip({ padding: 8 }), shift({ padding: 8 })],
  })
  useLayoutEffect(() => {
    refs.setPositionReference(point ? pointOn(anchor, point) : anchor)
  }, [anchor, point, refs])
  const { getFloatingProps } = useInteractions([
    useDismiss(context),
    useRole(context, { role: 'dialog' }),
  ])
  // Kept within 1 and as many as are left; its buttons stay where they can't go further, so
  // that focus isn't lost from one.
  const step = (by: number) => setCount(Math.min(most, Math.max(1, count + by)))
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSpend(count)
  }

  return (
    <FloatingPortal root={root}>
      <FloatingFocusManager
        context={context}
        // One more, which is what it's opened for, unless there's only one to spend.
        initialFocus={most > 1 ? more : spend}
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
            Use {die} hit dice
          </p>
          <div className='flex items-center gap-3'>
            <button
              type='button'
              aria-label='One die fewer'
              aria-disabled={count <= 1}
              onClick={() => step(-1)}
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
              ref={more}
              type='button'
              aria-label='One die more'
              aria-disabled={count >= most}
              onClick={() => step(1)}
              className={STEP}
            >
              <Plus aria-hidden className='size-4' />
            </button>
          </div>
          <p className='text-sm text-text-secondary'>
            Heals{' '}
            <output
              aria-live='polite'
              className='font-mono font-semibold text-text-primary'
            >
              {formula(count)}
            </output>
          </p>
          <button
            ref={spend}
            type='submit'
            className='h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover'
          >
            Use {count}
            <span className='sr-only'>
              {' '}
              {die} hit {count === 1 ? 'die' : 'dice'}
            </span>
          </button>
        </form>
      </FloatingFocusManager>
    </FloatingPortal>
  )
}

const STEP =
  'flex size-10 items-center justify-center rounded-xl border border-border transition-colors hover:border-primary/50 hover:bg-primary/5 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-border aria-disabled:hover:bg-transparent'
