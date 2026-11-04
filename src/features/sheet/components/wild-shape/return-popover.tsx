'use client'

import { use, useId, useRef } from 'react'
import {
  FloatingFocusManager,
  FloatingPortal,
  useDismiss,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import { PLAIN, SOLID } from './constants'
import { WildShapeContext } from './context'
import { usePopover } from '@/hooks/use-popover'
import { returnWords } from '@/utils/wild-shape-words'

/**
 * Return's confirm (round 0.40.0 §5.4), from the Return pressed: what ending it does, what the
 * character keeps, and Stay {aForm} first. Stay and Escape close it, focus back to the Return
 * that opened it; Return closes it and returns the character.
 */
export function ReturnPopover({ anchor }: Readonly<{ anchor: HTMLElement }>) {
  const ws = use(WildShapeContext)
  const titleId = useId()
  const stay = useRef<HTMLButtonElement>(null)
  const { setFloating, floatingStyles, context, root } = usePopover({
    open: true,
    onOpenChange: open => {
      if (!open) ws.closeReturn(false)
    },
    anchor,
    placement: 'bottom-end',
    gap: 6,
  })
  const { getFloatingProps } = useInteractions([
    useDismiss(context),
    useRole(context, { role: 'dialog' }),
  ])
  const words = returnWords(
    ws.name,
    ws.form?.name ?? '',
    ws.sheet?.hp?.temp ?? 0,
  )
  return (
    <FloatingPortal root={root}>
      <FloatingFocusManager
        context={context}
        initialFocus={stay}
        modal={false}
        returnFocus={false}
      >
        <div
          ref={setFloating}
          style={floatingStyles}
          aria-labelledby={titleId}
          className='z-50 flex w-72 max-w-[calc(100vw-1rem)] flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5 text-sm text-text-primary shadow-xl'
          {...getFloatingProps()}
        >
          <p id={titleId} className='font-semibold'>
            {words.title}
          </p>
          {words.body.map(line => (
            <p key={line} className='text-text-secondary'>
              {line}
            </p>
          ))}
          <div className='flex flex-wrap justify-end gap-2'>
            <button
              ref={stay}
              type='button'
              onClick={() => ws.closeReturn(false)}
              className={PLAIN}
            >
              {words.stay}
            </button>
            <button
              type='button'
              onClick={() => ws.closeReturn(true)}
              className={SOLID}
            >
              {words.confirm}
            </button>
          </div>
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  )
}
