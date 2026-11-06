/**
 * @jest-environment node
 */
import { checkHitPoints, hitPointsAvailable } from './hit-points'
import type { HitPointsInput } from '@/types/roll'

const NOW = Date.parse('2026-11-06T12:00:00Z')

/** Hit points set from what the page showed: both fields, 21 and 0, unless said. */
const set = (
  from: HitPointsInput['from'],
  fields?: Partial<HitPointsInput>,
): HitPointsInput => ({
  op: 'set',
  ...(fields ?? { value: 21, temp: 0 }),
  from,
})

describe('utils/hit-points', () => {
  it.each([
    ['its switch on, its module fetching', true, NOW - 5000, true],
    ['its switch off, as before module 0.44.0', false, NOW - 5000, false],
    ['its module stopped fetching', true, NOW - 46_000, false],
    ['its module never fetched', true, null, false],
  ])('a campaign with %s takes them: %s', (_name, on, polled, takes) => {
    const campaign = {
      hitPointsEnabled: on,
      bridgePolledAt: polled === null ? null : new Date(polled),
    }
    expect(hitPointsAvailable(campaign, NOW)).toBe(takes)
  })

  const sheet = { hp: { value: 22, max: 30, temp: 3 } }

  it.each([
    ['both still as shown', set({ value: 22, temp: 3 }), sheet, undefined],
    [
      'hit points alone, the temporary ones moved since',
      set({ value: 22 }, { value: 18 }),
      { hp: { value: 22, max: 30, temp: 8 } },
      undefined,
    ],
    ['hit points moved', set({ value: 25, temp: 3 }), sheet, 'changed'],
    ['temporary ones moved', set({ value: 22, temp: 0 }), sheet, 'changed'],
    [
      'temporary ones alone, moved',
      set({ temp: 5 }, { temp: 0 }),
      sheet,
      'changed',
    ],
    ['a sheet without hit points', set({ value: 22 }), { hp: null }, 'unknown'],
    ['no sheet', set({ value: 22 }), undefined, 'unknown'],
  ])('checks %s', (_name, hitPoints, held, refusal) => {
    expect(checkHitPoints(hitPoints, held)).toBe(refusal)
  })
})
