'use client'

import Link from 'next/link'
import { PartySheetFor } from '../party-sheet-for/party-sheet-for'
import { SidePanel } from '@/components/side-panel/side-panel'
import { usePartySheet } from '@/features/party/hooks/use-party-sheet'
import type { PartyPanelProps } from './types'

/**
 * A party's sheet in a side panel over a character's sheet, as the same core as its own page, with
 * a link to open it as one. It's fetched only while open.
 */
export function PartyPanel({
  group,
  api,
  pageHref,
  role,
  ownSheetHref,
  takeInto,
  onClose,
}: Readonly<PartyPanelProps>) {
  return (
    <SidePanel
      open={group !== undefined}
      onClose={onClose}
      title={group?.name ?? ''}
      subtitle={group?.primary ? 'Primary party' : 'Party'}
      actions={
        group && (
          // Its name starts with the words it shows, as one speaking to their device says them.
          <Link
            href={pageHref}
            aria-label={`Open as page: ${group.name}`}
            className='rounded-lg px-2 py-1.5 text-sm font-medium whitespace-nowrap text-primary-text transition-colors hover:bg-primary/10'
          >
            Open as page
          </Link>
        )
      }
    >
      {group && (
        <PartyPanelSheet
          key={group.id}
          api={api}
          role={role}
          ownSheetHref={ownSheetHref}
          takeInto={takeInto}
        />
      )}
    </SidePanel>
  )
}

/** The sheet inside the panel, which polls only while it's shown. */
function PartyPanelSheet({
  api,
  role,
  ownSheetHref,
  takeInto,
}: Readonly<
  Pick<PartyPanelProps, 'api' | 'role' | 'ownSheetHref' | 'takeInto'>
>) {
  const { view, state } = usePartySheet(api)
  return (
    <PartySheetFor
      api={api}
      role={role}
      view={view}
      state={state}
      ownSheetHref={ownSheetHref}
      takeInto={takeInto}
    />
  )
}
