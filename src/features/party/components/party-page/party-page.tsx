'use client'

import { useMemo } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { PartySheetFor } from '../party-sheet-for/party-sheet-for'
import { FullscreenButton } from '@/components/fullscreen-button/fullscreen-button'
import { LiveStatus } from '@/components/live-status/live-status'
import { HEADER_ICON_BUTTON } from '@/constants/buttons'
import { usePartySheet } from '@/features/party/hooks/use-party-sheet'
import { TableApiContext } from '@/hooks/use-table-api'
import type { PartyPageProps } from './types'
import type { LiveState } from '@/components/live-status/types'
import type { TableSeat } from '@/types/character'

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
  takeInto,
}: Readonly<PartyPageProps>) {
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
              className={`-ml-1.5 sm:-ml-3 ${HEADER_ICON_BUTTON}`}
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
              takeInto={takeInto}
            />
          </div>
        </div>
      </div>
    </TableApiContext>
  )
}
