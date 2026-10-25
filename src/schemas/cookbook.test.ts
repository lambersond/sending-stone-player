/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- the cookbook's body uses null for an absent value */
import { cookbookDishSchema, KNOWN_CHANGES } from './cookbook'
import {
  ashenRootFailure,
  fireberryBoon,
  fireberrySuccess,
  malformedKnown,
  SEEDED_DISHES,
  unknownKind,
} from '@/mocks/cookbook'
import type { CookbookDishBody } from '@/types/cookbook'

/** A body as fireberryBoon, with these fields changed: a deep copy, so nothing is shared. */
function body(change: (body: Record<string, any>) => void = () => {}) {
  const copy = structuredClone(fireberryBoon) as Record<string, any>
  change(copy)
  return copy
}

/** The first issue's path, joined as the route answers it. */
function refused(value: unknown): string {
  const parsed = cookbookDishSchema.safeParse(value)
  if (parsed.success) throw new Error('taken')
  return parsed.error.issues[0].path.join('.')
}

describe('cookbookDishSchema', () => {
  it('takes every fixture, and the eight from the seed back unchanged', () => {
    for (const dish of [...SEEDED_DISHES, unknownKind, malformedKnown]) {
      expect(cookbookDishSchema.safeParse(dish).success).toBe(true)
    }
    for (const dish of SEEDED_DISHES) {
      expect(cookbookDishSchema.parse(dish)).toEqual(dish)
    }
  })

  it('knows every kind the cookbook sends', () => {
    const kinds = new Set(
      SEEDED_DISHES.flatMap(dish => dish.effect?.changes ?? []).map(
        ({ type }) => type,
      ),
    )
    for (const kind of kinds) {
      expect(KNOWN_CHANGES as readonly string[]).toContain(kind)
    }
  })

  it.each([
    ['an empty status', (b: any) => (b.dish.status = ''), 'dish.status'],
    [
      'an unknown outcome',
      (b: any) => (b.dish.outcome = 'great'),
      'dish.outcome',
    ],
    ['a dish id with a space', (b: any) => (b.dish.id = 'cmh2 k8q'), 'dish.id'],
    ['no effect on a boon', (b: any) => (b.effect = null), 'effect'],
    ['stacks: true', (b: any) => (b.effect.stacks = true), 'effect.stacks'],
    [
      'a change type of <img>',
      (b: any) => b.effect.changes.push({ type: '<img>', value: 1 }),
      'effect.changes.2.type',
    ],
    ['version "2"', (b: any) => (b.version = '2'), 'version'],
    ['no version', (b: any) => delete b.version, 'version'],
    ['an empty recipe', (b: any) => (b.dish.recipe = ''), 'dish.recipe'],
    ['an empty effect name', (b: any) => (b.effect.name = ''), 'effect.name'],
    [
      'more than 20 ingredients',
      (b: any) =>
        (b.effect.ingredients = Array.from({ length: 21 }, () => ({
          name: 'Fireberries',
          text: 'Hot.',
        }))),
      'effect.ingredients',
    ],
  ])('refuses %s', (_name, change, path) => {
    expect(refused(body(change))).toBe(path)
  })

  it('refuses an effect on a standard dish', () => {
    expect(
      refused({
        ...structuredClone(fireberrySuccess),
        effect: fireberryBoon.effect,
      }),
    ).toBe('effect')
  })

  it("keeps a change it doesn't know, and one whose fields it refuses, exactly as sent", () => {
    expect(cookbookDishSchema.parse(unknownKind).effect?.changes[2]).toEqual({
      type: 'tempHitPoints',
      value: 5,
    })
    expect(cookbookDishSchema.parse(malformedKnown).effect?.changes[2]).toEqual(
      {
        type: 'abilityScore',
        ability: 'str',
        value: 0,
      },
    )
    const extra = body(b =>
      b.effect.changes.push({ type: 'tempHitPoints', value: 5, from: 'x' }),
    )
    expect(cookbookDishSchema.parse(extra).effect?.changes[2]).toEqual({
      type: 'tempHitPoints',
      value: 5,
      from: 'x',
    })
  })

  it('refuses a kept change of more than 20 keys, or more than 1 KB, with its place', () => {
    const keys = body(b =>
      b.effect.changes.push(
        Object.fromEntries([
          ['type', 'tempHitPoints'],
          ...Array.from({ length: 20 }, (_, n) => [`k${n}`, n]),
        ]),
      ),
    )
    expect(refused(keys)).toBe('effect.changes.2')
    const large = body(b =>
      b.effect.changes.push({ type: 'tempHitPoints', note: 'x'.repeat(1024) }),
    )
    expect(refused(large)).toBe('effect.changes.2')
    // Just within both.
    const within = body(b =>
      b.effect.changes.push(
        Object.fromEntries([
          ['type', 'tempHitPoints'],
          ...Array.from({ length: 19 }, (_, n) => [`k${n}`, n]),
        ]),
      ),
    )
    expect(cookbookDishSchema.safeParse(within).success).toBe(true)
  })

  it('strips a known change to its own keys', () => {
    const extra = body(b => (b.effect.changes[1].extra = 'more'))
    expect(cookbookDishSchema.parse(extra).effect?.changes[1]).toEqual({
      type: 'damageResistance',
      damageType: 'fire',
    })
  })

  it('takes a rolled maximum beyond 10 with its formula, and refuses a flat one', () => {
    const rolled = body(
      b =>
        (b.effect.changes[0] = {
          type: 'maxHitPoints',
          value: 14,
          formula: '2d6+2',
        }),
    )
    expect(cookbookDishSchema.parse(rolled).effect?.changes[0]).toEqual({
      type: 'maxHitPoints',
      value: 14,
      formula: '2d6+2',
    })
    // A flat maximum of 14 is no known change, so it's kept as sent for the module to skip.
    const flat = body(
      b => (b.effect.changes[0] = { type: 'maxHitPoints', value: 14 }),
    )
    expect(cookbookDishSchema.parse(flat).effect?.changes[0]).toEqual({
      type: 'maxHitPoints',
      value: 14,
    })
  })

  it('takes a legacy "fail" standard dish, reading only its outcome', () => {
    const legacy = {
      ...structuredClone(ashenRootFailure),
      dish: { ...ashenRootFailure.dish, status: 'fail' },
    }
    expect(cookbookDishSchema.parse(legacy).dish.status).toBe('fail')
  })

  it('cuts a long cook name to 200, never refusing it', () => {
    const long = body(b => (b.cook.name = 'T'.repeat(250)))
    expect(cookbookDishSchema.parse(long).cook.name).toBe('T'.repeat(200))
  })

  it('strips an unknown top-level key', () => {
    const parsed = cookbookDishSchema.parse(
      body(b => (b.extra = 1)),
    ) as CookbookDishBody & {
      extra?: number
    }
    expect(parsed.extra).toBeUndefined()
  })
})
