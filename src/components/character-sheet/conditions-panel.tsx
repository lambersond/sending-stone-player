'use client'

import { createContext, use, useState, type ReactNode } from 'react'
import { ConditionsReference } from './conditions-reference'
import { SidePanel } from '@/components/side-panel'
import { CONDITIONS } from '@/constants/conditions'
import type { SheetCondition } from '@/types/sending-stone'

/*
 * The conditions panel: an aside with every condition's rules, opened from anywhere on the sheet,
 * at one condition or at the top. The sheet has one, and every part of it opens that one.
 */

/** Opens the conditions panel, at a condition by its id, or at the top. */
export type ShowConditions = (id?: string) => void

const Opener = createContext<ShowConditions | undefined>(undefined)

/** Has every part of the sheet inside open the sheet's conditions panel with `show`. */
export function ConditionsOpener({
  show,
  children,
}: Readonly<{ show: ShowConditions; children: ReactNode }>) {
  return <Opener value={show}>{children}</Opener>
}

/** Opens the sheet's conditions panel; none outside a sheet that has one. */
export function useShowConditions(): ShowConditions | undefined {
  return use(Opener)
}

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

/** The rules of a condition the app has them for, by its id, such as "prone". */
export function rulesOf(id: string) {
  return CONDITIONS.find(condition => condition.id === id)
}
