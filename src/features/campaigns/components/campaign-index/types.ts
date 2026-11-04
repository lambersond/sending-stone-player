import { type ReactNode } from 'react'
import type { CampaignRowData } from '@/features/campaigns/types'

export type CampaignIndexProps = {
  /** Each campaign's row, in the page's order. */
  rows: CampaignRowData[]
  /** Each campaign's page by its id, drawn on the server. */
  details: Record<string, ReactNode>
  /** The campaign the page was first drawn showing: the one chosen, else the first in order. */
  first?: string
  /** The page's head: its heading, what it's for, and its buttons. */
  head: ReactNode
}
