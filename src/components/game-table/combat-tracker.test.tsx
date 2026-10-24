/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CombatTracker, formatInitiative } from './combat-tracker'
import { TableApiContext } from '@/hooks/use-table-api'
import { endableTurn } from '@/utils/end-turn'
import type { TableRollState } from '@/hooks/use-table-rolls'
import type { EndableTurn, TableCombat, TableCombatant } from '@/types/table'

const fighter = (
  fields: Partial<TableCombatant> & { id: string },
): TableCombatant => ({
  name: fields.id,
  initiative: 10,
  defeated: false,
  side: 'other',
  ...fields,
})

const encounter = (fields: Partial<TableCombat> = {}): TableCombat => ({
  id: 'cmbt1',
  name: null,
  started: true,
  round: 2,
  currentId: 'boss',
  combatants: [
    fighter({ id: 'boss', name: 'Goblin Boss', initiative: 19 }),
    fighter({
      id: 'thorin',
      name: 'Thorin',
      initiative: 17,
      side: 'me',
      hp: { value: 31, max: 44, temp: 5 },
    }),
    fighter({ id: 'goblin', name: 'Goblin', initiative: 14, defeated: true }),
    fighter({
      id: 'vex',
      name: 'Vex',
      initiative: 12,
      side: 'party',
      hp: { value: 0, max: 38, temp: 0 },
    }),
  ],
  ...fields,
})

const turnPanel = () =>
  screen.getByRole('heading', { level: 2, name: /acting|turn|ready/ })

/** A row's initiative box, coloured by whose side they're on. */
const box = (row: HTMLElement) =>
  within(row).getByText('Initiative', { selector: '.sr-only' }).parentElement

/** Thorin, his wolf Brakka, a goblin and Vex: Brakka's turn unless another is given. */
const fight = (fields: Partial<TableCombat> = {}) =>
  encounter({
    currentId: 'brakka',
    combatants: [
      fighter({
        id: 'brakka',
        name: 'Brakka',
        initiative: 18,
        side: 'party',
        yours: true,
        companion: 'wolfBrakka',
        hp: { value: 11, max: 11, temp: 0 },
      }),
      fighter({
        id: 'thorin',
        name: 'Thorin',
        initiative: 17,
        side: 'me',
        hp: { value: 31, max: 44, temp: 0 },
      }),
      fighter({ id: 'goblin', name: 'Goblin', initiative: 14 }),
      fighter({
        id: 'vex',
        name: 'Vex',
        initiative: 12,
        side: 'party',
        hp: { value: 20, max: 38, temp: 0 },
      }),
    ],
    ...fields,
  })

/** End Turn as the page's hook has it for this combat: the seat's turn, offered unless said. */
const endingOf = (
  combat: TableCombat,
  fields: {
    offered?: boolean
    way?: TableRollState
    sent?: { turn: EndableTurn; way: TableRollState }
  } = {},
) => ({
  turn: endableTurn(combat, ['endTurn']),
  offered: true,
  end: jest.fn(),
  ...fields,
})

const HINT = 'Or press and hold the Combat tab, from any tab.'

