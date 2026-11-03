import clsx from 'clsx'
import { LocalTime } from '@/components/local-time/local-time'
import type { FoundryState } from '@/features/campaigns/types'
import type { OwnedCampaign } from '@/types/campaign'

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
