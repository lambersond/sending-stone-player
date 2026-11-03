'use client'

import clsx from 'clsx'
import { Columns2, Rows3, Table2, type LucideIcon } from 'lucide-react'
import { useStoredChoice } from '@/hooks/use-stored'

/** How the Actions tab lays out its actions: in a list, in columns side by side, or in a table. */
export type Layout = 'list' | 'columns' | 'table'

/**
 * The layouts, and the width of the sheet, in pixels, each needs: a table from about a small
 * tablet's, and columns from where two fit side by side, each as wide as a phone's list.
 */
export const LAYOUTS: {
  id: Layout
  label: string
  icon: LucideIcon
  from: number
}[] = [
  { id: 'list', label: 'List', icon: Rows3, from: 0 },
  { id: 'columns', label: 'Columns', icon: Columns2, from: 720 },
  { id: 'table', label: 'Table', icon: Table2, from: 576 },
]
const LAYOUT_IDS = LAYOUTS.map(({ id }) => id)

/** Where this browser keeps the layout chosen. */
export const LAYOUT_KEY = 'sending-stone:actions-layout'

/**
 * The layouts the Actions tab offers where it is this many pixels wide, and the one it shows: the
 * one this browser chose, where it's offered, or else the list. Choosing one keeps it in this
 * browser; listing where it doesn't fit leaves the choice kept, so a phone turned sideways gets
 * its table back.
 * @param width - How wide the Actions tab is, in pixels.
 */
export function useActionsLayout(width: number) {
  const offered = LAYOUTS.filter(({ from }) => width >= from)
  const [chosen, choose] = useStoredChoice(LAYOUT_KEY, LAYOUT_IDS, 'list')
  const layout: Layout = offered.some(({ id }) => id === chosen)
    ? chosen
    : 'list'
  return { offered, layout, choose }
}

/** The layouts the Actions tab offers, the one it shows, and how to choose another. */
export type ActionsLayout = ReturnType<typeof useActionsLayout>

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
