import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { nextCookies } from 'better-auth/next-js'
import { socialProviders } from './auth-providers'
import { sessionOptions } from './auth-session'
import prisma from '@/clients/prisma'

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  socialProviders: socialProviders(),
  session: sessionOptions(),
  // nextCookies must stay the last plugin
  plugins: [nextCookies()],
})
