import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

// A campaign's secret is chosen by its Gamemaster, who may reuse it across the campaigns in one
// world (the module sends one secret for all of them), so it is stored only as a slow, salted hash.

const KEY_LENGTH = 32
const COST = { N: 16_384, r: 8, p: 1 }

/** A new random secret, for a Gamemaster who has none yet. */
export function generateSecret(): string {
  return randomBytes(24).toString('base64url')
}

/** A new random code for a campaign's invite link. */
export function generateInviteCode(): string {
  return randomBytes(12).toString('base64url')
}

/** @returns The secret's hash, with what is needed to check it: `scrypt$N$r$p$salt$key`. */
export async function hashSecret(secret: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(secret, salt, COST)
  return [
    'scrypt',
    COST.N,
    COST.r,
    COST.p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$')
}

/**
 * Is this the secret a hash was made from? Compared in constant time, so response timing does not
 * reveal how much of a guess was right.
 */
export async function verifySecret(
  secret: string,
  hash: string,
): Promise<boolean> {
  const [scheme, N, r, p, salt, key] = hash.split('$')
  if (scheme !== 'scrypt' || !key) return false
  const expected = Buffer.from(key, 'base64url')
  if (expected.length !== KEY_LENGTH) return false
  const actual = await derive(secret, Buffer.from(salt, 'base64url'), {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  })
  return timingSafeEqual(actual, expected)
}

/** The secret a request carries as `Authorization: Bearer <secret>`. */
export function bearerSecret(header: string | null): string | undefined {
  const match = /^Bearer (.+)$/.exec(header ?? '')
  return match?.[1]
}

function derive(
  secret: string,
  salt: Buffer,
  cost: typeof COST,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(secret, salt, KEY_LENGTH, cost, (error, key) =>
      error ? reject(error) : resolve(key),
    )
  })
}
