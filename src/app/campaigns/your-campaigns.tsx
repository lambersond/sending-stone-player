import {
  changeSecretAction,
  clearChatAction,
  removeCampaignAction,
  removePlayerAction,
  resetInviteAction,
  revokeCookbookLinkAction,
  setUpCampaignAction,
} from './actions'
import { JOIN_PATH } from '@/constants/campaign'
import { listOwnedCampaigns } from '@/db/campaigns'
import { CampaignCard } from '@/features/campaigns/components/campaign-card/campaign-card'
import { CampaignIndex } from '@/features/campaigns/components/campaign-index/campaign-index'
import { rowOf } from '@/features/campaigns/components/campaign-row/utils'
import { CampaignsHead } from '@/features/campaigns/components/campaigns-head/campaigns-head'
import { campaignsView } from '@/features/campaigns/utils/campaigns-view'
import { appOrigin } from '@/lib/app-origin'
import { generateSecret } from '@/lib/campaign-secret'
import type { ReactNode } from 'react'

/**
 * The campaigns a Gamemaster runs, those that need them first (v0.39), and the one the address
 * chose (v0.48.0: read once the page has its user, their outline shimmering until then).
 */
export async function YourCampaigns({
  userId,
  query,
}: Readonly<{ userId: string; query?: string }>) {
  const [owned, origin] = await Promise.all([
    listOwnedCampaigns(userId),
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
  )
}
