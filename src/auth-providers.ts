import type { BetterAuthOptions } from 'better-auth'

type SocialProviders = NonNullable<BetterAuthOptions['socialProviders']>

export const socialProviders = (): SocialProviders => ({
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
})

const isTrue = (value?: string) => value?.toLowerCase() === 'true'
