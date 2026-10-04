import {
  changeSecretAction,
  removeCampaignAction,
  resetInviteAction,
  setUpCampaignAction,
} from './actions'
import {
  CampaignCard,
  CampaignSetupForm,
  ConnectSteps,
} from '@/components/campaigns'
import { JOIN_PATH } from '@/constants/campaign'
import { listOwnedCampaigns } from '@/db/campaigns'
import { appOrigin } from '@/lib/app-origin'
import { generateSecret } from '@/lib/campaign-secret'
import { requireUser } from '@/lib/session'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Your campaigns' }

/** Where a Gamemaster sets up the campaigns they run, and invites their players. */
export default async function CampaignsPage() {
  const user = await requireUser('/campaigns')
  const [campaigns, origin] = await Promise.all([
    listOwnedCampaigns(user.id),
    appOrigin(),
  ])

  return (
    <div className='mx-auto w-full max-w-3xl px-4 py-10 sm:py-14'>
      <h1 className='text-2xl font-semibold tracking-tight'>Your campaigns</h1>
      <p className='mt-1 text-text-secondary'>
        Set up each campaign you run as Gamemaster, connect Foundry to it, then
        share its invite link with your players.
      </p>

      <section aria-labelledby='campaigns-heading' className='mt-10'>
        <h2 id='campaigns-heading' className='sr-only'>
          Campaigns
        </h2>
        {campaigns.length > 0 ? (
          <div className='grid gap-4'>
            {campaigns.map(campaign => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                inviteUrl={`${origin}${JOIN_PATH}/${campaign.inviteCode}`}
                changeSecret={changeSecretAction.bind(undefined, campaign.id)}
                resetInvite={resetInviteAction.bind(undefined, campaign.id)}
                remove={removeCampaignAction.bind(undefined, campaign.id)}
              />
            ))}
          </div>
        ) : (
          <p className='rounded-2xl border border-dashed border-border p-6 text-center text-text-secondary'>
            You haven&apos;t set up a campaign yet.
          </p>
        )}
      </section>

      <section aria-labelledby='set-up-heading' className='mt-10'>
        <h2 id='set-up-heading' className='mb-4 text-lg font-semibold'>
          Set up a campaign
        </h2>
        <CampaignSetupForm
          action={setUpCampaignAction}
          suggestedSecret={generateSecret()}
        />
      </section>

      <section aria-labelledby='connect-heading' className='mt-10'>
        <h2 id='connect-heading' className='text-lg font-semibold'>
          Connect Foundry
        </h2>
        <p className='mt-1 mb-4 text-text-secondary'>
          Sending Stone hears from your game through the Sending Stone module,
          running in your browser while you have the game open.
        </p>
        <ConnectSteps destination={origin} />
      </section>
    </div>
  )
}
