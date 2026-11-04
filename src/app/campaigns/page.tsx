import {
  changeSecretAction,
  clearChatAction,
  removeCampaignAction,
  removePlayerAction,
  resetInviteAction,
  revokeCookbookLinkAction,
  setUpCampaignAction,
} from './actions'
import { CAMPAIGNS_PATH, JOIN_PATH } from '@/constants/campaign'
import { listOwnedCampaigns } from '@/db/campaigns'
import { CampaignCard } from '@/features/campaigns/components/campaign-card/campaign-card'
import { CampaignIndex } from '@/features/campaigns/components/campaign-index/campaign-index'
import { rowOf } from '@/features/campaigns/components/campaign-row/utils'
import { CampaignsHead } from '@/features/campaigns/components/campaigns-head/campaigns-head'
import {
  askedCampaign,
  campaignsView,
} from '@/features/campaigns/utils/campaigns-view'
import { appOrigin } from '@/lib/app-origin'
import { generateSecret } from '@/lib/campaign-secret'
import { requireUser } from '@/lib/session'
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
  // The campaign the address chooses: a link to it returns to it once its Gamemaster signs in.
  const { campaign: asked } = await searchParams
  const query = askedCampaign(asked)
  const user = await requireUser(
    query
      ? `${CAMPAIGNS_PATH}?campaign=${encodeURIComponent(query)}`
      : CAMPAIGNS_PATH,
  )
  const [owned, origin] = await Promise.all([
    listOwnedCampaigns(user.id),
    appOrigin(),
  ])
  const view = campaignsView(owned, query)

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
        clearChat={clearChatAction.bind(undefined, campaign.id)}
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
