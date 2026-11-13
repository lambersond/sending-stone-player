'use client'

import clsx from 'clsx'
import { CAMPAIGNS_HEADING, CAMPAIGNS_LEAD } from '../../constants'
import { PAGE_HEADING_ID } from '../../utils/campaign-ids'
import { ConnectFoundryButton } from '@/features/campaigns/components/campaign-buttons/connect-foundry-button'
import { NewCampaignButton } from '@/features/campaigns/components/campaign-buttons/new-campaign-button'
import { useCampaignChoice } from '@/features/campaigns/hooks/use-campaign-choice'
import type { CampaignsHeadProps } from './types'

/**
 * The head of the campaigns page: its heading, what it's for, and Connect Foundry and New
 * campaign. Drawn inside the index, whose New campaign › Done chooses the campaign set up. On a
 * phone with a campaign chosen, only the heading stays, for screen readers, so the page keeps its
 * top heading over the campaign shown in place of the list.
 */
export function CampaignsHead({
  destination,
  setUp,
  suggestedSecret,
}: Readonly<CampaignsHeadProps>) {
  const { chosen } = useCampaignChoice()
  const narrowed = chosen !== undefined
  return (
    <header
      className={clsx(
        'flex flex-wrap items-end justify-between gap-3',
        // Its box gone with all it shows, so the page leaves no gap for it.
        narrowed && '@max-[900px]/index:contents',
      )}
    >
      <div
        className={clsx('min-w-0', narrowed && '@max-[900px]/index:contents')}
      >
        <h1
          id={PAGE_HEADING_ID}
          tabIndex={-1}
          className={clsx(
            'text-2xl font-semibold tracking-tight outline-none',
            narrowed && '@max-[900px]/index:sr-only',
          )}
        >
          {CAMPAIGNS_HEADING}
        </h1>
        <p
          className={clsx(
            'mt-1 max-w-[46ch] text-text-secondary',
            narrowed && '@max-[900px]/index:hidden',
          )}
        >
          {CAMPAIGNS_LEAD}
        </p>
      </div>
      <div
        className={clsx(
          'flex flex-wrap gap-2',
          narrowed && '@max-[900px]/index:hidden',
        )}
      >
        <ConnectFoundryButton destination={destination} />
        <NewCampaignButton action={setUp} suggestedSecret={suggestedSecret} />
      </div>
    </header>
  )
}
