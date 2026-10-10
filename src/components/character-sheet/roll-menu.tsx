'use client'

import { useId, useLayoutEffect, useRef, useState } from 'react'
import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  size,
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
  ArrowUpToLine,
  ChevronsDown,
  ChevronsUp,
  SlidersHorizontal,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { usePortalRoot, useTopmostEscape } from '@/components/modal'

/**
 * What the player chose: a roll with advantage or disadvantage, or to modify the roll first; or,
 * for damage or healing, a critical hit's, every die at its highest, or to change its dice first.
 */
export type RollChoice =
  'adv' | 'dis' | 'modify' | 'critical' | 'maximize' | 'modify-damage'

/** The ways to roll a check, save or attack. */
export const D20_CHOICES: RollChoice[] = ['adv', 'dis', 'modify']

/** Where the player clicked or pressed for the menu, from the top-left corner of what they hit. */
export type MenuPoint = {
  x: number
  y: number
  /** A finger or pen, whose hand would hide a menu below it. */
  touch: boolean
}

const CHOICES: Record<
  RollChoice,
  { label: string; icon: LucideIcon; tint: string }
> = {
  adv: { label: 'Roll with advantage', icon: ChevronsUp, tint: 'text-primary' },
  dis: {
    label: 'Roll with disadvantage',
    icon: ChevronsDown,
    tint: 'text-ruby',
  },
  modify: {
    label: 'Modify roll…',
    icon: SlidersHorizontal,
    tint: 'text-text-secondary',
  },
  critical: {
    label: 'Roll critical damage',
    icon: Zap,
    tint: 'text-gold-text',
  },
  maximize: {
    label: 'Roll maximum damage',
    icon: ArrowUpToLine,
    tint: 'text-damage',
  },
  'modify-damage': {
    label: 'Modify damage…',
    icon: SlidersHorizontal,
    tint: 'text-text-secondary',
  },
}

/** Where a menu opens, and what it's of. */
type MenuPlace = {
  /** The part of the sheet it opened from. */
  anchor: HTMLElement
  /** Where on it they clicked or pressed. With none, as from a key or a tap, it goes below it. */
  point?: MenuPoint
  /** What it's of, such as "Perception check +7". */
  title: string
  onClose: () => void
}

type Props = MenuPlace & {
  /** The ways it can be rolled; those of a d20 roll unless said. */
  choices?: RollChoice[]
  /** What to call a choice instead, such as "Roll maximum healing". */
  labels?: Partial<Record<RollChoice, string>>
  onChoose: (choice: RollChoice) => void
}

/**
 * Other ways to roll a check or save, where the player clicked or pressed for them: at the pointer,
 * like the browser's own context menu, or above a finger. Arrow keys move between them; Escape, or
 * a click or tap elsewhere, closes it.
 */
export function RollMenu({
  choices = D20_CHOICES,
  labels = {},
  onChoose,
  ...place
}: Readonly<Props>) {
  return (
    <ChoiceMenu
      {...place}
      items={choices.map(choice => ({
        ...choiceItem(choice),
        ...(labels[choice] && { label: labels[choice] }),
      }))}
      onChoose={onChoose}
    />
  )
}

/** A way to roll as a menu offers it, such as "Roll with advantage". */
export function choiceItem(choice: RollChoice): MenuItem<RollChoice> {
  return { id: choice, ...CHOICES[choice] }
}

/** One of a menu's items: what it says, its icon and the icon's colour, as a class. */
export type MenuItem<T extends string> = {
  id: T
  label: string
  icon: LucideIcon
  tint?: string
  /** Why it can't be chosen now, said under it; unset where it can be. */
  disabled?: string
}

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
  // eslint-disable-next-line unicorn/no-null -- floating-ui marks no active item with null
  const [active, setActive] = useState<number | null>(null)
  const list = useRef<(HTMLElement | null)[]>([])
  const reasons = useId()
  const root = usePortalRoot()
  useTopmostEscape(true)
  const { placement, gap } = placing(point)
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
      shift({ padding: 8 }),
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

  return (
    <FloatingPortal root={root}>
      <FloatingFocusManager context={context} initialFocus={0} modal={false}>
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          aria-label={title}
          className='z-50 flex max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] min-w-56 flex-col overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-1 text-text-primary shadow-xl'
          {...getFloatingProps()}
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
            return (
              <button
                key={item.id}
                type='button'
                role='menuitem'
                disabled={item.disabled !== undefined}
                // Named for what it does, and why it can't be done now said after.
                aria-label={
                  item.disabled === undefined ? undefined : item.label
                }
                aria-describedby={item.disabled === undefined ? undefined : why}
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
                  {item.disabled !== undefined && (
                    <span
                      id={why}
                      className='text-xs font-normal text-text-secondary'
                    >
                      {item.disabled}
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

/**
 * A click's menu hangs from the pointer, as the browser's would; a press's sits above the finger,
 * so the hand doesn't hide it; and one from a key sits below the part of the sheet. Each turns to
 * the other side when there's no room. So does any popover opened as a menu is.
 */
export function placing(point: MenuPoint | undefined): {
  placement: Placement
  gap: Parameters<typeof offset>[0]
} {
  if (!point) return { placement: 'bottom', gap: 6 }
  if (point.touch) return { placement: 'top', gap: 16 }
  return { placement: 'right-start', gap: { mainAxis: 4, alignmentAxis: 4 } }
}

/** A point on the part of the sheet, which moves with it as the sheet scrolls. */
export function pointOn(
  anchor: HTMLElement,
  { x, y }: MenuPoint,
): VirtualElement {
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
