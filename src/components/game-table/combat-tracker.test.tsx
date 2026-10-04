/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { render, screen, within } from '@testing-library/react'
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
})
