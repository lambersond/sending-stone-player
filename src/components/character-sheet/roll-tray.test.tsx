import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RollTray, type TableRolls } from './roll-tray'
import type { LocalCheck, LocalDamage } from '@/hooks/use-sheet-roller'
import type { TableRollState } from '@/hooks/use-table-rolls'

const roll = (fields: Partial<LocalCheck> = {}): LocalCheck => ({
  kind: 'check',
  id: 'r1',
  label: 'Perception check',
  total: 16,
  modifier: 4,
  d20s: [12],
  natural: 12,
  extras: [],
  at: 0,
  ...fields,
})

const damage = (fields: Partial<LocalDamage> = {}): LocalDamage => ({
  kind: 'damage',
  id: 'd1',
  label: 'Flame Tongue damage',
  total: 16,
  critical: false,
  healing: false,
  parts: [
    {
      type: 'Slashing',
      total: 9,
      terms: [
        { text: '1d8', values: [5], value: 5 },
        { text: '+4', values: [], value: 4 },
      ],
    },
    {
      type: 'Fire',
      total: 7,
      terms: [{ text: '+2d6', values: [3, 4], value: 7 }],
    },
  ],
  at: 0,
  ...fields,
})

describe('components/character-sheet/roll-tray', () => {
  it('invites a roll, and says rolls stay with the player for now', () => {
    render(<RollTray rolls={[]} rolling={false} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Tap an ability, skill or attack to roll it.',
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

  it('shows what the player added, each term with its dice', () => {
    render(
      <RollTray
        rolls={[
          roll({
            total: 18,
            extras: [
              { text: '+1d4', values: [3], value: 3 },
              { text: '−1d6', values: [2], value: -2 },
              { text: '+1', values: [], value: 1 },
            ],
          }),
        ]}
        rolling={false}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'd20 12 +4 +1d4 (3) −1d6 (2) +1',
    )
  })

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

  it('shows damage: its total, and each part with its dice and kind', () => {
    render(
      <RollTray
        rolls={[
          damage({
            parts: [
              {
                type: 'Slashing',
                total: 9,
                terms: [
                  { text: '2d8', values: [3, 2], value: 5 },
                  { text: '+4', values: [], value: 4 },
                ],
              },
              {
                type: 'Fire',
                total: 7,
                terms: [{ text: '+2d6', values: [3, 4], value: 7 }],
              },
            ],
            critical: true,
          }),
        ]}
        rolling={false}
      />,
    )

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('16Flame Tongue damage')
    expect(status).toHaveTextContent(
      '2d8 (3, 2) +4 Slashing +2d6 (3, 4) Fire · Critical hit',
    )
    expect(within(status).getByText('16')).toHaveClass('text-damage')
  })

  it('shows healing in the accent', () => {
    render(
      <RollTray
        rolls={[
          damage({
            label: 'Cure Wounds healing',
            total: 8,
            healing: true,
            parts: [
              {
                type: 'Healing',
                total: 8,
                terms: [{ text: '2d8', values: [5, 3], value: 8 }],
              },
            ],
          }),
        ]}
        rolling={false}
      />,
    )

    expect(within(screen.getByRole('status')).getByText('8')).toHaveClass(
      'text-primary',
    )
  })

  it('keeps earlier rolls a tap away', async () => {
    const user = userEvent.setup()
    render(
      <RollTray
        rolls={[
          roll({
            id: 'r4',
            label: 'Athletics check',
            total: 20,
            extras: [{ text: '+1d4', values: [4], value: 4 }],
          }),
          roll({ id: 'r3', label: 'Strength saving throw', total: 9 }),
          damage({ id: 'r3b' }),
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

    await user.click(screen.getByText('Earlier rolls (4)'))

    const earlier = screen.getAllByRole('listitem')
    expect(earlier.map(item => item.textContent)).toEqual([
      'Strength saving throw12 +4 = 9',
      'Flame Tongue damage9 Slashing + 7 Fire = 16',
      'Stealth check4 −1 = 3',
      'Perception check12 +4 = 16',
    ])
    expect(screen.getByRole('status')).toHaveTextContent('+1d4 (4)')
  })

  describe('at the table', () => {
    const table = (
      states: [string, TableRollState][] = [],
      fields: Partial<TableRolls> = {},
    ): TableRolls => ({
      states: new Map(states),
      available: true,
      sending: true,
      setSending: jest.fn(),
      ...fields,
    })

    it.each<[string, TableRollState, string]>([
      [
        'on its way',
        { status: 'sending' },
        'Sending to your Gamemaster’s game…',
      ],
      [
        'being made',
        { status: 'rolling' },
        'Rolling in your Gamemaster’s game…',
      ],
      [
        "made, with the game's total",
        { status: 'done', visible: true, total: 23 },
        'At the table: 23',
      ],
      [
        'made blind',
        { status: 'done', visible: false },
        'Rolled at the table, hidden by your Gamemaster',
      ],
      [
        'refused',
        { status: 'refused', reason: 'not-dying' },
        'Not made at the table: you aren’t dying',
      ],
      [
        'failed in the game',
        { status: 'failed', reason: 'already-rolled' },
        'Not made at the table: you have rolled initiative already',
      ],
      [
        'not fetched',
        { status: 'expired' },
        'Not made at the table: your Gamemaster’s game didn’t pick it up',
      ],
      [
        'never answered',
        { status: 'lost' },
        'Not made at the table: no answer from your Gamemaster’s game',
      ],
      [
        'failed for a reason it does not know',
        { status: 'failed', reason: 'gremlins' },
        'Not made at the table',
      ],
    ])('says where the latest roll is when %s', (_, state, text) => {
      render(
        <RollTray
          rolls={[roll()]}
          rolling={false}
          table={table([['r1', state]])}
        />,
      )

      expect(screen.getByRole('status')).toHaveTextContent(
        new RegExp(`${text}$`),
      )
    })

    it('marks each earlier roll with how it went at the table', async () => {
      const user = userEvent.setup()
      render(
        <RollTray
          rolls={[
            roll({ id: 'r5' }),
            roll({ id: 'r4' }),
            roll({ id: 'r3' }),
            roll({ id: 'r2' }),
            roll({ id: 'r1' }),
          ]}
          rolling={false}
          table={table([
            ['r4', { status: 'done', visible: true, total: 19 }],
            ['r3', { status: 'done', visible: false }],
            ['r2', { status: 'rolling' }],
            ['r1', { status: 'refused', reason: 'busy' }],
          ])}
        />,
      )

      await user.click(screen.getByText('Earlier rolls (4)'))

      expect(
        screen.getAllByRole('listitem').map(item => item.textContent),
      ).toEqual([
        'Perception check12 +4 = 16· table 19',
        'Perception check12 +4 = 16· hidden',
        'Perception check12 +4 = 16· sending',
        'Perception check12 +4 = 16· not at the table',
      ])
    })

    it('says rolls go to the table, with a switch to keep them on this device', async () => {
      const user = userEvent.setup()
      const sending = table()
      const { rerender } = render(
        <RollTray rolls={[]} rolling={false} table={sending} />,
      )

      expect(
        screen.getByText(
          /made in your Gamemaster’s game too, with the same dice/,
        ),
      ).toBeInTheDocument()
      const toggle = screen.getByRole('switch', { name: 'Send to the table' })
      expect(toggle).toBeChecked()
      await user.click(toggle)
      expect(sending.setSending).toHaveBeenCalledWith(false)

      rerender(
        <RollTray
          rolls={[]}
          rolling={false}
          table={table([], { sending: false })}
        />,
      )
      expect(
        screen.getByRole('switch', { name: 'Send to the table' }),
      ).not.toBeChecked()
      expect(
        screen.getByText(/Only you see these rolls. They aren’t sent/),
      ).toBeInTheDocument()
    })

    it('offers no switch while the game takes no rolls', () => {
      render(
        <RollTray
          rolls={[]}
          rolling={false}
          table={table([], { available: false })}
        />,
      )

      expect(screen.queryByRole('switch')).toBeNull()
      expect(
        screen.getByText(/They aren't sent to your Gamemaster's game/),
      ).toBeInTheDocument()
    })
  })
})
