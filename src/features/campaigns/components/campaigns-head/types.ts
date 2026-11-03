import type { CampaignSetupFormState } from '@/types/campaign'

export type CampaignsHeadProps = {
  /** This app's address, for Foundry to send to. */
  destination: string
  setUp: (
    state: CampaignSetupFormState,
    formData: FormData,
  ) => Promise<CampaignSetupFormState>
  suggestedSecret: string
}
