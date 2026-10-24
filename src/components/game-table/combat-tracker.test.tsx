/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CombatTracker, formatInitiative } from './combat-tracker'
import type { TableCombat, TableCombatant } from '@/types/table'

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
})
