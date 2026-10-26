import clsx from 'clsx'
import { CircleAlert, Plug } from 'lucide-react'
import {
  CampaignStatus,
  LastHeard,
  statusOf,
  type FoundryState,
} from './campaign-status'
import { SeatAvatars } from './seat-avatars'
import {
  campaignFlag,
  seatsOf,
  type Attention,
  type Seat,
} from '@/utils/campaign-order'
import { gameHost } from '@/utils/game-host'
import type { OwnedCampaign } from '@/types/campaign'

/**
 * What a campaign's row in the index shows (round 0.39.0), worked out on the server, so the page
 * hands the index no more of each campaign than its row draws.
 */
export type CampaignRowData = {
  id: string
  title: string
  /** Searched with its title. */
  worldTitle?: string
  /** Its world and its game's host, as far as known. */
  sub: string
  state: FoundryState
  flag?: { attention: Attention; text: string }
  seats: { shown: Seat[]; chosen: number; total: number }
  live: boolean
  lastSeenAt?: string
}

/**
 * A campaign's line under its title: its world and its game's host; the host alone before Foundry
 * has named its world; and, though a campaign is never set up without its game's address, words
 * for neither.
 */
export function subOf(
  campaign: Pick<OwnedCampaign, 'worldTitle' | 'gameUrl'>,
): string {
  const parts = [
    campaign.worldTitle,
    campaign.gameUrl ? gameHost(campaign.gameUrl) : undefined,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : 'Not connected yet'
}

/** A campaign's row, from the campaign as the page has it. */
export function rowOf(campaign: OwnedCampaign): CampaignRowData {
  const flag = campaignFlag(campaign)
  return {
    id: campaign.id,
    title: campaign.title,
    ...(campaign.worldTitle && { worldTitle: campaign.worldTitle }),
    sub: subOf(campaign),
    state: statusOf(campaign),
    ...(flag && { flag }),
    seats: seatsOf(campaign),
    live: campaign.live,
    ...(campaign.lastSeenAt && { lastSeenAt: campaign.lastSeenAt }),
  }
}

/**
 * A campaign in the index: a button that opens it, its name all its text, the seats' circles
 * hidden. Its title and line cut short on one line each; its chip on the right; and across the
 * foot, what it needs of its Gamemaster, else its seats, then when Foundry was last heard.
 * Marked current where it's the campaign shown beside the list, once the page knows it is.
 */
export function CampaignRow({
  row,
  current,
  onChoose,
}: Readonly<{ row: CampaignRowData; current: boolean; onChoose: () => void }>) {
  return (
    <button
      type='button'
      data-campaign={row.id}
      aria-current={current ? 'true' : undefined}
      onClick={onChoose}
      className={clsx(
        'grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-1 rounded-[14px] border bg-card p-3 text-left transition-colors',
        current
          ? 'border-primary bg-primary/4 shadow-[inset_3px_0_0_var(--color-primary)]'
          : 'border-border hover:border-primary/40',
      )}
    >
      <span className='min-w-0'>
        <span className='block truncate text-[15px] font-semibold'>
          {row.title}
        </span>
        <span className='block truncate text-[13px] text-text-secondary'>
          {row.sub}
        </span>
      </span>
      <span>
        <CampaignStatus state={row.state} />
      </span>
      <span className='col-span-full flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5'>
        {row.flag ? (
          <Flag flag={row.flag} />
        ) : (
          <SeatAvatars seats={row.seats} />
        )}
        <LastHeard campaign={row} />
      </span>
    </button>
  )
}

/** What a campaign needs of its Gamemaster, on its row: a refusal, or a first connection. */
function Flag({
  flag,
}: Readonly<{ flag: NonNullable<CampaignRowData['flag']> }>) {
  const refused = flag.attention === 'refused'
  const Icon = refused ? CircleAlert : Plug
  return (
    <span
      className={clsx(
        'inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold',
        refused ? 'text-danger' : 'text-warning',
      )}
    >
      <Icon aria-hidden className='size-4 shrink-0' />
      {flag.text}
    </span>
  )
}