describe('components/game-table/combat-tracker', () => {
  it('says when there is no combat', () => {
    render(<CombatTracker />)

    expect(
      screen.getByRole('heading', { name: 'No combat right now' }),
    ).toBeInTheDocument()
  })

  it('lists the turn order, marking whose turn it is', () => {
    render(<CombatTracker combat={encounter({ name: 'Ambush' })} />)

    const rows = screen.getAllByRole('listitem')
    expect(rows.map(row => row.textContent)).toEqual([
      'Initiative 19Goblin BossNOW',
      'Initiative 17ThorinYouHit points 31 / 44 +5 temp',
      'Initiative 14GoblinDefeated',
      'Initiative 12VexAllyHit points 0 / 38',
    ])
    expect(rows[0]).toHaveAttribute('aria-current', 'step')
    expect(screen.getByText('Ambush')).toBeInTheDocument()
  })

  it('colours each side, and those the game has disposed as allies or neutral, from module 0.29.0', () => {
    render(
      <CombatTracker
        combat={encounter({
          combatants: [
            fighter({ id: 'thorin', name: 'Thorin', side: 'me' }),
            fighter({ id: 'vex', name: 'Vex', side: 'party' }),
            fighter({ id: 'mira', name: 'Mira', stance: 'ally' }),
            fighter({ id: 'merchant', name: 'Merchant', stance: 'neutral' }),
            fighter({ id: 'goblin', name: 'Goblin' }),
          ],
        })}
      />,
    )

    const rows = screen.getAllByRole('listitem')
    expect(rows.map(row => row.textContent)).toEqual([
      'Initiative 10ThorinYou',
      'Initiative 10VexAlly',
      'Initiative 10MiraAlly',
      'Initiative 10MerchantNeutral',
      'Initiative 10Goblin',
    ])
    expect(box(rows[0])).toHaveClass('bg-primary', 'text-on-primary')
    for (const ally of [rows[1], rows[2]]) {
      expect(box(ally)).toHaveClass('bg-party/15', 'text-party')
    }
    expect(box(rows[3])).toHaveClass(
      'bg-text-secondary/15',
      'text-text-secondary',
    )
    expect(box(rows[3])).not.toHaveClass('text-foe')
    expect(box(rows[4])).toHaveClass('bg-foe/15', 'text-foe')
    // No one is called an enemy.
    expect(screen.queryByText(/enemy|hostile/i)).toBeNull()
  })

  it('fits a tiebreaker such as 18.14 in a box as wide as every other', () => {
    render(
      <CombatTracker
        combat={encounter({
          combatants: [
            fighter({ id: 'boss', initiative: 18.14 }),
            fighter({ id: 'imp', initiative: 7 }),
          ],
        })}
      />,
    )

    const [boss, imp] = screen
      .getAllByText('Initiative', { selector: '.sr-only' })
      .map(label => label.parentElement)
    expect(boss).toHaveTextContent('Initiative 18.14')
    expect(boss).toHaveClass('w-15')
    expect(imp).toHaveClass('w-15')
  })

  it.each([
    [18.140000000000001, '18.14'],
    [15.1, '15.1'],
    [12, '12'],
    [-1.005, '-1'],
    [null, '–'],
  ])('shows initiative %p as %s', (initiative, shown) => {
    expect(formatInitiative(initiative)).toBe(shown)
  })

  it("shows who is acting and who's next, skipping the defeated", () => {
    render(<CombatTracker combat={encounter({ currentId: 'thorin' })} />)

    expect(turnPanel()).toHaveTextContent('Your turn')
    expect(screen.getByText('Next: Vex')).toBeInTheDocument()
    expect(screen.getByText('Round 2')).toBeInTheDocument()
  })

  it("tells the player they're up next", () => {
    render(<CombatTracker combat={encounter()} />)

    expect(turnPanel()).toHaveTextContent('Goblin Boss is acting')
    expect(screen.getByText('Next: you')).toBeInTheDocument()
    expect(screen.getByText('You are up next.')).toBeInTheDocument()
  })

  it("waits while a hidden combatant's turn plays out", () => {
    render(<CombatTracker combat={encounter({ currentId: undefined })} />)

    expect(turnPanel()).toHaveTextContent('Waiting for the next turn')
    expect(screen.queryByText(/^Next:/)).not.toBeInTheDocument()
  })

  it('shows an encounter being set up', () => {
    render(
      <CombatTracker
        combat={encounter({
          started: false,
          round: 0,
          currentId: undefined,
          combatants: [fighter({ id: 'boss', initiative: null })],
        })}
      />,
    )

    expect(turnPanel()).toHaveTextContent('Getting ready')
    expect(screen.getByText('Not started')).toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveTextContent('Initiative –')
  })

  it('says when no one has joined', () => {
    render(<CombatTracker combat={encounter({ combatants: [] })} />)

    expect(
      screen.getByText('No one has joined this encounter yet.'),
    ).toBeInTheDocument()
  })

  it('shows hit points without a bar when the maximum is unknown', () => {
    render(
      <CombatTracker
        combat={encounter({
          combatants: [
            fighter({
              id: 'thorin',
              side: 'me',
              hp: { value: 9, max: null, temp: 0 },
            }),
          ],
        })}
      />,
    )

    const row = screen.getByRole('listitem')
    expect(row).toHaveTextContent('Hit points 9')
    expect(within(row).queryByText('/', { exact: false })).toBeNull()
  })

  describe('companions (module 0.36.0)', () => {
    it('reads a companion of the player’s own as Yours, drawn as the party, with its hit points', () => {
      render(<CombatTracker combat={fight({ currentId: 'goblin' })} />)
      const [brakka, thorin, , vex] = screen.getAllByRole('listitem')
      expect(brakka).toHaveTextContent('Yours')
      expect(brakka).toHaveTextContent('Hit points 11')
      expect(box(brakka)).toHaveClass('bg-party/15', 'text-party')
      expect(thorin).toHaveTextContent('You')
      expect(vex).toHaveTextContent('Ally')
    })

    it('says a companion’s turn is the player’s, rolled for on its tab, which it opens', async () => {
      const user = userEvent.setup()
      const onOpen = jest.fn()
      render(
        <CombatTracker
          combat={fight()}
          onOpen={onOpen}
          keys={new Set(['wolfBrakka'])}
        />,
      )
      expect(turnPanel()).toHaveTextContent('Brakka’s turn')
      expect(turnPanel()).toHaveClass('text-primary')
      expect(turnPanel().closest('section')).toHaveClass('border-primary')
      const line = screen.getByText((_, element) =>
        element?.tagName === 'P'
          ? element.textContent === 'Roll for it on its tab.'
          : false,
      )
      const link = within(line).getByRole('button', { name: 'its tab' })
      expect(link).toHaveClass('min-h-11', 'min-w-11')
      await user.click(link)
      expect(onOpen).toHaveBeenCalledWith('wolfBrakka')
    })

    it('words "its tab" plainly where its tab isn’t in the row', () => {
      render(<CombatTracker combat={fight()} onOpen={jest.fn()} />)
      expect(screen.getByText('Roll for it on its tab.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'its tab' })).toBeNull()
    })

    it('says nothing of up next while one of the player’s own creatures acts', () => {
      render(<CombatTracker combat={fight()} />)
      expect(screen.getByText('Next: you')).toBeInTheDocument()
      expect(screen.queryByText('You are up next.')).toBeNull()
    })

    it('says another’s companion is acting, not whose turn it is', () => {
      render(
        <CombatTracker
          combat={fight({
            combatants: fight().combatants.map(combatant =>
              combatant.id === 'brakka'
                ? { ...combatant, yours: undefined, companion: undefined }
                : combatant,
            ),
          })}
        />,
      )
      expect(turnPanel()).toHaveTextContent('Brakka is acting')
      expect(turnPanel()).not.toHaveClass('text-primary')
      expect(screen.queryByText('Roll for it on its tab.')).toBeNull()
    })

    it('marks nothing as the player’s before the start', () => {
      render(<CombatTracker combat={fight({ started: false })} />)
      expect(turnPanel()).toHaveTextContent('Getting ready')
      expect(turnPanel()).not.toHaveClass('text-primary')
      expect(turnPanel().closest('section')).toHaveClass('border-border')
      expect(screen.queryByText('Roll for it on its tab.')).toBeNull()
    })
  })

  describe('End Turn (module 0.36.0)', () => {
    const thorinsTurn = () => encounter({ currentId: 'thorin' })

    it('offers it on the player’s own turn, with the hint under it', async () => {
      const user = userEvent.setup()
      const combat = thorinsTurn()
      const onEnd = jest.fn()
      render(
        <CombatTracker
          combat={combat}
          ending={endingOf(combat)}
          onEnd={onEnd}
        />,
      )
      const button = screen.getByRole('button', { name: 'End turn' })
      expect(button).toHaveAccessibleDescription('Your turn')
      expect(screen.getByText(HINT)).toHaveClass(
        'text-xs',
        'text-text-secondary',
      )
      await user.click(button)
      expect(onEnd).toHaveBeenCalledWith({
        combatId: 'cmbt1',
        round: 2,
        combatantId: 'thorin',
      })
    })

    it('offers it on a companion’s turn, the button in the heading row, then the hint, then its tab', () => {
      const combat = fight()
      render(
        <CombatTracker
          combat={combat}
          ending={endingOf(combat)}
          onOpen={jest.fn()}
          keys={new Set(['wolfBrakka'])}
        />,
      )
      const button = screen.getByRole('button', { name: 'End turn' })
      expect(button).toHaveAccessibleDescription('Brakka’s turn')
      const lines = [...(turnPanel().closest('section')?.children ?? [])].map(
        child => child.textContent,
      )
      expect(lines).toEqual([
        'Round 2Next: you',
        'Brakka’s turnEnd turn',
        HINT,
        'Roll for it on its tab.',
      ])
    })

    it.each([
      ['a party member’s', encounter({ currentId: 'vex' })],
      ['a foe’s', encounter()],
      [
        'the player’s, before the start',
        fight({ started: false, currentId: 'thorin' }),
      ],
    ])('offers nothing on %s turn', (_, combat) => {
      render(<CombatTracker combat={combat} ending={endingOf(combat)} />)
      expect(screen.queryByRole('button', { name: 'End turn' })).toBeNull()
      expect(screen.queryByText(HINT)).toBeNull()
    })

    it('offers nothing where the page has no turn to end, as at the Gamemaster’s page', () => {
      const combat = thorinsTurn()
      const view = render(
        <CombatTracker
          combat={combat}
          ending={{ ...endingOf(combat), turn: undefined }}
        />,
      )
      expect(screen.queryByRole('button', { name: 'End turn' })).toBeNull()
      expect(screen.queryByText(HINT)).toBeNull()
      view.rerender(<CombatTracker combat={combat} />)
      expect(screen.queryByRole('button', { name: 'End turn' })).toBeNull()
    })

    it('puts the button beside the heading, wrapping under it, and lets the heading take focus', () => {
      const combat = thorinsTurn()
      render(<CombatTracker combat={combat} ending={endingOf(combat)} />)
      const row = turnPanel().parentElement
      expect(row).toHaveClass(
        'flex',
        'flex-wrap',
        'items-center',
        'justify-between',
        'gap-x-3',
        'gap-y-2',
      )
      expect(row).toContainElement(
        screen.getByRole('button', { name: 'End turn' }),
      )
      expect(turnPanel()).toHaveAttribute('tabindex', '-1')
      expect(turnPanel()).toHaveClass('outline-none')
      expect(turnPanel()).toHaveAttribute('id', 'turn-heading')
    })

    it('says why the turn wasn’t ended, and to try again where it may be', () => {
      const combat = thorinsTurn()
      const turn = endableTurn(combat, ['endTurn']) as EndableTurn
      const view = render(
        <CombatTracker
          combat={combat}
          ending={endingOf(combat)}
          refused={{ turn, key: 'busy' }}
        />,
      )
      const line = screen.getByRole('alert')
      expect(line).toHaveTextContent(
        /^Your turn wasn’t ended: too many rolls at once\. Try again in a moment\.$/,
      )
      expect(line).toHaveClass(
        'flex',
        'items-start',
        'gap-1.5',
        'text-[13px]',
        'text-warning',
      )
      const icon = line.querySelector('svg')
      expect(icon).toHaveAttribute('aria-hidden', 'true')
      expect(icon).toHaveClass('mt-0.5', 'size-4', 'shrink-0')
      // Under the heading row, above the hint.
      expect(line.previousElementSibling).toBe(turnPanel().parentElement)
      expect(line.nextElementSibling).toHaveTextContent(HINT)

      view.rerender(
        <CombatTracker
          combat={combat}
          ending={endingOf(combat, {
            offered: false,
            way: { status: 'refused', reason: 'moved' },
          })}
          refused={{ turn, key: 'moved' }}
        />,
      )
      expect(screen.getByRole('alert')).toHaveTextContent(
        /^Your turn wasn’t ended: the turn had already moved on\.$/,
      )
    })

    it('words a reason that has no words of End Turn’s own as the tray does, for the seat', () => {
      const combat = thorinsTurn()
      const turn = endableTurn(combat, ['endTurn']) as EndableTurn
      render(
        <TableApiContext value={{ role: 'gm', api: '/api/x', key: 'x' }}>
          <CombatTracker
            combat={combat}
            ending={endingOf(combat)}
            refused={{ turn, key: 'expired' }}
          />
        </TableApiContext>,
      )
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Your turn wasn’t ended: your game didn’t pick it up. Try again in a moment.',
      )
    })

    it('says nothing of a refusal for a turn it no longer shows', () => {
      const combat = fight()
      render(
        <CombatTracker
          combat={combat}
          ending={endingOf(combat)}
          refused={{
            turn: { combatId: 'cmbt1', round: 2, combatantId: 'thorin' },
            key: 'busy',
          }}
        />,
      )
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('keeps the button, doing nothing, with focus on it, once refused as moved on', () => {
      const combat = thorinsTurn()
      const turn = endableTurn(combat, ['endTurn']) as EndableTurn
      const view = render(
        <CombatTracker combat={combat} ending={endingOf(combat)} />,
      )
      const button = screen.getByRole('button', { name: 'End turn' })
      act(() => button.focus())
      view.rerender(
        <CombatTracker
          combat={combat}
          ending={endingOf(combat, {
            offered: false,
            way: { status: 'refused', reason: 'moved' },
            sent: { turn, way: { status: 'refused', reason: 'moved' } },
          })}
          via='button'
          refused={{ turn, key: 'moved' }}
        />,
      )
      expect(screen.getByRole('button', { name: 'End turn' })).toBe(button)
      expect(button).toHaveAttribute('aria-disabled', 'true')
      expect(button).toHaveFocus()
    })

    it('moves focus to the heading when the button goes from under it', async () => {
      const combat = thorinsTurn()
      const focusTurn = jest.fn()
      const view = render(
        <CombatTracker
          combat={combat}
          ending={endingOf(combat)}
          focusTurn={focusTurn}
        />,
      )
      act(() => screen.getByRole('button', { name: 'End turn' }).focus())
      const next = encounter({ currentId: 'vex' })
      view.rerender(
        <CombatTracker
          combat={next}
          ending={endingOf(next)}
          focusTurn={focusTurn}
        />,
      )
      await act(async () => {})
      expect(screen.queryByRole('button', { name: 'End turn' })).toBeNull()
      expect(turnPanel()).toHaveFocus()
      expect(turnPanel()).toHaveTextContent('Vex is acting')
      expect(focusTurn).not.toHaveBeenCalled()
    })

    it('hands focus to the page’s place for the turn when the button goes with its panel, as the encounter ends', async () => {
      const combat = thorinsTurn()
      const focusTurn = jest.fn()
      const view = render(
        <CombatTracker
          combat={combat}
          ending={endingOf(combat)}
          focusTurn={focusTurn}
        />,
      )
      act(() => screen.getByRole('button', { name: 'End turn' }).focus())
      view.rerender(<CombatTracker focusTurn={focusTurn} />)
      await act(async () => {})
      expect(document.querySelector('#turn-heading')).toBeNull()
      expect(focusTurn).toHaveBeenCalledTimes(1)
    })

    it('moves focus to the heading once the button’s End Turn has moved the turn on, though the next is the seat’s too', () => {
      const combat = encounter({
        currentId: 'thorin',
        combatants: [
          ...fight().combatants.filter(({ id }) => id !== 'brakka'),
          fight().combatants[0],
        ],
      })
      const turn = endableTurn(combat, ['endTurn']) as EndableTurn
      const view = render(
        <CombatTracker combat={combat} ending={endingOf(combat)} />,
      )
      const button = screen.getByRole('button', { name: 'End turn' })
      act(() => button.focus())
      view.rerender(
        <CombatTracker
          combat={combat}
          ending={endingOf(combat, {
            offered: false,
            way: { status: 'sending' },
            sent: { turn, way: { status: 'sending' } },
          })}
          via='button'
        />,
      )
      expect(button).toHaveFocus()
      const next = { ...combat, currentId: 'brakka' }
      view.rerender(
        <CombatTracker
          combat={next}
          ending={endingOf(next, {
            offered: false,
            sent: { turn, way: { status: 'done', requestId: 'req-1' } },
          })}
          via='button'
        />,
      )
      // The button stays, for Brakka's turn; focus doesn't rest on it.
      expect(screen.getByRole('button', { name: 'End turn' })).toBe(button)
      expect(turnPanel()).toHaveTextContent('Brakka’s turn')
      expect(turnPanel()).toHaveFocus()
    })

    it('leaves focus where it is once a hold’s End Turn has moved the turn on', () => {
      const combat = encounter({ currentId: 'thorin' })
      const turn = endableTurn(combat, ['endTurn']) as EndableTurn
      render(<button type='button'>Elsewhere</button>)
      const view = render(
        <CombatTracker combat={combat} ending={endingOf(combat)} />,
      )
      const elsewhere = screen.getByRole('button', { name: 'Elsewhere' })
      act(() => elsewhere.focus())
      const next = encounter({ currentId: 'vex' })
      view.rerender(
        <CombatTracker
          combat={next}
          ending={endingOf(next, {
            sent: { turn, way: { status: 'done', requestId: 'req-1' } },
          })}
          via='hold'
        />,
      )
      expect(elsewhere).toHaveFocus()
    })
  })
})
