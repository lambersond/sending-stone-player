'use client'

import clsx from 'clsx'
import { HoldDescription } from '../hold-tab/hold-description'
import { HoldFill } from '../hold-tab/hold-fill'
import { holdProps } from '../hold-tab/hold-props'
import type { TabHold } from '@/features/table/types'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'

/** Choosing whether combat or the chat sits beside the sheet on a wide screen. */
export function PaneTab({
  icon: Icon,
  label,
  pane,
  selected,
  onClick,
  hold,
  ref,
  children,
}: Readonly<{
  icon: LucideIcon
  label: string
  pane: string
  selected: boolean
  onClick: () => void
  /** From module 0.36.0, the Combat tab held to end the turn. */
  hold?: TabHold
  ref?: RefObject<HTMLButtonElement | null>
  /** What draws the eye to it, such as unread messages. */
  children?: ReactNode
}>) {
  const { className, ...holding } = holdProps(hold)
  return (
    <button
      ref={ref}
      type='button'
      role='tab'
      aria-selected={selected}
      aria-controls={pane}
      onClick={onClick}
      {...holding}
      className={clsx(
        'relative inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold transition-colors',
        selected || hold?.holding
          ? 'text-text-primary'
          : 'text-text-secondary hover:text-text-primary',
        selected && 'bg-primary/10',
        className,
      )}
    >
      <HoldFill hold={hold} />
      <Icon
        aria-hidden
        className={clsx('relative size-4', selected && 'text-primary')}
      />
      <span className='relative'>{label}</span>
      {children}
      <HoldDescription hold={hold} />
    </button>
  )
}
