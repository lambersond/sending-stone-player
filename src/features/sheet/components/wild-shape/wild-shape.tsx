'use client'

import { use, useLayoutEffect, useRef, type RefObject } from 'react'
import { Clock, PawPrint } from 'lucide-react'
import { WildShapeContext } from './context'
import { ReturnButton } from './return-button'
import { canReturn, timeLeftWords } from '@/utils/wild-shape'
import {
  ENDS_IN_FOUNDRY,
  notTakingWords,
  ribbonWords,
} from '@/utils/wild-shape-words'
import type { SheetForm } from '@/types/sending-stone'

// Wild Shape from the app, from module 0.40.0 (round 0.40.0 §5): the ribbon above a shaped sheet's
// tabs, Change, Return and Known forms… on the Wild Shape row wherever it's drawn, the one dialog
// of the pane its picker, manager and Beasts to learn are views of, Return's confirm, the shaped
// tabs' notes, and the banner when the game ends a Wild Shape. A change, a return or a Beast
// learned waits while it's on its way, and once made until the sheet says so (`form.profile`, no
// `form`, `known`), for up to `WILD_SHAPE_SETTLE`, as an effect's change does; focus then goes
// where the change is, only where it was on what was pressed, in the dialog, or lost.

/**
 * The ribbon above a shaped sheet's tabs, on every tab (round 0.40.0 §5.2): what the character is,
 * the time it has left as the module last sent it, and Return to {name} where the seat may; else
 * why not. None where the sheet has no form, nor at a creature's pane.
 */
export function WildShapeRibbon() {
  const { form, pane, heading } = use(WildShapeContext)
  if (!form || !pane) return
  return <Ribbon form={form} heading={heading} />
}

function Ribbon({
  form,
  heading,
}: Readonly<{
  form: SheetForm
  /** The ribbon's heading, which takes focus once a change is made. */
  heading: RefObject<HTMLHeadingElement | null>
}>) {
  const { panel, on, role, sheet, name } = use(WildShapeContext)
  const section = useRef<HTMLElement>(null)
  // The game ending it while focus is in the ribbon: focus to the tab's panel, as it goes.
  useLayoutEffect(() => {
    const element = section.current
    return () => {
      const active = document.activeElement
      if (element && active && element.contains(active)) panel()?.focus()
    }
  }, [panel])
  const { label, heading: title } = ribbonWords(form)
  const time = timeLeftWords(form.minutesLeft)
  const returnable = on && role === 'player' && canReturn(sheet)
  // The module times it, the campaign's switch on, but the game isn't taking Wild Shape now.
  const lapsed =
    role === 'player' && !on && form.hours !== null && form.minutesLeft !== null
  return (
    <section
      ref={section}
      aria-label={label}
      className='flex shrink-0 items-center gap-2.5 border-b border-wild/35 bg-wild-bg py-2 pr-2 pl-3.5 md:pl-6 lg:pl-7'
    >
      <PawPrint aria-hidden className='size-5 shrink-0 text-wild' />
      <div className='min-w-0 flex-1'>
        <h2
          ref={heading}
          tabIndex={-1}
          className='text-sm font-semibold text-wild outline-none'
        >
          {title}
        </h2>
        {time && (
          <p className='flex items-center gap-1 text-xs text-text-secondary'>
            <Clock aria-hidden className='size-3 shrink-0' />
            {time}
          </p>
        )}
        {!returnable && (
          <p className='text-xs text-text-secondary'>
            {lapsed ? notTakingWords(role) : ENDS_IN_FOUNDRY}
          </p>
        )}
      </div>
      {returnable && <ReturnButton label={`Return to ${name}`} />}
    </section>
  )
}
