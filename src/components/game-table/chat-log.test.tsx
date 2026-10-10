/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { fireEvent, render, screen, within } from '@testing-library/react'
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

/** Thorin's ask of the table, as the server shows it. */
const ask = (fields: Partial<TableMessage> = {}) =>
  message({
    speaker: 'Thorin',
    side: 'me',
    label: 'Roll Request: Worn Bardic Eternal Flame',
    text: 'Dexterity saving throw',
    ask: {
      type: 'save',
      abilities: ['dex'],
      dc: 15,
      label: 'Worn Bardic Eternal Flame',
    },
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

  it("shows the speaker's portrait, or their initials when it won't load", () => {
    const { container } = render(
      <ChatLog
        messages={[
          message({ speaker: 'Vex', avatar: 'https://game.example/vex.webp' }),
        ]}
      />,
    )

    const portrait = container.querySelector('img') as HTMLImageElement
    expect(portrait).toHaveAttribute('src', 'https://game.example/vex.webp')
    expect(screen.queryByText('V')).toBeNull()
    fireEvent.error(portrait)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('V')).toBeInTheDocument()
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
            targets: [{ name: 'Goblin' }],
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
    expect(within(mine).getByText('Goblin').closest('div')).toHaveClass(
      'self-end',
    )
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
            targets: [{ name: 'Goblin' }],
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
    expect(screen.getByText('Goblin').closest('p')).toHaveTextContent(
      'Target: Goblin',
    )
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
            targets: [{ name: 'Goblin' }, { name: 'Orc' }],
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
    expect(screen.getByText('Goblin').closest('p')).toHaveTextContent(
      'Targets: Goblin,Orc',
    )
  })

  it.each([
    ['attack', 'Attack', 'border-l-attack'],
    ['spell-attack', 'Spell attack', 'border-l-spell'],
    ['damage', 'Damage', 'border-l-damage'],
    ['healing', 'Healing', 'border-l-primary'],
  ] as const)('marks %s rolls', (action, chip, accent) => {
    render(
      <ChatLog
        messages={[
          message({
            kind: 'roll',
            label: 'Orcrist',
            action,
            text: undefined,
            rolls: [roll()],
          }),
        ]}
      />,
    )

    expect(screen.getByText(chip)).toBeInTheDocument()
    expect(screen.getByText('Orcrist')).toBeInTheDocument()
    expect(screen.getByText('2d20kh + 7').closest('.border-l-4')).toHaveClass(
      accent,
    )
    expect(screen.queryByText('Roll')).toBeNull()
  })

  it('calls out who an attack was against, and whether it hit when their armor class is known', () => {
    render(
      <ChatLog
        messages={[
          message({
            kind: 'roll',
            action: 'attack',
            label: undefined,
            text: undefined,
            rolls: [roll(), roll({ formula: '1d4' })],
            targets: [
              { name: 'Goblin Boss', ac: 15, outcome: 'hit' },
              { name: 'Goblin', ac: 25, outcome: 'miss' },
              { name: 'Smaug' },
            ],
          }),
        ]}
      />,
    )

    // Each roll is marked, but who it was against is called out once, on the first.
    expect(screen.getAllByText('Attack')).toHaveLength(2)
    expect(screen.queryByText('Roll')).toBeNull()
    expect(screen.getAllByText('Goblin Boss')).toHaveLength(1)
    expect(screen.getByText('AC 15')).toBeInTheDocument()
    expect(screen.getByText('Hit')).toHaveClass('text-primary')
    expect(screen.getByText('Miss')).toBeInTheDocument()
    expect(screen.getByText('Smaug').parentElement).toHaveTextContent(/^Smaug$/)
  })

  it("doesn't call healing damage, and names temporary hit points", () => {
    render(
      <ChatLog
        messages={[
          message({
            kind: 'roll',
            action: 'healing',
            label: 'Cure Wounds',
            text: undefined,
            rolls: [
              roll({ damageType: 'healing' }),
              roll({ damageType: 'temphp' }),
            ],
          }),
        ]}
      />,
    )

    expect(screen.queryByText(/healing damage/i)).toBeNull()
    expect(screen.getByText('Temporary hit points')).toBeInTheDocument()
  })

  it('marks a spell cast as a card, with its targets', () => {
    render(
      <ChatLog
        messages={[
          message({
            kind: 'card',
            action: 'spell',
            label: 'Fireball',
            text: undefined,
            targets: [{ name: 'Goblin' }],
          }),
        ]}
      />,
    )

    expect(screen.getByText('Spell')).toBeInTheDocument()
    expect(screen.queryByText('Used')).toBeNull()
    expect(screen.getByText('Fireball').parentElement).toHaveClass(
      'border-l-spell',
    )
    expect(screen.getByText('Goblin')).toBeInTheDocument()
  })

  describe('roll request cards', () => {
    it('says who asks the table for which saving throw, its DC, and what asks for it', () => {
      render(<ChatLog messages={[ask()]} />)

      const article = screen.getByRole('article')
      expect(
        within(article).getByText(
          'Thorin asks for a DC 15 Dexterity saving throw',
        ),
      ).toBeInTheDocument()
      expect(within(article).getByText('Saving throw')).toHaveAttribute(
        'aria-hidden',
        'true',
      )
      expect(
        within(article).getByText('Worn Bardic Eternal Flame'),
      ).toHaveTextContent('From Worn Bardic Eternal Flame')
      // Its line of text, for pages that don't read its ask, and the card's flavor are left out.
      expect(within(article).queryByText('Dexterity saving throw')).toBeNull()
      expect(within(article).queryByText(/Roll Request/)).toBeNull()
    })

    it("words the Gamemaster's card without a DC, nor what asks, and a concentration check", () => {
      render(
        <ChatLog
          messages={[
            ask({
              id: 'm1',
              speaker: 'Gamemaster',
              side: 'other',
              ask: { type: 'save', abilities: ['int', 'wis'] },
            }),
            ask({
              id: 'm2',
              ask: { type: 'concentration', abilities: ['con'], dc: 10 },
            }),
          ]}
        />,
      )

      const [gm, thorin] = screen.getAllByRole('article')
      expect(gm).toHaveTextContent(
        'Gamemaster asks for an Intelligence or Wisdom saving throw',
      )
      expect(within(gm).queryByText(/^From/)).toBeNull()
      expect(within(thorin).getByText('Concentration')).toBeInTheDocument()
      expect(thorin).toHaveTextContent(
        'Thorin asks for a DC 10 Concentration check',
      )
    })
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
