import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import type { SessionUser } from './types'

/** Asks the database whatever the session's cookie holds, and writes no cookie (no refresh). */
const CHECKED = { disableCookieCache: true, disableRefresh: true } as const

/**
 * The signed-in user, read once per request for each way of reading it.
 * @param checked - Ask the database whatever the session's cookie holds.
 * @returns The user, or undefined when nobody is signed in.
 */
const readUser = cache(
  async (checked: boolean): Promise<SessionUser | undefined> => {
    const session = await auth.api.getSession({
      headers: await headers(),
      ...(checked && { query: CHECKED }),
    })
    return session?.user
  },
)

/**
 * The signed-in user, once per request, for pages and Route Handlers. It may be taken from the
 * session's sealed cookie, for as long as that cookie lasts (AUTH_CACHE_MAX_AGE), rather than from
 * the database: a session ended from outside the app is still read until then.
 * @returns The user, or undefined when nobody is signed in.
 */
export const getCurrentUser = () => readUser(false)

/**
 * The signed-in user, for pages and Route Handlers: read as getCurrentUser reads it, perhaps from
 * the session's cookie. Sends anyone not signed in to the login page.
 * @param returnTo - The page to come back to once signed in, such as an invite link.
 * @returns The user.
 */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  return signedIn(await readUser(false), returnTo)
}

/**
 * The signed-in user, asked of the database whatever the session's cookie holds, for every Server
 * Action: a session that has ended is refused at once. It writes no cookie, so the action's page is
 * not read again for it. Sends anyone not signed in to the login page.
 * @param returnTo - The page to come back to once signed in, such as an invite link.
 * @returns The user.
 */
export async function requireCheckedUser(
  returnTo?: string,
): Promise<SessionUser> {
  return signedIn(await readUser(true), returnTo)
}

/** The user, or a redirect to the login page (with `next` when there is a page to come back to). */
function signedIn(
  user: SessionUser | undefined,
  returnTo?: string,
): SessionUser {
  if (!user) {
    redirect(
      returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : '/login',
    )
  }
  return user
}
