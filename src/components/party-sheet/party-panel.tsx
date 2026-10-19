'use client'

import Link from 'next/link'
import { PartySheetFor } from './party-sheet'
import { SidePanel } from '@/components/side-panel'
import { usePartySheet } from '@/hooks/use-party-sheet'
import type { TableGroup } from '@/types/party'
import type { SeatRole } from '@/utils/seat-words'

type Props = {
  /** The group whose sheet is open, as the table last listed it; unset while it's closed. */
  group?: TableGroup
  /** Its party sheet's API, such as `/api/characters/<id>/party/<group>`. */
  api: string
  /** Its own page, which the panel's link opens it as. */
  pageHref: string
  role: SeatRole
  /** The player's own character's sheet, which its name in the members links to. */
  ownSheetHref?: string
  onClose: () => void
}

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
  onClose,
}: Readonly<Props>) {
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
}: Readonly<Pick<Props, 'api' | 'role' | 'ownSheetHref'>>) {
  const { view, state } = usePartySheet(api)
  return (
    <PartySheetFor
      api={api}
      role={role}
      view={view}
      state={state}
      ownSheetHref={ownSheetHref}
    />
  )
}
