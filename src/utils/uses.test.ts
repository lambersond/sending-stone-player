/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  friendly,
  fromSelf,
  mostTargets,
  offersSelf,
  picksTargets,
  selfDefault,
} from './uses'
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

/** An action used through this use, at this range. */
const at = (range: string | null, activity: SheetUse) => ({
  range,
  activity,
})
/** A use whose range is Self, as the sheet says from module 0.22.0. */
const ranged = (
  type: SheetUse['type'],
  targets: Partial<SheetUse['targets']> = {},
) => use(type, { fromSelf: true, ...targets })

describe('utils/uses', () => {
  it('takes as many targets as a use affects, more for each level higher where it says so, none on oneself', () => {
    expect(mostTargets(use('heal', { count: 1 }).targets, 1, 1)).toBe(1)
    expect(
      mostTargets(use('utility', { count: 3, perLevel: 1 }).targets, 1, 1),
    ).toBe(3)
    expect(
      mostTargets(use('utility', { count: 3, perLevel: 1 }).targets, 1, 3),
    ).toBe(5)
    expect(
      mostTargets(use('save', { count: 1, perLevel: 1 }).targets, 2, null),
    ).toBe(1)
    expect(mostTargets(use('utility', { count: 3 }).targets, 1, 4)).toBe(3)
    expect(mostTargets(use('save', { area: true }).targets, 3, 3)).toBe(
      Number.POSITIVE_INFINITY,
    )
    expect(
      mostTargets(
        use('heal', { self: true, affects: 'self' }).targets,
        null,
        null,
      ),
    ).toBe(0)
  })

  it("takes as many targets as an area attack's area does, more for each level higher where it says so, or any number", () => {
    const cone = { count: 2, perLevel: 1, affects: 'creature' }
    expect(mostTargets(cone, 1, 1)).toBe(2)
    expect(mostTargets(cone, 1, 3)).toBe(4)
    // Not a spell, it's made at as many as its area takes.
    expect(mostTargets(cone, null, null)).toBe(2)
    expect(mostTargets({ ...cone, perLevel: null }, 1, 5)).toBe(2)
    expect(mostTargets({ ...cone, count: null }, null, null)).toBe(
      Number.POSITIVE_INFINITY,
    )
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

  it('has no targets to pick for an enchant activity, from module 0.21.0, whatever dnd5e says it affects', () => {
    expect(picksTargets(use('enchant'))).toBe(false)
    expect(
      picksTargets(use('enchant', { affects: 'creature', count: 1 })),
    ).toBe(false)
    expect(picksTargets(use('enchant', { self: true, affects: null }))).toBe(
      false,
    )
    expect(picksTargets(use('enchant', { area: true }))).toBe(false)
  })

  it('makes healing and help for allies friendly, and harm not', () => {
    expect(friendly(use('heal'))).toBe(true)
    expect(friendly(use('utility', { affects: 'ally' }))).toBe(true)
    expect(friendly(use('utility', { affects: 'willing' }))).toBe(true)
    expect(friendly(use('save', { affects: 'ally' }))).toBe(true)
    expect(friendly(use('save'))).toBe(false)
    expect(friendly(use('damage', { affects: 'enemy' }))).toBe(false)
  })

  describe('Self, from module 0.22.0', () => {
    it.each<[string, ReturnType<typeof at>, boolean, boolean]>([
      [
        'a potion: healing, Self, any creatures',
        at('Self', ranged('heal')),
        true,
        true,
      ],
      [
        'Wild Shape: a utility, Self, a creature',
        at('Self', ranged('utility', { count: 1 })),
        true,
        true,
      ],
      [
        'Second Wind: its user alone',
        at('Self', use('heal', { self: true, affects: 'self' })),
        true,
        true,
      ],
      [
        'a saving throw, Self, a creature',
        at('Self', ranged('save', { count: 1 })),
        false,
        true,
      ],
      [
        'damage, Self, an area',
        at('Self', ranged('damage', { area: true })),
        false,
        true,
      ],
      [
        'healing, Self, an area',
        at('Self', ranged('heal', { area: true })),
        false,
        true,
      ],
      [
        'a check, Self, a creature',
        at('Self', ranged('check', { count: 1 })),
        false,
        true,
      ],
      [
        'harm at enemies, Self',
        at('Self', ranged('damage', { affects: 'enemy' })),
        false,
        false,
      ],
      [
        'healing by touch',
        at('Touch', use('heal', { count: 1, fromSelf: false })),
        false,
        true,
      ],
      [
        'help with no target',
        at('30 ft', use('utility', { affects: null, fromSelf: false })),
        false,
        false,
      ],
      [
        'an enchantment, Self',
        at('Self', ranged('enchant', { self: true })),
        false,
        false,
      ],
    ])(
      '%s: Self by default %s, offered %s',
      (_name, action, byDefault, offered) => {
        expect(selfDefault(action)).toBe(byDefault)
        expect(offersSelf(action)).toBe(offered)
      },
    )

    it('reads a range of Self from the action, whatever its case, where the sheet says nothing, as before module 0.22.0', () => {
      const potion = use('heal')
      expect(fromSelf(at('Self', potion))).toBe(true)
      expect(fromSelf(at(' self ', potion))).toBe(true)
      expect(fromSelf(at('Touch', potion))).toBe(false)
      expect(fromSelf(at(null, potion))).toBe(false)
      expect(selfDefault(at('SELF', potion))).toBe(true)
      // What the sheet says stands.
      expect(fromSelf(at('Touch', ranged('heal')))).toBe(true)
      expect(fromSelf(at('Self', use('heal', { fromSelf: false })))).toBe(false)
    })
  })
})
