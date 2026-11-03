/* eslint-disable unicorn/no-null -- a character with no campaign holds null */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterList } from './character-list'

const characters = [
  {
    id: 'char-1',
    name: 'Thorin',
    gameUrl: 'https://my-game.forge-vtt.com',
    campaignTitle: 'The Lonely Mountain',
    campaignId: 'c1',
    actorId: 'actor-thorin',
  },
  {
    id: 'char-2',
    name: 'Vex',
    gameUrl: 'https://other.forge-vtt.com',
    campaignTitle: '',
    campaignId: null,
    actorId: null,
  },
]

describe('components/character-list', () => {
  it('links each character to its page', () => {
    render(<CharacterList characters={characters} onRemove={jest.fn()} />)

    expect(screen.getByRole('link', { name: /Thorin/ })).toHaveAttribute(
      'href',
      '/characters/char-1',
    )
    expect(screen.getByRole('link', { name: /Vex/ })).toHaveAttribute(
      'href',
      '/characters/char-2',
    )
    expect(
      screen.getByText('The Lonely Mountain · my-game.forge-vtt.com'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('No campaign · other.forge-vtt.com'),
    ).toBeInTheDocument()
  })

  it('deletes a character, after asking', async () => {
    const removal = Promise.withResolvers<void>()
    const onRemove = jest.fn(() => removal.promise)
    const user = userEvent.setup()
    render(<CharacterList characters={characters} onRemove={onRemove} />)

    await user.click(screen.getByRole('button', { name: 'Delete Vex' }))
    const dialog = screen.getByRole('dialog', { name: 'Delete Vex?' })
    expect(dialog).toHaveTextContent('You stop following your campaign as Vex')
    expect(onRemove).not.toHaveBeenCalled()

    const confirm = within(dialog).getByRole('button', { name: 'Delete' })
    await user.click(confirm)
    expect(onRemove).toHaveBeenCalledWith('char-2')
    expect(confirm).toBeDisabled()

    removal.resolve()
    await waitFor(() => expect(dialog).not.toHaveAttribute('open'))
  })
})
