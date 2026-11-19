import { takesInitiativeAnywhere, waitsForInitiative } from './initiative'

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
    [
      "the tracker's, its view saying the game takes none from the app (item 36)",
      { ...encounter(true, 2), takesInitiative: false as const },
      false,
    ],
  ])(
    'takes an initiative from the seat into an encounter: %s',
    (_, combat, takes) => {
      expect(waitsForInitiative(combat, seats)).toBe(takes)
    },
  )

  it.each([
    ['0.50.0', false],
    ['0.50.9', false],
    ['0.51.0', true],
    ['0.51.2', true],
    ['1.0.0', true],
    [null, false],
    ['next', false],
  ])(
    'says whether module %s takes initiative into any begun encounter (item 36): %s',
    (version, anywhere) => {
      expect(takesInitiativeAnywhere({ id: 'sending-stone', version })).toBe(
        anywhere,
      )
    },
  )

  it('says no module takes it anywhere where the hello names none', () => {
    expect(takesInitiativeAnywhere(undefined)).toBe(false)
  })
})
