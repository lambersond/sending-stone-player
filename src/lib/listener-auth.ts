import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Does a request's Authorization header carry the shared secret the Gamemaster's module sends?
 * Compared in constant time, so response timing does not reveal how much of a guess was right.
 * @param header - The request's Authorization header.
 * @param secret - The configured secret.
 */
export function hasSecret(header: string | null, secret: string): boolean {
  if (!header || !secret) return false
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`))
}

const digest = (value: string) => createHash('sha256').update(value).digest()
