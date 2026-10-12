/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  allApplied,
  belongingsOf,
  enchantmentParts,
  enchantOf,
  offeredAt,
  offeredProfiles,
} from './enchantments'
import {
  enchantingSheet,
  enchantment,
  enchantUse,
  MAGIC_WEAPON_PROFILES,
} from '@/mocks/sending-stone'

const [PLUS_ONE, PLUS_TWO, PLUS_THREE] = MAGIC_WEAPON_PROFILES

/** Dagger of Venom's Coat Blade, which enchants its own blade, so. */
const coat = (fields = {}) =>
  enchantUse('coat', {
    self: true,
    profiles: [{ id: 'venom', name: 'Venom', min: null, max: null }],
    ...fields,
  }).enchant!

describe('utils/enchantments', () => {
  it('offers a way with limits within them, and one without at any level', () => {
    expect(offeredAt(PLUS_ONE, 2)).toBe(true)
    expect(offeredAt(PLUS_ONE, 3)).toBe(true)
    expect(offeredAt(PLUS_ONE, 4)).toBe(false)
    expect(offeredAt(PLUS_TWO, 4)).toBe(true)
    expect(offeredAt(PLUS_TWO, 6)).toBe(false)
    expect(offeredAt(PLUS_THREE, 9)).toBe(true)
    // A level it can't say offers nothing with limits, and anything without.
    expect(offeredAt(PLUS_ONE, null)).toBe(false)
    expect(
      offeredAt({ id: 'x', name: 'Ablaze', min: null, max: null }, null),
    ).toBe(true)
  })

  it('offers the ways at the level it is cast at, but those on its own item already', () => {
    const magicWeapon = enchantUse('mw', {
      profiles: MAGIC_WEAPON_PROFILES,
      applied: [{ item: 'club', effect: 'e1', profile: PLUS_ONE.id }],
    }).enchant!
    expect(offeredProfiles(magicWeapon, 2)).toEqual([PLUS_ONE])
    expect(offeredProfiles(magicWeapon, 5)).toEqual([PLUS_TWO])
    expect(offeredProfiles(magicWeapon, null)).toEqual([])
    const flameBlade = enchantUse('blade', {
      self: true,
      profiles: [
        { id: 'one', name: 'Flame Blade (Fire)', min: null, max: null },
        { id: 'two', name: 'Flame Blade (Cold)', min: null, max: null },
      ],
      applied: [{ item: 'blade', effect: 'e2', profile: 'one' }],
    }).enchant!
    expect(offeredProfiles(flameBlade, 2).map(({ id }) => id)).toEqual(['two'])
  })

  it('says one that enchants its own item is on it in every way only when nothing is left to use it for', () => {
    expect(allApplied(coat())).toBe(false)
    const coated = {
      applied: [{ item: 'venom', effect: 'e3', profile: 'venom' }],
    }
    expect(allApplied(coat(coated))).toBe(true)
    // A switch is turned off, not ended so; and one on another item is used again.
    expect(allApplied(coat({ ...coated, toggle: true }))).toBe(false)
    expect(allApplied(coat({ ...coated, self: false }))).toBe(false)
  })

  it('finds an enchant activity only in one that enchants', () => {
    expect(enchantOf(enchantUse('mw'))).toEqual(enchantUse('mw').enchant)
    expect(enchantOf({ ...enchantUse('mw'), type: 'utility' })).toBeUndefined()
    expect(enchantOf(null)).toBeUndefined()
  })

  it('names what the character has, in containers too, then their spells and features', () => {
    const sheet = enchantingSheet()
    const belongings = belongingsOf(sheet)
    expect(belongings.get('longsword')).toEqual({
      name: 'Longsword',
      img: 'https://game.test/longsword.webp',
    })
    expect(belongings.get('pebble')?.name).toBe('Pebble')
    expect(belongings.get('magicweapon')?.name).toBe('Magic Weapon')
    expect(belongings.get('spear')?.name).toBe('Eldritch Spear')
    expect(belongingsOf({}).size).toBe(0)
  })

  it('says of an enchantment whether it lasts while its caster concentrates, how long, and what put it there', () => {
    expect(
      enchantmentParts(
        enchantment({
          id: 'e',
          name: 'Magic Weapon, +1',
          source: 'Magic Weapon',
          concentration: true,
          duration: '59 Minutes',
        }),
      ).filter(Boolean),
    ).toEqual(['Concentration', '59 Minutes', 'from Magic Weapon'])
    expect(
      enchantmentParts(
        enchantment({
          id: 'e',
          name: 'Shillelagh',
          duration: '1 Minute',
          expired: true,
        }),
      ).filter(Boolean),
    ).toEqual(['Expired'])
  })
})
