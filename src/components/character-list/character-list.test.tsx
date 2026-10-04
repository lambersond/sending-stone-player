/* eslint-disable unicorn/no-null -- a character with no campaign holds null */
import { render, screen } from '@testing-library/react'
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

  it('removes a character', async () => {
    const removal = Promise.withResolvers<void>()
    const onRemove = jest.fn(() => removal.promise)
    const user = userEvent.setup()
    render(<CharacterList characters={characters} onRemove={onRemove} />)

    const remove = screen.getByRole('button', { name: 'Remove Vex' })
    await user.click(remove)

    expect(onRemove).toHaveBeenCalledWith('char-2')
    expect(remove).toBeDisabled()
    removal.resolve()
    await screen.findByRole('button', { name: 'Remove Vex' })
  })
})
