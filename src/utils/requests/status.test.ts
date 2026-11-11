import { isDying, rollStatus, sameCounter } from './status'
import type { HeldRollRequest } from './types'
import type { RollRequestInput } from '@/types/roll'

const NOW = Date.parse('2026-10-09T20:00:00Z')
const ago = (ms: number) => new Date(NOW - ms)

const request = (fields: Partial<RollRequestInput>): RollRequestInput => ({
  kind: 'skill',
  key: 'prc',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [14] }],
  ...fields,
})

const held = (fields: Partial<HeldRollRequest> = {}): HeldRollRequest => ({
  id: 'req-1',
  actorId: 'actor-thorin',
  role: 'player',
  kind: 'skill',
  payload: request({}),
  status: 'pending',
  result: null,
  createdAt: ago(1000),
  claimedAt: null,
  ...fields,
})

describe('utils/roll-requests', () => {
  describe('isDying', () => {
    it('is so at 0 hit points, until three successes or failures, as dnd5e has it', () => {
      const at = (value: number, success: number, failure: number) =>
        isDying({
          hp: { value, max: 44, temp: 0 },
          deathSaves: { success, failure },
        })
      expect(at(0, 0, 0)).toBe(true)
      expect(at(0, 2, 2)).toBe(true)
      expect(at(0, 3, 0)).toBe(false)
      expect(at(0, 0, 3)).toBe(false)
      expect(at(1, 0, 0)).toBe(false)
      expect(
        isDying({ hp: { value: 0, max: 44, temp: 0 }, deathSaves: null }),
      ).toBe(false)
      expect(isDying()).toBe(false)
    })
  })

  describe('rollStatus', () => {
    it('is sending until the module fetches it, then expired', () => {
      expect(rollStatus(held(), NOW)).toBe('sending')
      expect(rollStatus(held({ createdAt: ago(30_000) }), NOW)).toBe('expired')
    })

    it('is rolling once fetched, then lost without an answer', () => {
      expect(
        rollStatus(held({ status: 'claimed', claimedAt: ago(74_000) }), NOW),
      ).toBe('rolling')
      expect(
        rollStatus(held({ status: 'claimed', claimedAt: ago(75_000) }), NOW),
      ).toBe('lost')
      expect(
        rollStatus(
          held({ status: 'claimed', claimedAt: null, createdAt: ago(76_000) }),
          NOW,
        ),
      ).toBe('lost')
    })

    it('doesn’t count the time the game held it asking for its run’s later dice, from module 0.44.0', () => {
      const claimed = held({ status: 'claimed', claimedAt: ago(100_000) })
      expect(rollStatus(claimed, NOW, 26_000)).toBe('rolling')
      expect(rollStatus(claimed, NOW, 25_000)).toBe('lost')
    })

    it('is what the module answered', () => {
      expect(rollStatus(held({ status: 'done' }), NOW)).toBe('done')
      expect(rollStatus(held({ status: 'failed' }), NOW)).toBe('failed')
    })
  })
})

describe('utils/roll-requests for concentration, charges and Heroic Inspiration, from module 0.29.0', () => {
  it.each([
    [{ item: 'a' }, { item: 'a' }, true],
    [{ item: 'a', activity: 'b' }, { item: 'a', activity: 'b' }, true],
    [{ resource: 'primary' }, { resource: 'primary' }, true],
    [{ item: 'a' }, { item: 'b' }, false],
    [{ item: 'a' }, { item: 'a', activity: 'b' }, false],
    [{ item: 'a', activity: 'b' }, { item: 'a', activity: 'c' }, false],
    [{ resource: 'primary' }, { resource: 'secondary' }, false],
    [{ resource: 'primary' }, { item: 'primary' }, false],
    [undefined, undefined, false],
    [{ item: 'a' }, undefined, false],
  ] as const)('takes %j and %j for the same counter: %p', (a, b, same) => {
    expect(sameCounter(a, b)).toBe(same)
    expect(sameCounter(b, a)).toBe(same)
  })
})
