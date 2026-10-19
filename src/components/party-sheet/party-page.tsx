'use client'

import { useMemo } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { PartySheetFor } from './party-sheet'
import { FullscreenButton } from '@/components/game-table/fullscreen-button'
import { LiveStatus, type LiveState } from '@/components/game-table/live-status'
import { usePartySheet } from '@/hooks/use-party-sheet'
import { TableApiContext } from '@/hooks/use-table-api'
import type { TableSeat } from '@/types/character'
import type { PartyView } from '@/types/party'
import type { SeatRole } from '@/utils/seat-words'

type Props = {
  /** The party sheet's API, such as `/api/characters/<id>/party/<group>`. */
  api: string
  role: SeatRole
  /** The view the page was rendered with. */
  initialView: PartyView
  /** Where its back arrow goes, and what it's called. */
  back: { href: string; label: string }
  /** The player's own character's sheet, which its name in the members links to. */
  ownSheetHref?: string
}

/**
 * A party's sheet as its own page, which the game fills as it does a character's (module 0.30.0):
 * a header like the table's, with the way back, the party's name and campaign, whether the game is
 * live and full screen; and under it the same core as the side panel.
 */
export function PartyPage({
  api,
  role,
  initialView,
  back,
  ownSheetHref,
}: Readonly<Props>) {
  const {
    view = initialView,
    state,
    connection,
  } = usePartySheet(api, initialView)
  const seat = useMemo<TableSeat>(
    () => ({ role, api, key: `party:${initialView.group.id}` }),
    [role, api, initialView.group.id],
  )
  let live: LiveState = view.live ? 'live' : 'offline'
  if (connection === 'reconnecting') live = 'reconnecting'
  return (
    // What it reads through the party's API, the live status's words among it, finds it here.
    <TableApiContext value={seat}>
      <div className='flex h-dvh flex-col'>
        <header className='flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 md:px-8'>
          <div className='flex min-w-0 items-center gap-2'>
            <Link
              href={back.href}
              aria-label={back.label}
              className='-ml-1.5 shrink-0 rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary'
            >
              <ArrowLeft aria-hidden className='size-5' />
            </Link>
            <div className='min-w-0'>
              <h1 className='truncate text-lg leading-tight font-semibold'>
                {view.group.name}
              </h1>
              <p className='truncate text-sm text-text-secondary'>
                {view.group.primary ? 'Primary party' : 'Party'} ·{' '}
                {view.campaign.title}
              </p>
            </div>
          </div>
          <div className='flex shrink-0 items-center gap-1'>
            <LiveStatus state={live} />
            <FullscreenButton />
          </div>
        </header>
        <div className='min-h-0 flex-1 overflow-y-auto'>
          <div className='mx-auto w-full max-w-5xl p-4 md:px-8 md:py-6'>
            <PartySheetFor
              api={api}
              role={role}
              view={view}
              state={state}
              ownSheetHref={ownSheetHref}
            />
          </div>
        </div>
      </div>
    </TableApiContext>
  )
}
