import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampaignSetupForm } from './campaign-setup-form'

describe('components/campaigns/campaign-setup-form', () => {
  it('submits the title, game and secret, then shows the secret to copy', async () => {
    const onDone = jest.fn()
    const action = jest.fn().mockResolvedValue({
      saved: { title: 'The Lonely Mountain', secret: 'suggested-secret-1' },
    })
    const user = userEvent.setup()
    render(
      <CampaignSetupForm
        action={action}
        suggestedSecret='suggested-secret-1'
        onDone={onDone}
      />,
    )

    await user.type(
      screen.getByLabelText('Campaign title'),
      'The Lonely Mountain',
    )
    await user.type(
      screen.getByLabelText('Forge game address'),
      'my-game.forge-vtt.com',
    )
    expect(screen.getByLabelText('Secret')).toHaveValue('suggested-secret-1')
    await user.click(screen.getByRole('button', { name: 'Set up campaign' }))

    const formData: FormData = action.mock.calls[0][1]
    expect(Object.fromEntries(formData)).toEqual({
      title: 'The Lonely Mountain',
      gameUrl: 'my-game.forge-vtt.com',
      secret: 'suggested-secret-1',
    })
    expect(await screen.findByRole('status')).toHaveTextContent(
      "The Lonely Mountain is set up. Copy its secret now: Sending Stone keeps only a check of it, so it can't be shown again.",
    )
    expect(screen.getByText('suggested-secret-1')).toBeInTheDocument()
    expect(screen.queryByLabelText('Campaign title')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalled()
  })

  it('generates another secret', async () => {
    const user = userEvent.setup()
    render(
      <CampaignSetupForm
        action={jest.fn()}
        suggestedSecret='first-secret-1'
        onDone={jest.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Generate' }))

    const secret = screen.getByLabelText('Secret') as HTMLInputElement
    expect(secret.value).toMatch(/^[\w-]{32}$/)
    expect(secret.value).not.toBe('first-secret-1')
  })

  it('shows what was wrong and keeps what was entered', async () => {
    const action = jest.fn().mockResolvedValue({
      values: {
        title: 'The Lonely Mountain',
        gameUrl: 'https://example.com',
        secret: 'short',
      },
      errors: { secret: ['Use a secret of at least 12 characters.'] },
      message: 'Something else went wrong.',
    })
    const user = userEvent.setup()
    render(
      <CampaignSetupForm
        action={action}
        suggestedSecret='x'
        onDone={jest.fn()}
      />,
    )

    await user.type(screen.getByLabelText('Campaign title'), 'T')
    await user.type(screen.getByLabelText('Forge game address'), 'x')
    await user.click(screen.getByRole('button', { name: 'Set up campaign' }))

    const secret = await screen.findByLabelText('Secret')
    expect(secret).toHaveAttribute('aria-invalid', 'true')
    expect(secret).toHaveAccessibleDescription(
      expect.stringContaining('Use a secret of at least 12 characters.'),
    )
    expect(secret).toHaveValue('short')
    expect(screen.getByLabelText('Forge game address')).toHaveValue(
      'https://example.com',
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Something else went wrong.',
    )
  })
})
