/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatLog, initials } from './chat-log'
import type {
  TableDamage,
  TableDamageKind,
  TableMessage,
  TableRoll,
} from '@/types/table'

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

/** A kind of damage, as a damage card's chip shows it. */
const kind = (
  label: string | undefined,
  total: number | null,
  pool: TableDamageKind['pool'] = 'harm',
): TableDamageKind => ({
  ...(label && { type: label.toLowerCase(), label }),
  total,
  pool,
})

/** Corvin's dagger's damage, as the server folds it: 5 Piercing and 7 Poison, 12 in all. */
const corvin = (fields: Partial<TableDamage> = {}): TableDamage => ({
  section: 'main',
  action: 'damage',
  formula: '1d4 + 4 + 2d6',
  kinds: [kind('Piercing', 5), kind('Poison', 7)],
  total: 12,
  critical: false,
  rolls: [
    {
      formula: '1d4 + 4',
      total: 5,
      dice: [{ faces: 4, value: 1, active: true }],
      label: 'Piercing',
    },
    {
      formula: '2d6',
      total: 7,
      dice: [
        { faces: 6, value: 2, active: true },
        { faces: 6, value: 5, active: false },
      ],
      label: 'Poison',
    },
  ],
  ...fields,
})

/** A message holding damage cards, and any other rolls. */
const damaged = (
  damage: TableDamage[],
  fields: Partial<TableMessage> = {},
): TableMessage =>
  message({
    kind: 'roll',
    label: 'Dagger (Melee)',
    text: undefined,
    damage,
    ...fields,
  })

/**
 * What opens a damage card's rolls, its summary, by what it says: a native disclosure, which the
 * browser names and marks open or closed, but which jsdom gives no role.
 */
