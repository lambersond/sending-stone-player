/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LONG_PRESS } from './roll-button'
import { briefOf, RollTray, type TableRolls } from './roll-tray'
import type {
  LocalAsk,
  LocalCheck,
  LocalDamage,
  LocalFormula,
  LocalUse,
} from '@/hooks/use-sheet-roller'
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

/** A hit die spent: a d10 that came up 7, and +2 for Constitution. */
const hitDie = (fields: Partial<LocalFormula> = {}): LocalFormula => ({
  kind: 'formula',
  id: 'h1',
  label: 'Hit die (d10)',
  total: 9,
  healing: true,
  terms: [
    { text: '1d10', values: [7], value: 7 },
    { text: '+2', values: [], value: 2 },
  ],
  at: 0,
  ...fields,
})

/**
 * That what was made of hit dice spent at once, and why not the rest, are one run of text after the
 * status line's icon, so that why reads on from what was made rather than in a column beside it.
 */
const expectOneRun = (made: HTMLElement) => {
  const line = made.closest('p') as HTMLElement
  expect(
    [...line.childNodes].filter(node => node.nodeName.toLowerCase() !== 'svg'),
  ).toHaveLength(1)
}

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

  it('shows a hit die spent: its total, its die and Constitution, and the least it gives back', () => {
    const { rerender } = render(<RollTray rolls={[hitDie()]} rolling={false} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      '9Hit die (d10)1d10 (7) +2',
    )

    rerender(
      <RollTray
        rolls={[
          hitDie({
            total: 1,
            terms: [
              { text: '1d10', values: [1], value: 1 },
              { text: '−3', values: [], value: -3 },
            ],
            minimum: 1,
          }),
        ]}
        rolling={false}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      '1Hit die (d10)1d10 (1) −3 · at least 1',
    )
  })

  it('shows hit dice spent at once as one roll: their total, every die, Constitution for each, and the least each gives back', async () => {
    const user = userEvent.setup()
    const three = hitDie({
      id: 'h3',
      label: 'Hit dice (3d10)',
      total: 8,
      terms: [
        { text: '3d10', values: [1, 8, 5], value: 14 },
        { text: '−9', values: [], value: -9 },
      ],
      minimum: 1,
      times: 3,
    })
    render(<RollTray rolls={[three, { ...three, id: 'h2' }]} rolling={false} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      '8Hit dice (3d10)3d10 (1, 8, 5) −9 · at least 1 each',
    )
    await user.click(screen.getByText('Earlier rolls (1)'))
    expect(screen.getByRole('listitem')).toHaveTextContent(
      'Hit dice (3d10)14 −9, at least 1 each = 8',
    )
  })

  it('shows a formula rolled, and keeps it among the earlier rolls', async () => {
    const user = userEvent.setup()
    render(
      <RollTray
        rolls={[
          hitDie({
            id: 'f1',
            label: 'Eternal Flame: Light radius',
            total: 6,
            healing: false,
            terms: [
              { text: '2d4', values: [2, 3], value: 5 },
              { text: '+1', values: [], value: 1 },
            ],
          }),
          hitDie(),
        ]}
        rolling={false}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      '6Eternal Flame: Light radius2d4 (2, 3) +1',
    )
    await user.click(screen.getByText('Earlier rolls (1)'))
    expect(screen.getByRole('listitem')).toHaveTextContent(
      'Hit die (d10)7 +2 = 9',
    )
  })

  it('says among the earlier rolls when a hit die gave back its least', async () => {
    const user = userEvent.setup()
    render(
      <RollTray
        rolls={[
          hitDie({ id: 'h2' }),
          hitDie({
            total: 1,
            terms: [
              { text: '1d6', values: [1], value: 1 },
              { text: '−2', values: [], value: -2 },
            ],
            minimum: 1,
          }),
        ]}
        rolling={false}
      />,
    )

    await user.click(screen.getByText('Earlier rolls (1)'))
    expect(screen.getByRole('listitem')).toHaveTextContent(
      'Hit die (d10)1 −2, at least 1 = 1',
    )
  })

  describe('at the table', () => {
    const table = (
      states: [string, TableRollState][] = [],
      fields: Partial<TableRolls> = {},
    ): TableRolls => ({
      states: new Map(states),
      available: true,
      sending: true,
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
      [
        'made, answering what the game asked, saved',
        { status: 'done', visible: true, total: 16, outcome: 'success' },
        'At the table: 16 · Saved',
      ],
      [
        'made, answering what the game asked, failed',
        { status: 'done', visible: true, total: 7, outcome: 'failure' },
        'At the table: 7 · Failed',
      ],
      [
        'answering what the game no longer asks',
        { status: 'failed', reason: 'prompt' },
        'Not made at the table: your Gamemaster’s game isn’t asking for it any more',
      ],
      [
        'refused a spell slot',
        { status: 'refused', reason: 'slot' },
        'Not made at the table: that spell slot can’t cast it',
      ],
      [
        'an attack of a spell an item casts, refused at a level the item no longer offers',
        { status: 'refused', reason: 'slot', itemCast: true },
        'Not made at the table: the item can’t cast it at that level now',
      ],
      [
        'an attack of a spell an item casts, failed in the game at that level',
        { status: 'failed', reason: 'slot', itemCast: true },
        'Not made at the table: the item can’t cast it at that level now',
      ],
      [
        'an attack of a spell an item casts, failed for another reason',
        { status: 'failed', reason: 'consume', itemCast: true },
        'Not made at the table: there’s nothing left to use it with',
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

    describe('attacks', () => {
      const attack = roll({ label: 'Longsword attack', total: 19 })
      const preview = {
        critical: false,
        plannable: true,
        rolls: [
          {
            formula: '1d8 + 4',
            type: 'slashing',
            dice: [{ faces: 8, number: 1 }],
          },
        ],
      }
      const made = (fields: Partial<TableRollState> = {}): TableRollState => ({
        status: 'done',
        visible: true,
        total: 19,
        requestId: 'req-1',
        attack: { critical: false, fumble: false, outcome: 'hit' },
        damage: preview,
        ...fields,
      })

      it.each<[string, TableRollState['attack'], string]>([
        ['a hit', { critical: false, fumble: false, outcome: 'hit' }, 'Hit'],
        ['a miss', { critical: false, fumble: true, outcome: 'miss' }, 'Miss'],
        [
          'a critical hit',
          { critical: true, fumble: false, outcome: 'hit' },
          'Critical hit',
        ],
        [
          'a critical hit, the target hidden',
          { critical: true, fumble: false, outcome: null },
          'Critical hit',
        ],
      ])('says the game made %s', (_, outcome, text) => {
        render(
          <RollTray
            rolls={[attack]}
            rolling={false}
            table={table([['r1', made({ attack: outcome })]])}
          />,
        )

        expect(screen.getByRole('status')).toHaveTextContent(
          `At the table: 19 · ${text}`,
        )
      })

      it('says how many of those in its area an area attack hit, and which', () => {
        render(
          <RollTray
            rolls={[roll({ label: 'Breath Weapon attack', total: 17 })]}
            rolling={false}
            table={table([
              [
                'r1',
                made({
                  total: 17,
                  attack: {
                    critical: false,
                    fumble: false,
                    outcome: null,
                    targets: [
                      { combatId: 'c1', combatantId: 'g1', outcome: 'hit' },
                      { combatId: 'c1', combatantId: 'g2', outcome: 'miss' },
                      { combatId: 'c1', combatantId: 'g3', outcome: 'hit' },
                    ],
                  },
                  targetNames: { g1: 'Goblin', g2: 'Hobgoblin' },
                }),
              ],
            ])}
          />,
        )

        const status = screen.getByRole('status')
        expect(status).toHaveTextContent('At the table: 17 · Hit 2 of 3')
        expect(
          within(within(status).getByRole('list', { name: 'Targets' }))
            .getAllByRole('listitem')
            .map(item => item.textContent),
        ).toEqual(['Goblin: Hit', 'Hobgoblin: Miss', 'A target: Hit'])
      })

      it('says nothing of whom an area attack hit where the Gamemaster shows no hits', () => {
        render(
          <RollTray
            rolls={[roll({ label: 'Breath Weapon attack', total: 17 })]}
            rolling={false}
            table={table([
              [
                'r1',
                made({
                  total: 17,
                  attack: {
                    critical: true,
                    fumble: false,
                    outcome: null,
                    targets: [
                      { combatId: 'c1', combatantId: 'g1', outcome: null },
                      { combatId: 'c1', combatantId: 'g2', outcome: null },
                    ],
                  },
                }),
              ],
            ])}
          />,
        )

        expect(screen.getByRole('status')).toHaveTextContent(
          /At the table: 17 · Critical hit$/,
        )
        expect(screen.queryByRole('list', { name: 'Targets' })).toBeNull()
      })

      it('says no more than the total when the Gamemaster shows no hits', () => {
        render(
          <RollTray
            rolls={[attack]}
            rolling={false}
            table={table([
              [
                'r1',
                made({
                  attack: { critical: false, fumble: false, outcome: null },
                }),
              ],
            ])}
          />,
        )

        expect(screen.getByRole('status')).toHaveTextContent(
          /At the table: 19$/,
        )
      })

      it("offers the attack's damage to roll, as the game said it will be", async () => {
        const user = userEvent.setup()
        const rollDamage = jest.fn()
        render(
          <RollTray
            rolls={[attack]}
            rolling={false}
            table={table([['r1', made()]], { rollDamage })}
          />,
        )

        await user.click(screen.getByRole('button', { name: 'Roll damage' }))
        expect(rollDamage).toHaveBeenCalledWith('Longsword', {
          use: 'req-1',
          damage: preview,
        })
      })

      it('offers to roll it at its highest, or changed, where the game takes it so', async () => {
        const user = userEvent.setup()
        const rollDamage = jest.fn()
        const { rerender } = render(
          <RollTray
            rolls={[attack]}
            rolling={false}
            table={table([['r1', made()]], { rollDamage })}
          />,
        )
        fireEvent.contextMenu(
          screen.getByRole('button', { name: 'Roll damage' }),
        )
        expect(screen.queryByRole('menu')).toBeNull()

        rerender(
          <RollTray
            rolls={[attack]}
            rolling={false}
            table={table([['r1', made()]], { rollDamage, modifies: true })}
          />,
        )
        fireEvent.contextMenu(
          screen.getByRole('button', { name: 'Roll damage' }),
        )
        const menu = screen.getByRole('menu', {
          name: 'Longsword damage 1d8 + 4',
        })
        await user.click(
          within(menu).getByRole('menuitem', { name: 'Roll maximum damage' }),
        )
        expect(rollDamage).toHaveBeenLastCalledWith(
          'Longsword',
          { use: 'req-1', damage: preview },
          undefined,
          { maximize: true },
        )

        // A die more, as the game will throw it.
        fireEvent.contextMenu(
          screen.getByRole('button', { name: 'Roll damage' }),
        )
        await user.click(
          screen.getByRole('menuitem', { name: 'Modify damage…' }),
        )
        const dialog = screen.getByRole('dialog', { name: 'Modify damage' })
        await user.click(
          within(dialog).getByRole('button', { name: 'One die more' }),
        )
        expect(within(dialog).getByRole('status')).toHaveTextContent(
          '2d8 + 4 slashing',
        )
        // The game decides a critical hit.
        expect(
          within(dialog).queryByRole('switch', { name: /^Critical/ }),
        ).toBe(null)
        await user.click(within(dialog).getByRole('button', { name: 'Roll' }))
        expect(rollDamage).toHaveBeenLastCalledWith(
          'Longsword',
          { use: 'req-1', damage: preview },
          undefined,
          { extra: 1 },
        )
      })

      it("changes a critical hit's own first die, never its critical damage's, and offers no die to change where it has none of its own", async () => {
        const user = userEvent.setup()
        const rollDamage = jest.fn()
        // A greataxe's critical hit: 3d12 + 3, and the weapon's 1d6.
        const greataxe = {
          ...preview,
          critical: true,
          rolls: [
            {
              formula: '3d12 + 3 + 1d6',
              type: 'Slashing',
              dice: [
                { faces: 12, number: 3 },
                { faces: 6, number: 1, added: true as const },
              ],
              perDie: 2,
            },
          ],
        }
        const { unmount } = render(
          <RollTray
            rolls={[attack]}
            rolling={false}
            table={table([['r1', made({ damage: greataxe })]], {
              rollDamage,
              modifies: true,
            })}
          />,
        )
        fireEvent.contextMenu(
          screen.getByRole('button', { name: 'Roll critical damage' }),
        )
        await user.click(
          screen.getByRole('menuitem', { name: 'Modify damage…' }),
        )
        const dialog = screen.getByRole('dialog', { name: 'Modify damage' })
        await user.click(
          within(dialog).getByRole('button', { name: 'One die more' }),
        )
        await user.click(within(dialog).getByRole('radio', { name: 'd10' }))
        expect(within(dialog).getByRole('status')).toHaveTextContent(
          '5d10 + 3 + 1d6 Slashing',
        )
        unmount()

        // "3 + 1d6": a number, and the weapon's critical damage.
        render(
          <RollTray
            rolls={[attack]}
            rolling={false}
            table={table(
              [
                [
                  'r1',
                  made({
                    damage: {
                      ...greataxe,
                      rolls: [
                        {
                          ...greataxe.rolls[0],
                          formula: '3 + 1d6',
                          dice: [{ faces: 6, number: 1, added: true }],
                        },
                      ],
                    },
                  }),
                ],
              ],
              { rollDamage, modifies: true },
            )}
          />,
        )
        fireEvent.contextMenu(
          screen.getByRole('button', { name: 'Roll critical damage' }),
        )
        expect(
          within(screen.getByRole('menu'))
            .getAllByRole('menuitem')
            .map(item => item.textContent),
        ).toEqual(['Roll maximum damage'])
      })

      describe('that takes a die away', () => {
        /** A greataxe under Reduce, as the game marks it: 1d12 + 3, less 1d4. */
        const reduced = {
          ...preview,
          rolls: [
            {
              formula: '1d12 + 3 - 1d4',
              type: 'Slashing',
              dice: [
                { faces: 12, number: 1 },
                { faces: 4, number: 1, subtracted: true as const },
              ],
            },
          ],
        }
        /** A Reduced Unarmed Strike: 1 + 3, less 1d4, which adds no die of its own. */
        const unarmed = {
          ...preview,
          rolls: [
            {
              formula: '1 + 3 - 1d4',
              type: 'Bludgeoning',
              dice: [{ faces: 4, number: 1, subtracted: true as const }],
            },
          ],
        }
        const rendered = (damage: typeof preview, rollDamage = jest.fn()) =>
          render(
            <RollTray
              rolls={[attack]}
              rolling={false}
              table={table([['r1', made({ damage })]], {
                rollDamage,
                modifies: true,
              })}
            />,
          )

        it('offers no menu where there is nothing to change, a long-press doing nothing and a tap rolling it', () => {
          const rollDamage = jest.fn()
          rendered(unarmed, rollDamage)
          const button = screen.getByRole('button', { name: 'Roll damage' })

          fireEvent.contextMenu(button)
          expect(screen.queryByRole('menu')).toBeNull()
          jest.useFakeTimers()
          try {
            fireEvent.pointerDown(button, {
              pointerType: 'touch',
              clientX: 20,
              clientY: 10,
            })
            act(() => jest.advanceTimersByTime(LONG_PRESS))
            expect(screen.queryByRole('menu')).toBeNull()
            fireEvent.pointerUp(button, { pointerType: 'touch' })
            fireEvent.click(button)
            expect(rollDamage).not.toHaveBeenCalled()
          } finally {
            jest.useRealTimers()
          }

          fireEvent.click(button)
          expect(rollDamage).toHaveBeenCalledWith('Longsword', {
            use: 'req-1',
            damage: unarmed,
          })
        })

        it('changes the die it adds, never at its highest, the die it takes away as it is', async () => {
          const user = userEvent.setup()
          const rollDamage = jest.fn()
          rendered(reduced, rollDamage)

          fireEvent.contextMenu(
            screen.getByRole('button', { name: 'Roll damage' }),
          )
          const menu = screen.getByRole('menu', {
            name: 'Longsword damage 1d12 + 3 - 1d4',
          })
          expect(
            within(menu)
              .getAllByRole('menuitem')
              .map(item => item.textContent),
          ).toEqual(['Modify damage…'])
          await user.click(
            within(menu).getByRole('menuitem', { name: 'Modify damage…' }),
          )
          const dialog = screen.getByRole('dialog', { name: 'Modify damage' })
          expect(
            within(dialog).queryByRole('switch', { name: /^Maximum/ }),
          ).toBeNull()
          await user.click(
            within(dialog).getByRole('button', { name: 'One die more' }),
          )
          expect(within(dialog).getByRole('status')).toHaveTextContent(
            '2d12 + 3 − 1d4 Slashing',
          )
          await user.click(within(dialog).getByRole('button', { name: 'Roll' }))
          expect(rollDamage).toHaveBeenLastCalledWith(
            'Longsword',
            { use: 'req-1', damage: reduced },
            undefined,
            { extra: 1 },
          )
        })

        it.each<[string, typeof preview, RegExp]>([
          [
            'the first it adds, never one it takes away',
            reduced,
            /^The first die it adds, never one it takes away, such as a versatile/,
          ],
          [
            'its first die, where it takes none away',
            {
              ...preview,
              rolls: [
                {
                  formula: '1d8 + 3',
                  type: 'Slashing',
                  dice: [{ faces: 8, number: 1 }],
                },
              ],
            },
            /^Its first die, such as a versatile weapon's in two hands/,
          ],
        ])('says which die is changed: %s', async (_, damage, hint) => {
          const user = userEvent.setup()
          rendered(damage)

          fireEvent.contextMenu(
            screen.getByRole('button', { name: 'Roll damage' }),
          )
          await user.click(
            screen.getByRole('menuitem', { name: 'Modify damage…' }),
          )
          const dialog = screen.getByRole('dialog', { name: 'Modify damage' })
          expect(within(dialog).getByText(hint)).toBeInTheDocument()
        })

        it.each<[string, string, string[] | undefined]>([
          ['takes a die away: no menu', '1d3 + 3 - 1d4', undefined],
          [
            'takes one away as Foundry may wrap a leading die: no menu',
            '(1d4 * -1) + 2d6',
            undefined,
          ],
          [
            'takes none away: at its highest',
            '1d3 + 3',
            ['Roll maximum damage'],
          ],
          ['explodes a die: no menu', '1d6x + 1d3', undefined],
        ])(
          'offers damage the game rolls itself, whose formula %s',
          (_, formula, items) => {
            rendered({
              ...preview,
              plannable: false,
              rolls: [{ formula, type: 'Bludgeoning', dice: [] }],
            })
            fireEvent.contextMenu(
              screen.getByRole('button', { name: 'Roll damage' }),
            )
            const menu = screen.queryByRole('menu')
            if (items) {
              expect(
                within(menu as HTMLElement)
                  .getAllByRole('menuitem')
                  .map(item => item.textContent),
              ).toEqual(items)
            } else {
              expect(menu).toBeNull()
            }
          },
        )

        it('offers no maximum where its formula explodes a die, though the app reads it as its dice alone', () => {
          // More than the app reads as a number: its die alone, no explosion to be seen.
          rendered({
            ...preview,
            rolls: [
              {
                formula: '1d6x + 120',
                type: 'Thunder',
                dice: [{ faces: 6, number: 1 }],
              },
            ],
          })
          fireEvent.contextMenu(
            screen.getByRole('button', { name: 'Roll damage' }),
          )
          expect(
            within(screen.getByRole('menu'))
              .getAllByRole('menuitem')
              .map(item => item.textContent),
          ).toEqual(['Modify damage…'])
        })

        it('changes none of the dice where a module before 0.21.0 would change the one it takes away', () => {
          // "-1d4 + 2d6", unmarked: such a module would add to the d4.
          rendered({
            ...preview,
            rolls: [
              {
                formula: '- 1d4 + 2d6',
                type: 'Necrotic',
                dice: [
                  { faces: 4, number: 1 },
                  { faces: 6, number: 2 },
                ],
              },
            ],
          })
          fireEvent.contextMenu(
            screen.getByRole('button', { name: 'Roll damage' }),
          )
          expect(screen.queryByRole('menu')).toBeNull()
        })
      })

      it("offers a critical hit's damage as such", () => {
        render(
          <RollTray
            rolls={[attack]}
            rolling={false}
            table={table(
              [['r1', made({ damage: { ...preview, critical: true } })]],
              { rollDamage: jest.fn() },
            )}
          />,
        )

        expect(
          screen.getByRole('button', { name: 'Roll critical damage' }),
        ).toBeInTheDocument()
      })

      it.each<[string, TableRollState]>([
        ['once its damage is on its way', made({ damaged: true })],
        ['when no damage follows', made({ damage: null })],
        ['until the game has made it', { status: 'rolling' }],
        [
          'when the game did not make it',
          { status: 'failed', reason: 'target' },
        ],
      ])('offers no damage %s', (_, state) => {
        render(
          <RollTray
            rolls={[attack]}
            rolling={false}
            table={table([['r1', state]], { rollDamage: jest.fn() })}
          />,
        )

        expect(screen.queryByRole('button', { name: /damage/ })).toBeNull()
      })

      it("says where an attack's damage is at the table, and its total there", () => {
        const { rerender } = render(
          <RollTray
            rolls={[damage()]}
            rolling={false}
            table={table([['d1', { status: 'rolling' }]])}
          />,
        )
        expect(screen.getByRole('status')).toHaveTextContent(
          /Rolling in your Gamemaster’s game…$/,
        )

        rerender(
          <RollTray
            rolls={[damage()]}
            rolling={false}
            table={table([
              ['d1', { status: 'done', visible: true, total: 16 }],
            ])}
          />,
        )
        expect(screen.getByRole('status')).toHaveTextContent(
          /At the table: 16$/,
        )

        rerender(
          <RollTray
            rolls={[damage()]}
            rolling={false}
            table={table([['d1', { status: 'refused', reason: 'damaged' }]])}
          />,
        )
        expect(screen.getByRole('status')).toHaveTextContent(
          /Not made at the table: its damage is rolled already$/,
        )
      })

      it('shows the total of damage the game rolls itself, once it has', async () => {
        const user = userEvent.setup()
        const theirs = damage({
          label: 'Club damage',
          total: 0,
          parts: [{ type: 'bludgeoning', total: 0, terms: [] }],
        })
        const { rerender } = render(
          <RollTray
            rolls={[theirs]}
            rolling={false}
            table={table([['d1', { status: 'rolling' }]])}
          />,
        )
        expect(screen.getByRole('status')).toHaveTextContent(
          '…Club damageIts dice are rolled in your Gamemaster’s game',
        )

        const made = table([
          ['d1', { status: 'done', visible: true, total: 3 }],
        ])
        rerender(<RollTray rolls={[theirs]} rolling={false} table={made} />)
        expect(screen.getByRole('status')).toHaveTextContent(
          /^3Club damage.*At the table: 3$/,
        )

        rerender(
          <RollTray
            rolls={[roll({ id: 'r2' }), theirs]}
            rolling={false}
            table={made}
          />,
        )
        await user.click(screen.getByText('Earlier rolls (1)'))
        expect(screen.getByRole('listitem')).toHaveTextContent(
          'Club damagerolled at the table· table 3',
        )
      })

      it("shows the game's total of a critical hit's whose dice its rules change as only it adds them up, once it says", () => {
        const critical = damage({
          label: 'Flame damage',
          total: 10,
          critical: true,
          gameTotal: true,
          described: true,
          parts: [
            {
              type: 'fire',
              total: 10,
              terms: [{ text: '4d6', values: [1, 2, 3, 4], value: 10 }],
            },
          ],
        })
        const { rerender } = render(
          <RollTray
            rolls={[critical]}
            rolling={false}
            table={table([['d1', { status: 'rolling' }]])}
          />,
        )
        expect(screen.getByRole('status')).toHaveTextContent(
          /^10Flame damage4d6 \(1, 2, 3, 4\) fire · Critical hit/,
        )

        rerender(
          <RollTray
            rolls={[critical]}
            rolling={false}
            table={table([
              ['d1', { status: 'done', visible: true, total: 24 }],
            ])}
          />,
        )
        expect(screen.getByRole('status')).toHaveTextContent(
          /^24Flame damage4d6 \(1, 2, 3, 4\) fire · Critical hit.*At the table: 24$/,
        )

        // One the game didn't take is the player's own.
        rerender(
          <RollTray
            rolls={[critical]}
            rolling={false}
            table={table([['d1', { status: 'refused', reason: 'dice' }]])}
          />,
        )
        expect(screen.getByRole('status')).toHaveTextContent(/^10Flame damage/)
      })

      it('strikes through the dice rerolled or dropped of a roll of the player’s own; at the table, shows only the first throw, which the game was sent, and the game’s total, once it says', async () => {
        const user = userEvent.setup()
        const rerolled = damage({
          label: 'Greatsword damage',
          total: 16,
          gameTotal: true,
          parts: [
            {
              type: 'slashing',
              total: 16,
              terms: [
                {
                  text: '2d6r<=2',
                  values: [1, 5],
                  value: 9,
                  thrown: [
                    { value: 1, active: false, rerolled: true },
                    { value: 5, active: true },
                    { value: 4, active: true },
                  ],
                },
                { text: '+7', values: [], value: 7 },
              ],
            },
          ],
        })
        // The player's own: every die thrown here, the 1 rerolled struck through.
        const { rerender } = render(
          <RollTray rolls={[rerolled]} rolling={false} />,
        )
        const status = screen.getByRole('status')
        expect(status).toHaveTextContent(
          /^16Greatsword damage2d6r<=2 \(1, 5, 4\) \+7 slashing$/,
        )
        expect(within(status).getByText('1').tagName).toBe('S')

        // At the table, the game throws the 1 again with its own dice: the first throw, and no
        // total until the game says.
        rerender(
          <RollTray
            rolls={[rerolled]}
            rolling={false}
            table={table([['d1', { status: 'rolling' }]])}
          />,
        )
        expect(status).toHaveTextContent(
          /^…Greatsword damage2d6r<=2 \(1, 5\) \+7 slashing · Rerolls thrown in your/,
        )
        expect(within(status).queryByText('4')).not.toBeInTheDocument()
        expect(status.querySelector('s')).toBeNull()

        rerender(
          <RollTray
            rolls={[rerolled]}
            rolling={false}
            table={table([
              ['d1', { status: 'done', visible: true, total: 18 }],
            ])}
          />,
        )
        expect(status).toHaveTextContent(
          /^18Greatsword damage2d6r<=2 \(1, 5\) \+7 slashing · Rerolls thrown/,
        )

        // Among the earlier rolls, it says the game threw again, with the game's total, not this
        // phone's.
        rerender(
          <RollTray
            rolls={[roll({ id: 'r2' }), rerolled]}
            rolling={false}
            table={table([
              ['d1', { status: 'done', visible: true, total: 18 }],
            ])}
          />,
        )
        await user.click(screen.getByText('Earlier rolls (1)'))
        expect(screen.getByRole('listitem')).toHaveTextContent(
          'Greatsword damagethrown again at the table· table 18',
        )

        // One the game didn't take is the player's own, every die thrown here.
        rerender(
          <RollTray
            rolls={[rerolled]}
            rolling={false}
            table={table([['d1', { status: 'refused', reason: 'dice' }]])}
          />,
        )
        expect(screen.getByRole('status')).toHaveTextContent(
          /^16Greatsword damage2d6r<=2 \(1, 5, 4\) \+7 slashing/,
        )

        // A formula's, the same.
        const exploded: LocalFormula = {
          kind: 'formula',
          id: 'f1',
          label: 'Wild Magic roll',
          total: 6,
          healing: false,
          gameTotal: true,
          terms: [
            {
              text: '1d4x',
              values: [4],
              value: 6,
              thrown: [
                { value: 4, active: true, exploded: true },
                { value: 2, active: true },
              ],
            },
          ],
          at: 0,
        }
        rerender(<RollTray rolls={[exploded]} rolling={false} />)
        expect(screen.getByRole('status')).toHaveTextContent(
          /^6Wild Magic roll1d4x \(4, 2\)$/,
        )
        rerender(
          <RollTray
            rolls={[exploded]}
            rolling={false}
            table={table([['f1', { status: 'rolling' }]])}
          />,
        )
        expect(screen.getByRole('status')).toHaveTextContent(
          /^…Wild Magic roll1d4x \(4\) · Rerolls thrown in your Gamemaster’s game/,
        )
        rerender(
          <RollTray
            rolls={[exploded]}
            rolling={false}
            table={table([['f1', { status: 'done', visible: true, total: 9 }]])}
          />,
        )
        expect(screen.getByRole('status')).toHaveTextContent(
          /^9Wild Magic roll1d4x \(4\)/,
        )
      })

      it('keeps every die of a roll whose dice Foundry only keeps or drops, which the game works out from the same throw', () => {
        const kept = damage({
          label: 'Lucky damage',
          total: 9,
          gameTotal: true,
          parts: [
            {
              type: 'fire',
              total: 9,
              terms: [
                {
                  text: '4d6kh3',
                  values: [1, 2, 3, 4],
                  value: 9,
                  thrown: [
                    { value: 1, active: false },
                    { value: 2, active: true },
                    { value: 3, active: true },
                    { value: 4, active: true },
                  ],
                },
              ],
            },
          ],
        })
        render(
          <RollTray
            rolls={[kept]}
            rolling={false}
            table={table([['d1', { status: 'rolling' }]])}
          />,
        )
        const status = screen.getByRole('status')
        expect(status).toHaveTextContent(
          /^9Lucky damage4d6kh3 \(1, 2, 3, 4\) fire/,
        )
        expect(status).not.toHaveTextContent('Rerolls thrown')
        expect(within(status).getByText('1').tagName).toBe('S')
      })

      it('names attacks among the rolls made at the table, when the game takes them', () => {
        render(
          <RollTray
            rolls={[]}
            rolling={false}
            table={table([], { takes: kind => kind === 'attack' })}
          />,
        )

        expect(
          screen.getByText(
            'Checks, saves and attacks you roll here are made in your Gamemaster’s game too, with the same dice.',
          ),
        ).toBeInTheDocument()
      })

      it('offers the kinds of damage the game lets the attacker choose, a button each', async () => {
        const user = userEvent.setup()
        const rollDamage = jest.fn()
        const orb = {
          ...preview,
          rolls: [
            {
              formula: '3d8',
              type: 'acid',
              types: [
                { key: 'acid', label: 'Acid' },
                { key: 'fire', label: 'Fire' },
              ],
              dice: [{ faces: 8, number: 3 }],
            },
          ],
        }
        render(
          <RollTray
            rolls={[roll({ label: 'Chromatic Orb attack', total: 17 })]}
            rolling={false}
            table={table([['r1', made({ damage: orb })]], { rollDamage })}
          />,
        )

        expect(screen.getByRole('status')).toHaveTextContent(
          'Choose its kind of damage:AcidFire',
        )
        expect(screen.queryByRole('button', { name: 'Roll damage' })).toBeNull()
        await user.click(
          screen.getByRole('button', { name: 'Roll Fire damage' }),
        )
        expect(rollDamage).toHaveBeenCalledWith(
          'Chromatic Orb',
          { use: 'req-1', damage: orb },
          'fire',
        )
      })
    })

    describe('spells and features', () => {
      const fireball: LocalUse = {
        kind: 'use',
        id: 'u1',
        label: 'Fireball',
        spell: true,
        at: 0,
      }
      const secondWind: LocalUse = {
        ...fireball,
        label: 'Second Wind',
        spell: false,
      }
      // Cast from a wand, at a level it offers, and Hex's damage after it's cast from a flame.
      const wandMissile: LocalUse = {
        ...fireball,
        label: 'Magic Missile',
        itemCast: true,
      }
      const hexDamage: LocalUse = {
        ...fireball,
        label: 'Bonus Hex Damage',
        spell: false,
        itemCast: true,
      }
      const fire = {
        critical: false,
        plannable: true,
        rolls: [
          { formula: '8d6', type: 'fire', dice: [{ faces: 6, number: 8 }] },
        ],
      }
      const heal = {
        critical: false,
        plannable: true,
        healing: true,
        rolls: [
          {
            formula: '1d10 + 5',
            type: 'healing',
            dice: [{ faces: 10, number: 1 }],
          },
        ],
      }
      const used = (fields: Partial<TableRollState> = {}): TableRollState => ({
        status: 'done',
        visible: true,
        requestId: 'req-1',
        use: { type: 'save' },
        damage: fire,
        ...fields,
      })

      it.each<[string, LocalUse, TableRollState, string]>([
        [
          'on its way',
          fireball,
          { status: 'sending' },
          'Sending to your Gamemaster’s game…',
        ],
        [
          'being cast',
          fireball,
          { status: 'rolling' },
          'Casting it in your Gamemaster’s game…',
        ],
        [
          'being used',
          secondWind,
          { status: 'rolling' },
          'Using it in your Gamemaster’s game…',
        ],
        [
          'cast, its damage to follow',
          fireball,
          used(),
          'Cast at the table, its damage to follow',
        ],
        [
          'used, its healing to follow',
          secondWind,
          used({ use: { type: 'heal' }, damage: heal }),
          'Used at the table, its healing to follow',
        ],
        [
          'cast, with nothing to follow',
          fireball,
          used({ use: { type: 'utility' }, damage: null }),
          'Cast at the table',
        ],
        [
          'cast, its damage sent',
          fireball,
          used({ damaged: true }),
          'Cast at the table',
        ],
        [
          'refused',
          fireball,
          { status: 'refused', reason: 'slot' },
          'Not cast at the table: that spell slot can’t cast it',
        ],
        [
          'failed in the game',
          secondWind,
          { status: 'failed', reason: 'consume' },
          'Not used at the table: there’s nothing left to use it with',
        ],
        [
          'cast from an item, refused at a level it no longer offers',
          wandMissile,
          { status: 'refused', reason: 'slot', itemCast: true },
          'Not cast at the table: the item can’t cast it at that level now',
        ],
        [
          'cast from an item, failed in the game at a level it no longer offers',
          wandMissile,
          { status: 'failed', reason: 'slot', itemCast: true },
          'Not cast at the table: the item can’t cast it at that level now',
        ],
        [
          'used after it’s cast from an item, at a level the item no longer offers',
          hexDamage,
          { status: 'failed', reason: 'slot', itemCast: true },
          'Not used at the table: the item can’t cast it at that level now',
        ],
        [
          'cast from an item, with no charges left',
          wandMissile,
          { status: 'failed', reason: 'consume', itemCast: true },
          'Not cast at the table: there’s nothing left to use it with',
        ],
        [
          'failed for a reason it does not know',
          secondWind,
          { status: 'failed', reason: 'gremlins' },
          'Not used at the table',
        ],
      ])('says where a use is when %s', (_, use, state, text) => {
        render(
          <RollTray
            rolls={[use]}
            rolling={false}
            table={table([['u1', state]], { rollDamage: jest.fn() })}
          />,
        )

        expect(screen.getByRole('status')).toHaveTextContent(
          new RegExp(`^${use.label}${text}$`),
        )
        // Its damage or healing is rolled for it, with no button.
        expect(screen.queryByRole('button')).toBeNull()
      })

      it.each([
        ['activity', 'it can’t be used from Sending Stone'],
        ['target', 'a target can’t be picked, or there are too many'],
        ['type', 'it can’t deal that kind of damage'],
        ['mode', 'the weapon can’t attack that way'],
        ['ammo', 'you have none of that ammunition left'],
        ['no-damage', 'no damage follows it'],
      ])('says why when the game refuses it for %s', (reason, text) => {
        render(
          <RollTray
            rolls={[fireball]}
            rolling={false}
            table={table([['u1', { status: 'failed', reason }]])}
          />,
        )

        expect(screen.getByRole('status')).toHaveTextContent(
          `Not cast at the table: ${text}`,
        )
      })

      it('offers the kinds of damage the game lets the caster choose, a button each, before it is rolled', async () => {
        const user = userEvent.setup()
        const rollDamage = jest.fn()
        const breath = {
          ...fire,
          rolls: [
            {
              formula: '3d6',
              type: 'acid',
              types: [
                { key: 'acid', label: 'Acid' },
                { key: 'cold', label: 'Cold' },
                { key: 'fire', label: 'Fire' },
              ],
              dice: [{ faces: 6, number: 3 }],
            },
          ],
        }
        render(
          <RollTray
            rolls={[{ ...fireball, label: 'Dragon’s Breath' }]}
            rolling={false}
            table={table([['u1', used({ damage: breath })]], { rollDamage })}
          />,
        )

        expect(screen.getByRole('status')).toHaveTextContent(
          /^Dragon’s BreathCast at the tableChoose its kind of damage:AcidColdFire$/,
        )
        await user.click(
          screen.getByRole('button', { name: 'Roll Cold damage' }),
        )
        expect(rollDamage).toHaveBeenCalledWith(
          'Dragon’s Breath',
          { use: 'req-1', damage: breath },
          'cold',
        )
      })

      it('offers the kinds of healing to choose by their names', () => {
        render(
          <RollTray
            rolls={[secondWind]}
            rolling={false}
            table={table(
              [
                [
                  'u1',
                  used({
                    damage: {
                      ...heal,
                      rolls: [
                        {
                          ...heal.rolls[0],
                          types: [
                            { key: 'healing', label: 'Healing' },
                            { key: 'temphp', label: 'Temporary Hit Points' },
                          ],
                        },
                      ],
                    },
                  }),
                ],
              ],
              { rollDamage: jest.fn() },
            )}
          />,
        )

        expect(screen.getByRole('status')).toHaveTextContent(
          'Choose its kind of healing:',
        )
        expect(
          screen.getAllByRole('button').map(button => button.ariaLabel),
        ).toEqual(['Roll Healing', 'Roll Temporary Hit Points'])
      })

      it('marks each earlier use with how it went at the table', async () => {
        const user = userEvent.setup()
        render(
          <RollTray
            rolls={[
              roll({ id: 'r1' }),
              fireball,
              { ...secondWind, id: 'u2' },
              { ...fireball, id: 'u3', label: 'Shield' },
            ]}
            rolling={false}
            table={table([
              ['u1', used()],
              ['u2', { status: 'rolling' }],
              ['u3', { status: 'failed', reason: 'reaction' }],
            ])}
          />,
        )

        await user.click(screen.getByText('Earlier rolls (3)'))

        expect(
          screen.getAllByRole('listitem').map(item => item.textContent),
        ).toEqual([
          'Fireballcast· at the table',
          'Second Windused· sending',
          'Shieldcast· not at the table',
        ])
      })

      it('names spells among the rolls made at the table, when the game takes them', () => {
        render(
          <RollTray
            rolls={[]}
            rolling={false}
            table={table([], {
              takes: kind => ['attack', 'use'].includes(kind),
            })}
          />,
        )

        expect(
          screen.getByText(
            'Checks, saves, attacks and spells you roll or cast here are made in your Gamemaster’s game too, with the same dice.',
          ),
        ).toBeInTheDocument()
      })
    })

    it('says how many hit points a hit die spent at the table gave back', () => {
      render(
        <RollTray
          rolls={[hitDie()]}
          rolling={false}
          table={table([
            ['h1', { status: 'done', visible: true, total: 9, healed: 4 }],
          ])}
        />,
      )

      expect(screen.getByRole('status')).toHaveTextContent(
        /1d10 \(7\) \+2At the table: 9 · 4 HP regained$/,
      )
    })

    it.each([
      ['self-test', 'your Gamemaster’s game can’t make it with your dice'],
      ['area', 'your Gamemaster’s game can’t make that area attack from here'],
    ])(
      'says what the game refusing it as %s means, whatever was rolled',
      (reason, text) => {
        render(
          <RollTray
            rolls={[hitDie()]}
            rolling={false}
            table={table([['h1', { status: 'failed', reason }]])}
          />,
        )

        expect(screen.getByRole('status')).toHaveTextContent(
          `Not made at the table: ${text}`,
        )
      },
    )

    describe('hit dice spent at once, a request a die', () => {
      const three = hitDie({
        label: 'Hit dice (3d10)',
        total: 22,
        terms: [
          { text: '3d10', values: [6, 2, 5], value: 13 },
          { text: '+9', values: [], value: 9 },
        ],
        times: 3,
      })
      const renderState = (state: TableRollState) =>
        render(
          <RollTray
            rolls={[three, { ...three, id: 'h0' }]}
            rolling={false}
            table={table([
              ['h1', state],
              ['h0', state],
            ])}
          />,
        )

      it.each<[string, TableRollState, string]>([
        [
          'the first on its way',
          { status: 'sending', together: { count: 3, made: 0 } },
          'Sending die 1 of 3 to your Gamemaster’s game… Keep this page open until they’re all sent.',
        ],
        [
          'the second being made',
          {
            status: 'rolling',
            visible: true,
            total: 9,
            healed: 9,
            together: { count: 3, made: 1 },
          },
          'Rolling die 2 of 3 in your Gamemaster’s game… Keep this page open until they’re all sent.',
        ],
      ])(
        'says where they are, %s, and that the rest are sent from this page',
        (_, state, text) => {
          renderState(state)

          expect(screen.getByRole('status')).toHaveTextContent(
            new RegExp(`${text}$`),
          )
        },
      )

      it('says what they all came to at the table, and gave back, once each is made', async () => {
        const user = userEvent.setup()
        renderState({
          status: 'done',
          visible: true,
          total: 22,
          healed: 20,
          together: { count: 3, made: 3 },
        })

        expect(screen.getByRole('status')).toHaveTextContent(
          /3d10 \(6, 2, 5\) \+9At the table: 22 · 20 HP regained$/,
        )
        await user.click(screen.getByText('Earlier rolls (1)'))
        expect(screen.getByRole('listitem')).toHaveTextContent(
          'Hit dice (3d10)13 +9 = 22· table 22',
        )
      })

      it('says how many were made before one was not, what they gave back, and why not the rest', async () => {
        const user = userEvent.setup()
        renderState({
          status: 'refused',
          reason: 'no-hit-dice',
          visible: true,
          total: 9,
          healed: 9,
          together: { count: 3, made: 1 },
        })

        expect(screen.getByRole('status')).toHaveTextContent(
          new RegExp(
            String.raw`\+91 of 3 made at the table · 9 HP regained\. ` +
              'Not the rest: you have no hit dice of that size left$',
          ),
        )
        expectOneRun(screen.getByText(/made at the table/))
        await user.click(screen.getByText('Earlier rolls (1)'))
        expect(screen.getByRole('listitem')).toHaveTextContent(
          /= 22· 1 of 3 at the table$/,
        )
      })

      it('says none was made where the first was not', () => {
        renderState({
          status: 'failed',
          reason: 'no-hit-dice',
          together: { count: 3, made: 0 },
        })

        expect(screen.getByRole('status')).toHaveTextContent(
          /\+9Not made at the table: you have no hit dice of that size left$/,
        )
      })
    })

    describe('hit dice spent at once as one request, from module 0.20.0', () => {
      const three = hitDie({
        label: 'Hit dice (2d10 + 1d8)',
        total: 22,
        terms: [
          { text: '2d10', values: [6, 2], value: 8 },
          { text: '+1d8', values: [5], value: 5 },
          { text: '+9', values: [], value: 9 },
        ],
        times: 3,
      })
      const renderState = (state: TableRollState) =>
        render(
          <RollTray
            rolls={[three, { ...three, id: 'h0' }]}
            rolling={false}
            table={table([
              ['h1', state],
              ['h0', state],
            ])}
          />,
        )

      it.each<[string, TableRollState, string]>([
        ['on their way', { status: 'sending' }, 'Sending to'],
        ['being made', { status: 'rolling' }, 'Rolling in'],
      ])(
        'says where they are, %s, as one, with nothing more to send from this page',
        (_, state, text) => {
          renderState(state)

          const status = screen.getByRole('status')
          expect(status).toHaveTextContent(
            new RegExp(String.raw`\+9${text} your Gamemaster’s game…$`),
          )
          expect(status).not.toHaveTextContent(/die \d of \d/)
          expect(status).not.toHaveTextContent('Keep this page open')
        },
      )

      it('says what they all came to at the table, and gave back', () => {
        renderState({
          status: 'done',
          visible: true,
          total: 22,
          healed: 20,
          spent: { count: 3, made: 3 },
        })

        expect(screen.getByRole('status')).toHaveTextContent(
          /2d10 \(6, 2\) \+1d8 \(5\) \+9At the table: 22 · 20 HP regained$/,
        )
      })

      it('says how many the game made before it stopped, what they gave back, and why not the rest', async () => {
        const user = userEvent.setup()
        renderState({
          status: 'failed',
          reason: 'full-hp',
          visible: true,
          total: 9,
          healed: 9,
          spent: { count: 3, made: 1 },
          together: { count: 3, made: 1 },
        })

        expect(screen.getByRole('status')).toHaveTextContent(
          new RegExp(
            String.raw`\+91 of 3 made at the table · 9 HP regained\. ` +
              'Not the rest: you’re at full hit points$',
          ),
        )
        expectOneRun(screen.getByText(/made at the table/))
        await user.click(screen.getByText('Earlier rolls (1)'))
        expect(screen.getByRole('listitem')).toHaveTextContent(
          /= 22· 1 of 3 at the table$/,
        )
      })

      it('says how many the game made before it stopped, but not what they gave back, where it made them blind', () => {
        renderState({
          status: 'failed',
          reason: 'timeout',
          visible: false,
          spent: { count: 3, made: 2 },
          together: { count: 3, made: 2 },
        })

        expect(screen.getByRole('status')).toHaveTextContent(
          /\+92 of 3 made at the table\. Not the rest: the game took too long$/,
        )
      })

      it('says none was made where the game spent none, as at full hit points', () => {
        renderState({ status: 'failed', reason: 'full-hp' })

        expect(screen.getByRole('status')).toHaveTextContent(
          /\+9Not made at the table: you’re at full hit points$/,
        )
      })

      it.each<[string, TableRollState, string]>([
        [
          'refused before any was spent',
          { status: 'refused', reason: 'no-hit-dice', hitDice: true },
          String.raw`\+9Not made at the table`,
        ],
        [
          'refused in the game before any was spent',
          { status: 'failed', reason: 'no-hit-dice', hitDice: true },
          String.raw`\+9Not made at the table`,
        ],
        [
          'stopped part way',
          {
            status: 'failed',
            reason: 'no-hit-dice',
            hitDice: true,
            visible: true,
            total: 9,
            healed: 9,
            spent: { count: 3, made: 1 },
            together: { count: 3, made: 1 },
          },
          String.raw`\+91 of 3 made at the table · 9 HP regained\. Not the rest`,
        ],
      ])(
        'says there are not that many left, not none of a size, where they were %s for want of dice',
        (_, state, text) => {
          renderState(state)

          const status = screen.getByRole('status')
          expect(status).toHaveTextContent(
            new RegExp(`${text}: you haven’t that many hit dice left$`),
          )
          expect(status).not.toHaveTextContent('of that size')
        },
      )
    })

    it('says why a hit die was not spent at the table', () => {
      render(
        <RollTray
          rolls={[hitDie()]}
          rolling={false}
          table={table([['h1', { status: 'failed', reason: 'no-hit-dice' }]])}
        />,
      )

      expect(screen.getByRole('status')).toHaveTextContent(
        'Not made at the table: you have no hit dice of that size left',
      )
    })

    it.each([
      [['hitDie'], 'Checks, saves and hit dice you roll or spend here'],
      [
        ['attack', 'hitDie'],
        'Checks, saves, attacks and hit dice you roll or spend here',
      ],
    ])(
      'names hit dice among what is made at the table without spells too (%j)',
      (kinds, text) => {
        render(
          <RollTray
            rolls={[]}
            rolling={false}
            table={table([], { takes: kind => kinds.includes(kind) })}
          />,
        )

        expect(
          screen.getByText(
            `${text} are made in your Gamemaster’s game too, with the same dice.`,
          ),
        ).toBeInTheDocument()
      },
    )

    it('names hit dice among what is made at the table, when the game takes them', () => {
      render(
        <RollTray
          rolls={[]}
          rolling={false}
          table={table([], {
            takes: kind => ['attack', 'use', 'hitDie'].includes(kind),
          })}
        />,
      )

      expect(
        screen.getByText(
          'Checks, saves, attacks, spells and hit dice you roll, cast or spend here are made in your Gamemaster’s game too, with the same dice.',
        ),
      ).toBeInTheDocument()
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
            [
              'r4',
              { status: 'done', visible: true, total: 19, outcome: 'success' },
            ],
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
        'Perception check12 +4 = 16· table 19, saved',
        'Perception check12 +4 = 16· hidden',
        'Perception check12 +4 = 16· sending',
        'Perception check12 +4 = 16· not at the table',
      ])
    })

    it('says rolls go to the table, or that Settings keeps them on this device, with no switch of its own', () => {
      const { rerender } = render(
        <RollTray rolls={[]} rolling={false} table={table()} />,
      )

      expect(
        screen.getByText(
          /made in your Gamemaster’s game too, with the same dice/,
        ),
      ).toBeInTheDocument()
      expect(screen.queryByRole('switch')).toBeNull()

      rerender(
        <RollTray
          rolls={[]}
          rolling={false}
          table={table([], { sending: false })}
        />,
      )
      expect(screen.queryByRole('switch')).toBeNull()
      expect(
        screen.getByText(
          'Only you see these rolls: Send to the table is off in Settings.',
        ),
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

  describe('from descriptions', () => {
    const table = (states: [string, TableRollState][] = []): TableRolls => ({
      states: new Map(states),
      available: true,
      sending: true,
    })
    const save = roll({
      id: 's1',
      label: 'Dexterity saving throw',
      modifier: 1,
      d20s: [13],
      natural: 13,
      total: 14,
      dc: 15,
      described: true,
    })
    const asked: LocalAsk = {
      kind: 'ask',
      id: 'a1',
      label: 'DC 15 Dexterity saving throw',
      at: 0,
    }

    it('says whether a saving throw made against its DC here was made, and that only the player sees it', () => {
      const { rerender } = render(<RollTray rolls={[save]} rolling={false} />)

      const status = screen.getByRole('status')
      expect(status).toHaveTextContent('d20 13 +1 · DC 15 · Failed')
      expect(status).toHaveTextContent(/Only you see this roll$/)

      rerender(
        <RollTray
          rolls={[{ ...save, total: 15, natural: 14, d20s: [14] }]}
          rolling={false}
        />,
      )
      expect(screen.getByRole('status')).toHaveTextContent(
        'd20 14 +1 · DC 15 · Saved',
      )
    })

    it.each<[string, TableRollState, string]>([
      [
        'made there, by its total where the game says nothing of it',
        { status: 'done', visible: true, total: 17 },
        'd20 13 +1 · DC 15At the table: 17 · Saved',
      ],
      [
        'made there, by a total that meets the DC',
        { status: 'done', visible: true, total: 15 },
        'd20 13 +1 · DC 15At the table: 15 · Saved',
      ],
      [
        'made there, as the game says',
        { status: 'done', visible: true, total: 14, outcome: 'failure' },
        'd20 13 +1 · DC 15At the table: 14 · Failed',
      ],
      [
        'hidden there',
        { status: 'done', visible: false },
        'd20 13 +1 · DC 15Rolled at the table, hidden by your Gamemaster',
      ],
      [
        'on its way',
        { status: 'sending' },
        'd20 13 +1 · DC 15Sending to your Gamemaster’s game…',
      ],
      [
        'not made there, by this roll',
        { status: 'refused', reason: 'gone' },
        'd20 13 +1 · DC 15 · FailedNot made at the table: it can’t be found in the game any more',
      ],
    ])(
      'says whether a saving throw against its DC was made, %s',
      (_, state, text) => {
        render(
          <RollTray
            rolls={[save]}
            rolling={false}
            table={table([['s1', state]])}
          />,
        )

        expect(screen.getByRole('status')).toHaveTextContent(
          `14Dexterity saving throw${text}`,
          { normalizeWhitespace: false },
        )
        expect(screen.queryByText('Only you see this roll')).toBeNull()
      },
    )

    describe('a check against its DC', () => {
      const athletics = roll({
        id: 'c1',
        label: 'Strength (Athletics) check',
        modifier: 7,
        d20s: [7],
        natural: 7,
        total: 14,
        dc: 15,
        verdict: 'check',
        described: true,
      })

      it('says whether it passed here, and that only the player sees it', () => {
        const { rerender } = render(
          <RollTray rolls={[athletics]} rolling={false} />,
        )

        const status = screen.getByRole('status')
        expect(status).toHaveTextContent('d20 7 +7 · DC 15 · Failed')
        expect(status).toHaveTextContent(/Only you see this roll$/)

        rerender(
          <RollTray
            rolls={[{ ...athletics, total: 15, natural: 8, d20s: [8] }]}
            rolling={false}
          />,
        )
        expect(screen.getByRole('status')).toHaveTextContent(
          'd20 8 +7 · DC 15 · Passed',
        )
      })

      it.each<[string, TableRollState, string]>([
        [
          'by its total where the game says nothing of it',
          { status: 'done', visible: true, total: 16 },
          'At the table: 16 · Passed',
        ],
        [
          'as the game says',
          { status: 'done', visible: true, total: 16, outcome: 'failure' },
          'At the table: 16 · Failed',
        ],
        [
          'as the game says it passed',
          { status: 'done', visible: true, total: 12, outcome: 'success' },
          'At the table: 12 · Passed',
        ],
      ])('says whether it passed at the table, %s', (_name, state, text) => {
        render(
          <RollTray
            rolls={[athletics]}
            rolling={false}
            table={table([['c1', state]])}
          />,
        )

        expect(screen.getByRole('status')).toHaveTextContent(
          `14Strength (Athletics) checkd20 7 +7 · DC 15${text}`,
          { normalizeWhitespace: false },
        )
      })

      it('says whether it passed at the table, as the game says, where the description keeps its DC from the player', () => {
        render(
          <RollTray
            rolls={[{ ...athletics, dc: undefined }]}
            rolling={false}
            table={table([
              [
                'c1',
                {
                  status: 'done',
                  visible: true,
                  total: 14,
                  outcome: 'success',
                },
              ],
            ])}
          />,
        )

        expect(screen.getByRole('status')).toHaveTextContent(
          '14Strength (Athletics) checkd20 7 +7At the table: 14 · Passed',
          { normalizeWhitespace: false },
        )
      })

      it('says whether it passed among the earlier rolls', async () => {
        const user = userEvent.setup()
        render(
          <RollTray
            rolls={[
              roll({ id: 'r9', label: 'Perception check' }),
              athletics,
              { ...athletics, id: 'c2', total: 18 },
              { ...athletics, id: 'c3' },
            ]}
            rolling={false}
            table={table([
              ['c2', { status: 'done', visible: true, total: 18 }],
              ['c3', { status: 'done', visible: true, total: 9 }],
            ])}
          />,
        )

        await user.click(screen.getByText('Earlier rolls (3)'))

        expect(
          screen.getAllByRole('listitem').map(item => item.textContent),
        ).toEqual([
          'Strength (Athletics) check7 +7 = 14· DC 15, failed',
          'Strength (Athletics) check7 +7 = 18· table 18, passed',
          'Strength (Athletics) check7 +7 = 14· table 9, failed',
        ])
      })
    })

    it('says only the player sees damage or a roll from a description the game didn’t take', () => {
      const { rerender } = render(
        <RollTray
          rolls={[damage({ described: true })]}
          rolling={false}
          table={table()}
        />,
      )
      expect(screen.getByRole('status')).toHaveTextContent(
        /Only you see this roll$/,
      )

      rerender(
        <RollTray
          rolls={[hitDie({ described: true, healing: false })]}
          rolling={false}
          table={table()}
        />,
      )
      expect(screen.getByRole('status')).toHaveTextContent(
        /Only you see this roll$/,
      )

      // Nor of a roll that isn't one, which the footer says of already.
      rerender(<RollTray rolls={[damage()]} rolling={false} table={table()} />)
      expect(screen.queryByText('Only you see this roll')).toBeNull()
    })

    it.each<[string, TableRollState | undefined, string]>([
      [
        'on its way',
        { status: 'sending' },
        'Sending to your Gamemaster’s game…',
      ],
      [
        'being posted',
        { status: 'rolling' },
        'Posting it in your Gamemaster’s game…',
      ],
      [
        'posted',
        { status: 'done', visible: true, rolls: [] },
        'Posted to the table’s chat',
      ],
      [
        'asked a moment ago',
        { status: 'failed', reason: 'busy' },
        'Not posted to the table: the table was asked a moment ago. Wait a little before asking again',
      ],
      [
        'in a secret',
        { status: 'failed', reason: 'secret' },
        'Not posted to the table: it’s in a secret part of the description',
      ],
      [
        'no such link',
        { status: 'failed', reason: 'link' },
        'Not posted to the table: your Gamemaster’s game doesn’t find that in its description',
      ],
      [
        'no longer on the sheet',
        { status: 'refused', reason: 'gone' },
        'Not posted to the table: it can’t be found in the game any more',
      ],
      ['not sent', undefined, 'Not posted to the table'],
    ])('says where the table asked is when %s', (_, state, text) => {
      render(
        <RollTray
          rolls={[asked]}
          rolling={false}
          table={table(state ? [['a1', state]] : [])}
        />,
      )

      expect(screen.getByRole('status')).toHaveTextContent(
        new RegExp(`^DC 15 Dexterity saving throw${text}$`),
      )
    })

    it('marks earlier asks and saves against a DC with how they went at the table', async () => {
      const user = userEvent.setup()
      render(
        <RollTray
          rolls={[roll({ id: 'r9' }), asked, { ...asked, id: 'a2' }, save]}
          rolling={false}
          table={table([
            ['a1', { status: 'done', visible: true }],
            ['a2', { status: 'failed', reason: 'busy' }],
            ['s1', { status: 'done', visible: true, total: 18 }],
          ])}
        />,
      )

      await user.click(screen.getByText('Earlier rolls (3)'))

      expect(
        screen.getAllByRole('listitem').map(item => item.textContent),
      ).toEqual([
        'DC 15 Dexterity saving throwasked· posted',
        'DC 15 Dexterity saving throwasked· not posted',
        'Dexterity saving throw13 +1 = 14· table 18, saved',
      ])
    })

    it('marks earlier saves against a DC the game didn’t make with whether they were made here, and one it made by a total meeting the DC as saved', async () => {
      const user = userEvent.setup()
      const made = { ...save, id: 's2', natural: 14, d20s: [14], total: 15 }
      render(
        <RollTray
          rolls={[
            roll({ id: 'r9' }),
            save,
            made,
            { ...save, id: 's3' },
            { ...made, id: 's4' },
          ]}
          rolling={false}
          table={table([
            ['s3', { status: 'refused', reason: 'gone' }],
            ['s4', { status: 'done', visible: true, total: 15 }],
          ])}
        />,
      )

      await user.click(screen.getByText('Earlier rolls (4)'))

      expect(
        screen.getAllByRole('listitem').map(item => item.textContent),
      ).toEqual([
        'Dexterity saving throw13 +1 = 14· DC 15, failed',
        'Dexterity saving throw14 +1 = 15· DC 15, saved',
        'Dexterity saving throw13 +1 = 14· DC 15, failed· not at the table',
        'Dexterity saving throw14 +1 = 15· table 15, saved',
      ])
    })
  })
})

/** The table, with these rolls' ways to it. */
const tableOf = (states: [string, TableRollState][]): TableRolls => ({
  states: new Map(states),
  available: true,
  sending: true,
})

/** An enchant activity used, or an enchantment ended, at the table, what it did said. */
const done = (
  enchantment: TableRollState['enchantment'],
  fields: Partial<TableRollState> = {},
): TableRollState => ({
  status: 'done',
  visible: true,
  rolls: [],
  use: { type: 'enchant' },
  damage: null,
  ...(enchantment && { enchantment }),
  ...fields,
})

describe('components/character-sheet/roll-tray for enchant activities, from module 0.21.0', () => {
  const magicWeapon: LocalUse = {
    kind: 'use',
    id: 'u1',
    label: 'Magic Weapon',
    spell: true,
    at: 0,
  }
  const ablaze: LocalUse = {
    kind: 'use',
    id: 'u2',
    label: 'Ablaze',
    spell: false,
    ending: true,
    at: 0,
  }
  const enchanted = {
    item: 'longsword',
    itemName: 'Longsword',
    effect: 'effect000000002',
    profile: 'SLSudYaACjmmmZsU',
    name: 'Magic Weapon, +1',
  }
  const ended = {
    item: 'flametongue',
    itemName: 'Flame Tongue',
    effect: 'ablazeEffect001',
    name: 'Ablaze',
  }
  it('says what a use put on which item, once the game made it', () => {
    render(
      <RollTray
        rolls={[magicWeapon]}
        rolling={false}
        table={tableOf([['u1', done({ enchanted, ended: null })]])}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Magic WeaponCast at the table · Magic Weapon, +1 on Longsword',
    )
  })

  it('says an enchantment was ended, where it is on its way, and once it is', () => {
    const { rerender } = render(
      <RollTray
        rolls={[ablaze]}
        rolling={false}
        table={tableOf([['u2', { status: 'rolling' }]])}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Ending it in your Gamemaster’s game…',
    )
    rerender(
      <RollTray
        rolls={[ablaze]}
        rolling={false}
        table={tableOf([
          ['u2', done({ enchanted: null, ended }, { use: undefined })],
        ])}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'AblazeEnded at the table',
    )
    expect(screen.getByRole('status')).not.toHaveTextContent('hidden')
  })

  it('marks each earlier one with what it put on, what it ended, or the card alone, never as hidden', async () => {
    const user = userEvent.setup()
    render(
      <RollTray
        rolls={[
          roll({ id: 'r1' }),
          magicWeapon,
          ablaze,
          { ...magicWeapon, id: 'u3', label: 'Shillelagh' },
          { ...ablaze, id: 'u4', label: 'Venom' },
        ]}
        rolling={false}
        table={tableOf([
          ['u1', done({ enchanted, ended: null })],
          [
            'u2',
            done({ enchanted: null, ended }, { visible: true, use: undefined }),
          ],
          ['u3', done({ enchanted: null, ended: null }, { visible: false })],
          ['u4', { status: 'failed', reason: 'enchantment' }],
        ])}
      />,
    )

    await user.click(screen.getByText('Earlier rolls (4)'))

    expect(
      screen.getAllByRole('listitem').map(item => item.textContent),
    ).toEqual([
      'Magic Weaponcast· Magic Weapon, +1 on Longsword',
      'Ablazeended· ended Ablaze',
      'Shillelaghcast· at the table',
      'Venomended· not at the table',
    ])
  })

  it.each([
    [
      'profile',
      'Not cast at the table: that enchantment isn’t offered at that level',
    ],
    [
      'enchant-target',
      'Not cast at the table: that item can’t take that enchantment',
    ],
    ['applied', 'Not cast at the table: that enchantment is on it already'],
    [
      'enchant',
      'Not cast at the table: it was used, but the enchantment wasn’t applied: your Gamemaster can apply it from the card',
    ],
  ])('says why a use was not made, for %s', (reason, said) => {
    render(
      <RollTray
        rolls={[magicWeapon]}
        rolling={false}
        table={tableOf([['u1', { status: 'failed', reason }]])}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(said)
  })

  it('says an enchantment was not applied without sending the Gamemaster to a card the game has not', () => {
    render(
      <RollTray
        rolls={[magicWeapon]}
        rolling={false}
        table={tableOf([
          ['u1', { status: 'failed', reason: 'enchant', card: false }],
        ])}
      />,
    )
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(
      /Not cast at the table: it was used, but the enchantment wasn’t applied$/,
    )
    expect(status).not.toHaveTextContent('card')
  })

  it('says why an enchantment was not ended', () => {
    render(
      <RollTray
        rolls={[ablaze]}
        rolling={false}
        table={tableOf([['u2', { status: 'refused', reason: 'enchantment' }]])}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Not ended at the table: that enchantment can’t be ended from here',
    )
  })
})

describe('components/character-sheet/roll-tray, in brief for its toast', () => {
  /** A damage roll the game rolls itself, with no dice here. */
  const theirs = damage({
    id: 'd2',
    label: 'Club damage',
    total: 0,
    parts: [{ type: 'Bludgeoning', total: 0, terms: [] }],
  })
  /** Damage with a die rerolled here, which the game throws again itself. */
  const rerolled = damage({
    id: 'd3',
    label: 'Greatsword damage',
    total: 9,
    parts: [
      {
        type: 'Slashing',
        total: 9,
        terms: [
          {
            text: '2d6r<=2',
            values: [1, 4],
            value: 9,
            thrown: [
              { value: 1, active: false, rerolled: true },
              { value: 4, active: true },
              { value: 5, active: true },
            ],
          },
        ],
      },
    ],
  })
  const shown: TableRollState = { status: 'done', visible: true, total: 23 }

  it.each<
    [string, Parameters<typeof briefOf>, string, number | string | undefined]
  >([
    [
      'a natural 20',
      [roll({ natural: 20, d20s: [20], total: 24 })],
      'critical',
      24,
    ],
    ['a natural 1', [roll({ natural: 1, d20s: [1], total: 5 })], 'fumble', 5],
    ['any other check', [roll()], 'plain', 16],
    ['damage', [damage()], 'damage', 16],
    ['healing', [damage({ healing: true })], 'healing', 16],
    [
      'damage the game rolls, on its way',
      [theirs, { status: 'sending' }],
      'damage',
      '…',
    ],
    [
      'damage the game rolls, made blind',
      [theirs, { status: 'done', visible: false }],
      'damage',
      '…',
    ],
    ['damage the game rolled', [theirs, shown], 'damage', 23],
    [
      'damage thrown again there, on its way',
      [rerolled, { status: 'rolling' }],
      'damage',
      '…',
    ],
    ['damage thrown again there, made', [rerolled, shown], 'damage', 23],
    [
      'damage thrown again there, refused',
      [rerolled, { status: 'refused', reason: 'busy' }],
      'damage',
      9,
    ],
    [
      'damage the game adds up, once made',
      [damage({ gameTotal: true }), shown],
      'damage',
      23,
    ],
    ['a hit die', [hitDie()], 'plain', 9],
    [
      'a use',
      [{ kind: 'use', id: 'u1', label: 'Bless', spell: true, at: 0 }],
      'use',
      undefined,
    ],
    [
      'an ask',
      [{ kind: 'ask', id: 'a1', label: 'DC 15 Dexterity saving throw', at: 0 }],
      'ask',
      undefined,
    ],
  ])(
    'B1 colours %s as the tray does, with its total',
    (_, args, badge, total) => {
      const brief = briefOf(...args)
      expect(brief.badge).toBe(badge)
      expect(brief.total).toBe(total)
      if (args[0].kind === 'use' || args[0].kind === 'ask') {
        expect(brief.dice).toBeUndefined()
        return
      }
      // The tray shows the same total, in the same colours.
      render(
        <RollTray
          rolls={[args[0]]}
          rolling={false}
          table={{
            states: new Map(args[1] ? [[args[0].id, args[1]]] : []),
            available: true,
            sending: true,
          }}
        />,
      )
      const badgeOf = (screen.getByRole('status').querySelector('span') ??
        undefined) as HTMLElement
      expect(badgeOf).toHaveTextContent(String(total))
      const colour = {
        critical: 'bg-gold',
        fumble: 'bg-ruby',
        plain: 'bg-primary/10',
        damage: 'bg-damage/15',
        healing: 'bg-primary/10',
      }[badge]
      expect(badgeOf).toHaveClass(colour as string)
    },
  )

  it.each<[string, Parameters<typeof briefOf>, string]>([
    [
      'a check with advantage, against a DC this roll saved',
      [
        roll({
          natural: 14,
          d20s: [9, 14],
          modifier: 3,
          total: 17,
          advantage: 'adv',
          dc: 15,
        }),
      ],
      'd20 14 +3 · Advantage · DC 15 · Saved',
    ],
    [
      'a check against a DC this roll passed',
      [
        roll({ dc: 15, verdict: 'check' }),
        { status: 'refused', reason: 'busy' },
      ],
      'd20 12 +4 · DC 15 · Passed',
    ],
    [
      'a save against a DC this roll failed, where the game did not make it',
      [roll({ dc: 18 }), { status: 'expired' }],
      'd20 12 +4 · DC 18 · Failed',
    ],
    [
      'a save against a DC the game made',
      [roll({ dc: 15 }), { status: 'done', visible: true, total: 16 }],
      'd20 12 +4 · DC 15',
    ],
    [
      'a save against a DC on its way',
      [roll({ dc: 15 }), { status: 'sending' }],
      'd20 12 +4 · DC 15',
    ],
    [
      'a check with what the player added, with disadvantage, a natural 1',
      [
        roll({
          natural: 1,
          d20s: [1, 15],
          total: 10,
          advantage: 'dis',
          extras: [
            { text: '+1d4', values: [3], value: 3 },
            { text: '+2', values: [], value: 2 },
          ],
        }),
      ],
      'd20 1 +4 +1d4 (3) +2 · Disadvantage · Natural 1',
    ],
    [
      'a natural 20 with a penalty',
      [roll({ natural: 20, d20s: [20], modifier: -1, total: 19 })],
      'd20 20 −1 · Natural 20',
    ],
    [
      'damage',
      [damage({ critical: true })],
      '9 Slashing + 7 Fire · Critical hit',
    ],
    [
      'damage at its highest',
      [damage({ maximized: true })],
      '9 Slashing + 7 Fire · Maximum',
    ],
    [
      'damage the game rolls',
      [theirs, { status: 'sending' }],
      'rolled at the table',
    ],
    [
      'damage thrown again there',
      [rerolled, shown],
      'thrown again at the table',
    ],
    ['a hit die', [hitDie()], '7 +2'],
    ['a hit die, at its least', [hitDie({ minimum: 1 })], '7 +2, at least 1'],
  ])('B2 says the dice of %s in a line', (_, args, dice) => {
    expect(briefOf(...args).dice).toBe(dice)
  })

  /** Each kind of roll the tray shows, as it's sent to the table. */
  const kinds: [
    string,
    LocalCheck | LocalDamage | LocalFormula | LocalUse | LocalAsk,
  ][] = [
    ['a check', roll()],
    ['a check against a DC', roll({ dc: 15, verdict: 'check' })],
    ['damage', damage()],
    ['damage the game rolls', theirs],
    ['hit dice', hitDie()],
    [
      'a spell',
      { kind: 'use', id: 'u1', label: 'Fireball', spell: true, at: 0 },
    ],
    [
      'a feature',
      { kind: 'use', id: 'u2', label: 'Second Wind', spell: false, at: 0 },
    ],
    [
      'an enchantment ended',
      {
        kind: 'use',
        id: 'u3',
        label: 'Ablaze',
        spell: false,
        ending: true,
        at: 0,
      },
    ],
    [
      'an ask',
      { kind: 'ask', id: 'a1', label: 'DC 15 Dexterity saving throw', at: 0 },
    ],
  ]
  const attack = (fields: Partial<NonNullable<TableRollState['attack']>>) => ({
    critical: false,
    fumble: false,
    outcome: null,
    ...fields,
  })
  const preview = {
    critical: false,
    plannable: true,
    rolls: [{ formula: '8d6', type: 'fire', dice: [{ faces: 6, number: 8 }] }],
  }
  /** Each way to the game the tray says, and whether it's on its way, made there, or not. */
  const ways: [string, TableRollState, 'pending' | 'made' | 'not'][] = [
    ['sent', { status: 'sending' }, 'pending'],
    ['being made', { status: 'rolling' }, 'pending'],
    [
      'sent, a die of three',
      { status: 'sending', together: { count: 3, made: 1 } },
      'pending',
    ],
    [
      'being made, a die of three',
      { status: 'rolling', together: { count: 3, made: 2 } },
      'pending',
    ],
    ['made', { ...shown }, 'made'],
    ['made, its total unsaid', { status: 'done', visible: true }, 'made'],
    ['a hit', { ...shown, attack: attack({ outcome: 'hit' }) }, 'made'],
    ['a miss', { ...shown, attack: attack({ outcome: 'miss' }) }, 'made'],
    [
      'a critical hit',
      { ...shown, attack: attack({ critical: true, outcome: 'hit' }) },
      'made',
    ],
    [
      'an area attack',
      {
        ...shown,
        attack: attack({
          targets: [
            { combatId: 'c1', combatantId: 'g1', outcome: 'hit' },
            { combatId: 'c1', combatantId: 'g2', outcome: 'miss' },
            { combatId: 'c1', combatantId: 'g3', outcome: 'hit' },
          ],
        }),
        targetNames: { g1: 'Goblin' },
      },
      'made',
    ],
    ['saved', { ...shown, outcome: 'success' }, 'made'],
    ['failed', { ...shown, total: 7, outcome: 'failure' }, 'made'],
    ['healing', { ...shown, total: 9, healed: 9 }, 'made'],
    ['made blind', { status: 'done', visible: false }, 'made'],
    [
      'used, its damage to follow',
      {
        status: 'done',
        visible: true,
        use: { type: 'save' },
        damage: preview,
        requestId: 'req-1',
      },
      'made',
    ],
    [
      'an enchantment applied',
      {
        status: 'done',
        visible: true,
        use: { type: 'enchant' },
        damage: null,
        enchantment: {
          enchanted: {
            item: 'longsword',
            itemName: 'Longsword',
            effect: 'effect000000002',
            profile: 'SLSudYaACjmmmZsU',
            name: 'Magic Weapon, +1',
          },
          ended: null,
        },
      },
      'made',
    ],
    ['refused, too many at once', { status: 'refused', reason: 'busy' }, 'not'],
    ['refused, unreached', { status: 'refused', reason: 'network' }, 'not'],
    ['refused, for an error', { status: 'refused', reason: 'error' }, 'not'],
    ['refused, out of slots', { status: 'refused', reason: 'slots' }, 'not'],
    ['failed, too long', { status: 'failed', reason: 'timeout' }, 'not'],
    [
      'failed, at a slot an item cast it',
      { status: 'failed', reason: 'slot', itemCast: true },
      'not',
    ],
    [
      'failed, out of hit dice',
      { status: 'failed', reason: 'no-hit-dice', hitDice: true },
      'not',
    ],
    [
      'failed, its enchantment on no card',
      { status: 'failed', reason: 'enchant', card: false },
      'not',
    ],
    [
      'failed, for a reason unknown',
      { status: 'failed', reason: 'gremlins' },
      'not',
    ],
    ['expired', { status: 'expired' }, 'not'],
    ['lost', { status: 'lost' }, 'not'],
    [
      'made in part',
      {
        status: 'failed',
        reason: 'full-hp',
        together: { count: 3, made: 1 },
        healed: 9,
      },
      'not',
    ],
  ]

  it.each(
    kinds.flatMap(([kind, sent]) =>
      ways.map(
        ([way, state, tone]) => [`${kind}, ${way}`, sent, state, tone] as const,
      ),
    ),
  )('B3 says of %s what the tray says', (_, sent, state, tone) => {
    const brief = briefOf(sent, state)
    render(
      <RollTray
        rolls={[sent]}
        rolling={false}
        table={{
          states: new Map([[sent.id, state]]),
          available: true,
          sending: true,
        }}
      />,
    )
    const status = screen.getByRole('status')

    expect(brief.label).toBe(sent.label)
    expect(brief.table?.text).toBeTruthy()
    expect(status.textContent).toContain(brief.table?.text)
    expect(brief.table?.tone).toBe(tone)
    // As the tray colours its line: a warning where it wasn't made, a spinner while on its way.
    expect(status.querySelector('.text-warning') !== null).toBe(tone === 'not')
    expect(status.querySelector('[class*="animate-spin"]') !== null).toBe(
      tone === 'pending',
    )
  })

  it.each([
    ['a check', roll()],
    ['damage', damage()],
    ['hit dice', hitDie()],
    [
      'a use',
      { kind: 'use', id: 'u1', label: 'Bless', spell: true, at: 0 } as LocalUse,
    ],
  ])('B3 says nothing of the table for %s never sent', (_, kept) => {
    expect(briefOf(kept).table).toBeUndefined()
  })

  it.each<[string, TableRollState | undefined, string]>([
    [
      'too soon after another',
      { status: 'refused', reason: 'busy' },
      'Not posted to the table: the table was asked a moment ago. Wait a little before asking again',
    ],
    ['never sent', undefined, 'Not posted to the table'],
    ['posted', { status: 'done', visible: true }, 'Posted to the table’s chat'],
    [
      'being posted',
      { status: 'rolling' },
      'Posting it in your Gamemaster’s game…',
    ],
  ])('B4 says an ask %s in its own words', (_, state, text) => {
    const ask: LocalAsk = {
      kind: 'ask',
      id: 'a1',
      label: 'DC 15 Dexterity saving throw',
      at: 0,
    }
    expect(briefOf(ask, state).table?.text).toBe(text)
  })

  it.each<[string, Parameters<typeof briefOf>, string]>([
    [
      'too many at once',
      [roll(), { status: 'refused', reason: 'busy' }],
      'Not made at the table: too many rolls at once. Wait a moment',
    ],
    [
      'unreached',
      [roll(), { status: 'refused', reason: 'network' }],
      'Not made at the table: Sending Stone couldn’t be reached',
    ],
    [
      'unpicked',
      [roll(), { status: 'expired' }],
      'Not made at the table: your Gamemaster’s game didn’t pick it up',
    ],
    [
      'for an unknown reason',
      [roll(), { status: 'failed', reason: 'gremlins' }],
      'Not made at the table',
    ],
    [
      'out of slots',
      [
        { kind: 'use', id: 'u1', label: 'Fireball', spell: true, at: 0 },
        { status: 'refused', reason: 'slots' },
      ],
      'Not cast at the table: you have no spell slots left for it',
    ],
    [
      'an attack hit',
      [roll(), { ...shown, attack: attack({ outcome: 'hit' }) }],
      'At the table: 23 · Hit',
    ],
    [
      'three hit dice, one made',
      [
        hitDie(),
        {
          status: 'failed',
          reason: 'full-hp',
          together: { count: 3, made: 1 },
          healed: 9,
        },
      ],
      '1 of 3 made at the table · 9 HP regained. Not the rest: you’re at full hit points',
    ],
    [
      'hit dice sent one by one',
      [hitDie(), { status: 'sending', together: { count: 3, made: 1 } }],
      'Sending die 2 of 3 to your Gamemaster’s game…',
    ],
    [
      'an enchantment ended',
      [
        {
          kind: 'use',
          id: 'u3',
          label: 'Ablaze',
          spell: false,
          ending: true,
          at: 0,
        },
        { status: 'done', visible: true },
      ],
      'Ended at the table',
    ],
  ])('B3 reads, %s, as the contract words it', (_, args, text) => {
    expect(briefOf(...args).table?.text).toBe(text)
  })

  it('B6 leaves the status unannounced where toasts say it, a status either way', () => {
    const { rerender } = render(<RollTray rolls={[roll()]} rolling={false} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')

    rerender(<RollTray rolls={[roll()]} rolling={false} announce={false} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'off')
    expect(screen.getByRole('status')).toHaveTextContent('Perception check')
  })
})
