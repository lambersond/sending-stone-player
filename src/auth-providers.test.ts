import { enabledSocialProviders } from './auth-providers'

describe('auth-providers', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
  })

  afterAll(() => {
    process.env = env
  })

  it('lists the providers switched on, ignoring case', () => {
    process.env.AUTH_GOOGLE_ENABLED = 'TRUE'
    process.env.AUTH_DISCORD_ENABLED = 'true'

    expect(enabledSocialProviders()).toEqual(['google', 'discord'])
  })

  it('leaves out providers that are off or unset', () => {
    process.env.AUTH_GOOGLE_ENABLED = 'false'
    delete process.env.AUTH_DISCORD_ENABLED

    expect(enabledSocialProviders()).toEqual([])
  })
})
