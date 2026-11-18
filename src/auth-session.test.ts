import { sessionOptions } from './auth-session'

/** Better Auth's cookie cache, sealed (JWE), for so many seconds. */
const sealed = (maxAge: number) => ({ enabled: true, maxAge, strategy: 'jwe' })

describe('auth-session', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.AUTH_CACHE_MAX_AGE
    delete process.env.AUTH_MAX_AGE
  })

  afterAll(() => {
    process.env = env
  })

  it('takes who is signed in from a sealed cookie for a minute, unset', () => {
    expect(sessionOptions().cookieCache).toEqual(sealed(60))
  })

  it.each([
    ['300', 300],
    ['1', 1],
    ['3600', 3600],
    ['007', 7],
  ])('takes AUTH_CACHE_MAX_AGE %p as %p seconds', (value, seconds) => {
    process.env.AUTH_CACHE_MAX_AGE = value

    expect(sessionOptions().cookieCache).toEqual(sealed(seconds))
  })

  it("asks the database every time at 0, not after Better Auth's own 5 minutes", () => {
    process.env.AUTH_CACHE_MAX_AGE = '0'

    expect(sessionOptions().cookieCache).toEqual({ enabled: false })
  })

  it.each(['', 'abc', '-5', '1.5', '1e2', ' 30 ', '0x10', '3601'])(
    'takes %p, which is no whole number of seconds up to an hour, as a minute',
    value => {
      process.env.AUTH_CACHE_MAX_AGE = value

      expect(sessionOptions().cookieCache).toEqual(sealed(60))
    },
  )

  it('lasts 30 days unless AUTH_MAX_AGE says otherwise, pushed back once a day', () => {
    expect(sessionOptions()).toEqual({
      expiresIn: 30 * 86_400,
      updateAge: 86_400,
      cookieCache: sealed(60),
    })

    process.env.AUTH_MAX_AGE = '604800'

    expect(sessionOptions()).toEqual({
      expiresIn: 604_800,
      updateAge: 86_400,
      cookieCache: sealed(60),
    })
  })
})
