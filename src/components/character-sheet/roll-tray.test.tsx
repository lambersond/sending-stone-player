import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RollTray } from './roll-tray'
import type { LocalRoll } from '@/hooks/use-sheet-roller'

const roll = (fields: Partial<LocalRoll> = {}): LocalRoll => ({
  id: 'r1',
  label: 'Perception check',
  total: 16,
  modifier: 4,
  d20s: [12],
  natural: 12,
  at: 0,
  ...fields,
})

describe('components/character-sheet/roll-tray', () => {
  it('invites a roll, and says rolls stay with the player for now', () => {
    render(<RollTray rolls={[]} rolling={false} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Tap an ability or skill to roll it.',
    )
    expect(
      screen.getByText(/They aren't sent to your Gamemaster's game/),
    ).toBeInTheDocument()
  })

  it('says when the dice are rolling', () => {
    render(<RollTray rolls={[roll()]} rolling />)

    expect(screen.getByRole('status')).toHaveTextContent('Rolling…')
  })

  it('shows the latest roll: its total, the die and the modifier', () => {
    render(<RollTray rolls={[roll()]} rolling={false} />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('16Perception check')
    expect(status).toHaveTextContent('d20 12 +4')
    expect(screen.queryByText(/Earlier rolls/)).toBeNull()
  })

  it.each([
    ['adv' as const, [7, 15], 15, 'Advantage', '7'],
    ['dis' as const, [7, 15], 7, 'Disadvantage', '15'],
  ])(
    'shows a roll with %s, striking out the die that did not count',
    (advantage, d20s, natural, word, dropped) => {
      render(
        <RollTray
          rolls={[roll({ advantage, d20s, natural, total: natural + 4 })]}
          rolling={false}
        />,
      )

      const status = screen.getByRole('status')
      expect(status).toHaveTextContent(word)
      expect(within(status).getByText(dropped).tagName).toBe('S')
    },
  )

  it.each([
    [20, 'Natural 20', 'bg-gold'],
    [1, 'Natural 1', 'bg-ruby'],
  ])('marks a natural %d', (natural, words, color) => {
    render(
      <RollTray
        rolls={[roll({ d20s: [natural], natural, total: natural + 4 })]}
        rolling={false}
      />,
    )

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(words)
    expect(within(status).getByText(String(natural + 4))).toHaveClass(color)
  })

  it('keeps earlier rolls a tap away', async () => {
    const user = userEvent.setup()
    render(
      <RollTray
        rolls={[
          roll({ id: 'r3', label: 'Strength saving throw', total: 9 }),
          roll({
            id: 'r2',
            label: 'Stealth check',
            total: 3,
            modifier: -1,
            natural: 4,
          }),
          roll({ id: 'r1' }),
        ]}
        rolling={false}
      />,
    )

    await user.click(screen.getByText('Earlier rolls (2)'))

    const earlier = screen.getAllByRole('listitem')
    expect(earlier.map(item => item.textContent)).toEqual([
      'Stealth check4 −1 = 3',
      'Perception check12 +4 = 16',
    ])
  })
})
