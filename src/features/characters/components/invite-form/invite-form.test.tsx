import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InviteForm } from './invite-form'

describe('components/invite-form', () => {
  it('submits the pasted link', async () => {
    const action = jest.fn().mockResolvedValue({})
    const user = userEvent.setup()
    render(<InviteForm action={action} />)

    await user.type(
      screen.getByLabelText('Invite link'),
      'https://stone.example/join/abc',
    )
    await user.click(screen.getByRole('button', { name: 'Join campaign' }))

    const formData: FormData = action.mock.calls[0][1]
    expect(formData.get('invite')).toBe('https://stone.example/join/abc')
  })

  it('says what was wrong and keeps what was pasted', async () => {
    const action = jest.fn().mockResolvedValue({
      value: 'nope',
      error: 'Paste the invite link your Gamemaster shared.',
    })
    const user = userEvent.setup()
    render(<InviteForm action={action} />)

    await user.type(screen.getByLabelText('Invite link'), 'nope')
    await user.click(screen.getByRole('button', { name: 'Join campaign' }))

    const input = await screen.findByLabelText('Invite link')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(
      expect.stringContaining('Paste the invite link your Gamemaster shared.'),
    )
    expect(input).toHaveValue('nope')
  })
})
