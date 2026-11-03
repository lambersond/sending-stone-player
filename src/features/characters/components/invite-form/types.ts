import type { InviteFormState } from '@/types/campaign'

export type InviteFormProps = {
  action: (
    state: InviteFormState,
    formData: FormData,
  ) => Promise<InviteFormState>
}
