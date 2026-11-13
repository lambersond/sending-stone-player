import { Suspense } from 'react'
import { YourCampaigns } from './your-campaigns'
import { CAMPAIGNS_PATH } from '@/constants/campaign'
import { CampaignIndexSkeleton } from '@/features/campaigns/components/campaign-index/campaign-index-skeleton'
import { askedCampaign } from '@/features/campaigns/utils/campaigns-view'
import { requireUser } from '@/lib/session'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Your campaigns' }

/**
 * Where a Gamemaster sets up the campaigns they run, and invites their players: their campaigns,
 * those that need them first (v0.39), and the one the address chooses, `?campaign=<id>`. Signed
 * out, to the login page and back, before anything is sent; then the page's box at once, its
 * outline shimmering in it while their campaigns are read (v0.48.0).
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
    // As wide as the design's page, 1120 px, for the list and a campaign side by side.
    <div className='mx-auto w-full max-w-[70rem] px-4 pt-6 pb-8 md:px-8 md:pt-8 md:pb-10'>
      <Suspense
        fallback={<CampaignIndexSkeleton asked={query !== undefined} />}
      >
        <YourCampaigns userId={user.id} query={query} />
      </Suspense>
    </div>
  )
}
