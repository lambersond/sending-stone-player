import { createHash, randomBytes } from 'node:crypto'
import { COOKBOOK_CODE } from '@/constants/cookbook'

// A player's link code for the Magical Recipe Book (module 0.38.0) names their seat alone. It's 32
// random bytes, unlike a campaign's secret, which its Gamemaster chooses and may reuse, so a fast
// hash keeps it safe, and a unique index finds it well inside the cookbook's 10 seconds.

/** A new link code for one seat: shown to its player once, never kept. */
export function generateCookbookCode(): string {
  return `sscb_${randomBytes(32).toString('base64url')}`
}

/** What is kept of a code, and looked up by: its SHA-256, as hex. */
export function hashCookbookCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

/** Is this shaped like a code this app makes? Checked before any database read. */
export function isCookbookCode(code: string | undefined): code is string {
  return !!code && COOKBOOK_CODE.test(code)
}
