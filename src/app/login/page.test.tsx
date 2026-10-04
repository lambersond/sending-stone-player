import { render, screen } from '@testing-library/react'
import { redirect } from 'next/navigation'
import LoginPage from './page'
import { enabledSocialProviders } from '@/auth-providers'
import { getCurrentUser } from '@/lib/session'

jest.mock('next/navigation', () => ({
  redirect: jest.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
}))
jest.mock('@/auth-providers', () => ({ enabledSocialProviders: jest.fn() }))
jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/components/sign-in-buttons', () => ({
  SignInButtons: ({ providers, callbackURL, errorCallbackURL }: any) => (
    <p>
      providers: {providers.join(', ')}; to {callbackURL}, or {errorCallbackURL}
    </p>
  ),
}))

const props = (searchParams: Record<string, string> = {}) => ({
  params: Promise.resolve({}),
  searchParams: Promise.resolve(searchParams),
})

describe('app/login/page', () => {
  beforeEach(() => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getCurrentUser).mockResolvedValue(undefined)
    jest.mocked(enabledSocialProviders).mockReturnValue(['google', 'discord'])
  })

  it('offers the enabled providers', async () => {
    render(await LoginPage(props()))

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(
      screen.getByText('providers: google, discord; to /characters, or /login'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('says when a sign-in failed', async () => {
    render(await LoginPage(props({ error: 'access_denied' })))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'That sign-in did not go through. Try again.',
    )
  })

  it('explains how to switch on a provider when none are', async () => {
    jest.mocked(enabledSocialProviders).mockReturnValue([])
    render(await LoginPage(props()))

    expect(
      screen.getByText(/No sign-in providers are set up yet/),
    ).toBeInTheDocument()
  })

  it('sends someone already signed in to their characters', async () => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)

    await expect(LoginPage(props())).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/characters')
  })

  it('returns a player to the invite link they followed', async () => {
    render(await LoginPage(props({ next: '/join/abc' })))

    expect(
      screen.getByText(
        'Sign in to join the campaign and choose your character.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'providers: google, discord; to /join/abc, or /login?next=%2Fjoin%2Fabc',
      ),
    ).toBeInTheDocument()

    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)
    await expect(LoginPage(props({ next: '/join/abc' }))).rejects.toThrow(
      'NEXT_REDIRECT',
    )
    expect(redirect).toHaveBeenCalledWith('/join/abc')
  })

  it('never sends anyone off the site after signing in', async () => {
    render(await LoginPage(props({ next: '//evil.example' })))

    expect(screen.getByText(/to \/characters, or \/login$/)).toBeInTheDocument()
  })
})
