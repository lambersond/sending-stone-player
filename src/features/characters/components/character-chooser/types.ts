import type { CampaignChoice, ChooseCharacterFormState } from '@/types/campaign'

export type CharacterChooserProps = {
  choice: CampaignChoice
  action: (
    state: ChooseCharacterFormState,
    formData: FormData,
  ) => Promise<ChooseCharacterFormState>
  /** The button's label. */
  submitLabel?: string
}
