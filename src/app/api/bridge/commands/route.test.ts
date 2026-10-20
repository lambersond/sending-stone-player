/**
 * @jest-environment node
 */
import { OPTIONS, POST } from './route'
import { findEventCampaign } from '@/db/campaigns'
import {
  claimRollRequests,
  markBridgePolled,
  openActorIds,
} from '@/db/roll-requests'
import type { RollCommand } from '@/utils/roll-requests'

jest.mock('@/db/campaigns', () => ({ findEventCampaign: jest.fn() }))
jest.mock('@/db/roll-requests', () => ({
  claimRollRequests: jest.fn(),
  markBridgePolled: jest.fn(),
  openActorIds: jest.fn(),
}))

const URL = 'https://player.example/api/bridge/commands'
const GAME = 'https://my-game.forge-vtt.com'
const campaign = { id: 'camp-a', title: 'The Lonely Mountain' }
const poll = { protocol: 2, session: 's1', campaign }

const command: RollCommand = {
  id: 'req-1',
  actorId: 'actor-thorin',
  kind: 'skill',
  key: 'prc',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [14] }],
}

const post = (
  body: unknown = poll,
  headers: Record<string, string> = {},
  signal?: AbortSignal,
): Promise<Response> =>
  POST(
    new Request(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer hunter2',
        Origin: GAME,
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
      signal,
    }),
  )

/** A refusal as the module reads it: its status kept, CORS headers, and why, in JSON. */
const expectRefusal = async (
  response: Response,
  status: number,
  body: object,
  origin = GAME,
) => {
  expect(response.status).toBe(status)
  expect(response.headers.get('content-type')).toMatch(/^application\/json/)
  expect(response.headers.get('access-control-allow-origin')).toBe(origin)
  expect(response.headers.get('cache-control')).toBe('no-store')
  await expect(response.json()).resolves.toEqual(body)
}

const UNAVAILABLE = {
  reason: 'unavailable',
  message: 'Sending Stone couldn’t take this just now',
}

/**
 * The players' rolls as the campaign's game is ready for them, and from module 0.31.0 their moves
 * of items and coins.
 */
const given = (
  rollsEnabled: boolean,
  playersPresent: boolean,
  transfersEnabled = false,
) =>
  jest
    .mocked(markBridgePolled)
    .mockResolvedValue({ rollsEnabled, transfersEnabled, playersPresent })

