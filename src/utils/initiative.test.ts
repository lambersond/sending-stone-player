import { waitsForInitiative } from './initiative'

/** An encounter with the seat's combatant, its initiative as given, and another's waiting. */
const encounter = (
  active: boolean,
  round: number,
  initiative: number | null = null,
) => ({
  active,
  round,
  combatants: [
    { id: 'c-goblin', initiative: null },
    { id: 'c-thorin', initiative },
  ],
})

const seats = ({ id }: { id: string }) => id === 'c-thorin'

describe('utils/initiative', () => {
  it.each([
    ["the tracker's before Begin Combat", encounter(true, 0), true],
    ["the tracker's begun", encounter(true, 2), true],
    ["the tracker's, rolled already", encounter(true, 0, 14), false],
    [
      'begun, then switched away from on the tracker',
      encounter(false, 2),
      false,
    ],
    ['none', undefined, false],
  ])(
    'takes an initiative from the seat into an encounter: %s',
    (_, combat, takes) => {
      expect(waitsForInitiative(combat, seats)).toBe(takes)
    },
  )
})
