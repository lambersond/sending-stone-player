'use client'

import { useState, useRef, useId, useLayoutEffect } from 'react'
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  size,
  useInteractions,
  useDismiss,
  useRole,
  useListNavigation,
  FloatingPortal,
  FloatingFocusManager,
} from '@floating-ui/react'
import clsx from 'clsx'
import { usePortalRoot } from '@/components/modal/use-portal-root'
import { useTopmostEscape } from '@/components/modal/use-topmost-escape'
import { placing, pointOn } from '@/features/rolling/utils/menu-points'
import type { MenuPlace } from './types'
import type { MenuItem } from '@/features/rolling/types'

/**
 * A menu of things to do with a part of the sheet, opened where the player clicked or pressed for
 * it, as `RollMenu` is: the first item that can be chosen takes focus, arrow keys move between
 * them, skipping any that can't be chosen now, which say why; Escape, or a click or tap elsewhere,
 * closes it. One taller than the room there is scrolls inside. Inside a modal dialog, it opens in
 * the dialog, as the page behind it is inert, and Escape closes only the menu.
 */
export function ChoiceMenu<T extends string>({
  anchor,
  point,
  title,
  items,
  onChoose,
  onClose,
}: Readonly<
  MenuPlace & { items: MenuItem<T>[]; onChoose: (choice: T) => void }
>) {
  const [active, setActive] = useState<number | null>(null)
  const list = useRef<(HTMLElement | null)[]>([])
  const reasons = useId()
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
      // No taller than the room on the side it's on, its items scrolled inside it: one with many,
      // as a check that may be made many ways, may be taller than a phone's screen.
      size({
        padding: 8,
        apply: ({ availableHeight, elements }) => {
          elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`
        },
      }),
    ],
  })
  const { setFloating } = refs
  useLayoutEffect(() => {
    refs.setPositionReference(point ? pointOn(anchor, point) : anchor)
  }, [anchor, point, refs])
  const { getFloatingProps, getItemProps } = useInteractions([
    useDismiss(context),
    useRole(context, { role: 'menu' }),
    useListNavigation(context, {
      listRef: list,
      activeIndex: active,
      onNavigate: setActive,
      loop: true,
    }),
  ])
  // The first that can be chosen takes focus when the menu opens.
  const first = Math.max(
    0,
    items.findIndex(item => !item.disabled),
  )
  // Where nothing can be chosen, focus stays on the menu itself, and arrow keys reach no item, so
  // the menu says why of each, as "Remove…" waiting alone does (module 0.33.0).
  const nothing =
    items.length > 0 && items.every(item => item.disabled !== undefined)
      ? items.map((_item, index) => `${reasons}-${index}`).join(' ')
      : undefined

  return (
    <FloatingPortal root={root}>
      <FloatingFocusManager context={context} initialFocus={0} modal={false}>
        <div
          ref={setFloating}
          style={floatingStyles}
          aria-label={title}
          className='z-50 flex max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] min-w-56 flex-col overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-1 text-text-primary shadow-xl'
          {...getFloatingProps()}
          {...(nothing && { 'aria-describedby': nothing })}
        >
          <p
            aria-hidden
            className='shrink-0 px-3 pt-1.5 pb-1 text-xs font-semibold text-text-secondary'
          >
            {title}
          </p>
          {items.map((item, index) => {
            const { icon: Icon } = item
            const why = `${reasons}-${index}`
            // Why it can't be done now; or else what else to know of it, where there's anything.
            const note = item.disabled ?? item.hint
            return (
              <button
                key={item.id}
                type='button'
                role='menuitem'
                disabled={item.disabled !== undefined}
                // Named for what it does, and why it can't be done now, or what else to know of
                // it, said after.
                aria-label={note === undefined ? undefined : item.label}
                aria-describedby={note === undefined ? undefined : why}
                ref={node => {
                  list.current[index] = node
                }}
                tabIndex={(active ?? first) === index ? 0 : -1}
                className={clsx(
                  'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium outline-none disabled:cursor-not-allowed',
                  active === index && 'bg-primary/10',
                )}
                {...getItemProps({ onClick: () => onChoose(item.id) })}
              >
                <Icon
                  aria-hidden
                  className={clsx(
                    'size-4 shrink-0',
                    item.disabled === undefined
                      ? item.tint
                      : 'text-text-secondary',
                  )}
                />
                <span className='flex min-w-0 flex-col'>
                  <span
                    className={clsx(
                      item.disabled !== undefined && 'text-text-secondary',
                    )}
                  >
                    {item.label}
                  </span>
                  {note !== undefined && (
                    <span
                      id={why}
                      className='text-xs font-normal text-text-secondary'
                    >
                      {note}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  )
}
