import type { FoundryState } from '@/features/campaigns/types'
import type { OwnedCampaign } from '@/types/campaign'

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
