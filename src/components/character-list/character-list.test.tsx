import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterList } from './character-list'

const characters = [
  { id: 'char-1', name: 'Thorin', gameUrl: 'https://my-game.forge-vtt.com' },
  { id: 'char-2', name: 'Vex', gameUrl: 'https://other.forge-vtt.com' },
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
    expect(screen.getByText('my-game.forge-vtt.com')).toBeInTheDocument()
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
