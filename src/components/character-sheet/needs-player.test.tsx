/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import { render, screen, within } from '@testing-library/react'
import { RollToasts } from './roll-toasts'
import { RollTray } from './roll-tray'
import {
  damageDue,
  needsPlayer,
  type TableRollState,
} from '@/hooks/use-table-rolls'
import type {
  LocalCheck,
  LocalDamage,
  LocalRoll,
  LocalUse,
} from '@/hooks/use-sheet-roller'

// The real ones, watched, so that a test can have them say otherwise.
jest.mock('@/hooks/use-table-rolls', () => {
  const actual = jest.requireActual<typeof import('@/hooks/use-table-rolls')>(
    '@/hooks/use-table-rolls',
  )
  return {
    ...actual,
    damageDue: jest.fn(actual.damageDue),
    needsPlayer: jest.fn(actual.needsPlayer),
  }
})

const actual = jest.requireActual<typeof import('@/hooks/use-table-rolls')>(
  '@/hooks/use-table-rolls',
)

const attack: LocalCheck = {
  kind: 'check',
  id: 'r1',
  label: 'Longsword attack',
  total: 19,
  modifier: 7,
  d20s: [12],
  natural: 12,
  extras: [],
  at: 0,
}
const cast: LocalUse = {
  kind: 'use',
  id: 'r1',
  label: 'Dragon’s Breath',
  spell: true,
  at: 0,
}
const struck: LocalDamage = {
  kind: 'damage',
  id: 'r1',
  label: 'Longsword damage',
  total: 9,
  critical: false,
  healing: false,
  parts: [{ type: 'Slashing', total: 9, terms: [] }],
  at: 0,
}
const preview = {
  critical: false,
  plannable: true,
  rolls: [
    { formula: '1d8 + 4', type: 'slashing', dice: [{ faces: 8, number: 1 }] },
  ],
}
const choosing = {
  ...preview,
  rolls: [
    {
      formula: '3d6',
      type: 'acid',
      types: [
        { key: 'acid', label: 'Acid' },
        { key: 'fire', label: 'Fire' },
      ],
      dice: [{ faces: 6, number: 3 }],
    },
  ],
}
/** What the game made of it: done, its damage still to roll. */
const made = (fields: Partial<TableRollState> = {}): TableRollState => ({
  status: 'done',
  visible: true,
  total: 19,
  requestId: 'req-1',
  damage: preview,
  ...fields,
})

/** Whether the tray, its latest roll this one, offers damage to roll. */
const trayOffers = (roll: LocalRoll, state: TableRollState) => {
  const { unmount } = render(
    <RollTray
      rolls={[roll]}
      rolling={false}
      table={{
        states: new Map([[roll.id, state]]),
        available: true,
        sending: true,
        rollDamage: jest.fn(),
      }}
    />,
  )
  const offers =
    within(screen.getByRole('region', { name: 'Your rolls' })).queryAllByRole(
      'button',
      { name: /^Roll / },
    ).length > 0
  unmount()
  return offers
}

/** Whether this roll's toast waits for the player, holding damage to roll and a × to close it. */
const toastWaits = (roll: LocalRoll, state: TableRollState) => {
  const { unmount } = render(
    <RollToasts
      rolls={[roll]}
      states={new Map([[roll.id, state]])}
      on
      rollDamage={jest.fn()}
    />,
  )
  const card = document.querySelector<HTMLElement>('[data-roll-toast]')
  const waits =
    card?.dataset.waits === 'true' &&
    within(card).queryByRole('button', { name: 'Dismiss' }) !== null &&
    within(card).queryAllByRole('button', { name: /^Roll / }).length > 0
  unmount()
  return waits
}

/** An attack's outcome at its target. */
const at = (outcome: 'hit' | 'miss' | null) => ({
  attack: { critical: false, fumble: false, outcome },
})

