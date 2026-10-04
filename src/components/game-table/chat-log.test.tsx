/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { render, screen, within } from '@testing-library/react'
import { ChatLog, initials } from './chat-log'
import type { TableMessage, TableRoll } from '@/types/table'

const message = (fields: Partial<TableMessage> = {}): TableMessage => ({
  id: 'm1',
  sentAt: '2026-10-04T19:02:00.000Z',
  speaker: 'Gamemaster',
  side: 'other',
  whisper: false,
  kind: 'text',
  rolls: [],
  targets: [],
  text: 'Roll initiative!',
  ...fields,
})

const roll = (fields: Partial<TableRoll> = {}): TableRoll => ({
  formula: '2d20kh + 7',
  total: 24,
  dice: [
    { faces: 20, value: 17, active: true },
    { faces: 20, value: 4, active: false },
  ],
  advantage: false,
  disadvantage: false,
  critical: false,
  fumble: false,
  ...fields,
})

describe('components/game-table/chat-log', () => {
  it('says when there are no messages', () => {
    render(<ChatLog messages={[]} />)

    expect(
      screen.getByRole('heading', { name: 'No messages yet' }),
    ).toBeInTheDocument()
  })

  it('shows who said what, and when', () => {
    render(<ChatLog messages={[message()]} />)

    const article = screen.getByRole('article')
    expect(within(article).getByText('Gamemaster')).toBeInTheDocument()
    expect(within(article).getByText('Roll initiative!')).toBeInTheDocument()
    expect(article.querySelector('time')).toHaveAttribute(
      'dateTime',
      '2026-10-04T19:02:00.000Z',
    )
  })

  it("puts the player's own messages on the other side", () => {
    render(
      <ChatLog
        messages={[
          message({ id: 'a', side: 'other' }),
          message({ id: 'b', side: 'party', speaker: 'Vex' }),
          message({
            id: 'c',
            side: 'me',
            speaker: 'Thorin',
            targets: ['Goblin'],
          }),
        ]}
      />,
    )

    const [gm, ally, mine] = screen.getAllByRole('article')
    expect(gm).toHaveAttribute('data-side', 'other')
    expect(gm).not.toHaveClass('flex-row-reverse')
    expect(ally).not.toHaveClass('flex-row-reverse')
    expect(mine).toHaveAttribute('data-side', 'me')
    expect(mine).toHaveClass('flex-row-reverse')
    expect(within(mine).getByText('Target: Goblin')).toHaveClass('text-right')
  })

  it('marks a whisper', () => {
    render(<ChatLog messages={[message({ whisper: true })]} />)

    expect(screen.getByText('Whisper')).toBeInTheDocument()
  })

  it('shows a label over text, or the label alone', () => {
    render(
      <ChatLog
        messages={[
          message({ id: 'a', label: 'Lore', text: 'Old tales.' }),
          message({ id: 'b', label: 'Just a title', text: undefined }),
          message({ id: 'c', label: undefined, text: undefined }),
        ]}
      />,
    )

    const [first, second, third] = screen.getAllByRole('article')
    expect(first).toHaveTextContent('LoreOld tales.')
    expect(second).toHaveTextContent('Just a title')
    expect(third.querySelector('p')).toBeNull()
  })

  it('shows an item used as a card', () => {
    render(
      <ChatLog
        messages={[
          message({ kind: 'card', label: 'Second Wind', text: undefined }),
          message({ id: 'm2', kind: 'card', label: undefined }),
        ]}
      />,
    )

    expect(screen.getAllByText('Used')).toHaveLength(2)
    expect(screen.getByText('Second Wind')).toBeInTheDocument()
    expect(screen.getByText('An item or ability')).toBeInTheDocument()
  })

  it('shows a roll: label, formula, dice, total and how it went', () => {
    render(
      <ChatLog
        messages={[
          message({
            kind: 'roll',
            label: 'Longbow · Attack',
            text: undefined,
            rolls: [roll({ advantage: true, critical: true })],
            targets: ['Goblin'],
          }),
        ]}
      />,
    )

    expect(screen.getByText('Longbow · Attack')).toBeInTheDocument()
    expect(screen.getByText('2d20kh + 7')).toBeInTheDocument()
    expect(screen.getByText('Critical')).toHaveClass('bg-gold', 'text-on-gold')
    expect(screen.getByText('Advantage')).toHaveClass(
      'bg-primary',
      'text-on-primary',
    )
    expect(screen.getByText('24')).toHaveClass('text-gold-text')
    const dice = within(screen.getByRole('list', { name: 'Dice' }))
      .getAllByRole('listitem')
      .map(die => die.textContent)
    expect(dice).toEqual(['17', '4 (dropped)'])
    expect(screen.getByText('Total')).toHaveTextContent('Total')
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByText('Target: Goblin')).toBeInTheDocument()
  })

  it('shows a fumble, disadvantage, damage type and several targets', () => {
    render(
      <ChatLog
        messages={[
          message({
            kind: 'roll',
            label: undefined,
            whisper: true,
            rolls: [
              roll({
                fumble: true,
                disadvantage: true,
                total: null,
                dice: [],
                damageType: 'fire',
              }),
            ],
            targets: ['Goblin', 'Orc'],
          }),
        ]}
      />,
    )

    expect(screen.getByText('Roll')).toBeInTheDocument()
    expect(screen.getByText('Nat 1')).toBeInTheDocument()
    expect(screen.getByText('Disadvantage')).toHaveClass(
      'bg-ruby',
      'text-on-ruby',
    )
    expect(screen.getByText('fire damage')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Dice' })).toBeNull()
    expect(screen.getByText('–')).toBeInTheDocument()
    expect(screen.getByText('Targets: Goblin, Orc')).toBeInTheDocument()
  })

  describe('initials', () => {
    it.each([
      ['Thorin Oakenshield', 'TO'],
      ['vex', 'V'],
      ['Gimli son of Gloin', 'GS'],
      ['  ', '?'],
    ])('%s -> %s', (name, expected) => {
      expect(initials(name)).toBe(expected)
    })
  })
})
