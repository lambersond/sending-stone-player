import type { ReactNode } from 'react'

export type SidePanelProps = {
  open: boolean
  onClose: () => void
  title: string
  /** Under the title, such as where its content comes from. */
  subtitle?: string
  /** Beside the Close button, such as a link to open its content as a page. */
  actions?: ReactNode
  children: ReactNode
}
