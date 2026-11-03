'use client'

import clsx from 'clsx'
import type { Ref } from 'react'

/**
 * A choice in a row of them. A `tall` one is as tall as a finger on a phone, as damage on its own's
 * are (module 0.41.0).
 */
export function Chip({
  ref,
  tall = false,
  selected,
  disabled = false,
  onSelect,
  label,
  children,
}: Readonly<{
  ref?: Ref<HTMLElement>
  tall?: boolean
  selected: boolean
  disabled?: boolean
  onSelect: () => void
  label: string
  children: React.ReactNode
}>) {
  return (
    <button
      ref={ref as Ref<HTMLButtonElement>}
      type='button'
      role='radio'
      aria-checked={selected}
      aria-label={label}
      disabled={disabled}
      onClick={onSelect}
      className={clsx(
        'max-w-full rounded-lg border px-2.5 py-1 text-sm font-semibold tabular-nums transition-colors disabled:opacity-40',
        tall && 'min-h-11 sm:min-h-9',
        selected
          ? 'border-primary bg-primary/10 text-primary-text'
          : 'border-border hover:bg-primary/5',
      )}
    >
      {children}
    </button>
  )
}
