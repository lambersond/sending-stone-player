import type { SocialProviderId } from '@/types/auth'
import type { BetterAuthOptions } from 'better-auth'

type SocialProviders = NonNullable<BetterAuthOptions['socialProviders']>

export const socialProviders = () =>
  ({
    google: {
      enabled: isTrue(process.env.AUTH_GOOGLE_ENABLED),
      clientId: process.env.AUTH_GOOGLE_ID as string,
      clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
    },
    discord: {
      enabled: isTrue(process.env.AUTH_DISCORD_ENABLED),
      clientId: process.env.AUTH_DISCORD_ID as string,
      clientSecret: process.env.AUTH_DISCORD_SECRET as string,
    },
  }) satisfies Required<Pick<SocialProviders, SocialProviderId>>

/** The providers switched on by their *_ENABLED environment variable. */
export const enabledSocialProviders = (): SocialProviderId[] =>
  Object.entries(socialProviders())
    .filter(([, provider]) => provider.enabled)
    .map(([id]) => id as SocialProviderId)

const isTrue = (value?: string) => value?.toLowerCase() === 'true'
