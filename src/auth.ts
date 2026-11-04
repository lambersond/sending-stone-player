import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { socialProviders } from './auth-providers'
import prisma from '@/clients/prisma'

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  socialProviders: socialProviders(),
  session: {
    expiresIn: Number(process.env.AUTH_MAX_AGE) || 30 * 86_400, // 30 days
    updateAge: 86_400,
  },
  // nextCookies must stay the last plugin
  plugins: [nextCookies()],
})
