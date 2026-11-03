import {
  ChevronsUp,
  ChevronsDown,
  SlidersHorizontal,
  Zap,
  ArrowUpToLine,
  type LucideIcon,
} from 'lucide-react'
import type { MenuPoint, RollChoice, MenuItem } from '@/features/rolling/types'
import type { Placement, offset, VirtualElement } from '@floating-ui/react'

/** Where a pointer is on the button, or nothing when it's off it. */
export function pointWithin(
  button: HTMLElement,
  { clientX, clientY }: { clientX: number; clientY: number },
  touch: boolean,
): MenuPoint | undefined {
  const { left, top, width, height } = button.getBoundingClientRect()
  const x = clientX - left
  const y = clientY - top
  // A pixel's leeway, for browsers that round where the pointer is.
  if (x < -1 || y < -1 || x > width + 1 || y > height + 1) return undefined
  return { x, y, touch }
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

/** A way to roll as a menu offers it, such as "Roll with advantage". */
export function choiceItem(choice: RollChoice): MenuItem<RollChoice> {
  return { id: choice, ...CHOICES[choice] }
}

/**
 * A click's menu hangs from the pointer, as the browser's would; a press's sits above the finger,
 * so the hand doesn't hide it; and one from a key sits below the part of the sheet. Each turns to
 * the other side when there's no room, and a click's, beside the pointer, moves back across onto
 * the screen where neither side has room, as on a phone's narrow one (`across`). So does any
 * popover opened as a menu is.
 */
export function placing(point?: MenuPoint): {
  placement: Placement
  gap: Parameters<typeof offset>[0]
  across: boolean
} {
  if (!point) return { placement: 'bottom', gap: 6, across: false }
  if (point.touch) return { placement: 'top', gap: 16, across: false }
  return {
    placement: 'right-start',
    gap: { mainAxis: 4, alignmentAxis: 4 },
    across: true,
  }
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
