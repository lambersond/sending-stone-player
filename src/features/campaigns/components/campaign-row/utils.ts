import { statusOf } from '@/features/campaigns/components/campaign-status/utils'
import {
  campaignFlag,
  seatsOf,
} from '@/features/campaigns/utils/campaign-order'
import { gameHost } from '@/utils/game-host'
import type { CampaignRowData } from '@/features/campaigns/types'
import type { OwnedCampaign } from '@/types/campaign'

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
