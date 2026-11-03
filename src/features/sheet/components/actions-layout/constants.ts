import { Rows3, Columns2, Table2, type LucideIcon } from 'lucide-react'

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
