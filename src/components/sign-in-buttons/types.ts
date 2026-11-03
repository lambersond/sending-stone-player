import type { SocialProviderId } from '@/auth-providers'

export type SignInButtonsProps = {
  providers: SocialProviderId[]
  /** Where to land once signed in. */
  callbackURL: string
  /** Where to land if signing in fails. */
  errorCallbackURL?: string
}
