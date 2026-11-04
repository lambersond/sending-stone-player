import { createContext, use } from 'react'
import type { CampaignChoice } from '@/features/campaigns/types'

/** Nothing chosen, nothing to choose: anywhere outside the index, as a lone campaign's page. */
const NO_CHOICE: CampaignChoice = {
  choose: () => {},
  focusNext: () => {},
}

export const CampaignChoiceContext = createContext<CampaignChoice>(NO_CHOICE)

/** The index's choice of campaign, for what's drawn inside it: its head and each campaign page. */
export function useCampaignChoice(): CampaignChoice {
  return use(CampaignChoiceContext)
}
