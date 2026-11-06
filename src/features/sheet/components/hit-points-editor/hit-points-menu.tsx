'use client'

import { useId, useRef } from 'react'
import {
  FloatingFocusManager,
  FloatingPortal,
  useDismiss,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import { HitPointsField } from './hit-points-field'
import { useHitPointsEditor } from './use-hit-points-editor'
import { usePopover } from '@/hooks/use-popover'
import type { HitPointsInput } from '@/types/roll'
import type { HitPointsNow } from '@/types/sending-stone'

/** Why Save does nothing yet, as the words under it say while nothing has changed. */
const UNCHANGED = 'Change a number to save'

/**
 * The hit points and temporary hit points set from the app (module 0.44.0), as a popover below
 * the tile it opened from, as the hit dice's opens: a field for each, its number typed in or
 * stepped by one; a live line of what they are, then of what Save changes, "22 → 21 · temporary
 * 3 → 0"; Save, which sends that change, and Cancel. Should the game's numbers change while it's
 * open, the fields reset to them, and the line says so. Its focus starts on the hit points' one
 * fewer, so that a phone's keyboard doesn't cover it until the player taps a field. Escape, a tap
 * elsewhere or Cancel closes it, and focus goes back to the tile. Inside a modal dialog, it opens
 * in the dialog, as the page behind it is inert.
 */
export function HitPointsMenu({
  anchor,
  hp,
  onSave,
  onClose,
}: Readonly<{
  /** The tile it opened from. */
  anchor: HTMLElement
  /** The hit points as the sheet has them now. */
  hp: HitPointsNow
  onSave: (change: HitPointsInput) => void
  onClose: () => void
}>) {
  const { draft, wanted, most, change, line, step, type, settle, submit } =
    useHitPointsEditor({ hp, onSave })
  const fewer = useRef<HTMLButtonElement>(null)
  const title = useId()
  const reason = useId()
  const { setFloating, floatingStyles, context, root } = usePopover({
    open: true,
    onOpenChange: open => {
      if (!open) onClose()
    },
    anchor,
    placement: 'bottom-start',
    gap: 6,
  })
  const { getFloatingProps } = useInteractions([
    useDismiss(context),
    useRole(context, { role: 'dialog' }),
  ])

  return (
    <FloatingPortal root={root}>
      <FloatingFocusManager
        context={context}
        initialFocus={fewer}
        modal={false}
      >
        <form
          ref={setFloating}
          style={floatingStyles}
          aria-labelledby={title}
          onSubmit={submit}
          noValidate
          className='z-50 flex w-72 max-w-[calc(100vw-1rem)] flex-col gap-3 rounded-xl border border-border bg-card p-3 text-text-primary shadow-xl'
          {...getFloatingProps()}
        >
          <p id={title} className='text-xs font-semibold text-text-secondary'>
            Hit points
          </p>
          <HitPointsField
            label='Hit points'
            unit='hit point'
            text={draft.value}
            number={wanted.value}
            most={most.value}
            of={hp.max === null ? undefined : `of ${hp.max}`}
            atMost={
              hp.max === null
                ? `${most.value} is the most`
                : `${most.value} is the maximum`
            }
            minusRef={fewer}
            onStep={by => step('value', by)}
            onType={text => type('value', text)}
            onSettle={() => settle('value')}
          />
          <HitPointsField
            label='Temporary hit points'
            unit='temporary hit point'
            text={draft.temp}
            number={wanted.temp}
            most={most.temp}
            atMost={`${most.temp} is the most`}
            onStep={by => step('temp', by)}
            onType={text => type('temp', text)}
            onSettle={() => settle('temp')}
          />
          <output
            aria-live='polite'
            className='text-sm font-semibold tabular-nums'
          >
            {line}
          </output>
          <div className='flex flex-col gap-1'>
            <button
              type='submit'
              aria-disabled={!change}
              aria-describedby={change ? undefined : reason}
              className='h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-primary'
            >
              Save
            </button>
            {!change && (
              <p
                id={reason}
                className='text-center text-xs text-text-secondary'
              >
                {UNCHANGED}
              </p>
            )}
            <button
              type='button'
              onClick={onClose}
              className='h-11 rounded-xl px-4 text-sm font-semibold text-text-secondary transition-colors hover:bg-primary/5 hover:text-text-primary'
            >
              Cancel
            </button>
          </div>
        </form>
      </FloatingFocusManager>
    </FloatingPortal>
  )
}
