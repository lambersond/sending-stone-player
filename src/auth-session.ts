// Better Auth's session options, read from the environment: kept apart from auth.ts so that they
// can be tested without Better Auth or the database.
import type { BetterAuthOptions } from 'better-auth'

/** A day, in seconds. */
const DAY = 86_400
/** For how long, in seconds, who is signed in is taken from the session's sealed cookie. */
const CACHE_MAX_AGE = 60
/** The longest AUTH_CACHE_MAX_AGE taken, in seconds: an hour. */
const CACHE_MOST = 3600
/** Whole seconds, in digits only. */
const WHOLE_SECONDS = /^\d+$/

/**
 * Better Auth's session options. A session lasts AUTH_MAX_AGE seconds, or 30 days, and is pushed
 * back once a day while it is in use. Who is signed in is taken from a sealed (JWE) cookie for
 * AUTH_CACHE_MAX_AGE seconds, 60 if unset, and asked of the database again after that; at 0 the
 * database is asked every time. So a session ended from outside the app, such as one deleted from
 * the database, keeps working for up to that long; signing out ends it at once.
 */
export const sessionOptions = () => {
  const maxAge = cacheMaxAge(process.env.AUTH_CACHE_MAX_AGE)
  return {
    expiresIn: Number(process.env.AUTH_MAX_AGE) || 30 * DAY,
    updateAge: DAY,
    // Off at 0: Better Auth reads a maxAge of 0 as its own 5 minutes.
    cookieCache:
      maxAge > 0
        ? { enabled: true, maxAge, strategy: 'jwe' }
        : { enabled: false },
  } satisfies NonNullable<BetterAuthOptions['session']>
}

/** AUTH_CACHE_MAX_AGE in whole seconds, 0 to CACHE_MOST; unset or anything else, CACHE_MAX_AGE. */
function cacheMaxAge(value?: string): number {
  if (!value || !WHOLE_SECONDS.test(value)) return CACHE_MAX_AGE
  const seconds = Number(value)
  return seconds <= CACHE_MOST ? seconds : CACHE_MAX_AGE
}
