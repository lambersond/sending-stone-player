'use client'

import { use, useId, useLayoutEffect, useRef } from 'react'
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
import { Clock, PawPrint } from 'lucide-react'
import { WildShapeContext } from './use-wild-shape-row'
import { ReturnButton, PLAIN, SOLID } from './wild-shape-row-controls'
import { usePortalRoot } from '@/components/modal/use-portal-root'
import { useTopmostEscape } from '@/components/modal/use-topmost-escape'
import { canReturn, timeLeftWords } from '@/utils/wild-shape'
import {
  ENDS_IN_FOUNDRY,
  notTakingWords,
  returnWords,
  ribbonWords,
} from '@/utils/wild-shape-words'
import type { WildShapeValue } from './use-wild-shape'
import type { SheetForm } from '@/types/sending-stone'

// Wild Shape from the app, from module 0.40.0 (round 0.40.0 §5): the ribbon above a shaped sheet's
// tabs, Change, Return and Known forms… on the Wild Shape row wherever it's drawn, the one dialog
// of the pane its picker, manager and Beasts to learn are views of, Return's confirm, the shaped
// tabs' notes, and the banner when the game ends a Wild Shape. A change, a return or a Beast
// learned waits while it's on its way, and once made until the sheet says so (`form.profile`, no
// `form`, `known`), for up to `WILD_SHAPE_SETTLE`, as an effect's change does; focus then goes
// where the change is, only where it was on what was pressed, in the dialog, or lost.

/** What the pane's rows, tabs and ribbon know of the character's Wild Shape. */
export function useWildShaping(): WildShapeValue {
  return use(WildShapeContext)
}

/**
 * The ribbon above a shaped sheet's tabs, on every tab (round 0.40.0 §5.2): what the character is,
 * the time it has left as the module last sent it, and Return to {name} where the seat may; else
 * why not. None where the sheet has no form, nor at a creature's pane.
 */
export function WildShapeRibbon() {
  const ws = use(WildShapeContext)
  if (!ws.form || !ws.pane) return
  return <Ribbon form={ws.form} />
}

function Ribbon({ form }: Readonly<{ form: SheetForm }>) {
  const ws = use(WildShapeContext)
  const section = useRef<HTMLElement>(null)
  const { panel } = ws
  // The game ending it while focus is in the ribbon: focus to the tab's panel, as it goes.
  useLayoutEffect(() => {
    const element = section.current
    return () => {
      const active = document.activeElement
      if (element && active && element.contains(active)) panel()?.focus()
    }
  }, [panel])
  const { label, heading } = ribbonWords(form)
  const time = timeLeftWords(form.minutesLeft)
  const returnable = ws.on && ws.role === 'player' && canReturn(ws.sheet)
  // The module times it, the campaign's switch on, but the game isn't taking Wild Shape now.
  const lapsed =
    ws.role === 'player' &&
    !ws.on &&
    form.hours !== null &&
    form.minutesLeft !== null
  return (
    <section
      ref={section}
      aria-label={label}
      className='flex shrink-0 items-center gap-2.5 border-b border-wild/35 bg-wild-bg py-2 pr-2 pl-3.5 md:pl-6 lg:pl-7'
    >
      <PawPrint aria-hidden className='size-5 shrink-0 text-wild' />
      <div className='min-w-0 flex-1'>
        <h2
          ref={ws.heading}
          tabIndex={-1}
          className='text-sm font-semibold text-wild outline-none'
        >
          {heading}
        </h2>
        {time && (
          <p className='flex items-center gap-1 text-xs text-text-secondary'>
            <Clock aria-hidden className='size-3 shrink-0' />
            {time}
          </p>
        )}
        {!returnable && (
          <p className='text-xs text-text-secondary'>
            {lapsed ? notTakingWords(ws.role) : ENDS_IN_FOUNDRY}
          </p>
        )}
      </div>
      {returnable && <ReturnButton label={`Return to ${ws.name}`} />}
    </section>
  )
}

/**
 * Return's confirm (round 0.40.0 §5.4), from the Return pressed: what ending it does, what the
 * character keeps, and Stay {aForm} first. Stay and Escape close it, focus back to the Return
 * that opened it; Return closes it and returns the character.
 */
export function ReturnPopover({ anchor }: Readonly<{ anchor: HTMLElement }>) {
  const ws = use(WildShapeContext)
  const titleId = useId()
  const stay = useRef<HTMLButtonElement>(null)
  const root = usePortalRoot()
  useTopmostEscape(true)
  const { refs, floatingStyles, context } = useFloating({
    open: true,
    onOpenChange: open => {
      if (!open) ws.closeReturn(false)
    },
    elements: { reference: anchor },
    placement: 'bottom-end',
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
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
          ref={refs.setFloating}
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

/** Where this browser keeps the last ending dismissed, by when, after which the seat's key. */
export const ENDED_KEY = 'sending-stone:wild-shape-ended'

/** How long an ending is told of on a page opened since, in milliseconds: twelve hours. */
export const ENDED_FOR = 12 * 60 * 60 * 1000
