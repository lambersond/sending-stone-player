/**
 * @jest-environment node
 */
import {
  bearerSecret,
  generateInviteCode,
  generateSecret,
  hashSecret,
  verifySecret,
} from './campaign-secret'

describe('lib/campaign-secret', () => {
  it('generates long random secrets and invite codes, safe in a URL', () => {
    const secrets = new Set([generateSecret(), generateSecret()])
    expect(secrets.size).toBe(2)
    for (const secret of secrets) expect(secret).toMatch(/^[\w-]{32}$/)
    expect(generateInviteCode()).toMatch(/^[\w-]{16}$/)
  })

  it('checks a secret against its salted hash', async () => {
    const hash = await hashSecret('hunter2-hunter2')

    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$[\w-]+\$[\w-]+$/)
    expect(hash).not.toContain('hunter2')
    await expect(verifySecret('hunter2-hunter2', hash)).resolves.toBe(true)
    await expect(verifySecret('hunter2-hunter3', hash)).resolves.toBe(false)
  })

  it('salts each hash differently', async () => {
    const [first, second] = await Promise.all([
      hashSecret('same secret'),
      hashSecret('same secret'),
    ])
    expect(first).not.toBe(second)
  })

  it('refuses a hash it cannot read', async () => {
    await expect(verifySecret('x', 'sha1$abc')).resolves.toBe(false)
    await expect(verifySecret('x', '')).resolves.toBe(false)
    await expect(
      verifySecret('x', 'scrypt$16384$8$1$c2FsdA$c2hvcnQ'),
    ).resolves.toBe(false)
  })

  it('reads the secret a request carries', () => {
    expect(bearerSecret('Bearer hunter2')).toBe('hunter2')
    expect(bearerSecret('Basic aHVudGVyMg==')).toBeUndefined()
    expect(bearerSecret('Bearer ')).toBeUndefined()
    // eslint-disable-next-line unicorn/no-null -- what Headers.get returns
    expect(bearerSecret(null)).toBeUndefined()
  })
})
