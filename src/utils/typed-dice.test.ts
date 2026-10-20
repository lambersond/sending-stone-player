import { d20Count, d20Label, typedResult } from './typed-dice'

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
