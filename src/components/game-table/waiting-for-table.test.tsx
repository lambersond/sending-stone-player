import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WaitingForTable } from './waiting-for-table'

const character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
}
const url = 'https://stone.example'

describe('components/game-table/waiting-for-table', () => {
  it('tells the Gamemaster how to set up the campaign', () => {
    render(<WaitingForTable character={character} destination={url} />)

    expect(
      screen.getByText(
        /Nothing has arrived for The Lonely Mountain from my-game.forge-vtt.com yet/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(url)).toBeInTheDocument()
    expect(
      screen.getByText(
        /add a campaign titled “The Lonely Mountain” with Thorin/,
      ),
    ).toBeInTheDocument()
  })

  it('copies the destination', async () => {
    const user = userEvent.setup()
    const writeText = jest
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue()
    render(<WaitingForTable character={character} destination={url} />)

    await user.click(screen.getByRole('button', { name: 'Copy destination' }))

    expect(writeText).toHaveBeenCalledWith(url)
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('leaves the destination to copy by hand when the clipboard refuses', async () => {
    const user = userEvent.setup()
    jest
      .spyOn(navigator.clipboard, 'writeText')
      .mockRejectedValue(new Error('denied'))
    render(<WaitingForTable character={character} destination={url} />)

    await user.click(screen.getByRole('button', { name: 'Copy destination' }))

    expect(
      screen.getByRole('button', { name: 'Copy destination' }),
    ).toBeInTheDocument()
  })
})
