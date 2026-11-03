import { Rows3, Columns2, Table2 } from 'lucide-react'
import type { LayoutOption } from './types'

/**
 * The layouts, and the width of the sheet, in pixels, each needs: a table from about a small
 * tablet's, and columns from where two fit side by side, each as wide as a phone's list.
 */
export const LAYOUTS: LayoutOption[] = [
  { id: 'list', label: 'List', icon: Rows3, from: 0 },
  { id: 'columns', label: 'Columns', icon: Columns2, from: 720 },
  { id: 'table', label: 'Table', icon: Table2, from: 576 },
]
