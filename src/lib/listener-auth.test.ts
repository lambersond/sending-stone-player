/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { hasSecret } from './listener-auth'

describe('lib/listener-auth', () => {
  it('accepts the secret as a bearer token', () => {
    expect(hasSecret('Bearer hunter2', 'hunter2')).toBe(true)
  })

  it.each([
    ['a wrong secret', 'Bearer hunter3', 'hunter2'],
    ['the secret without Bearer', 'hunter2', 'hunter2'],
    ['no header', null, 'hunter2'],
    ['an empty configured secret', 'Bearer ', ''],
  ])('refuses %s', (_, header, secret) => {
    expect(hasSecret(header, secret)).toBe(false)
  })
})
