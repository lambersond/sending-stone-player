import { type LucideIcon } from 'lucide-react'
import type { MoveEnd } from '@/features/transfers/types'

export type Section = {
  key: 'parties' | 'characters'
  label: 'Parties' | 'Characters'
  ends: MoveEnd[]
  fallback: LucideIcon
}
