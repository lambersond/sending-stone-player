'use client'

import clsx from 'clsx'
import { PILL } from './constants'
import { useRollsLocked } from '@/hooks/use-rolls-locked'
import type { MouseEvent, ReactNode } from 'react'

/** A link that rolls, greyed where its pane's rolls are locked, as a gone companion's (0.36.0). */
const LOCKED = 'cursor-not-allowed opacity-50'

/**
 * A description's link that rolls or opens a menu, as a pill in its text: tinted as given, and
 * greyed and disabled while its pane's rolls are locked, as a gone companion's (module 0.36.0).
 */
export function LinkPill({
  label,
  popup = false,
  tint,
  onClick,
  children,
}: Readonly<{
  /** Its accessible name, where it isn't its text. */
  label?: string
  /** Whether it opens a menu. */
  popup?: boolean
  /** Its colours, such as `bg-primary/12 hover:bg-primary/20`. */
  tint: string
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  children: ReactNode
}>) {
  const locked = useRollsLocked()
  return (
    <button
      type='button'
      aria-label={label}
      aria-haspopup={popup ? 'menu' : undefined}
      disabled={locked}
      onClick={onClick}
      className={clsx(PILL, tint, locked && LOCKED)}
    >
      {children}
    </button>
  )
}
