'use client'

import { useId, useState, type ReactNode } from 'react'
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  size,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import clsx from 'clsx'
import { Settings } from 'lucide-react'
import { LayoutPicker, type ActionsLayout } from './actions-layout'
import { usePortalRoot, useTopmostEscape } from '@/components/modal'
import { ThemeToggle } from '@/components/theme-toggle'
import { useTableRole } from '@/hooks/use-table-api'
import { seatWords } from '@/utils/seat-words'

type Props = {
  /** Whether this device sends the player's rolls to the table, while the game takes any. */
  send?: { on: boolean; onChange: (on: boolean) => void }
  /** Whether the player's rolls pop up as toasts on this device. */
  toasts?: { on: boolean; onChange: (on: boolean) => void }
  /** The Actions tab's layouts, where the sheet is wide enough for more than one. */
  layouts?: ActionsLayout
}

/**
 * The sheet's settings, behind a cog beside its tabs, so that they're at hand from every tab
 * without taking room from them: whether this device sends the player's rolls to the table, and
 * pops them up as toasts, the theme, and how the Actions tab is laid out. It opens as
 * `ExactAmount`'s popover does, by a click or tap, or Enter or Space, its first setting taking
 * focus; Escape, a click or tap elsewhere, or the cog again closes it. It stays open as settings
 * change, for several to be changed at once.
 */
export function SheetSettings({ send, toasts, layouts }: Readonly<Props>) {
  const { game } = seatWords(useTableRole())
  const [open, setOpen] = useState(false)
  const title = useId()
  const root = usePortalRoot()
  useTopmostEscape(open)
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-end',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      // No taller than the room below the cog, as on a phone turned sideways; it scrolls inside.
      size({
        padding: 8,
        apply: ({ availableHeight, elements }) => {
          elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`
        },
      }),
    ],
  })
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: 'dialog' }),
  ])
  return (
    <>
      <button
        ref={refs.setReference}
        type='button'
        aria-label='Settings'
        title='Settings'
        className='rounded-lg p-2 text-text-secondary transition-colors hover:bg-primary/5 hover:text-text-primary aria-expanded:bg-primary/10 aria-expanded:text-primary'
        {...getReferenceProps()}
      >
        <Settings aria-hidden className='size-4' />
      </button>
      {open && (
        <FloatingPortal root={root}>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              aria-labelledby={title}
              className='z-50 flex w-72 max-w-[calc(100vw-1rem)] flex-col gap-3 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-3 text-text-primary shadow-xl outline-none'
              {...getFloatingProps()}
            >
              <p
                id={title}
                className='text-xs font-semibold text-text-secondary'
              >
                Settings
              </p>
              {send && (
                <SwitchSetting
                  label='Send to the table'
                  hint={`Your rolls here are made in ${game} too, with the same dice.`}
                  {...send}
                />
              )}
              {toasts && (
                <SwitchSetting
                  label='Roll toasts'
                  hint='Each roll’s result pops up at the top of the screen for 4 seconds. Tap one to clear it.'
                  {...toasts}
                />
              )}
              <Setting label='Theme'>
                <ThemeToggle />
              </Setting>
              {layouts && (
                <Setting label='Actions layout'>
                  <LayoutPicker
                    layouts={layouts.offered}
                    layout={layouts.layout}
                    onChange={layouts.choose}
                  />
                </Setting>
              )}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  )
}

/** A setting turned on or off by a switch, said more of beneath it. */
function SwitchSetting({
  label,
  hint,
  on,
  onChange,
}: Readonly<{
  label: string
  hint: string
  on: boolean
  onChange: (on: boolean) => void
}>) {
  const hintId = useId()
  return (
    <div className='flex flex-col gap-1 border-t border-border pt-3'>
      <label className='flex cursor-pointer items-center gap-3 text-sm font-medium'>
        <input
          type='checkbox'
          role='switch'
          checked={on}
          onChange={event => onChange(event.target.checked)}
          aria-describedby={hintId}
          className='peer sr-only'
        />
        <span
          aria-hidden
          className={clsx(
            'relative h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary',
            on ? 'bg-primary' : 'bg-border',
          )}
        >
          <span
            className={clsx(
              'absolute top-0.5 size-4 rounded-full bg-card shadow-sm transition-[left]',
              on ? 'left-4.5' : 'left-0.5',
            )}
          />
        </span>
        {label}
      </label>
      <p id={hintId} className='pl-12 text-xs text-text-secondary'>
        {hint}
      </p>
    </div>
  )
}

/**
 * A setting under its caption, which only shows: the control it captions is named the same for
 * screen readers.
 */
function Setting({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className='flex flex-col items-start gap-1.5 border-t border-border pt-3'>
      <p aria-hidden className='text-xs font-semibold text-text-secondary'>
        {label}
      </p>
      {children}
    </div>
  )
}
