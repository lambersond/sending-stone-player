'use client'

import { useLayoutEffect, useRef, useState } from 'react'
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
  type Placement,
  type VirtualElement,
} from '@floating-ui/react'
import clsx from 'clsx'
import {
  ChevronsDown,
  ChevronsUp,
  SlidersHorizontal,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * What the player chose: a roll with advantage or disadvantage, or to modify the roll first; or,
 * for damage, a critical hit's.
 */
export type RollChoice = 'adv' | 'dis' | 'modify' | 'critical'

/** The ways to roll a check, save or attack. */
export const D20_CHOICES: RollChoice[] = ['adv', 'dis', 'modify']

/** Where the player clicked or pressed for the menu, from the top-left corner of what they hit. */
export type MenuPoint = {
  x: number
  y: number
  /** A finger or pen, whose hand would hide a menu below it. */
  touch: boolean
}

const CHOICES: Record<RollChoice, { label: string; icon: LucideIcon }> = {
  adv: { label: 'Roll with advantage', icon: ChevronsUp },
  dis: { label: 'Roll with disadvantage', icon: ChevronsDown },
  modify: { label: 'Modify roll…', icon: SlidersHorizontal },
  critical: { label: 'Roll critical damage', icon: Zap },
}

type Props = {
  /** The part of the sheet it opened from. */
  anchor: HTMLElement
  /** Where on it they clicked or pressed. With none, as from a key, the menu goes below it. */
  point?: MenuPoint
  /** What would be rolled, such as "Perception check +7". */
  title: string
  /** The ways it can be rolled; those of a d20 roll unless said. */
  choices?: RollChoice[]
  onChoose: (choice: RollChoice) => void
  onClose: () => void
}

/**
 * Other ways to roll a check or save, where the player clicked or pressed for them: at the pointer,
 * like the browser's own context menu, or above a finger. Arrow keys move between them; Escape, or
 * a click or tap elsewhere, closes it.
 */
export function RollMenu({
  anchor,
  point,
  title,
  choices = D20_CHOICES,
  onChoose,
  onClose,
}: Readonly<Props>) {
  // eslint-disable-next-line unicorn/no-null -- floating-ui marks no active item with null
  const [active, setActive] = useState<number | null>(null)
  const items = useRef<(HTMLElement | null)[]>([])
  const { placement, gap } = placing(point)
  const { refs, floatingStyles, context } = useFloating({
    open: true,
    onOpenChange: open => {
      if (!open) onClose()
    },
    elements: { reference: anchor },
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [offset(gap), flip({ padding: 8 }), shift({ padding: 8 })],
  })
  useLayoutEffect(() => {
    refs.setPositionReference(point ? pointOn(anchor, point) : anchor)
  }, [anchor, point, refs])
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
          {choices.map((choice, index) => {
            const { label, icon: Icon } = CHOICES[choice]
            return (
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
                    choice === 'critical' && 'text-gold-text',
                  )}
                />
                {label}
              </button>
            )
          })}
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  )
}

/**
 * A click's menu hangs from the pointer, as the browser's would; a press's sits above the finger,
 * so the hand doesn't hide it; and one from a key sits below the part of the sheet. Each turns to
 * the other side when there's no room.
 */
function placing(point: MenuPoint | undefined): {
  placement: Placement
  gap: Parameters<typeof offset>[0]
} {
  if (!point) return { placement: 'bottom', gap: 6 }
  if (point.touch) return { placement: 'top', gap: 16 }
  return { placement: 'right-start', gap: { mainAxis: 4, alignmentAxis: 4 } }
}

/** A point on the part of the sheet, which moves with it as the sheet scrolls. */
function pointOn(anchor: HTMLElement, { x, y }: MenuPoint): VirtualElement {
  return {
    contextElement: anchor,
    getBoundingClientRect: () => {
      const rect = anchor.getBoundingClientRect()
      const left = rect.left + x
      const top = rect.top + y
      return {
        x: left,
        y: top,
        left,
        top,
        right: left,
        bottom: top,
        width: 0,
        height: 0,
      }
    },
  }
}
