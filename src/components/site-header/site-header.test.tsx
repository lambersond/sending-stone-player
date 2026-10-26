import { render, screen } from '@testing-library/react'
import { HeaderAccount } from './header-account'
import { SiteHeader } from './site-header'
import { getCurrentUser } from '@/lib/session'

jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))
let pathname = '/'
jest.mock('next/navigation', () => ({ usePathname: () => pathname }))
jest.mock('@/components/sign-out-button', () => ({
  SignOutButton: () => <button type='button'>Sign out</button>,
}))

/** Alice, signed in. */
const signedIn = () =>
  jest
    .mocked(getCurrentUser)
    .mockResolvedValue({ id: 'user-1', name: 'Alice' } as any)

describe('components/site-header', () => {
  beforeEach(() => {
    pathname = '/'
  })

  it('links home', () => {
    jest.mocked(getCurrentUser).mockReturnValue(new Promise(() => {}))
    render(<SiteHeader />)

    expect(screen.getByRole('link', { name: 'Sending Stone' })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('offers sign-in to someone signed out', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getCurrentUser).mockResolvedValue(undefined)
    render(await HeaderAccount())

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it('links a signed-in user to their characters', async () => {
    jest
      .mocked(getCurrentUser)
      .mockResolvedValue({ id: 'user-1', name: 'Alice' } as any)
    render(await HeaderAccount())

    expect(screen.getByRole('link', { name: /Alice/ })).toHaveAttribute(
      'href',
      '/characters',
    )
    expect(screen.getByRole('link', { name: 'Campaigns' })).toHaveAttribute(
      'href',
      '/campaigns',
    )
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  describe('round 0.39.0', () => {
    it('marks Campaigns as the page shown on the campaigns page, tinted', async () => {
      pathname = '/campaigns'
      signedIn()
      render(await HeaderAccount())

      const campaigns = screen.getByRole('link', { name: 'Campaigns' })
      expect(campaigns).toHaveAttribute('aria-current', 'page')
      expect(campaigns).toHaveClass('bg-primary/10', 'text-text-primary')
      expect(campaigns).not.toHaveClass('text-text-secondary')
      expect(screen.getByRole('link', { name: /Alice/ })).not.toHaveAttribute(
        'aria-current',
      )
    })

    it.each(['/', '/characters', '/join/abc'])(
      'marks nothing on %s',
      async path => {
        pathname = path
        signedIn()
        render(await HeaderAccount())

        const campaigns = screen.getByRole('link', { name: 'Campaigns' })
        expect(campaigns).not.toHaveAttribute('aria-current')
        expect(campaigns).toHaveClass('text-text-secondary')
        expect(campaigns).not.toHaveClass('bg-primary/10')
      },
    )

    it('is as wide as the campaigns page, so their edges meet', () => {
      jest.mocked(getCurrentUser).mockReturnValue(new Promise(() => {}))
      render(<SiteHeader />)

      const box = screen.getByRole('link', { name: 'Sending Stone' })
        .parentElement as HTMLElement
      expect(box).toHaveClass('mx-auto', 'max-w-[70rem]', 'px-4')
      expect(box).not.toHaveClass('max-w-3xl')
    })
  })
})
