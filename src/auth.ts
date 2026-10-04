import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { socialProviders } from './auth-providers'
import prisma from './clients/prisma'

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  socialProviders: socialProviders(),
  session: {
    expiresIn: Number(process.env.AUTH_MAX_AGE) || 7 * 86_400, // 7 days
    updateAge: 86_400,
  },
  // nextCookies must stay the last plugin
  plugins: [nextCookies()],
})
