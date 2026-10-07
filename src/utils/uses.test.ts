/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { friendly, mostTargets, picksTargets } from './uses'
import type { SheetUse } from '@/types/sending-stone'

/** A use of this kind, at these targets. */
const use = (
  type: SheetUse['type'],
  targets: Partial<SheetUse['targets']> = {},
): SheetUse => ({
  id: 'act',
  type,
  targets: {
    self: false,
    area: false,
    count: null,
    perLevel: null,
    affects: 'creature',
    ...targets,
  },
})

describe('utils/uses', () => {
  it('takes as many targets as a use affects, more for each level higher where it says so, none on oneself', () => {
    expect(mostTargets(use('heal', { count: 1 }), 1, 1)).toBe(1)
    expect(mostTargets(use('utility', { count: 3, perLevel: 1 }), 1, 1)).toBe(3)
    expect(mostTargets(use('utility', { count: 3, perLevel: 1 }), 1, 3)).toBe(5)
    expect(mostTargets(use('save', { count: 1, perLevel: 1 }), 2, null)).toBe(1)
    expect(mostTargets(use('utility', { count: 3 }), 1, 4)).toBe(3)
    expect(mostTargets(use('save', { area: true }), 3, 3)).toBe(
      Number.POSITIVE_INFINITY,
    )
    expect(
      mostTargets(use('heal', { self: true, affects: 'self' }), null, null),
    ).toBe(0)
  })

  it('picks targets for a use at someone, or at an area, but not on oneself or at nothing', () => {
    expect(picksTargets(use('save'))).toBe(true)
    expect(picksTargets(use('save', { area: true, affects: null }))).toBe(true)
    expect(picksTargets(use('heal', { self: true, affects: 'self' }))).toBe(
      false,
    )
    expect(picksTargets(use('utility', { affects: null }))).toBe(false)
    expect(picksTargets(use('utility', { affects: 'object' }))).toBe(false)
    expect(picksTargets(use('utility', { affects: 'space', area: true }))).toBe(
      true,
    )
  })

  it('makes healing and help for allies friendly, and harm not', () => {
    expect(friendly(use('heal'))).toBe(true)
    expect(friendly(use('utility', { affects: 'ally' }))).toBe(true)
    expect(friendly(use('utility', { affects: 'willing' }))).toBe(true)
    expect(friendly(use('save', { affects: 'ally' }))).toBe(true)
    expect(friendly(use('save'))).toBe(false)
    expect(friendly(use('damage', { affects: 'enemy' }))).toBe(false)
  })
})
