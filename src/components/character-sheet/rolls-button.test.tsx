/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RollTray, type TableRolls } from './roll-tray'
import { RollsButton } from './rolls-button'
import type {
  LocalCheck,
  LocalGmRoll,
  LocalRoll,
  LocalUse,
} from '@/hooks/use-sheet-roller'
import type { TableRollState } from '@/hooks/use-table-rolls'

const attack: LocalCheck = {
  kind: 'check',
  id: 'r2',
  label: 'Longsword attack',
  total: 19,
  modifier: 7,
  d20s: [12],
  natural: 12,
  extras: [],
  at: 1,
}
const perception: LocalCheck = {
  kind: 'check',
  id: 'r1',
  label: 'Perception check',
  total: 16,
  modifier: 4,
  d20s: [12],
  natural: 12,
  extras: [],
  at: 0,
}
const preview = {
  critical: false,
  plannable: true,
  rolls: [
    { formula: '1d8 + 4', type: 'slashing', dice: [{ faces: 8, number: 1 }] },
  ],
}
/** The game's answer to the attack: an area attack, its damage still to roll. */
const hit = (fields: Partial<TableRollState> = {}): TableRollState => ({
  status: 'done',
  visible: true,
  total: 19,
  requestId: 'req-1',
  attack: {
    critical: false,
    fumble: false,
    outcome: null,
    targets: [
      { combatId: 'c1', combatantId: 'g1', outcome: 'hit' },
      { combatId: 'c1', combatantId: 'g2', outcome: 'miss' },
    ],
  },
  targetNames: { g1: 'Goblin', g2: 'Hobgoblin' },
  damage: preview,
  ...fields,
})

const table = (
  states: [string, TableRollState][],
  fields: Partial<TableRolls> = {},
): TableRolls => ({
  states: new Map(states),
  available: true,
  sending: true,
  takes: kind => kind === 'attack',
  rollDamage: jest.fn(),
  ...fields,
})

/** The button, named as it shows: "Your rolls", and whether damage is to roll. */
const button = () => screen.getByRole('button', { name: /^Your rolls/ })

/** The rolls, open. */
const rolls = () => screen.getByRole('dialog', { name: 'Your rolls' })

