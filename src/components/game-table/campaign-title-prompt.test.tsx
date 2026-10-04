import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CampaignTitlePrompt } from './campaign-title-prompt'

const character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: '',
}

describe('components/game-table/campaign-title-prompt', () => {
  it("asks for the character's campaign and submits its title", async () => {
    const action = jest.fn().mockResolvedValue({})
    const user = userEvent.setup()
    render(<CampaignTitlePrompt character={character} action={action} />)

    expect(
      screen.getByRole('heading', { name: 'Which campaign is Thorin in?' }),
    ).toBeInTheDocument()
    await user.type(
      screen.getByLabelText('Campaign title'),
      'The Lonely Mountain',
    )
    await user.click(screen.getByRole('button', { name: 'Save campaign' }))

    expect(action).toHaveBeenCalledTimes(1)
    const formData: FormData = action.mock.calls[0][1]
    expect(formData.get('campaignTitle')).toBe('The Lonely Mountain')
  })

  it('shows what was wrong and keeps what was entered', async () => {
    const action = jest.fn().mockResolvedValue({
      value: 'a'.repeat(10),
      error: 'Keep the title to 100 characters or fewer.',
    })
    const user = userEvent.setup()
    render(<CampaignTitlePrompt character={character} action={action} />)

    await user.type(screen.getByLabelText('Campaign title'), 'a'.repeat(10))
    await user.click(screen.getByRole('button', { name: 'Save campaign' }))

    const title = await screen.findByLabelText('Campaign title')
    expect(title).toHaveAttribute('aria-invalid', 'true')
    expect(title).toHaveAccessibleDescription(
      'Keep the title to 100 characters or fewer.',
    )
    expect(title).toHaveValue('a'.repeat(10))
  })
})
