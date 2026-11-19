import { act, renderHook } from '@testing-library/react'
import { useEncounterChoice } from './use-encounter-choice'
import { mockTurnCombat } from '@/mocks/sending-stone'
import type { TableCombat } from '@/types/table'

const a = mockTurnCombat({ id: 'a' })
const b = mockTurnCombat({ id: 'b' })
const before = mockTurnCombat({ id: '0' })

const choice = (combats: TableCombat[], preferred?: string) =>
  renderHook(props => useEncounterChoice(props.combats, props.preferred), {
    initialProps: { combats, preferred },
  })

describe('useEncounterChoice (item 36)', () => {
  it('shows the seat’s own first, and keeps it across a view where another sorts first', () => {
    const { result, rerender } = choice([a, b], 'b')
    expect(result.current.shown?.id).toBe('b')
    rerender({ combats: [before, a, b], preferred: 'a' })
    expect(result.current.shown?.id).toBe('b')
  })

  it('shows another chosen, and keeps it', () => {
    const { result, rerender } = choice([a, b], 'a')
    act(() => result.current.choose('b'))
    expect(result.current.shown?.id).toBe('b')
    rerender({ combats: [a, b], preferred: 'a' })
    expect(result.current.shown?.id).toBe('b')
  })

  it('falls to the seat’s own once the one shown goes', () => {
    const { result, rerender } = choice([a, b], 'a')
    act(() => result.current.choose('b'))
    rerender({ combats: [before, a], preferred: 'a' })
    expect(result.current.shown?.id).toBe('a')
  })
})
