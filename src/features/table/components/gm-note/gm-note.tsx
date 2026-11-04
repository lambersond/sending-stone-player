'use client'

import clsx from 'clsx'
import { gmNote } from '@/features/table/utils/header'
import type { GmRolls } from '@/types/table'

/**
 * Tells the Gamemaster at one of their campaign's characters' sheets (#156) where what they roll
 * there goes: made in their game as the character's, marked as theirs; kept here until their
 * module is new enough to mark it; or kept here while their game takes no rolls.
 */
export function GmNote({
  name,
  rolls,
}: Readonly<{ name: string; rolls: GmRolls }>) {
  const note = gmNote(name, rolls)
  return (
    <p
      className={clsx(
        'shrink-0 border-b px-4 py-2.5 text-sm md:px-8',
        rolls === 'made'
          ? 'border-primary/30 bg-primary/5'
          : 'border-warning/40 bg-warning/10',
      )}
    >
      {note}
    </p>
  )
}
