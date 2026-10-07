/**
 * @jest-environment node
 */
import { OPTIONS, POST } from './route'
import { findEventCampaign } from '@/db/campaigns'
import { claimRollRequests, markBridgePolled } from '@/db/roll-requests'
import type { RollCommand } from '@/utils/roll-requests'

jest.mock('@/db/campaigns', () => ({ findEventCampaign: jest.fn() }))
jest.mock('@/db/roll-requests', () => ({
  claimRollRequests: jest.fn(),
  markBridgePolled: jest.fn(),
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

/** The players' rolls as the campaign's game is ready for them. */
const given = (rollsEnabled: boolean, playersPresent: boolean) =>
  jest
    .mocked(markBridgePolled)
    .mockResolvedValue({ rollsEnabled, playersPresent })

describe('app/api/bridge/commands', () => {
  beforeEach(() => {
    jest
      .mocked(findEventCampaign)
      .mockResolvedValue({ id: 'c1', helloSession: 's1' })
    given(true, false)
    jest.mocked(claimRollRequests).mockResolvedValue([])
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
    })
    expect(findEventCampaign).toHaveBeenCalledWith(GAME, campaign, 'hunter2')
    expect(markBridgePolled).toHaveBeenCalledWith('c1')
    expect(claimRollRequests).toHaveBeenCalledWith('c1', 's1')
  })

  it('answers at once, saying to ask again in a minute, while the campaign takes no rolls', async () => {
    given(false, true)

    const response = await post()

    await expect(response.json()).resolves.toEqual({
      commands: [],
      wait: 60_000,
    })
    expect(claimRollRequests).not.toHaveBeenCalled()
  })

  describe('while players are at the table', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      given(true, true)
    })

    it('answers at once with the rolls waiting, to fetch again at once', async () => {
      jest.mocked(claimRollRequests).mockResolvedValue([command])

      const response = await post()

      await expect(response.json()).resolves.toEqual({ commands: [command] })
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
      await expect(answered?.json()).resolves.toEqual({ commands: [command] })
    })

    it('answers with nothing after twenty seconds without a roll', async () => {
      let answered: Response | undefined
      void post().then(response => (answered = response))

      await jest.advanceTimersByTimeAsync(19_900)
      expect(answered).toBeUndefined()

      await jest.advanceTimersByTimeAsync(100)
      await expect(answered?.json()).resolves.toEqual({ commands: [] })
      expect(claimRollRequests).toHaveBeenCalledTimes(21)
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

      await expect(answered?.json()).resolves.toEqual({ commands: [] })
      expect(claimRollRequests).toHaveBeenCalledTimes(3)
    })
  })

  it.each([
    ['no secret', { Authorization: '' }, 401],
    [
      'a site that is not a Forge game',
      { Origin: 'https://evil.example' },
      403,
    ],
    ['no origin', { Origin: '' }, 403],
  ])('refuses a fetch with %s', async (_, headers, status) => {
    const response = await post(poll, headers)

    expect(response.status).toBe(status)
    expect(findEventCampaign).not.toHaveBeenCalled()
  })

  it.each([
    ['not JSON', 'nope'],
    ['for another protocol', { ...poll, protocol: 1 }],
    ['for no campaign', { ...poll, campaign: undefined }],
  ])('refuses a fetch that is %s', async (_, body) => {
    const response = await post(body)

    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Not a Sending Stone fetch')
  })

  it('refuses an oversized fetch', async () => {
    const response = await post({ ...poll, padding: 'x'.repeat(5000) })

    expect(response.status).toBe(413)
  })

  it('refuses a fetch for a campaign not set up, or without its secret', async () => {
    jest.mocked(findEventCampaign).mockResolvedValue('unknown')
    let response = await post()
    expect(response.status).toBe(404)
    expect(await response.text()).toBe(
      `No campaign titled “The Lonely Mountain” is set up for ${GAME} in Sending Stone`,
    )

    jest.mocked(findEventCampaign).mockResolvedValue('refused')
    response = await post()
    expect(response.status).toBe(401)
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

    expect(response.status).toBe(500)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(GAME)
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

    expect(response.status).toBe(500)
    consoleError.mockRestore()
  })
})
