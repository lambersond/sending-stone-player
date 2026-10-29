import {
  d20Count,
  d20Label,
  ELVEN_DIE,
  ELVEN_LABEL,
  ELVEN_LINE,
  typedResult,
} from './typed-dice'

describe('utils/typed-dice', () => {
  it('asks for one d20, two with advantage or disadvantage, and three only for Elven Accuracy with advantage', () => {
    expect(d20Count()).toBe(1)
    expect(d20Count(undefined, true)).toBe(1)
    expect(d20Count('adv')).toBe(2)
    expect(d20Count('dis')).toBe(2)
    expect(d20Count('dis', true)).toBe(2)
    expect(d20Count('adv', true)).toBe(3)
  })

  it('heads the d20s as they are thrown', () => {
    expect(d20Label()).toBe('d20')
    expect(d20Label('adv', 2)).toBe('d20, advantage')
    expect(d20Label('dis', 2)).toBe('d20, disadvantage')
    expect(d20Label('adv', 3)).toBe('d20, advantage (Elven Accuracy)')
  })

  // Round 0.42.1 §1.2: Elven Accuracy's third d20 on its own line, the switch on; the branches
  // above still ask 0.42.0's three-box group where it's turned off.
  it("asks Elven Accuracy's third d20 on its own line, from 0.42.1", () => {
    expect(ELVEN_LINE).toBe(true)
    expect(ELVEN_LABEL).toBe('Elven Accuracy: third d20')
    expect(ELVEN_DIE).toEqual({ name: 'Elven Accuracy', faces: 20, count: 1 })
  })

  // Round 0.42.1's review: the switch is how Elven Accuracy is dropped (§0.8.21), so its off
  // position must build as its on position does. Typed as its literal, `true`, turned off it
  // narrowed what it gates to `false`, which the roller can't spread, and tsc failed; this line
  // fails tsc while it's typed so.
  it('keeps ELVEN_LINE a boolean, so turning it off compiles as on does', () => {
    const flippable: boolean extends typeof ELVEN_LINE ? true : false = true
    expect(flippable).toBe(true)
  })

  it("keeps the typed d20s as the app's own throw does: the higher with advantage, the lower with disadvantage", () => {
    expect(
      typedResult([{ sides: 20, count: 1 }], [[4, 17, 9]], {
        advantage: 'adv',
        modifier: 5,
      }),
    ).toMatchObject({
      pools: [{ sides: 20, count: 1, rolls: [[4, 17, 9]], kept: [17] }],
      modifier: 5,
      advantage: 'adv',
      total: 22,
    })
    expect(
      typedResult([{ sides: 20, count: 1 }], [[4, 17]], { advantage: 'dis' }),
    ).toMatchObject({ pools: [{ rolls: [[4, 17]], kept: [4] }], total: 4 })
    expect(typedResult([{ sides: 20, count: 1 }], [[12]])).toMatchObject({
      pools: [{ sides: 20, count: 1, rolls: [[12]], kept: [12] }],
      total: 12,
    })
  })

  it('keeps every other die as typed, a die each, leaving out a pool of none', () => {
    const result = typedResult(
      [
        { sides: 6, count: 2 },
        { sides: 8, count: 0 },
        { sides: 4, count: 1 },
      ],
      [[3, 5], [], [2]],
    )
    expect(result.pools).toEqual([
      { sides: 6, count: 2, rolls: [[3], [5]], kept: [3, 5] },
      { sides: 4, count: 1, rolls: [[2]], kept: [2] },
    ])
    expect(result.total).toBe(10)
    expect(result.id).toEqual(expect.any(String))
    expect(result.at).toEqual(expect.any(Number))
  })
})
