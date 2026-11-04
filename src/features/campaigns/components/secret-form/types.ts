import type { SecretFormState } from '@/types/campaign'

export type SecretFormProps = {
  action: (
    state: SecretFormState,
    formData: FormData,
  ) => Promise<SecretFormState>
}
