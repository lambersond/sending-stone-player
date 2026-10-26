import {
  changeSecretAction,
  removeCampaignAction,
  removePlayerAction,
  resetInviteAction,
  revokeCookbookLinkAction,
  setUpCampaignAction,
} from './actions'
import {
  CampaignCard,
  CampaignIndex,
  CampaignsHead,
  rowOf,
} from '@/components/campaigns'
import { CAMPAIGN_ID, CAMPAIGNS_PATH, JOIN_PATH } from '@/constants/campaign'
import { listOwnedCampaigns } from '@/db/campaigns'
import { appOrigin } from '@/lib/app-origin'
import { generateSecret } from '@/lib/campaign-secret'
import { requireUser } from '@/lib/session'
import { sortCampaigns } from '@/utils/campaign-order'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = { title: 'Your campaigns' }

/**
 * Where a Gamemaster sets up the campaigns they run, and invites their players: their campaigns,
 * those that need them first (v0.39), and the one the address chooses, `?campaign=<id>`.
 */
export default async function CampaignsPage({
  searchParams,
}: PageProps<'/campaigns'>) {
  // The campaign the address chooses, read only where it's one value of a campaign id's shape:
  // anything else is ignored, and a link to it returns to it once its Gamemaster signs in.
  const { campaign: asked } = await searchParams
  const query =
    typeof asked === 'string' && CAMPAIGN_ID.test(asked) ? asked : undefined
  const user = await requireUser(
    query
      ? `${CAMPAIGNS_PATH}?campaign=${encodeURIComponent(query)}`
      : CAMPAIGNS_PATH,
  )
  const [owned, origin] = await Promise.all([
    listOwnedCampaigns(user.id),
    appOrigin(),
  ])
  const campaigns = sortCampaigns(owned, Date.now())
  // The chosen campaign, where it's still one of theirs: an unknown or deleted one is ignored. The
  // first view shows it, else the first in order, beside the list on a wide screen.
  const chosen = campaigns.find(({ id }) => id === query)?.id
  const view = { campaigns, chosen, first: chosen ?? campaigns[0]?.id }

  // Every campaign's page, drawn here, for the index to show the one chosen by its id, which it
  // keys it by.
  const details: Record<string, ReactNode> = {}
  for (const campaign of view.campaigns) {
    details[campaign.id] = (
      <CampaignCard
        campaign={campaign}
        inviteUrl={`${origin}${JOIN_PATH}/${campaign.inviteCode}`}
        changeSecret={changeSecretAction.bind(undefined, campaign.id)}
        resetInvite={resetInviteAction.bind(undefined, campaign.id)}
        removePlayer={removePlayerAction.bind(undefined, campaign.id)}
        revokeCookbookLink={revokeCookbookLinkAction.bind(
          undefined,
          campaign.id,
        )}
        remove={removeCampaignAction.bind(undefined, campaign.id)}
      />
    )
  }

  return (
    // As wide as the design's page, 1120 px, for the list and a campaign side by side.
    <div className='mx-auto w-full max-w-[70rem] px-4 pt-6 pb-8 md:px-8 md:pt-8 md:pb-10'>
      <CampaignIndex
        rows={view.campaigns.map(campaign => rowOf(campaign))}
        details={details}
        first={view.first}
        head={
          <CampaignsHead
            destination={origin}
            setUp={setUpCampaignAction}
            suggestedSecret={generateSecret()}
          />
        }
      />
    </div>
  )
}
