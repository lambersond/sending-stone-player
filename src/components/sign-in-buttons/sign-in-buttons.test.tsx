import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignInButtons } from './sign-in-buttons'
import { authClient } from '@/clients/auth-client'

jest.mock('@/clients/auth-client', () => ({
  authClient: { signIn: { social: jest.fn() } },
}))

const social = authClient.signIn.social as unknown as jest.Mock

describe('components/sign-in-buttons', () => {
  it('offers only the providers given', () => {
    render(<SignInButtons providers={['discord']} callbackURL='/characters' />)

    expect(
      screen.getByRole('button', { name: 'Continue with Discord' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Continue with Google' }),
    ).not.toBeInTheDocument()
  })

  it('signs in with the chosen provider and waits for the redirect', async () => {
    social.mockResolvedValue({ data: { redirect: true } })
    const user = userEvent.setup()
    render(
      <SignInButtons
        providers={['google', 'discord']}
        callbackURL='/characters'
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Continue with Google' }),
    )

    expect(social).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/characters',
      errorCallbackURL: '/login',
    })
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled()
    }
  })

  it('says when the provider could not be reached', async () => {
    social.mockResolvedValue({ error: { message: 'nope' } })
    const user = userEvent.setup()
    render(<SignInButtons providers={['discord']} callbackURL='/characters' />)

    await user.click(
      screen.getByRole('button', { name: 'Continue with Discord' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not reach Discord. Try again.',
    )
    expect(
      screen.getByRole('button', { name: 'Continue with Discord' }),
    ).toBeEnabled()
  })
})
