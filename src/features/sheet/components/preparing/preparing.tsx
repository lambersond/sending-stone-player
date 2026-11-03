'use client'

import { type ReactNode } from 'react'
import { PreparingContext, type Preparations } from './use-prepare-choice'

// What a pane offers of its character's spells, from module 0.42.1: on every row of a spell the
// character prepares, Prepare or Unprepare, as the sheet says it is now, as dnd5e's own sheet's
// menu offers them. Found by the spell's id, so that each of its rows offers it whatever draws it,
// a spell's row or an action's, and all of them wait together once it's sent.

/** What the rows inside offer of the character's spells. */
export function Preparing({
  value,
  children,
}: Readonly<{ value: Preparations; children: ReactNode }>) {
  return <PreparingContext value={value}>{children}</PreparingContext>
}
