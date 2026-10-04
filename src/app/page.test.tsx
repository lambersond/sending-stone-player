import { render, screen } from '@testing-library/react'
import HomePage from './page'
import { getCurrentUser } from '@/lib/session'

jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))

describe('app/page', () => {
  it('invites someone signed out to sign in', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getCurrentUser).mockResolvedValue(undefined)
    render(await HomePage())

    expect(
      screen.getByRole('link', { name: 'Sign in to get started' }),
    ).toHaveAttribute('href', '/login')
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('sends a signed-in user to their characters', async () => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)
    render(await HomePage())

    expect(
      screen.getByRole('link', { name: 'Choose your character' }),
    ).toHaveAttribute('href', '/characters')
  })
})
