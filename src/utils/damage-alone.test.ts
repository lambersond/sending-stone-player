/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import { aloneRollOf } from './damage-alone'
import { mockTableDamage } from '@/mocks/sending-stone'
import type { TableDamagePlan } from '@/types/sending-stone'

const bite = {
  item: 'wolfBite',
  activity: 'biteAttack',
  plan: mockTableDamage(),
}

const fire = {
  critical: false,
  plannable: true,
  rolls: [
    {
      formula: '2d6',
      type: 'Fire',
      types: [
        { key: 'fire', label: 'Fire' },
        { key: 'cold', label: 'Cold' },
      ],
      dice: [{ faces: 6, number: 2 }],
      perDie: 1,
    },
  ],
}

describe('utils/damage-alone', () => {
  it("rolls the plan's normal damage, called after what it's of, as its own item and activity", () => {
    const roll = aloneRollOf('Bite', bite)

    expect(roll).toMatchObject({
      label: 'Bite damage',
      critical: false,
      healing: false,
      exact: true,
      perDie: 1,
      parts: [
        {
          type: 'Slashing',
          terms: [
            { count: 1, sides: 8, sign: 1 },
            { flat: 3, sign: 1 },
          ],
        },
      ],
      alone: { item: 'wolfBite', activity: 'biteAttack', critical: false },
    })
    // It follows no attack or use of the game's.
    expect(roll).not.toHaveProperty('use')
  })

  it("rolls the plan's critical damage for a critical hit, its dice as the game doubles them", () => {
    const roll = aloneRollOf('Bite', bite, { critical: true })

    expect(roll).toMatchObject({
      label: 'Bite damage',
      critical: true,
      perDie: 2,
      parts: [
        {
          terms: [
            { count: 2, sides: 8, sign: 1 },
            { flat: 3, sign: 1 },
          ],
        },
      ],
      alone: { critical: true },
    })
  })

  it('never makes a critical hit’s from a plan whose critical is null', () => {
    const plan: TableDamagePlan = { ...mockTableDamage(), critical: null }

    const roll = aloneRollOf(
      'Frost Breath',
      { ...bite, plan },
      { critical: true },
    )

    expect(roll).toMatchObject({
      critical: false,
      perDie: 1,
      parts: [
        {
          terms: [{ count: 1, sides: 8, sign: 1 }, expect.anything()],
        },
      ],
      alone: { critical: false },
    })
  })

  it('calls healing healing', () => {
    const plan: TableDamagePlan = {
      normal: { ...mockTableDamage().normal, healing: true },
      critical: null,
    }

    expect(
      aloneRollOf('Cure Wounds', { item: 'cure', activity: 'heal', plan }),
    ).toMatchObject({ label: 'Cure Wounds healing', healing: true })
  })

  it('carries the kind chosen and the changes made', () => {
    const plan: TableDamagePlan = { normal: fire, critical: null }

    const roll = aloneRollOf(
      'Chromatic Orb',
      { item: 'orb', activity: 'orbAttack', plan },
      { type: 'cold', modifiers: { maximize: true } },
    )

    expect(roll).toMatchObject({
      types: ['cold'],
      modifiers: { maximize: true },
      parts: [{ type: 'Cold' }],
    })
  })

  it('makes none where the game said nothing of its dice', () => {
    expect(
      aloneRollOf('Bite', { item: 'wolfBite', activity: 'biteAttack' }),
    ).toBeUndefined()
  })
})
