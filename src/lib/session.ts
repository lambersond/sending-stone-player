import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export type SessionUser = typeof auth.$Infer.Session.user

/**
 * The signed-in user, checked against the database once per request.
 * @returns The user, or undefined when nobody is signed in.
 */
export const getCurrentUser = cache(
  async (): Promise<SessionUser | undefined> => {
    const session = await auth.api.getSession({ headers: await headers() })
    return session?.user
  },
)

/**
 * The signed-in user. Sends anyone not signed in to the login page.
 * Call this in every page and Server Action that reads or changes a user's data.
 * @param returnTo - The page to come back to once signed in, such as an invite link.
 * @returns The user.
 */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) {
    redirect(
      returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login',
    )
  }
  return user
}
