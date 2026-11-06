import { follow } from './lifecycle'
import { CHECK_EVERY } from '@/constants/lifecycle'
import { advance, respond } from '@/utils/test-utils'
import type { RollRequestInput } from '@/types/roll'

const api = '/api/characters/char-1'
/** The GM's fall, 4 damage taken from 22 and 3 temporary, as the editor's Save sends it. */
const fall: RollRequestInput = {
  kind: 'hitPoints',
  hitPoints: { op: 'set', value: 21, temp: 0, from: { value: 22, temp: 3 } },
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
}

describe('utils/lifecycle, follow', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('keeps the hit points the game says are set apart from the request’s own marker (module 0.44.0)', async () => {
    const hitPoints = { value: 21, temp: 0, max: 30 }
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-hp' }))
      .mockResolvedValue(
        respond(200, {
          id: 'req-hp',
          status: 'done',
          visible: true,
          rolls: [],
          hitPoints,
        }),
      )
    const update = jest.fn()

    void follow(api, fall, new AbortController().signal, update, jest.fn())
    await advance(CHECK_EVERY)

    expect(update).toHaveBeenCalledWith({
      id: 'req-hp',
      status: 'done',
      visible: true,
      rolls: [],
      hitPointsNow: hitPoints,
      requestId: 'req-hp',
    })
  })
})
