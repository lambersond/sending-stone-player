import { LocalTime } from '@/components/local-time/local-time'
import type { OwnedCampaign } from '@/types/campaign'

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