/** An area attack's outcome at each combatant in it, in order. */
const area = (...outcomes: ('hit' | 'miss' | null)[]) => ({
  attack: {
    critical: false,
    fumble: false,
    outcome: null,
    targets: outcomes.map((outcome, index) => ({
      combatId: 'c1',
      combatantId: `g${index}`,
      outcome,
    })),
  },
})

describe('damageDue, which the tray offers, and needsPlayer, for which a toast waits', () => {
  afterEach(() => {
    jest.mocked(damageDue).mockImplementation(actual.damageDue)
    jest.mocked(needsPlayer).mockImplementation(actual.needsPlayer)
  })

  it.each<[string, LocalRoll, TableRollState, boolean, boolean]>([
    [
      'an attack that hit, its damage to roll',
      attack,
      made(at('hit')),
      true,
      true,
    ],
    [
      'an attack that missed, its damage still offered',
      attack,
      made(at('miss')),
      true,
      false,
    ],
    [
      'an attack whose outcome the game kept to itself, as a hit',
      attack,
      made(at(null)),
      true,
      true,
    ],
    [
      'an attack the game says nothing of, as a hit',
      attack,
      made(),
      true,
      true,
    ],
    [
      'an area attack that missed everyone',
      attack,
      made(area('miss', 'miss')),
      true,
      false,
    ],
    [
      'an area attack that hit one of them',
      attack,
      made(area('miss', 'hit')),
      true,
      true,
    ],
    [
      'an area attack that missed everyone the game says of',
      attack,
      made(area('miss', null)),
      true,
      false,
    ],
    [
      'an area attack whose outcomes the game kept, as a hit',
      attack,
      made(area(null, null)),
      true,
      true,
    ],
    [
      'an attack whose damage is rolled',
      attack,
      made({ damaged: true }),
      false,
      false,
    ],
    [
      'an attack with no damage to follow',
      attack,
      made({ damage: null }),
      false,
      false,
    ],
    [
      'an attack the app has no id of',
      attack,
      made({ requestId: undefined }),
      false,
      false,
    ],
    ['an attack on its way', attack, { status: 'sending' }, false, false],
    [
      'an attack refused',
      attack,
      { status: 'refused', reason: 'busy' },
      false,
      false,
    ],
    [
      'an attack that failed in the game',
      attack,
      { status: 'failed', reason: 'midi', requestId: 'req-1', damage: preview },
      false,
      false,
    ],
    [
      'a use whose kind of damage is to be chosen',
      cast,
      made({ damage: choosing }),
      true,
      true,
    ],
    [
      'a use whose kind of damage is to be chosen, which has no hit or miss',
      cast,
      made({ damage: choosing, ...at('miss') }),
      true,
      true,
    ],
    ['a use whose damage is rolled at once', cast, made(), false, false],
    [
      'a use whose chosen damage is rolled',
      cast,
      made({ damage: choosing, damaged: true }),
      false,
      false,
    ],
    ['damage', struck, made(), false, false],
  ])('%s', (_, roll, state, due, waits) => {
    expect(damageDue(roll, state)).toBe(due)
    expect(needsPlayer(roll, state)).toBe(waits)
    expect(trayOffers(roll, state)).toBe(due)
    expect(toastWaits(roll, state)).toBe(waits)
  })

  it('the tray asks damageDue, and the toast needsPlayer, each following what it says', () => {
    // Damage due after a miss: offered in the tray, and the toast doesn't wait.
    jest.mocked(needsPlayer).mockReturnValue(false)
    expect(trayOffers(attack, made(at('hit')))).toBe(true)
    expect(toastWaits(attack, made(at('hit')))).toBe(false)

    jest.mocked(damageDue).mockReturnValue(false)
    expect(trayOffers(attack, made(at('hit')))).toBe(false)

    jest.mocked(damageDue).mockReturnValue(true)
    jest.mocked(needsPlayer).mockReturnValue(true)
    expect(trayOffers(attack, made({ damaged: true }))).toBe(true)
    expect(toastWaits(attack, made({ damaged: true }))).toBe(true)
  })
})
