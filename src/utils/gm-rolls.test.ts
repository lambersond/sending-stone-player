import { gmRollParts, gmRollsKey } from './gm-rolls'
import { PARTY } from '@/mocks/sending-stone'
import type { HeldRollRequest } from '@/utils/requests/types'

const NOW = Date.parse('2026-11-09T12:00:00Z')
const ago = (ms: number) => new Date(NOW - ms)

/** One of the Gamemaster's rolls as Thorin, as kept: made a moment ago, its damage healing none. */
const made = (
  fields: Partial<HeldRollRequest> & {
    useId?: string | null
    completedAt?: Date | null
  } = {},
) => ({
  id: 'gm-roll-1',
  actorId: PARTY.thorin,
  role: 'gm' as const,
  kind: 'damage',
  payload: {
    kind: 'damage',
    mode: 0,
    explicit: false,
    extras: [],
    dice: [{ faces: 8, results: [5] }],
  },
  status: 'done' as const,
  result: null,
  createdAt: ago(10_000),
  claimedAt: ago(9000),
  completedAt: ago(8000),
  label: null,
  useId: null,
  ...fields,
})

describe('utils/gm-rolls', () => {
  describe('gmRollsKey', () => {
    it('has none for no rolls', () => {
      expect(gmRollsKey([], NOW)).toBeUndefined()
    })

    it('is the same while nothing changes, and changes whenever a status or an answer does', () => {
      const key = gmRollsKey([made()], NOW)
      expect(key).toMatch(/^[\w-]{16}$/)
      expect(gmRollsKey([made()], NOW)).toBe(key)
      // Answered at another time.
      expect(gmRollsKey([made({ completedAt: ago(1000) })], NOW)).not.toBe(key)
      // Its status, as time moves it too: one still waiting, then lost.
      const waiting = made({
        status: 'pending',
        claimedAt: null,
        completedAt: null,
      })
      expect(gmRollsKey([waiting], NOW)).not.toBe(
        gmRollsKey([waiting], NOW + 3_600_000),
      )
      // Another roll.
      expect(gmRollsKey([made({ id: 'gm-roll-2' })], NOW)).not.toBe(key)
    })
  })

  describe('gmRollParts', () => {
    it('adds nothing to a view where the Gamemaster made none', () => {
      expect(gmRollParts([], new Set(), NOW)).toEqual({})
    })

    it('tells each, newest first, damage that follows a healing use as healing, with what tells them apart', () => {
      const rolls = [
        made({ id: 'gm-roll-2', useId: 'use-cure' }),
        made({ id: 'gm-roll-1', useId: 'use-axe' }),
      ]
      const parts = gmRollParts(rolls, new Set(['use-cure']), NOW)
      expect(parts.gmRolls?.map(({ id }) => id)).toEqual([
        'gm-roll-2',
        'gm-roll-1',
      ])
      expect(parts.gmRolls?.[0]).toHaveProperty('healing', true)
      expect(parts.gmRolls?.[1]).not.toHaveProperty('healing')
      expect(parts.gmRollsKey).toBe(gmRollsKey(rolls, NOW))
      // Damage that follows nothing heals nothing.
      expect(
        gmRollParts([made()], new Set(['use-cure']), NOW).gmRolls?.[0],
      ).not.toHaveProperty('healing')
    })
  })
})
