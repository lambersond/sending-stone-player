import { sortCampaigns } from './campaign-order'
import { CAMPAIGN_ID } from '@/constants/campaign'
import type { OwnedCampaign } from '@/types/campaign'

/**
 * The campaign the campaigns page's address chooses, `?campaign=<id>`, read only where it's one
 * value of a campaign id's shape: anything else is ignored.
 */
export function askedCampaign(
  asked: string | string[] | undefined,
): string | undefined {
  return typeof asked === 'string' && CAMPAIGN_ID.test(asked)
    ? asked
    : undefined
}

/**
 * What the campaigns page shows of a Gamemaster's campaigns: each in order, those that need them
 * first, as of now; the chosen campaign, where it's still one of theirs, an unknown or deleted one
 * ignored; and the one the first view shows, the chosen one, else the first in order, beside the
 * list on a wide screen.
 * @param query - The campaign the address chooses, if any.
 */
export function campaignsView(
  owned: OwnedCampaign[],
  query: string | undefined,
  now = Date.now(),
) {
  const campaigns = sortCampaigns(owned, now)
  const chosen = campaigns.find(({ id }) => id === query)?.id
  return { campaigns, chosen, first: chosen ?? campaigns[0]?.id }
}
