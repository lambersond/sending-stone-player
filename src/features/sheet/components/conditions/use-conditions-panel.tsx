import { useState, type ReactNode } from 'react'
import { ConditionsReference } from './conditions-reference'
import { SidePanel } from '@/components/side-panel/side-panel'
import type { ShowConditions } from './use-show-conditions'
import type { SheetCondition } from '@/types/sending-stone'

/*
 * The conditions panel: an aside with every condition's rules, opened from anywhere on the sheet,
 * at one condition or at the top. The sheet has one, and every part of it opens that one.
 */

/**
 * The conditions panel, with the character's own conditions marked: `show` opens it, at a
 * condition or at the top; it's in `panel`, to be put on the page.
 */
export function useConditionsPanel(conditions: SheetCondition[]): {
  show: ShowConditions
  panel: ReactNode
} {
  const [open, setOpen] = useState<{ at?: string }>()
  return {
    show: id => setOpen(id ? { at: id } : {}),
    panel: (
      <SidePanel
        open={open !== undefined}
        onClose={() => setOpen(undefined)}
        title='Conditions'
        subtitle='Every condition in the 2024 rules (5.5e)'
      >
        <ConditionsReference conditions={conditions} at={open?.at} />
      </SidePanel>
    ),
  }
}
