import { render, screen } from '@testing-library/react'
import { HeaderAccount } from './header-account'
import { SiteHeader } from './site-header'
import { getCurrentUser } from '@/lib/session'

jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/components/sign-out-button', () => ({
  SignOutButton: () => <button type='button'>Sign out</button>,
}))

describe('components/site-header', () => {
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
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })
})
