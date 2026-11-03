'use client'

import { Users } from 'lucide-react'
import { PartySheet } from '../party-sheet/party-sheet'
import { EmptyState } from '@/components/empty-state/empty-state'
import type { PartySheetForProps } from './types'

/**
 * The party's sheet as its hook has it: while it's first fetched, once it's no longer the seat's
 * to see, or else the sheet, with the party's journal notes. Its page and its side panel each show
 * it so.
 */
export function PartySheetFor({
  api,
  role,
  view,
  state,
  ownSheetHref,
  takeInto,
}: Readonly<PartySheetForProps>) {
  if (state === 'gone') {
    return (
      <EmptyState icon={Users} title="This party sheet isn't available">
        {role === 'gm'
          ? "It's no longer in this campaign in Foundry."
          : "It's no longer shared with your character in Foundry."}
      </EmptyState>
    )
  }
  if (!view) {
    return (
      <p
        role='status'
        className='py-16 text-center text-sm text-text-secondary'
      >
        Loading the party sheet…
      </p>
    )
  }
  return (
    <PartySheet
      api={api}
      role={role}
      view={view}
      ownSheetHref={ownSheetHref}
      takeInto={takeInto}
      notes
    />
  )
}
