import type { CampaignSetupFormState } from '@/types/campaign'

export type NewCampaignProps = {
  action: (
    state: CampaignSetupFormState,
    formData: FormData,
  ) => Promise<CampaignSetupFormState>
  suggestedSecret: string
}