describe('components/character-sheet/rolls-button', () => {
  it('R1 opens, as the cog does, to the latest roll in full, the earlier ones and the way they go, unannounced', async () => {
    const user = userEvent.setup()
    render(
      <RollsButton
        rolls={[attack, perception]}
        rolling={false}
        table={table([['r2', hit()]])}
      />,
    )
    expect(button()).toHaveAttribute('title', 'Your rolls')
    expect(button()).toHaveAttribute('aria-haspopup', 'dialog')
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(button())

    const status = within(rolls()).getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'off')
    expect(status).toHaveTextContent(
      new RegExp(
        String.raw`^19Longsword attackd20 12 \+7At the table: 19 · Hit 1 of 2` +
          'Goblin: HitHobgoblin: MissRoll damage$',
      ),
    )
    expect(within(rolls()).getByText('Earlier rolls (1)')).toBeInTheDocument()
    expect(
      within(rolls()).getByText(
        'Checks, saves and attacks you roll here are made in your Gamemaster’s game too, with the same dice.',
      ),
    ).toBeInTheDocument()
    // Without the banner's own frame.
    expect(screen.queryByRole('region', { name: 'Your rolls' })).toBeNull()
    expect(rolls().querySelector('.border-t')).toBeNull()
    await waitFor(() =>
      expect(
        within(rolls()).getByRole('button', { name: 'Roll damage' }),
      ).toHaveFocus(),
    )

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(button())
    await user.click(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it("R2 rolls the latest roll's damage as the banner does", async () => {
    const user = userEvent.setup()
    const rollDamage = jest.fn()
    render(
      <RollsButton
        rolls={[attack]}
        rolling={false}
        table={table([['r2', hit()]], { rollDamage })}
      />,
    )
    await user.click(button())

    await user.click(
      within(rolls()).getByRole('button', { name: 'Roll damage' }),
    )

    expect(rollDamage).toHaveBeenCalledWith('Longsword', {
      use: 'req-1',
      damage: preview,
    })
  })

  it('R3 opens the damage menu inside, choosing from it without closing first', async () => {
    const user = userEvent.setup()
    const rollDamage = jest.fn()
    render(
      <RollsButton
        rolls={[attack]}
        rolling={false}
        table={table([['r2', hit()]], { rollDamage, modifies: true })}
      />,
    )
    await user.click(button())

    fireEvent.contextMenu(
      within(rolls()).getByRole('button', { name: 'Roll damage' }),
    )
    const menu = screen.getByRole('menu', { name: 'Longsword damage 1d8 + 4' })
    expect(rolls()).toContainElement(menu)
    await user.click(
      within(menu).getByRole('menuitem', { name: 'Roll maximum damage' }),
    )

    expect(rollDamage).toHaveBeenCalledWith(
      'Longsword',
      { use: 'req-1', damage: preview },
      undefined,
      { maximize: true },
    )
  })

  it('R6 closes only the damage menu on Escape, then itself', async () => {
    const user = userEvent.setup()
    render(
      <RollsButton
        rolls={[attack]}
        rolling={false}
        table={table([['r2', hit()]], { modifies: true })}
      />,
    )
    await user.click(button())

    // Its focus left on the button, as a right-click may leave it.
    fireEvent.contextMenu(
      within(rolls()).getByRole('button', { name: 'Roll damage' }),
    )
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(rolls()).toBeInTheDocument()

    fireEvent.contextMenu(
      within(rolls()).getByRole('button', { name: 'Roll damage' }),
    )
    await waitFor(() =>
      expect(
        screen.getByRole('menuitem', { name: 'Roll maximum damage' }),
      ).toHaveFocus(),
    )
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(rolls()).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('R9 closes only the dialog that changes the damage on Escape, opened inside, not itself', async () => {
    const user = userEvent.setup()
    render(
      <RollsButton
        rolls={[attack]}
        rolling={false}
        table={table([['r2', hit()]], { modifies: true })}
      />,
    )
    await user.click(button())
    fireEvent.contextMenu(
      within(rolls()).getByRole('button', { name: 'Roll damage' }),
    )
    await user.click(screen.getByRole('menuitem', { name: 'Modify damage…' }))
    const dialog = screen.getByRole('dialog', { name: 'Modify damage' })
    expect(rolls()).toContainElement(dialog)
    within(dialog).getByRole('button', { name: 'One die more' }).focus()

    // The browser closes the dialog itself as the key goes past.
    await user.keyboard('{Escape}')

    expect(rolls()).toBeInTheDocument()
  })

  it('R10 is held to the room below its button, scrolling inside', async () => {
    const user = userEvent.setup()
    render(
      <RollsButton
        rolls={[attack]}
        rolling={false}
        table={table([['r2', hit()]])}
      />,
    )

    await user.click(button())

    await waitFor(() => expect(rolls().style.maxHeight).toMatch(/^\d+px$/))
    expect(rolls().firstElementChild).toHaveClass('min-h-0', 'overflow-y-auto')
  })

  it('R4 has a dot while a roll waits for its damage, said as such', () => {
    const breath: LocalUse = {
      kind: 'use',
      id: 'u1',
      label: 'Bless',
      spell: true,
      at: 2,
    }
    const { rerender } = render(
      <RollsButton
        rolls={[breath, attack]}
        rolling={false}
        table={table([['r2', hit()]])}
      />,
    )
    // As the Effects tab says its conditions: its words run on, as a browser reads them.
    expect(button().textContent).toBe('Your rolls, damage to roll')
    expect(button().querySelector('.bg-primary.rounded-full')).not.toBeNull()

    rerender(
      <RollsButton
        rolls={[breath, attack]}
        rolling={false}
        table={table([['r2', hit({ damaged: true })]])}
      />,
    )
    expect(button().textContent).toBe('Your rolls')
    expect(button().querySelector('.rounded-full')).toBeNull()
  })

  it('R7 offers the damage of a roll that waits, once others follow it, as the banner would offer it, the dot going once it is rolled', async () => {
    const user = userEvent.setup()
    const rollDamage = jest.fn()
    const { rerender } = render(
      <RollsButton
        rolls={[perception, attack]}
        rolling={false}
        table={table([['r2', hit()]], { rollDamage, modifies: true })}
      />,
    )
    expect(button().textContent).toBe('Your rolls, damage to roll')
    await user.click(button())

    const due = within(rolls()).getByRole('group', {
      name: 'Longsword attack',
    })
    expect(within(rolls()).getByRole('status')).toHaveTextContent(
      'Perception check',
    )
    await user.click(within(due).getByRole('button', { name: 'Roll damage' }))
    // As the banner rolls it, where the attack is the latest.
    const trayRolls = jest.fn()
    render(
      <RollTray
        rolls={[attack]}
        rolling={false}
        table={table([['r2', hit()]], { rollDamage: trayRolls })}
      />,
    )
    await user.click(
      within(screen.getByRole('region', { name: 'Your rolls' })).getByRole(
        'button',
        { name: 'Roll damage' },
      ),
    )
    expect(rollDamage.mock.calls).toEqual(trayRolls.mock.calls)
    expect(rollDamage).toHaveBeenCalledWith('Longsword', {
      use: 'req-1',
      damage: preview,
    })
    // Its damage menu opens inside too.
    fireEvent.contextMenu(
      within(due).getByRole('button', { name: 'Roll damage' }),
    )
    expect(rolls()).toContainElement(
      screen.getByRole('menu', { name: 'Longsword damage 1d8 + 4' }),
    )
    await user.keyboard('{Escape}')

    rerender(
      <RollsButton
        rolls={[perception, attack]}
        rolling={false}
        table={table([['r2', hit({ damaged: true })]], { rollDamage })}
      />,
    )
    expect(button().textContent).toBe('Your rolls')
    expect(
      within(rolls()).queryByRole('group', { name: 'Longsword attack' }),
    ).toBeNull()
    expect(within(rolls()).queryByRole('button', { name: /^Roll / })).toBeNull()
  })

  it.each<[string, TableRollState]>([
    [
      'an attack that missed',
      hit({
        attack: { critical: false, fumble: false, outcome: 'miss' },
        targetNames: undefined,
      }),
    ],
    [
      'an area attack that missed everyone',
      hit({
        attack: {
          critical: false,
          fumble: false,
          outcome: null,
          targets: [
            { combatId: 'c1', combatantId: 'g1', outcome: 'miss' },
            { combatId: 'c1', combatantId: 'g2', outcome: 'miss' },
          ],
        },
      }),
    ],
  ])(
    'R11 has no dot for %s, nor lists it among the rolls that wait, offering its damage while it is the latest, as the banner does',
    async (_, missed) => {
      const user = userEvent.setup()
      const rollDamage = jest.fn()
      const { rerender } = render(
        <RollsButton
          rolls={[attack]}
          rolling={false}
          table={table([['r2', missed]], { rollDamage })}
        />,
      )
      expect(button().textContent).toBe('Your rolls')
      expect(button().querySelector('.rounded-full')).toBeNull()

      await user.click(button())
      expect(
        within(rolls()).queryByRole('group', { name: 'Longsword attack' }),
      ).toBeNull()
      await user.click(
        within(within(rolls()).getByRole('status')).getByRole('button', {
          name: 'Roll damage',
        }),
      )
      expect(rollDamage).toHaveBeenCalledWith('Longsword', {
        use: 'req-1',
        damage: preview,
      })

      // Once another roll follows it, or while dice roll in its place, its row offers it.
      for (const [shown, rolling] of [
        [[perception, attack], false],
        [[attack], true],
      ] as const) {
        rerender(
          <RollsButton
            rolls={[...shown]}
            rolling={rolling}
            table={table([['r2', missed]], { rollDamage })}
          />,
        )
        expect(button().textContent).toBe('Your rolls')
        expect(
          within(rolls()).queryByRole('group', { name: 'Longsword attack' }),
        ).toBeNull()
        expect(
          within(rolls()).queryByRole('button', { name: /^Roll / }),
        ).toBeNull()
      }
    },
  )

  it("R8 offers the latest roll's damage while dice roll in its place, and only once otherwise", async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <RollsButton rolls={[attack]} rolling table={table([['r2', hit()]])} />,
    )
    await user.click(button())
    expect(within(rolls()).getByRole('status')).toHaveTextContent('Rolling…')
    expect(
      within(
        within(rolls()).getByRole('group', { name: 'Longsword attack' }),
      ).getByRole('button', { name: 'Roll damage' }),
    ).toBeInTheDocument()

    rerender(
      <RollsButton
        rolls={[attack]}
        rolling={false}
        table={table([['r2', hit()]])}
      />,
    )
    expect(
      within(rolls()).queryByRole('group', { name: 'Longsword attack' }),
    ).toBeNull()
    expect(
      within(rolls()).getAllByRole('button', { name: 'Roll damage' }),
    ).toHaveLength(1)
  })

  it("R12 offers the player's own latest roll's damage beneath one of the Gamemaster's that came after it (#156), once, as before it came", async () => {
    const user = userEvent.setup()
    const rollDamage = jest.fn()
    const stealth: LocalGmRoll = {
      kind: 'gm',
      id: 'gm:req-gm',
      label: 'Stealth check',
      rolled: 'skill',
      at: 2,
    }
    const ways = table(
      [
        ['r2', hit()],
        [
          'gm:req-gm',
          { status: 'done', visible: true, total: 14, requestId: 'req-gm' },
        ],
      ],
      { rollDamage },
    )
    const tray = (shown: LocalRoll[], rolling = false) => (
      <RollTray rolls={shown} rolling={rolling} table={ways} />
    )
    const { rerender, unmount } = render(tray([stealth, attack, perception]))
    const banner = screen.getByRole('region', { name: 'Your rolls' })
    expect(within(banner).getByRole('status')).toHaveTextContent(
      'Stealth checkGM',
    )

    const due = within(banner).getByRole('group', { name: 'Longsword attack' })
    await user.click(within(due).getByRole('button', { name: 'Roll damage' }))
    expect(rollDamage).toHaveBeenCalledWith('Longsword', {
      use: 'req-1',
      damage: preview,
    })

    // Not one before the player's own latest, nor while dice roll, as the banner never offered it.
    for (const [shown, rolling] of [
      [[stealth, perception, attack], false],
      [[stealth, attack], true],
    ] as const) {
      rerender(tray([...shown], rolling))
      expect(
        within(banner).queryByRole('button', { name: /^Roll / }),
      ).toBeNull()
    }
    unmount()

    // Behind the rolls' button, once.
    render(
      <RollsButton rolls={[stealth, attack]} rolling={false} table={ways} />,
    )
    expect(button().textContent).toBe('Your rolls, damage to roll')
    await user.click(button())
    expect(
      within(rolls()).getAllByRole('group', { name: 'Longsword attack' }),
    ).toHaveLength(1)
    expect(
      within(rolls()).getAllByRole('button', { name: 'Roll damage' }),
    ).toHaveLength(1)
  })

  it('R5 invites a roll where there are none', async () => {
    const user = userEvent.setup()
    render(<RollsButton rolls={[]} rolling={false} table={table([])} />)

    await user.click(button())

    expect(within(rolls()).getByRole('status')).toHaveTextContent(
      'Tap an ability, skill or attack to roll it.',
    )
  })
})