describe('app/api/bridge/commands', () => {
  beforeEach(() => {
    jest
      .mocked(findEventCampaign)
      .mockResolvedValue({ id: 'c1', helloSession: 's1' })
    given(true, false)
    jest.mocked(claimRollRequests).mockResolvedValue([])
    // Thorin's player has his sheet open.
    jest.mocked(openActorIds).mockResolvedValue(['thorin'])
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('lets the game page fetch from its own origin', () => {
    const response = OPTIONS(
      new Request(URL, { method: 'OPTIONS', headers: { Origin: GAME } }),
    )

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(GAME)
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
      'Content-Type, Authorization',
    )
  })

  it("hands over the campaign's waiting rolls, once the secret is checked as its", async () => {
    jest.mocked(claimRollRequests).mockResolvedValue([command])

    const response = await post()

    expect(response.status).toBe(200)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(GAME)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({
      commands: [command],
      wait: 10_000,
      open: ['thorin'],
    })
    expect(findEventCampaign).toHaveBeenCalledWith(GAME, campaign, 'hunter2')
    expect(markBridgePolled).toHaveBeenCalledWith('c1')
    expect(claimRollRequests).toHaveBeenCalledWith('c1', 's1')
    expect(openActorIds).toHaveBeenCalledWith('c1')
  })

  it('answers at once, saying to ask again in a minute, while the campaign takes no rolls', async () => {
    given(false, true)

    const response = await post()

    await expect(response.json()).resolves.toEqual({
      commands: [],
      wait: 60_000,
      open: ['thorin'],
    })
    expect(claimRollRequests).not.toHaveBeenCalled()
  })

  it('hands over moves of items and coins with rolls off, from module 0.31.0, holding the fetch open as for a roll', async () => {
    given(false, false, true)
    jest.mocked(claimRollRequests).mockResolvedValue([command])

    const cold = await post()

    await expect(cold.json()).resolves.toEqual({
      commands: [command],
      wait: 10_000,
      open: ['thorin'],
    })
    expect(claimRollRequests).toHaveBeenCalledWith('c1', 's1')

    jest.useFakeTimers()
    given(false, true, true)
    jest
      .mocked(claimRollRequests)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([command])
    let answered: Response | undefined
    void post().then(response => (answered = response))

    await jest.advanceTimersByTimeAsync(500)
    expect(answered).toBeUndefined()
    await jest.advanceTimersByTimeAsync(1000)
    await expect(answered?.json()).resolves.toEqual({
      commands: [command],
      open: ['thorin'],
    })
  })

  it('says no one is open, where no character is', async () => {
    jest.mocked(openActorIds).mockResolvedValue([])

    const response = await post()

    await expect(response.json()).resolves.toEqual({
      commands: [],
      wait: 10_000,
      open: [],
    })
  })

  it('hands over no rolls, which would be lost, when it cannot read which characters are open', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    jest.mocked(openActorIds).mockRejectedValue(new Error('db down'))

    const response = await post()

    await expectRefusal(response, 500, UNAVAILABLE)
    expect(claimRollRequests).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  describe('while players are at the table', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      given(true, true)
    })

    it('answers at once with the rolls waiting, to fetch again at once', async () => {
      jest.mocked(claimRollRequests).mockResolvedValue([command])

      const response = await post()

      await expect(response.json()).resolves.toEqual({
        commands: [command],
        open: ['thorin'],
      })
    })

    it('holds the fetch open until a roll comes', async () => {
      jest
        .mocked(claimRollRequests)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([command])
      let answered: Response | undefined
      void post().then(response => (answered = response))

      await jest.advanceTimersByTimeAsync(1500)
      expect(answered).toBeUndefined()
      expect(claimRollRequests).toHaveBeenCalledTimes(2)

      await jest.advanceTimersByTimeAsync(500)
      expect(answered?.status).toBe(200)
      await expect(answered?.json()).resolves.toEqual({
        commands: [command],
        open: ['thorin'],
      })
    })

    it('answers with nothing after twenty seconds without a roll', async () => {
      let answered: Response | undefined
      void post().then(response => (answered = response))

      await jest.advanceTimersByTimeAsync(19_900)
      expect(answered).toBeUndefined()

      await jest.advanceTimersByTimeAsync(100)
      await expect(answered?.json()).resolves.toEqual({
        commands: [],
        open: ['thorin'],
      })
      expect(claimRollRequests).toHaveBeenCalledTimes(21)
      // Which characters are open is read again each time it's checked, as rolls are.
      expect(openActorIds).toHaveBeenCalledTimes(21)
    })

    it('answers early, with no rolls, once a character opens or closes, saying which are open now', async () => {
      jest
        .mocked(openActorIds)
        .mockResolvedValueOnce(['balin', 'thorin'])
        .mockResolvedValueOnce(['balin', 'thorin'])
        .mockResolvedValueOnce(['balin'])
      let answered: Response | undefined
      void post().then(response => (answered = response))

      await jest.advanceTimersByTimeAsync(1500)
      expect(answered).toBeUndefined()

      await jest.advanceTimersByTimeAsync(500)
      await expect(answered?.json()).resolves.toEqual({
        commands: [],
        open: ['balin'],
      })
      // None is handed over once it's seen to change, which the answer would carry.
      expect(claimRollRequests).toHaveBeenCalledTimes(2)
    })

    it('answers early when one character closes as another opens, though as many are open', async () => {
      jest
        .mocked(openActorIds)
        .mockResolvedValueOnce(['thorin'])
        .mockResolvedValueOnce(['balin'])
      let answered: Response | undefined
      void post().then(response => (answered = response))

      await jest.advanceTimersByTimeAsync(1000)

      await expect(answered?.json()).resolves.toEqual({
        commands: [],
        open: ['balin'],
      })
    })

    it('asks for a retry, handing over nothing, when it cannot read again which characters are open', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      jest
        .mocked(openActorIds)
        .mockResolvedValueOnce(['thorin'])
        .mockRejectedValueOnce(new Error('db down'))
      let answered: Response | undefined
      void post().then(response => (answered = response))

      await jest.advanceTimersByTimeAsync(1000)

      expect(answered?.status).toBe(500)
      expect(claimRollRequests).toHaveBeenCalledTimes(1)
      consoleError.mockRestore()
    })

    it('hands over nothing to a fetch given up on, which would lose it', async () => {
      const controller = new AbortController()
      let answered: Response | undefined
      void post(poll, {}, controller.signal).then(
        response => (answered = response),
      )

      await jest.advanceTimersByTimeAsync(2500)
      expect(claimRollRequests).toHaveBeenCalledTimes(3)
      controller.abort()
      await jest.advanceTimersByTimeAsync(0)

      await expect(answered?.json()).resolves.toEqual({
        commands: [],
        open: ['thorin'],
      })
      expect(claimRollRequests).toHaveBeenCalledTimes(3)
    })
  })

  const NO_SECRET = {
    reason: 'noSecret',
    message: 'Send the campaign’s secret',
  }
  const NOT_FORGE = {
    reason: 'notForge',
    message: 'Only games on The Forge are accepted',
  }
  it.each([
    ['no secret', { Authorization: '' }, 401, NO_SECRET, GAME],
    [
      'a site that is not a Forge game',
      { Origin: 'https://evil.example' },
      403,
      NOT_FORGE,
      'https://evil.example',
    ],
    ['no origin', { Origin: '' }, 403, NOT_FORGE, ''],
  ])('refuses a fetch with %s', async (_, headers, status, body, origin) => {
    const response = await post(poll, headers)

    await expectRefusal(response, status, body, origin)
    expect(findEventCampaign).not.toHaveBeenCalled()
  })

  it.each([
    ['not JSON', 'nope'],
    ['for another protocol', { ...poll, protocol: 1 }],
    ['for no campaign', { ...poll, campaign: undefined }],
  ])('refuses a fetch that is %s', async (_, body) => {
    const response = await post(body)

    await expectRefusal(response, 400, {
      reason: 'badEnvelope',
      message: 'Not a Sending Stone fetch',
    })
  })

  it('refuses an oversized fetch, saying how much it takes', async () => {
    const tooLarge = {
      reason: 'tooLarge',
      message: 'Larger than the 4096 bytes Sending Stone takes',
      limit: 4096,
    }
    let response = await post({ ...poll, padding: 'x'.repeat(5000) })
    await expectRefusal(response, 413, tooLarge)

    response = await post(poll, { 'Content-Length': '5000' })
    await expectRefusal(response, 413, tooLarge)
    expect(findEventCampaign).not.toHaveBeenCalled()
  })

  it('refuses a fetch for a campaign not set up, or without its secret', async () => {
    jest.mocked(findEventCampaign).mockResolvedValue('unknown')
    let response = await post()
    await expectRefusal(response, 404, {
      reason: 'notSetUp',
      message: `No campaign titled “The Lonely Mountain” is set up for ${GAME} in Sending Stone`,
    })

    jest.mocked(findEventCampaign).mockResolvedValue('refused')
    response = await post()
    await expectRefusal(response, 401, {
      reason: 'wrongSecret',
      message: 'The secret isn’t this campaign’s in Sending Stone',
    })
    // A fetch's refusal is recorded as an event's is.
    expect(findEventCampaign).toHaveBeenCalledWith(GAME, campaign, 'hunter2')
    expect(markBridgePolled).not.toHaveBeenCalled()
  })

  it.each([
    ['the campaign cannot be looked up', findEventCampaign],
    ['the fetch cannot be noted', markBridgePolled],
    ['the rolls cannot be handed over', claimRollRequests],
  ])('asks for a retry when %s', async (_, step) => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    jest.mocked(step).mockRejectedValue(new Error('db down'))

    const response = await post()

    await expectRefusal(response, 500, UNAVAILABLE)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('asks for a retry when rolls cannot be handed over to a held fetch', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    given(true, true)
    jest.mocked(claimRollRequests).mockRejectedValue(new Error('db down'))

    const response = await post()

    await expectRefusal(response, 500, UNAVAILABLE)
    consoleError.mockRestore()
  })
})
