import { Suspense } from 'react'
import { YourCampaigns } from './your-campaigns'
import { LoadingStone } from '@/components/loading-stone/loading-stone'
import { CAMPAIGNS_PATH } from '@/constants/campaign'
import { askedCampaign } from '@/features/campaigns/utils/campaigns-view'
import { requireUser } from '@/lib/session'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Your campaigns' }

/**
 * Where a Gamemaster sets up the campaigns they run, and invites their players: their campaigns,
 * those that need them first (v0.39), and the one the address chooses, `?campaign=<id>`. Signed
 * out, to the login page and back, before anything is sent; then the loading stone while their
 * campaigns are read (v0.48.0).
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

  return (
    <Suspense fallback={<LoadingStone />}>
      <YourCampaigns userId={user.id} query={query} />
    </Suspense>
  )
}
