import type { LucideIcon } from 'lucide-react'

/** How the Actions tab lays out its actions: in a list, in columns side by side, or in a table. */
export type Layout = 'list' | 'columns' | 'table'

/** One of the Actions tab's layouts: its name and icon, and the width of the sheet it needs. */
export type LayoutOption = {
  id: Layout
  label: string
  icon: LucideIcon
  from: number
}

/** The layouts the Actions tab offers, the one it shows, and how to choose another. */
export type ActionsLayout = {
  offered: LayoutOption[]
  layout: Layout
  choose: (choice: Layout) => void
}
