'use client'

import type { TabHold } from '@/features/table/types'

/**
 * The fill of a tab held to end the turn, from the left, and its description: hidden words, so
 * that they describe the tab without being its name. The hook draws the fill each frame.
 */
export function HoldFill({ hold }: Readonly<{ hold?: TabHold }>) {
  if (!hold?.offer) return
  // The ref taken out first: read off the props in place, the compiler takes it for a ref read
  // during render.
  const { fill } = hold.offer
  return (
    <span
      ref={fill}
      aria-hidden
      className='pointer-events-none absolute inset-0 origin-left rounded-[inherit] bg-primary/22'
      style={{ transform: 'scaleX(0)' }}
    />
  )
}
