import { redirect } from 'next/navigation'
import { getCurrentUser, requireCheckedUser, requireUser } from './session'
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
  // The cookie may answer for pages and the routes; a Server Action always asks the database and
  // writes no cookie, so its page isn't read again (ROADMAP item 62).
  it.each([
    ['getCurrentUser', getCurrentUser, undefined],
    ['requireUser', () => requireUser(), undefined],
    [
      'requireCheckedUser',
      () => requireCheckedUser(),
      { disableCookieCache: true, disableRefresh: true },
    ],
  ])(
    '%s reads the session from the request headers, with query %p',
    async (_name, read, query) => {
      getSession.mockResolvedValue({ session: {}, user })

      await expect(read()).resolves.toBe(user)
      const [options] = getSession.mock.calls[0]
      expect(options).toEqual({
        headers: expect.any(Headers),
        ...(query && { query }),
      })
      expect(options.headers.get('cookie')).toBe('session=abc')
    },
  )

  it('has no user when nobody is signed in', async () => {
    getSession.mockResolvedValue(null)

    await expect(getCurrentUser()).resolves.toBeUndefined()
  })

  describe.each([
    ['requireUser', requireUser],
    ['requireCheckedUser', requireCheckedUser],
  ])('%s', (_name, readUser) => {
    it('returns the signed-in user', async () => {
      getSession.mockResolvedValue({ session: {}, user })

      await expect(readUser()).resolves.toBe(user)
      expect(redirect).not.toHaveBeenCalled()
    })

    it('sends anyone not signed in to the login page', async () => {
      getSession.mockResolvedValue(null)

      await expect(readUser()).rejects.toThrow('NEXT_REDIRECT')
      expect(redirect).toHaveBeenCalledWith('/login')
    })

    it('can bring them back to the page they were on once signed in', async () => {
      getSession.mockResolvedValue(null)

      await expect(readUser('/join/abc?x=1')).rejects.toThrow('NEXT_REDIRECT')
      expect(redirect).toHaveBeenCalledWith('/login?next=%2Fjoin%2Fabc%3Fx%3D1')
    })
  })
})
