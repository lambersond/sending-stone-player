import clsx from 'clsx'
import { LocalTime } from '@/components/game-table/local-time'
import type { OwnedCampaign } from '@/types/campaign'

/** What a campaign's chip says of its Foundry (round 0.39.0). */
export type FoundryState = 'refused' | 'live' | 'waiting' | 'offline'

/**
 * Where a campaign's Foundry stands: its posts refused, while a refusal is current, whatever else
 * is so; else live; else waiting for its first connection; else offline.
 */
export function statusOf(
  campaign: Pick<OwnedCampaign, 'refusal' | 'live' | 'connected'>,
): FoundryState {
  if (campaign.refusal?.current) return 'refused'
  if (campaign.live) return 'live'
  return campaign.connected ? 'offline' : 'waiting'
}

const CHIPS: Record<
  FoundryState,
  { label: string; chip?: string; dot: string }
> = {
  refused: {
    label: 'Refused',
    chip: 'border-danger/45 text-danger',
    dot: 'bg-danger',
  },
  // Pulsing only where the reader allows motion.
  live: { label: 'Live', dot: 'bg-primary motion-safe:animate-pulse' },
  waiting: {
    label: 'Waiting for Foundry',
    dot: 'border-[1.5px] border-dashed border-text-secondary',
  },
  offline: { label: 'Offline', dot: 'bg-text-secondary' },
}

/** A campaign's chip, on its row and at the head of its page: what its Foundry is doing. */
export function CampaignStatus({ state }: Readonly<{ state: FoundryState }>) {
  const { label, chip, dot } = CHIPS[state]
  return (
    <span
      data-state={state}
      className={clsx(
        'inline-flex shrink-0 items-center gap-2 rounded-full border bg-card px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        chip ?? 'border-border',
      )}
    >
      <span aria-hidden className={clsx('size-2 rounded-full', dot)} />
      {label}
    </span>
  )
}

/** When Foundry was last heard for a campaign, where it isn't live and has been heard. */
export function LastHeard({
  campaign,
}: Readonly<{ campaign: Pick<OwnedCampaign, 'live' | 'lastSeenAt'> }>) {
  if (campaign.live || !campaign.lastSeenAt) return
  return (
    <span className='text-xs whitespace-nowrap text-text-secondary'>
      Last heard <LocalTime value={campaign.lastSeenAt} />
    </span>
  )
}

/** The head of a campaign's page: its chip, and under it when Foundry was last heard. */
export function FoundryStatus({
  campaign,
}: Readonly<{
  campaign: Pick<OwnedCampaign, 'refusal' | 'live' | 'connected' | 'lastSeenAt'>
}>) {
  return (
    <span className='inline-flex shrink-0 flex-col items-end gap-0.5'>
      <CampaignStatus state={statusOf(campaign)} />
      <LastHeard campaign={campaign} />
    </span>
  )
}
