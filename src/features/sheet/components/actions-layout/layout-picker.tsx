'use client'

import clsx from 'clsx'
import type { LAYOUTS, Layout } from './constants'

/** The layouts to choose from, each a button pressed while it's the one chosen. */
export function LayoutPicker({
  layouts,
  layout,
  onChange,
}: Readonly<{
  layouts: typeof LAYOUTS
  layout: Layout
  onChange: (layout: Layout) => void
}>) {
  return (
    <div
      role='group'
      aria-label='Actions layout'
      className='flex rounded-lg border border-border bg-card p-0.5'
    >
      {layouts.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type='button'
          aria-pressed={layout === id}
          onClick={() => onChange(id)}
          className={clsx(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
            layout === id
              ? 'bg-primary/10 text-primary-text'
              : 'text-text-secondary hover:bg-primary/5 hover:text-text-primary',
          )}
        >
          <Icon aria-hidden className='size-4' />
          {label}
        </button>
      ))}
    </div>
  )
}