const opener = (says: RegExp) => {
  const found = [...document.querySelectorAll('summary')].find(summary =>
    says.test(summary.textContent ?? ''),
  )
  if (!found) throw new Error(`No summary says ${says}`)
  return found
}

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

  it('marks a roll the Gamemaster made as the character, for every reader (#156)', () => {
    render(
      <ChatLog
        messages={[
          message({ id: 'gm', speaker: 'Thorin', side: 'party', byGm: true }),
          message({ id: 'own', speaker: 'Thorin', side: 'party' }),
        ]}
      />,
    )

    const [gm, own] = screen.getAllByRole('article')
    const pill = within(gm).getByTitle('Rolled by the Gamemaster')
    expect(pill).toHaveTextContent('GM, rolled by the Gamemaster')
    expect(within(pill).getByText(', rolled by the Gamemaster')).toHaveClass(
      'sr-only',
    )
    expect(pill).toHaveClass('text-[11px]', 'shrink-0')
    // After the speaker.
    expect(within(gm).getByText('Thorin').nextSibling).toBe(pill)
    expect(within(own).queryByTitle('Rolled by the Gamemaster')).toBeNull()
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

  it('shows a fumble, disadvantage and several targets', () => {
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
    expect(screen.queryByRole('list', { name: 'Dice' })).toBeNull()
    expect(screen.getByText('–')).toBeInTheDocument()
    expect(screen.getByText('Goblin').closest('p')).toHaveTextContent(
      'Targets: Goblin,Orc',
    )
  })

  it.each([
    ['attack', 'Attack', 'border-l-attack', 'text-attack-text'],
    ['spell-attack', 'Spell attack', 'border-l-spell', 'text-spell-text'],
  ] as const)('marks %s rolls', (action, chip, accent, text) => {
    render(
      <ChatLog
        messages={[
          message({
            kind: 'roll',
            label: 'Orcrist',
            // The message's own mark isn't drawn on a roll: its attack's is.
            action: 'spell',
            attackRoll: { index: 0, action },
            text: undefined,
            rolls: [roll()],
          }),
        ]}
      />,
    )

    expect(screen.getByText(chip)).toHaveClass(text)
    expect(screen.queryByText('Spell')).toBeNull()
    expect(screen.getByText('Orcrist')).toBeInTheDocument()
    expect(screen.getByText('2d20kh + 7').closest('.border-l-4')).toHaveClass(
      accent,
    )
    expect(screen.queryByText('Roll')).toBeNull()
  })

  it.each([
    ['damage', 'Damage', 'border-l-damage', 'text-damage-text', 'bg-damage/15'],
    [
      'healing',
      'Healing',
      'border-l-primary',
      'text-primary-text',
      'bg-primary/10',
    ],
  ] as const)('marks %s', (action, chip, accent, text, tint) => {
    render(
      <ChatLog
        messages={[damaged([corvin({ action })], { label: 'Orcrist' })]}
      />,
    )

    expect(screen.getByText(chip)).toHaveClass(text, tint)
    expect(screen.getByText('Orcrist')).toBeInTheDocument()
    expect(
      screen.getByText('1d4 + 4 + 2d6').closest('.border-l-4'),
    ).toHaveClass(accent)
  })

  it('calls out who an attack was against, and whether it hit when their armor class is known', () => {
    render(
      <ChatLog
        messages={[
          message({
            kind: 'roll',
            label: undefined,
            text: undefined,
            rolls: [roll(), roll({ formula: '1d4' })],
            attackRoll: { index: 0, action: 'attack' },
            targets: [
              { name: 'Goblin Boss', ac: 15, outcome: 'hit' },
              { name: 'Goblin', ac: 25, outcome: 'miss' },
              { name: 'Smaug' },
            ],
          }),
        ]}
      />,
    )

    // Only the attack is marked, and who it was against is called out once, on the first.
    expect(screen.getAllByText('Attack')).toHaveLength(1)
    expect(screen.getByText('1d4').closest('.border-l-4')).toBeNull()
    expect(screen.getAllByText('Roll')).toHaveLength(1)
    expect(screen.getAllByText('Goblin Boss')).toHaveLength(1)
    expect(screen.getByText('AC 15')).toBeInTheDocument()
    expect(screen.getByText('Hit')).toHaveClass(
      'text-primary-text',
      'bg-primary/10',
    )
    expect(screen.getByText('Miss')).toHaveClass(
      'text-text-secondary',
      'bg-text-secondary/10',
    )
    expect(screen.getByText('Smaug').parentElement).toHaveTextContent(/^Smaug$/)
  })

  it('marks the attack on its own roll only, the one the server says', () => {
    render(
      <ChatLog
        messages={[
          message({
            kind: 'roll',
            label: 'Dagger (Melee)',
            text: undefined,
            rolls: [roll({ formula: '1d20' }), roll({ formula: '1d20 + 6' })],
            attackRoll: { index: 1, action: 'attack' },
          }),
        ]}
      />,
    )

    expect(screen.getByText('Attack').closest('.border-l-4')).toBe(
      screen.getByText('1d20 + 6').closest('.border-l-4'),
    )
    expect(screen.getByText('1d20').closest('.border-l-4')).toBeNull()
  })

  describe('damage cards', () => {
    it("shows Corvin's dagger: its formula, a chip for each kind, and its total", () => {
      render(<ChatLog messages={[damaged([corvin()])]} />)

      expect(screen.getByText('Damage')).toBeInTheDocument()
      expect(screen.getByText('Dagger (Melee)')).toBeInTheDocument()
      const summary = opener(/Piercing/)
      expect(summary.tagName).toBe('SUMMARY')
      expect(summary.textContent).toBe(
        '1d4 + 4 + 2d6, 5 Piercing + 7 Poison = 12',
      )
      expect(summary).toHaveClass('min-h-11')
      expect(screen.getByText('1d4 + 4 + 2d6')).toHaveClass(
        'font-mono',
        'text-xs',
        'break-words',
        'text-text-secondary',
      )
      const chip = screen.getByText('Piercing').parentElement as HTMLElement
      expect(chip.textContent).toBe('5 Piercing')
      expect(within(chip).getByText('5')).toHaveClass(
        'font-bold',
        'text-text-primary',
      )
      expect(screen.getByText('Piercing')).toHaveClass('text-damage-text')
      expect(chip).toHaveClass('bg-damage/10', 'border-damage/30')
      expect(screen.getByText('12')).toHaveClass('text-3xl')
      // The rolls' dice are left closed, and its old per-roll words are gone.
      expect(screen.queryByRole('list', { name: 'Dice' })).toBeNull()
      expect(screen.queryByText(/piercing damage/i)).toBeNull()
    })

    it("opens to each roll's formula, dice and total on a tap", async () => {
      const user = userEvent.setup()
      render(
        <ChatLog
          messages={[
            damaged([
              corvin({
                rolls: [
                  ...corvin().rolls,
                  {
                    formula: '1d4 - 5',
                    total: -2,
                    dice: [{ faces: 4, value: 3, active: true }],
                    label: 'Piercing',
                    tag: 'Sneak Attack',
                  },
                  { formula: '1d6', total: null, dice: [] },
                ],
              }),
            ]),
          ]}
        />,
      )

      await user.click(opener(/Piercing/))

      const rows = within(screen.getByRole('list', { name: 'Rolls' }))
        .getAllByRole('listitem')
        .filter(
          item => item.parentElement?.getAttribute('aria-label') === 'Rolls',
        )
      expect(rows.map(row => row.textContent)).toEqual([
        '1d4 + 4 15 Piercing',
        '2d6 25 (dropped)7 Poison',
        'Sneak Attack 1d4 - 5 3-2 Piercing',
        '1d6 –',
      ])
      expect(within(rows[1]).getByText('5')).toHaveClass('line-through')
      expect(rows[0]).toHaveClass('items-end')
      expect(within(rows[2]).getByText('Sneak Attack')).toHaveClass(
        'text-[11px]',
        'font-semibold',
        'text-text-secondary',
      )
      expect(screen.getAllByRole('list', { name: 'Dice' })).toHaveLength(3)

      await user.click(opener(/Piercing/))
      expect(screen.queryByRole('list', { name: 'Rolls' })).toBeNull()
    })

    it('shows the dice of a card of one roll inline, with nothing to open', () => {
      render(
        <ChatLog
          messages={[
            damaged([
              corvin({
                formula: '1d8 + 4',
                kinds: [kind('Piercing', 15)],
                total: 15,
                rolls: [
                  {
                    formula: '1d8 + 4',
                    total: 15,
                    dice: [{ faces: 8, value: 11, active: true }],
                    label: 'Piercing',
                  },
                ],
              }),
            ]),
          ]}
        />,
      )

      expect(document.querySelector('summary')).toBeNull()
      expect(screen.queryByRole('button')).toBeNull()
      expect(
        within(screen.getByRole('list', { name: 'Dice' })).getByText('11'),
      ).toBeInTheDocument()
      expect(screen.getByText('Piercing').parentElement?.textContent).toBe(
        '15 Piercing',
      )
    })

    it('shows unknown, untyped and uncounted damage, and no total across pools', () => {
      render(
        <ChatLog
          messages={[
            damaged([
              corvin({
                kinds: [
                  kind('Piercing', null),
                  kind(undefined, 4),
                  kind('No damage', 3, 'none'),
                  kind('Healing', 5, 'healing'),
                ],
                total: undefined,
              }),
            ]),
          ]}
        />,
      )

      expect(opener(/Piercing/).textContent).toBe(
        '1d4 + 4 + 2d6, – Piercing + 4 + No damage + 5 Healing',
      )
      expect(screen.getByText('No damage')).toHaveClass('text-text-secondary')
      expect(screen.getByText('No damage').parentElement).toHaveClass(
        'bg-text-secondary/10',
      )
      expect(screen.getByText('Healing')).toHaveClass('text-primary-text')
      expect(screen.getByText('Healing').parentElement).toHaveClass(
        'bg-primary/10',
      )
    })

    it('shows an unknown total as unknown', () => {
      render(
        <ChatLog
          messages={[
            damaged([
              corvin({
                kinds: [kind('Piercing', null), kind('Poison', 7)],
                total: null,
              }),
            ]),
          ]}
        />,
      )

      expect(opener(/Piercing/).textContent).toBe(
        '1d4 + 4 + 2d6, – Piercing + 7 Poison = –',
      )
    })

    it("gives Midi-QOL's other damage a card of its own, captioned", () => {
      render(
        <ChatLog
          messages={[
            damaged([
              corvin({ kinds: [kind('Piercing', 5)], total: 5 }),
              corvin({
                section: 'other',
                formula: '2d6',
                kinds: [kind('Poison', 7)],
                total: 7,
              }),
            ]),
          ]}
        />,
      )

      const caption = screen.getByText('Other damage')
      expect(caption).toHaveClass(
        'text-[11px]',
        'font-semibold',
        'tracking-wider',
        'text-text-secondary',
        'uppercase',
      )
      expect(caption).not.toHaveAttribute('aria-hidden')
      const [main, other] = screen
        .getAllByText('Damage')
        .map(chip => chip.closest('.border-l-4') as HTMLElement)
      expect(within(main).queryByText('Other damage')).toBeNull()
      expect(other).toContainElement(caption)
      expect(other).toHaveTextContent('2d6, 7 Poison = 7')
      expect(screen.getAllByText('Dagger (Melee)')).toHaveLength(2)
    })

    it('keeps an open card open as Midi-QOL adds another before it', async () => {
      const user = userEvent.setup()
      const other = corvin({ section: 'other', formula: '2d6 + 1d4' })
      const { rerender } = render(<ChatLog messages={[damaged([other])]} />)

      await user.click(opener(/Piercing/))
      expect(screen.getByRole('list', { name: 'Rolls' })).toBeInTheDocument()

      rerender(
        <ChatLog
          messages={[damaged([corvin({ formula: '1d8', total: 99 }), other])]}
        />,
      )

      const [main, open] = screen.getAllByRole('group')
      expect(within(main).getByText('1d8')).toBeInTheDocument()
      expect(within(main).queryByRole('list', { name: 'Rolls' })).toBeNull()
      expect(within(open).getByText('2d6 + 1d4')).toBeInTheDocument()
      expect(
        within(open).getByRole('list', { name: 'Rolls' }),
      ).toBeInTheDocument()
    })

    it("doesn't say its item again under its attack's card, and shows the targets once", () => {
      render(
        <ChatLog
          messages={[
            damaged([corvin()], {
              rolls: [roll({ formula: '1d20 + 6' })],
              attackRoll: { index: 0, action: 'attack' },
              targets: [{ name: 'Mira', ac: 14, outcome: 'hit' }],
            }),
            damaged([corvin()], {
              id: 'm2',
              targets: [{ name: 'Mira', ac: 14 }],
            }),
          ]}
        />,
      )

      const [attacked, alone] = screen.getAllByRole('article')
      expect(within(attacked).getAllByText('Dagger (Melee)')).toHaveLength(1)
      expect(
        within(attacked).getByText('Dagger (Melee)').closest('.border-l-4'),
      ).toBe(within(attacked).getByText('Attack').closest('.border-l-4'))
      expect(within(attacked).getAllByText('Mira')).toHaveLength(1)
      expect(within(attacked).getByText('Mira').closest('.border-l-4')).toBe(
        within(attacked).getByText('Attack').closest('.border-l-4'),
      )
      // With no card above it, the damage card says what it's from, and against whom.
      expect(within(alone).getByText('Dagger (Melee)')).toBeInTheDocument()
      expect(within(alone).getByText('Mira').closest('.border-l-4')).toBe(
        within(alone).getByText('Damage').closest('.border-l-4'),
      )
    })

    it("doesn't say its item again on either damage card under its attack's", () => {
      render(
        <ChatLog
          messages={[
            damaged(
              [corvin(), corvin({ section: 'other', formula: '2d6 + 1d4' })],
              {
                rolls: [roll({ formula: '1d20 + 6' })],
                attackRoll: { index: 0, action: 'attack' },
              },
            ),
          ]}
        />,
      )

      expect(screen.getAllByText('Dagger (Melee)')).toHaveLength(1)
      expect(screen.getByText('Dagger (Melee)').closest('.border-l-4')).toBe(
        screen.getByText('Attack').closest('.border-l-4'),
      )
    })

    it('shows the targets once, on the main card, where no roll has a card above it', () => {
      render(
        <ChatLog
          messages={[
            damaged(
              [corvin(), corvin({ section: 'other', formula: '2d6 + 1d4' })],
              { targets: [{ name: 'Mira', ac: 14 }] },
            ),
          ]}
        />,
      )

      const [main] = screen
        .getAllByText('Damage')
        .map(chip => chip.closest('.border-l-4') as HTMLElement)
      expect(screen.getAllByText('Mira')).toHaveLength(1)
      expect(main).toContainElement(screen.getByText('Mira'))
      expect(main).not.toHaveTextContent('Other damage')
    })

    it('says what a creature that saves takes, under the main card only', () => {
      render(
        <ChatLog
          messages={[
            damaged([corvin({ onSave: 'half' })]),
            damaged([corvin({ onSave: 'none' })], { id: 'm2' }),
            damaged([corvin({ onSave: 'full' })], { id: 'm3' }),
          ]}
        />,
      )

      expect(screen.getByText('Half damage on a save')).toHaveClass(
        'text-xs',
        'text-text-secondary',
      )
      expect(screen.getByText('No damage on a save')).toBeInTheDocument()
      expect(screen.getByText('Full damage on a save')).toBeInTheDocument()
      // Not part of what the card's button is called.
      expect(opener(/= 12$/)).not.toBeNull()
    })

    it("says what a creature that saves takes under a card of one roll, as a Fireball's", () => {
      render(
        <ChatLog
          messages={[
            damaged(
              [
                corvin({
                  formula: '8d6',
                  kinds: [kind('Fire', 28)],
                  total: 28,
                  onSave: 'half',
                  rolls: [
                    { formula: '8d6', total: 28, dice: [], label: 'Fire' },
                  ],
                }),
              ],
              { label: 'Fireball' },
            ),
          ]}
        />,
      )

      expect(document.querySelector('summary')).toBeNull()
      expect(screen.getByText('Half damage on a save')).toHaveClass(
        'text-xs',
        'text-text-secondary',
      )
    })

    it("names healing's pools, with no total across them", () => {
      render(
        <ChatLog
          messages={[
            damaged(
              [
                corvin({
                  action: 'healing',
                  formula: '1d8 + 3 + 5',
                  kinds: [
                    kind('Healing', 11, 'healing'),
                    kind('Temp HP', 5, 'temphp'),
                  ],
                  total: undefined,
                }),
              ],
              { label: 'Cure Wounds' },
            ),
          ]}
        />,
      )

      expect(
        screen.getByText('Healing', { selector: '.uppercase' }),
      ).toBeInTheDocument()
      expect(opener(/Healing/).textContent).toBe(
        '1d8 + 3 + 5, 11 Healing + 5 Temp HP',
      )
      expect(
        screen.getByText('1d8 + 3 + 5').closest('.border-l-4'),
      ).toHaveClass('border-l-primary')
    })

    it("tints each of healing's pools as healing, never as harm", () => {
      render(
        <ChatLog
          messages={[
            damaged([
              corvin({
                action: 'healing',
                kinds: [
                  kind('Healing', 11, 'healing'),
                  kind('Temp HP', 5, 'temphp'),
                  kind('Max HP', 3, 'maximum'),
                ],
                total: undefined,
              }),
            ]),
          ]}
        />,
      )

      const summary = opener(/Max HP/)
      for (const label of ['Healing', 'Temp HP', 'Max HP']) {
        const word = within(summary).getByText(label)
        expect(word).toHaveClass('text-primary-text')
        expect(word).not.toHaveClass('text-damage-text')
        expect(word.parentElement).toHaveClass('bg-primary/10')
        expect(word.parentElement).not.toHaveClass('bg-damage/10')
      }
    })

    it('rings its summary on a hover, never tinting what it says', () => {
      render(<ChatLog messages={[damaged([corvin({ critical: true })])]} />)

      // A tint under its chips' words and its gold total takes them below WCAG AA on the
      // player's own bubble, in the light theme.
      const summary = opener(/Piercing/)
      const tints = [summary, ...summary.querySelectorAll('*')].flatMap(
        element =>
          [...element.classList].filter(name => name.includes('hover:bg-')),
      )
      expect(tints).toEqual([])
      expect(summary).toHaveClass('hover:ring-1', 'hover:ring-primary/30')
    })
  })

  describe('a critical', () => {
    it.each([
      ['a roll', [roll({ critical: true })], undefined],
      ['damage', [], [corvin({ critical: true })]],
    ])(
      "edges %s in gold, on the player's own bubble and on a whisper",
      (_, rolls, damage) => {
        render(
          <ChatLog
            messages={[
              message({
                kind: 'roll',
                side: 'me',
                text: undefined,
                rolls,
                damage,
              }),
              message({
                id: 'm2',
                kind: 'roll',
                whisper: true,
                text: undefined,
                rolls,
                damage,
              }),
            ]}
          />,
        )

        const [mine, whisper] = screen
          .getAllByText('Critical')
          .map(badge => badge.closest('.max-w-sm') as HTMLElement)
        expect(mine).toHaveClass('border-gold', 'bg-primary/10')
        expect(mine).not.toHaveClass('border-primary/30')
        expect(mine).not.toHaveClass('border-solid')
        expect(whisper).toHaveClass(
          'border-gold',
          'border-dashed',
          'bg-whisper/5',
        )
        expect(whisper).not.toHaveClass('border-whisper/60')
        expect(whisper).not.toHaveClass('border-solid')
      },
    )

    it("keeps the card's edge and border otherwise", () => {
      render(
        <ChatLog
          messages={[
            message({
              kind: 'roll',
              side: 'me',
              text: undefined,
              damage: [corvin()],
            }),
            message({
              id: 'm2',
              kind: 'roll',
              whisper: true,
              text: undefined,
              rolls: [roll()],
            }),
          ]}
        />,
      )

      const [mine, whisper] = screen
        .getAllByRole('article')
        .map(article => article.querySelector('.max-w-sm') as HTMLElement)
      expect(mine).toHaveClass('border-primary/30', 'border-l-damage')
      expect(mine).not.toHaveClass('border-gold')
      expect(whisper).toHaveClass('border-whisper/60', 'border-dashed')
      expect(whisper).not.toHaveClass('border-gold')
    })

    it('marks a critical damage card with its badge, its total in gold', () => {
      render(<ChatLog messages={[damaged([corvin({ critical: true })])]} />)

      expect(screen.getByText('Critical')).toHaveClass(
        'bg-gold',
        'text-on-gold',
      )
      expect(screen.getByText('12')).toHaveClass('text-gold-text')
      // The chips stay damage's: they say what kind it is, not how it was rolled.
      expect(screen.getByText('Piercing')).toHaveClass('text-damage-text')
    })
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

    expect(screen.getByText('Spell')).toHaveClass(
      'bg-spell/15',
      'text-spell-text',
    )
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

    it("words a check, the player's and the Gamemaster's, a tool by the game's name for it", () => {
      render(
        <ChatLog
          messages={[
            ask({
              id: 'm1',
              text: 'Strength (Athletics) check',
              ask: {
                type: 'check',
                checks: [{ type: 'skill', ability: 'str', skill: 'ath' }],
                dc: 15,
                label: 'Cloak of Climbing',
              },
            }),
            ask({
              id: 'm2',
              speaker: 'Gamemaster',
              side: 'other',
              ask: {
                type: 'check',
                checks: [
                  { type: 'check', ability: 'int' },
                  {
                    type: 'tool',
                    ability: 'dex',
                    tool: 'thief',
                    name: 'Lockpicks',
                  },
                ],
              },
            }),
          ]}
        />,
      )

      const [thorin, gm] = screen.getAllByRole('article')
      expect(
        within(thorin).getByText(
          'Thorin asks for a DC 15 Strength (Athletics) check',
        ),
      ).toBeInTheDocument()
      expect(within(thorin).getByText('Check')).toHaveAttribute(
        'aria-hidden',
        'true',
      )
      expect(within(thorin).getByText('Cloak of Climbing')).toHaveTextContent(
        'From Cloak of Climbing',
      )
      expect(gm).toHaveTextContent(
        'Gamemaster asks for an Intelligence or Dexterity (Lockpicks) check',
      )
      expect(within(gm).queryByText(/^From/)).toBeNull()
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

describe('components/game-table/chat-log hits, misses and saves, from module 0.29.0', () => {
  const targets = [
    { name: 'Goblin', outcome: 'hit' as const, save: 'failed' as const },
    { name: 'Orc', outcome: 'miss' as const },
    { name: 'Kobold', save: 'saved' as const },
    { name: 'Bat' },
  ]

  it('marks where it landed as a hit, or a failed save, and where it didn’t muted, with a cross, each read after the name', () => {
    render(
      <ChatLog
        messages={[
          message({
            kind: 'card',
            label: 'Fireball',
            text: undefined,
            targets,
            summary: 'Hit 1 of 2 · 1 of 2 saved',
          }),
        ]}
      />,
    )

    for (const word of ['Hit', 'Failed']) {
      const pill = screen.getByText(word)
      expect(pill).toHaveClass('bg-primary/10', 'text-primary-text')
      expect(pill.querySelector('svg')).toBeNull()
    }
    for (const word of ['Miss', 'Saved']) {
      const pill = screen.getByText(word)
      expect(pill).toHaveClass('bg-text-secondary/10', 'text-text-secondary')
      expect(pill.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    }
    const named = (name: string) =>
      screen.getByText(name).parentElement?.textContent
    expect(named('Goblin')).toBe('Goblin, Hit, Failed,')
    expect(named('Orc')).toBe('Orc, Miss,')
    expect(named('Kobold')).toBe('Kobold, Saved,')
    expect(named('Bat')).toBe('Bat')
    // How it went in all, over who it was at.
    const summary = screen.getByText('Hit 1 of 2 · 1 of 2 saved')
    expect(
      summary.compareDocumentPosition(screen.getByText('Goblin')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('sums it up over the targets of a roll, a damage card or text, once', () => {
    render(
      <ChatLog
        messages={[
          message({
            id: 'roll',
            kind: 'roll',
            text: undefined,
            rolls: [roll(), roll({ formula: '1d4' })],
            attackRoll: { index: 0, action: 'attack' },
            targets: targets.slice(0, 2),
            summary: 'Hit 1 of 2',
          }),
          message({
            id: 'damage',
            kind: 'roll',
            text: undefined,
            damage: [corvin()],
            targets: targets.slice(0, 2),
            summary: 'Hit 1 of 2 · 0 of 1 saved',
          }),
          message({
            id: 'text',
            targets: targets.slice(2),
            summary: '1 of 1 saved',
          }),
        ]}
      />,
    )

    expect(screen.getAllByText('Hit 1 of 2')).toHaveLength(1)
    expect(screen.getAllByText('Hit 1 of 2 · 0 of 1 saved')).toHaveLength(1)
    expect(screen.getAllByText('1 of 1 saved')).toHaveLength(1)
  })
})
