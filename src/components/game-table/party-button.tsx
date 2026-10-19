'use client'

import { useRef, useState } from 'react'
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useRole,
} from '@floating-ui/react'
import clsx from 'clsx'
import { Users } from 'lucide-react'
import { usePortalRoot, useTopmostEscape } from '@/components/modal'
import type { TableGroup } from '@/types/party'

/** The table header's icon buttons' look. */
const ICON_BUTTON =
  'rounded-lg p-2 text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'

/**
 * Opens the side panel of a party sheet the seat may see (module 0.30.0): with one group, at once;
 * with several, from a menu of them, the primary party first. Nothing without any.
 */
export function PartyButton({
  groups,
  onOpen,
}: Readonly<{ groups: TableGroup[]; onOpen: (group: string) => void }>) {
  const [only] = groups
  if (!only) return
  if (groups.length === 1) {
    const label = `Party: ${only.name}`
    return (
      <button
        type='button'
        aria-label={label}
        title={label}
        onClick={() => onOpen(only.id)}
        className={ICON_BUTTON}
      >
        <Users aria-hidden className='size-4' />
      </button>
    )
  }
  return <PartiesMenu groups={groups} onOpen={onOpen} />
}

/**
 * The parties, in a menu under the button, the primary one first: arrow keys move between them;
 * Escape, or a click or tap elsewhere, closes it.
 */
function PartiesMenu({
  groups,
  onOpen,
}: Readonly<{ groups: TableGroup[]; onOpen: (group: string) => void }>) {
  const [open, setOpen] = useState(false)
  // eslint-disable-next-line unicorn/no-null -- floating-ui marks no active item with null
  const [active, setActive] = useState<number | null>(null)
  const list = useRef<(HTMLElement | null)[]>([])
  const root = usePortalRoot()
  useTopmostEscape(open)
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'bottom-end',
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
  })
  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions(
    [
      useClick(context),
      useDismiss(context),
      useRole(context, { role: 'menu' }),
      useListNavigation(context, {
        listRef: list,
        activeIndex: active,
        onNavigate: setActive,
        loop: true,
      }),
    ],
  )
  const sorted = groups.toSorted(
    (a, b) => Number(b.primary) - Number(a.primary),
  )
  return (
    <>
      <button
        ref={refs.setReference}
        type='button'
        aria-label='Parties'
        title='Parties'
        aria-haspopup='menu'
        aria-expanded={open}
        className={ICON_BUTTON}
        {...getReferenceProps()}
      >
        <Users aria-hidden className='size-4' />
      </button>
      {open && (
        <FloatingPortal root={root}>
          <FloatingFocusManager
            context={context}
            initialFocus={0}
            modal={false}
          >
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              aria-label='Parties'
              className='z-50 flex max-w-[calc(100vw-1rem)] min-w-48 flex-col rounded-xl border border-border bg-card p-1 text-text-primary shadow-xl'
              {...getFloatingProps()}
            >
              {sorted.map((group, index) => (
                <button
                  key={group.id}
                  type='button'
                  role='menuitem'
                  ref={node => {
                    list.current[index] = node
                  }}
                  tabIndex={(active ?? 0) === index ? 0 : -1}
                  className={clsx(
                    'truncate rounded-lg px-3 py-2 text-left text-sm font-medium outline-none',
                    active === index && 'bg-primary/10',
                  )}
                  {...getItemProps({
                    onClick: () => {
                      setOpen(false)
                      onOpen(group.id)
                    },
                  })}
                >
                  {group.name}
                </button>
              ))}
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  )
}
