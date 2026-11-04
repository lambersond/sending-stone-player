import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
  type Placement,
  type UseFloatingOptions,
} from '@floating-ui/react'
import { usePortalRoot } from '@/components/modal/use-portal-root'
import { useTopmostEscape } from '@/components/modal/use-topmost-escape'

/**
 * A menu's, popover's or tooltip's place beside what it's opened from, as floating-ui places it,
 * kept there as either moves: `gap` away on the `placement` side, flipped and shifted to stay
 * 8px inside the screen, shifted along the other axis too where `across`, and no taller than the
 * room there where `fit` says how (floating-ui's `size`). It opens where `usePortalRoot` says,
 * inside a modal dialog it's opened from, and while it's open, Escape closes only it, unless
 * `escape` is false. Its `anchor`, where it's given, is what it's opened from; else the element
 * given `setReference`. What it does on a click, a hover or a key stays with each one.
 */
export function usePopover({
  open,
  onOpenChange,
  anchor,
  placement,
  gap,
  across,
  fit,
  escape = true,
}: {
  open: boolean
  onOpenChange: NonNullable<UseFloatingOptions['onOpenChange']>
  anchor?: HTMLElement
  placement: Placement
  gap?: Parameters<typeof offset>[0]
  across?: boolean
  fit?: Parameters<typeof size>[0]
  escape?: boolean
}) {
  const root = usePortalRoot()
  useTopmostEscape(escape && open)
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange,
    ...(anchor && { elements: { reference: anchor } }),
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(gap),
      flip({ padding: 8 }),
      shift({ padding: 8, ...(across !== undefined && { crossAxis: across }) }),
      ...(fit ? [size(fit)] : []),
    ],
  })
  const { setReference, setFloating, setPositionReference } = refs
  return {
    setReference,
    setFloating,
    setPositionReference,
    floatingStyles,
    context,
    root,
  }
}
