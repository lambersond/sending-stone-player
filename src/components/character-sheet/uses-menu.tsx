'use client'

import { useId, useRef, useState, type FormEvent } from 'react'
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
import { placing } from './roll-menu'
import { usePortalRoot, useTopmostEscape } from '@/components/modal'

type Props = {
  /** The count it opened from. */
  anchor: HTMLElement
  /** What the counter is called, such as "Sorcery Points". */
  name: string
  /** How many are left: as many as may be spent. */
  left: number
  /** Whether using what its row uses spends this counter too. */
  usedToo: boolean
  /** Spends this many. */
  onSpend: (count: number) => void
  onClose: () => void
}

/**
 * How many of a counter's charges to spend directly, opened from its count as hit dice's popover
 * opens from their Use: from 1, as it opens, to as many as are left, and a button that spends
 * them; nothing is spent until it's pressed. Where using the row's activity spends the same
 * counter, it says so, as spending here and using it there would spend it twice. Escape, or a
 * click or tap elsewhere, closes it. Inside a modal dialog, it opens in the dialog, as the page
 * behind it is inert, and Escape closes only it.
 */
export function UsesMenu({
  anchor,
  name,
  left,
  usedToo,
  onSpend,
  onClose,
}: Readonly<Props>) {
  const [chosen, setChosen] = useState(1)
  // No more than are left, should the sheet say fewer are while it's open.
  const most = Math.max(1, left)
  if (chosen > most) setChosen(most)
  const more = useRef<HTMLButtonElement>(null)
  const spend = useRef<HTMLButtonElement>(null)
  const title = useId()
  const root = usePortalRoot()
  useTopmostEscape(true)
  const { placement, gap, across } = placing()
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
  const { getFloatingProps } = useInteractions([
    useDismiss(context),
    useRole(context, { role: 'dialog' }),
  ])
  // Kept within 1 and as many as are left; its buttons stay where they can't go further, so that
  // focus isn't lost from one.
  const step = (by: number) => {
    const next = chosen + by
    if (next < 1 || next > most) return
    setChosen(next)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSpend(Math.min(chosen, most))
  }

  return (
    <FloatingPortal root={root}>
      <FloatingFocusManager
        context={context}
        // One more, as what's spent is chosen up from 1, unless there's no more to spend.
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
            Spend {name}
          </p>
          <div className='flex items-center gap-3'>
            <button
              type='button'
              aria-label='One fewer'
              aria-disabled={chosen <= 1}
              onClick={() => step(-1)}
              className={STEP}
            >
              <Minus aria-hidden className='size-4' />
            </button>
            <span className='min-w-12 text-center text-lg font-bold tabular-nums'>
              <output aria-live='polite'>{chosen}</output>
              <span className='text-sm font-normal text-text-secondary'>
                {' '}
                of {left}
              </span>
            </span>
            <button
              ref={more}
              type='button'
              aria-label='One more'
              aria-disabled={chosen >= most}
              onClick={() => step(1)}
              className={STEP}
            >
              <Plus aria-hidden className='size-4' />
            </button>
          </div>
          {usedToo && (
            <p className='text-xs text-text-secondary'>Use spends this too</p>
          )}
          <button
            ref={spend}
            type='submit'
            className='h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover'
          >
            Spend {chosen}
          </button>
        </form>
      </FloatingFocusManager>
    </FloatingPortal>
  )
}

const STEP =
  'flex size-10 items-center justify-center rounded-xl border border-border transition-colors hover:border-primary/50 hover:bg-primary/5 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:border-border aria-disabled:hover:bg-transparent'
