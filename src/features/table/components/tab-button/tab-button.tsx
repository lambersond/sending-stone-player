'use client'

import clsx from 'clsx'
import { HoldDescription } from '../hold-tab/hold-description'
import { HoldFill } from '../hold-tab/hold-fill'
import { holdProps } from '../hold-tab/hold-props'
import { TABLE_NAV_TAB } from '@/features/table/constants'
import type { TabHold } from '@/features/table/types'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'

/** One of the table's tabs, in the bottom bar on a phone or the rail on a tablet. */
export function TabButton({
  icon: Icon,
  label,
  active,
  onClick,
  hold,
  ref,
  children,
}: Readonly<{
  icon: LucideIcon
  label: string
  active: boolean
  onClick: () => void
  /** From module 0.36.0, the Combat tab held to end the turn. */
  hold?: TabHold
  ref?: RefObject<HTMLButtonElement | null>
  children?: ReactNode
}>) {
  const { className, ...holding } = holdProps(hold)
  return (
    <button
      ref={ref}
      type='button'
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      {...holding}
      className={clsx(
        TABLE_NAV_TAB,
        'relative rounded-xl text-xs font-semibold transition-colors',
        active || hold?.holding
          ? 'text-text-primary'
          : 'text-text-secondary hover:text-text-primary',
        active && 'bg-primary/10',
        className,
      )}
    >
      <HoldFill hold={hold} />
      <Icon
        aria-hidden
        className={clsx('relative size-6', active && 'text-primary')}
      />
      <span className='relative'>{label}</span>
      {children}
      <HoldDescription hold={hold} />
    </button>
  )
}
