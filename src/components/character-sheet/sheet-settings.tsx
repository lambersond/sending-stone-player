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
import { PanelBottom, PanelTop, Settings } from 'lucide-react'
import { LayoutPicker, type ActionsLayout } from './actions-layout'
import { usePortalRoot, useTopmostEscape } from '@/components/modal'
import { ThemeToggle } from '@/components/theme-toggle'
import { useTableRole } from '@/hooks/use-table-api'
import { seatWords } from '@/utils/seat-words'

type Props = {
  /** Whether this device sends the player's rolls to the table, while the game takes any. */
  send?: { on: boolean; onChange: (on: boolean) => void }
  /**
   * Whether damage rolled here goes to the table on its own, from module 0.36.0, where the game
   * takes it: this device's, so every pane's cog says the same. Disabled while Send to the table
   * is off, as nothing goes then.
   */
  alone?: { on: boolean; onChange: (on: boolean) => void; disabled: boolean }
  /**
   * Whether the player types in what their own dice show, where the campaign's game lets them,
   * from module 0.32.0: the setting is shown only then.
   */
  manualDice?: { on: boolean; onChange: (on: boolean) => void }
  /** Whether the player's rolls pop up as toasts on this device, or stay in the banner. */
  toasts?: { on: boolean; onChange: (on: boolean) => void }
  /** The Actions tab's layouts, where the sheet is wide enough for more than one. */
  layouts?: ActionsLayout
}

/**
 * The sheet's settings, behind a cog beside its tabs, so that they're at hand from every tab
 * without taking room from them: whether this device sends the player's rolls to the table, and
 * beneath it, where the game takes it, whether their damage goes there on its own; where the game
 * lets them, typing in what their own dice show; whether rolls show as
 * toasts or in a banner, the theme, and how the Actions tab is laid out. It opens as
 * `ExactAmount`'s popover does, by a click or tap, or Enter or Space, its first setting taking
 * focus; Escape, a click or tap elsewhere, or the cog again closes it. It stays open as settings
 * change, for several to be changed at once.
 */
export function SheetSettings({
  send,
  alone,
  manualDice,
  toasts,
  layouts,
}: Readonly<Props>) {
  const role = useTableRole()
  const { game } = seatWords(role)
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
      {/* A little tighter in the row of tabs on a phone under 390 pixels, as the rolls' button. */}
      <button
        ref={refs.setReference}
        type='button'
        aria-label='Settings'
        title='Settings'
        className='rounded-lg p-2 text-text-secondary transition-colors @max-[366px]:p-1.5 hover:bg-primary/5 hover:text-text-primary aria-expanded:bg-primary/10 aria-expanded:text-primary'
        {...getReferenceProps()}
      >
        <Settings aria-hidden className='size-4' />
      </button>
      {open && (
        <FloatingPortal root={root}>
          <FloatingFocusManager context={context} modal={false}>
            {/* Over the rolls' toasts, 100001, which start just below the cog, as it does. */}
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              aria-labelledby={title}
              className='z-[100002] flex w-72 max-w-[calc(100vw-1rem)] flex-col gap-3 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-3 text-text-primary shadow-xl outline-none'
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
              {/* Under Send to the table, as what it sends rides on it. */}
              {alone && (
                <SwitchSetting
                  label='Damage on its own'
                  hint={
                    alone.disabled
                      ? 'Turn on Send to the table first.'
                      : `Damage you roll goes to ${game} with no attack or saving throw made there, for ${role === 'gm' ? 'you' : 'your Gamemaster'} to apply.`
                  }
                  {...alone}
                  child
                />
              )}
              {manualDice && (
                <SwitchSetting
                  label='Enter dice results manually'
                  hint='Type in what your own dice show, instead of rolling here.'
                  {...manualDice}
                />
              )}
              {toasts && <ResultsSetting {...toasts} />}
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

/**
 * A setting turned on or off by a switch, said more of beneath it; one that rides on the setting
 * above it set in beneath it, its `child`. A disabled one is drawn and announced off, whatever's
 * stored, which comes back once it's enabled again.
 */
function SwitchSetting({
  label,
  hint,
  on,
  onChange,
  child = false,
  disabled = false,
}: Readonly<{
  label: string
  hint: string
  on: boolean
  onChange: (on: boolean) => void
  child?: boolean
  disabled?: boolean
}>) {
  const hintId = useId()
  const shown = on && !disabled
  return (
    <div
      className={clsx(
        'flex flex-col gap-1',
        child
          ? 'ml-1 border-l border-border pl-4'
          : 'border-t border-border pt-3',
      )}
    >
      {/* A 44-pixel target, as the switch inside it is small. */}
      <label
        className={clsx(
          'flex min-h-11 items-center gap-3 text-sm font-medium',
          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        )}
      >
        <input
          type='checkbox'
          role='switch'
          checked={shown}
          disabled={disabled}
          onChange={event => onChange(event.target.checked)}
          aria-describedby={hintId}
          className='peer sr-only'
        />
        <span
          aria-hidden
          className={clsx(
            'relative h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary',
            shown ? 'bg-primary' : 'bg-border',
          )}
        >
          <span
            className={clsx(
              'absolute top-0.5 size-4 rounded-full bg-card shadow-sm transition-[left]',
              shown ? 'left-4.5' : 'left-0.5',
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

/** The ways the player's rolls are shown, one or the other: as toasts, or in the banner. */
const RESULTS = [
  {
    toasts: true,
    label: 'Toasts',
    icon: PanelTop,
    hint: 'Each roll pops up at the top of the screen for 4 seconds; one you need to act on stays until you do.',
  },
  {
    toasts: false,
    label: 'Banner',
    icon: PanelBottom,
    hint: 'Your rolls stay in a banner at the bottom of the sheet.',
  },
]

/**
 * How the player's rolls are shown, as toasts or in the banner, picked as the Actions tab's layout
 * is, and said more of beneath, as the choice made shows them.
 */
function ResultsSetting({
  on,
  onChange,
}: Readonly<{ on: boolean; onChange: (on: boolean) => void }>) {
  const hintId = useId()
  const chosen = RESULTS.find(({ toasts }) => toasts === on) ?? RESULTS[0]
  return (
    <Setting label='Roll results'>
      <div
        role='radiogroup'
        aria-label='Roll results'
        aria-describedby={hintId}
        className='flex rounded-lg border border-border bg-card p-0.5'
      >
        {RESULTS.map(({ toasts, label, icon: Icon }) => (
          <button
            key={label}
            type='button'
            role='radio'
            aria-checked={on === toasts}
            onClick={() => onChange(toasts)}
            className={clsx(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
              on === toasts
                ? 'bg-primary/10 text-primary-text'
                : 'text-text-secondary hover:bg-primary/5 hover:text-text-primary',
            )}
          >
            <Icon aria-hidden className='size-4' />
            {label}
          </button>
        ))}
      </div>
      <p id={hintId} className='text-xs text-text-secondary'>
        {chosen.hint}
      </p>
    </Setting>
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
