import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignOutButton } from './sign-out-button'
import { authClient } from '@/clients/auth-client'

const router = { push: jest.fn(), refresh: jest.fn() }

jest.mock('next/navigation', () => ({ useRouter: () => router }))
jest.mock('@/clients/auth-client', () => ({
  authClient: { signOut: jest.fn() },
}))

describe('components/sign-out-button', () => {
  it('signs out and returns home', async () => {
    jest.mocked(authClient.signOut).mockResolvedValue({} as any)
    const user = userEvent.setup()
    render(<SignOutButton />)

    await user.click(screen.getByRole('button', { name: 'Sign out' }))

    expect(authClient.signOut).toHaveBeenCalled()
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/'))
    expect(router.refresh).toHaveBeenCalled()
  })
})
