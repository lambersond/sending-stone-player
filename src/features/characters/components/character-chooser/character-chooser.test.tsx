import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterChooser } from './character-chooser'
import type { CampaignChoice } from '@/types/campaign'

const choice = (characters: CampaignChoice['characters']): CampaignChoice => ({
  id: 'c1',
  title: 'The Lonely Mountain',
  gameUrl: 'https://my-game.forge-vtt.com',
  characters,
})

describe('components/character-chooser', () => {
  it('submits the character chosen, offering only those not taken', async () => {
    const action = jest.fn().mockResolvedValue({})
    const user = userEvent.setup()
    render(
      <CharacterChooser
        choice={choice([
          { id: 'actor-thorin', name: 'Thorin', claimedBy: 'you' },
          { id: 'actor-vex', name: 'Vex', claimedBy: 'someone' },
          { id: 'actor-bard', name: 'Bard' },
        ])}
        action={action}
        submitLabel='Join as this character'
      />,
    )

    // Screen readers hear why a character can't be chosen.
    expect(
      screen.getByRole('radio', { name: 'Thorin Already yours' }),
    ).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Vex Taken' })).toBeDisabled()

    await user.click(screen.getByRole('radio', { name: 'Bard' }))
    await user.click(
      screen.getByRole('button', { name: 'Join as this character' }),
    )

    expect(action).toHaveBeenCalledTimes(1)
    const formData: FormData = action.mock.calls[0][1]
    expect(formData.get('actorId')).toBe('actor-bard')
  })

  it('shows why a choice was refused', async () => {
    const action = jest.fn().mockResolvedValue({
      message: 'Another player has just chosen that character.',
    })
    const user = userEvent.setup()
    render(
      <CharacterChooser
        choice={choice([{ id: 'actor-bard', name: 'Bard' }])}
        action={action}
      />,
    )

    await user.click(screen.getByRole('radio', { name: 'Bard' }))
    await user.click(screen.getByRole('button', { name: 'Choose character' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Another player has just chosen that character.',
    )
  })

  it('says when every character is taken', () => {
    render(
      <CharacterChooser
        choice={choice([
          { id: 'actor-vex', name: 'Vex', claimedBy: 'someone' },
        ])}
        action={jest.fn()}
      />,
    )

    expect(screen.queryByRole('button')).toBeNull()
    expect(
      screen.getByText(/Every character has been chosen/),
    ).toBeInTheDocument()
  })

  it("says when the campaign hasn't sent its characters yet", () => {
    render(<CharacterChooser choice={choice([])} action={jest.fn()} />)

    expect(
      screen.getByText(/The Lonely Mountain hasn't sent its characters yet/),
    ).toBeInTheDocument()
  })
})
