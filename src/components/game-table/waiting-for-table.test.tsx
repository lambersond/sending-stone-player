import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WaitingForTable } from './waiting-for-table'

const character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
}
const url = 'https://stone.example/api/sending-stone'

describe('components/game-table/waiting-for-table', () => {
  it('tells the Gamemaster how to connect the game', () => {
    render(<WaitingForTable character={character} listenerUrl={url} />)

    expect(
      screen.getByText(/Nothing has arrived from my-game.forge-vtt.com yet/),
    ).toBeInTheDocument()
    expect(screen.getByText(url)).toBeInTheDocument()
    expect(screen.getByText(/connect Thorin/)).toBeInTheDocument()
  })

  it('copies the listener URL', async () => {
    const user = userEvent.setup()
    const writeText = jest
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue()
    render(<WaitingForTable character={character} listenerUrl={url} />)

    await user.click(screen.getByRole('button', { name: 'Copy listener URL' }))

    expect(writeText).toHaveBeenCalledWith(url)
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('leaves the URL to copy by hand when the clipboard refuses', async () => {
    const user = userEvent.setup()
    jest
      .spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValue(new Error('denied'))
    render(<WaitingForTable character={character} listenerUrl={url} />)

    await user.click(screen.getByRole('button', { name: 'Copy listener URL' }))

    expect(
      screen.getByRole('button', { name: 'Copy listener URL' }),
    ).toBeInTheDocument()
  })
})
