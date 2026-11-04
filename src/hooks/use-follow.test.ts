import { renderHook } from '@testing-library/react'
import { useFollow } from './use-follow'
import { CHECK_EVERY } from '@/constants/lifecycle'
import { advance, respond } from '@/utils/test-utils'
import type { RollRequestInput } from '@/types/roll'

const api = '/api/characters/char-1'
const endTurn: RollRequestInput = {
  kind: 'endTurn',
  turn: { combatId: 'combat-1', round: 2, combatantId: 'thorin' },
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
}

describe('hooks/use-follow', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('sends a request and follows it, telling each way and the id it was taken under', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockResolvedValue(
        respond(200, { id: 'req-1', status: 'done', rolls: [] }),
      )
    const onState = jest.fn()
    const onTaken = jest.fn()
    const { result, rerender } = renderHook(() => useFollow())
    const follow = result.current
    rerender()
    expect(result.current).toBe(follow)

    follow(api, endTurn, onState, onTaken)
    await advance(CHECK_EVERY)
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      `${api}/rolls`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(endTurn),
      }),
    )
    expect(onTaken).toHaveBeenCalledWith('req-1')
    expect(onState).toHaveBeenCalledTimes(1)
    expect(onState).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'done', requestId: 'req-1' }),
    )
  })

  it('gives up on what it follows as the page is left, and tells nothing after', async () => {
    let answer: ((response: Response) => void) | undefined
    jest.mocked(fetch).mockReturnValue(
      new Promise(resolve => {
        answer = resolve
      }),
    )
    const onState = jest.fn()
    const { result, unmount } = renderHook(() => useFollow())

    result.current(api, endTurn, onState)
    const signal = jest.mocked(fetch).mock.calls[0][1]?.signal
    expect(signal?.aborted).toBe(false)
    unmount()
    expect(signal?.aborted).toBe(true)

    // Its answer, come too late, is told to no one.
    answer?.(respond(409, { reason: 'busy' }))
    await advance(CHECK_EVERY)
    expect(onState).not.toHaveBeenCalled()
  })
})
