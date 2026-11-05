/**
 * @jest-environment node
 */
import { due } from './commands'

describe('db/commands', () => {
  it('notes a key at most once every so often, forgetting each whose time has passed', () => {
    const noted = new Map<string, number>()

    const decisions = [
      due(noted, 'a', 1000, 10_000),
      due(noted, 'b', 1000, 10_500),
      due(noted, 'a', 1000, 10_999),
      due(noted, 'a', 1000, 11_000),
      due(noted, 'c', 1000, 11_600),
    ]

    expect(decisions).toEqual([true, true, false, true, true])
    expect([...noted]).toEqual([
      ['a', 11_000],
      ['c', 11_600],
    ])
    expect(due(noted, 'b', 1000, 11_601)).toBe(true)
    expect(due(noted, 'a', 1000, 11_999)).toBe(false)
  })
})
