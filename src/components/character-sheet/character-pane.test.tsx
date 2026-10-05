import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterPane } from './character-pane'
import { characterSheet } from '@/mocks/sending-stone'
import { toTableSheet } from '@/utils/table-view'

// Without WebGL the renderer is never ready, so rolls resolve at once, without dice.
jest.mock('@lambersond/3d-dice-react', () => ({
  DiceRendererProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useDiceRenderer: () => ({ isReady: false, roll: jest.fn() }),
}))

describe('components/character-sheet/character-pane', () => {
  it('rolls from the sheet into the tray', async () => {
    const user = userEvent.setup()
    render(
      <CharacterPane
        name='Thorin Oakenshield'
        sheet={toTableSheet(characterSheet(), 'https://my-game.forge-vtt.com')}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Strength saving throw, +7, proficient',
      }),
    )

    const status = await screen.findByText('Strength saving throw')
    const total = Number(status.parentElement?.previousSibling?.textContent)
    expect(total).toBeGreaterThanOrEqual(8)
    expect(total).toBeLessThanOrEqual(27)
    expect(screen.getByRole('status')).toHaveTextContent('+7')
  })
})
