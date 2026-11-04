import type { CampaignSetupFormState } from '@/types/campaign'
import type { InputHTMLAttributes, ReactNode, Ref } from 'react'

export type CampaignSetupFormProps = {
  action: (
    state: CampaignSetupFormState,
    formData: FormData,
  ) => Promise<CampaignSetupFormState>
  /** A random secret to start from. */
  suggestedSecret: string
  /** Called when the Gamemaster is done with the campaign just set up, with its id. */
  onDone: (id: string) => void
}

export type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>
  label: string
  name: string
  hint: string
  errors?: string[]
  /** Beside the input, such as a button acting on it. */
  children?: ReactNode
}
