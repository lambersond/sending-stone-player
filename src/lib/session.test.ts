import { redirect } from 'next/navigation'
import { getCurrentUser, requireUser } from './session'
import { auth } from '@/auth'

jest.mock('@/auth', () => ({ auth: { api: { getSession: jest.fn() } } }))
jest.mock('next/headers', () => ({
  headers: jest.fn(async () => new Headers({ cookie: 'session=abc' })),
}))
jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))

const getSession = auth.api.getSession as unknown as jest.Mock
const user = { id: 'user-1', name: 'Alice' }

describe('lib/session', () => {
  it('reads the session from the request headers', async () => {
    getSession.mockResolvedValue({ session: {}, user })

    await expect(getCurrentUser()).resolves.toBe(user)
    expect(getSession).toHaveBeenCalledWith({
      headers: expect.any(Headers),
    })
    expect(getSession.mock.calls[0][0].headers.get('cookie')).toBe(
      'session=abc',
    )
  })

  it('has no user when nobody is signed in', async () => {
    // eslint-disable-next-line unicorn/no-null -- what Better Auth returns
    getSession.mockResolvedValue(null)

    await expect(getCurrentUser()).resolves.toBeUndefined()
  })

  it('requireUser returns the signed-in user', async () => {
    getSession.mockResolvedValue({ session: {}, user })

    await expect(requireUser()).resolves.toBe(user)
    expect(redirect).not.toHaveBeenCalled()
  })

  it('requireUser sends anyone not signed in to the login page', async () => {
    // eslint-disable-next-line unicorn/no-null -- what Better Auth returns
    getSession.mockResolvedValue(null)

    await expect(requireUser()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })
})
