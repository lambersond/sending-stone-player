import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterForm } from './character-form'

describe('components/character-form', () => {
  it('submits the name and game address', async () => {
    const action = jest.fn().mockResolvedValue({})
    const user = userEvent.setup()
    render(<CharacterForm action={action} />)

    await user.type(screen.getByLabelText('Character name'), 'Thorin')
    await user.type(
      screen.getByLabelText('Forge game address'),
      'https://my-game.forge-vtt.com',
    )
    await user.click(screen.getByRole('button', { name: 'Add character' }))

    expect(action).toHaveBeenCalledTimes(1)
    const formData: FormData = action.mock.calls[0][1]
    expect(Object.fromEntries(formData)).toEqual({
      name: 'Thorin',
      gameUrl: 'https://my-game.forge-vtt.com',
    })
  })

  it('shows what was wrong and keeps what was entered', async () => {
    const action = jest.fn().mockResolvedValue({
      values: { name: 'Thorin', gameUrl: 'https://example.com' },
      errors: { gameUrl: ['Use a Forge address.'] },
    })
    const user = userEvent.setup()
    render(<CharacterForm action={action} />)

    await user.type(screen.getByLabelText('Character name'), 'Thorin')
    await user.type(
      screen.getByLabelText('Forge game address'),
      'https://example.com',
    )
    await user.click(screen.getByRole('button', { name: 'Add character' }))

    const gameUrl = await screen.findByLabelText('Forge game address')
    expect(gameUrl).toHaveAttribute('aria-invalid', 'true')
    expect(gameUrl).toHaveAccessibleDescription(
      'The address you open to join the game on The Forge. Use a Forge address.',
    )
    expect(gameUrl).toHaveValue('https://example.com')
    expect(screen.getByLabelText('Character name')).toHaveValue('Thorin')
    expect(screen.getByLabelText('Character name')).not.toHaveAttribute(
      'aria-invalid',
    )
  })

  it('shows a problem that is not about one field', async () => {
    const action = jest.fn().mockResolvedValue({
      message: 'Your character could not be saved. Try again.',
    })
    const user = userEvent.setup()
    render(<CharacterForm action={action} />)

    await user.type(screen.getByLabelText('Character name'), 'Thorin')
    await user.type(screen.getByLabelText('Forge game address'), 'x')
    await user.click(screen.getByRole('button', { name: 'Add character' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your character could not be saved. Try again.',
    )
  })
})
