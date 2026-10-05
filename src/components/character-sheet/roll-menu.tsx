'use client'

import { useRef, useState } from 'react'
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
  useListNavigation,
  useRole,
} from '@floating-ui/react'
import clsx from 'clsx'
import {
  ChevronsDown,
  ChevronsUp,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'

/** What the player chose: a roll with advantage or disadvantage, or to modify the roll first. */
export type RollChoice = 'adv' | 'dis' | 'modify'

const CHOICES: { choice: RollChoice; label: string; icon: LucideIcon }[] = [
  { choice: 'adv', label: 'Roll with advantage', icon: ChevronsUp },
  { choice: 'dis', label: 'Roll with disadvantage', icon: ChevronsDown },
  { choice: 'modify', label: 'Modify roll…', icon: SlidersHorizontal },
]

type Props = {
  /** The part of the sheet it opened from, which it sits beside. */
  anchor: HTMLElement
  /** What would be rolled, such as "Perception check +7". */
  title: string
  onChoose: (choice: RollChoice) => void
  onClose: () => void
}

/**
 * Other ways to roll a check or save, beside the part of the sheet it opened from. Arrow keys move
 * between them; Escape, or a click or tap elsewhere, closes it.
 */
export function RollMenu({
  anchor,
  title,
  onChoose,
  onClose,
}: Readonly<Props>) {
  // eslint-disable-next-line unicorn/no-null -- floating-ui marks no active item with null
  const [active, setActive] = useState<number | null>(null)
  const items = useRef<(HTMLElement | null)[]>([])
  const { refs, floatingStyles, context } = useFloating({
    open: true,
    onOpenChange: open => {
      if (!open) onClose()
    },
    elements: { reference: anchor },
    placement: 'bottom',
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
  })
  const { getFloatingProps, getItemProps } = useInteractions([
    useDismiss(context),
    useRole(context, { role: 'menu' }),
    useListNavigation(context, {
      listRef: items,
      activeIndex: active,
      onNavigate: setActive,
      loop: true,
    }),
  ])

  return (
    <FloatingPortal>
      <FloatingFocusManager context={context} initialFocus={0} modal={false}>
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          aria-label={title}
          className='z-50 flex min-w-56 flex-col rounded-xl border border-border bg-card p-1 text-text-primary shadow-xl'
          {...getFloatingProps()}
        >
          <p
            aria-hidden
            className='px-3 pt-1.5 pb-1 text-xs font-semibold text-text-secondary'
          >
            {title}
          </p>
          {CHOICES.map(({ choice, label, icon: Icon }, index) => (
            <button
              key={choice}
              type='button'
              role='menuitem'
              ref={node => {
                items.current[index] = node
              }}
              // The first item takes focus when the menu opens.
              tabIndex={(active ?? 0) === index ? 0 : -1}
              className={clsx(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium outline-none',
                active === index && 'bg-primary/10',
              )}
              {...getItemProps({ onClick: () => onChoose(choice) })}
            >
              <Icon
                aria-hidden
                className={clsx(
                  'size-4',
                  choice === 'adv' && 'text-primary',
                  choice === 'dis' && 'text-ruby',
                  choice === 'modify' && 'text-text-secondary',
                )}
              />
              {label}
            </button>
          ))}
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  )
}
