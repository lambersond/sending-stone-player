/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import { render, screen, within } from '@testing-library/react'
import { RollToasts } from './roll-toasts'
import { RollTray } from './roll-tray'
import { needsPlayer, type TableRollState } from '@/hooks/use-table-rolls'
import type {
  LocalCheck,
  LocalDamage,
  LocalRoll,
  LocalUse,
} from '@/hooks/use-sheet-roller'

// The real one, watched, so that a test can have it say otherwise.
jest.mock('@/hooks/use-table-rolls', () => {
  const actual = jest.requireActual<typeof import('@/hooks/use-table-rolls')>(
    '@/hooks/use-table-rolls',
  )
  return { ...actual, needsPlayer: jest.fn(actual.needsPlayer) }
})

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

describe('needsPlayer, which the tray and the toasts share', () => {
  afterEach(() => {
    jest
      .mocked(needsPlayer)
      .mockImplementation(
        jest.requireActual<typeof import('@/hooks/use-table-rolls')>(
          '@/hooks/use-table-rolls',
        ).needsPlayer,
      )
  })

  it.each<[string, LocalRoll, TableRollState, boolean]>([
    ['an attack that hit, its damage to roll', attack, made(), true],
    [
      'an attack that missed, its damage still offered',
      attack,
      made({ attack: { critical: false, fumble: false, outcome: 'miss' } }),
      true,
    ],
    [
      'an attack whose damage is rolled',
      attack,
      made({ damaged: true }),
      false,
    ],
    [
      'an attack with no damage to follow',
      attack,
      made({ damage: null }),
      false,
    ],
    [
      'an attack the app has no id of',
      attack,
      made({ requestId: undefined }),
      false,
    ],
    ['an attack on its way', attack, { status: 'sending' }, false],
    ['an attack refused', attack, { status: 'refused', reason: 'busy' }, false],
    [
      'an attack that failed in the game',
      attack,
      { status: 'failed', reason: 'midi', requestId: 'req-1', damage: preview },
      false,
    ],
    [
      'a use whose kind of damage is to be chosen',
      cast,
      made({ damage: choosing }),
      true,
    ],
    ['a use whose damage is rolled at once', cast, made(), false],
    [
      'a use whose chosen damage is rolled',
      cast,
      made({ damage: choosing, damaged: true }),
      false,
    ],
    ['damage', struck, made(), false],
  ])('%s: %s', (_, roll, state, waits) => {
    expect(needsPlayer(roll, state)).toBe(waits)
    expect(trayOffers(roll, state)).toBe(waits)
    expect(toastWaits(roll, state)).toBe(waits)
  })

  it('is what both ask, so that neither waits where it says not, nor stops where it says to', () => {
    jest.mocked(needsPlayer).mockReturnValue(false)
    expect(trayOffers(attack, made())).toBe(false)
    expect(toastWaits(attack, made())).toBe(false)

    jest.mocked(needsPlayer).mockReturnValue(true)
    expect(trayOffers(attack, made({ damaged: true }))).toBe(true)
    expect(toastWaits(attack, made({ damaged: true }))).toBe(true)
  })
})
