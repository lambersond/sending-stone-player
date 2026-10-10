/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RollTray, type TableRolls } from './roll-tray'
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

  describe('from descriptions', () => {
    const table = (states: [string, TableRollState][] = []): TableRolls => ({
      states: new Map(states),
      available: true,
      sending: true,
      setSending: jest.fn(),
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
