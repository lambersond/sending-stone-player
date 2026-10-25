/**
 * @jest-environment node
 */
import { OPTIONS, POST } from './route'
import { findEventCampaign } from '@/db/campaigns'
import { claimDishes } from '@/db/cookbook'
import { claimNoteWrites } from '@/db/note-sync'
import {
  claimRollRequests,
  markBridgePolled,
  openActorIds,
} from '@/db/roll-requests'
import { fireberryBoon } from '@/mocks/cookbook'
import { mockNoteCommand } from '@/mocks/sending-stone'
import type { DishCommand } from '@/types/cookbook'
import type { RollCommand } from '@/utils/roll-requests'

jest.mock('@/db/campaigns', () => ({ findEventCampaign: jest.fn() }))
jest.mock('@/db/cookbook', () => ({ claimDishes: jest.fn() }))
jest.mock('@/db/note-sync', () => ({ claimNoteWrites: jest.fn() }))
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
 * The players' rolls as the campaign's game is ready for them, from module 0.31.0 their moves of
 * items and coins, from module 0.33.0 removals of their characters' items, from module 0.34.0
 * journal notes, from module 0.37.0 their characters' favorites, and from module 0.38.0 dishes
 * from the Magical Recipe Book. Changed on purpose (round 0.38.0 §D9): dishes too.
 */
const given = (
  rollsEnabled: boolean,
  playersPresent: boolean,
  transfersEnabled = false,
  removalsEnabled = false,
  notesEnabled = false,
  favoritesEnabled = false,
  dishesEnabled = false,
) =>
  jest.mocked(markBridgePolled).mockResolvedValue({
    rollsEnabled,
    transfersEnabled,
    removalsEnabled,
    notesEnabled,
    favoritesEnabled,
    dishesEnabled,
    playersPresent,
  })

describe('app/api/bridge/commands', () => {
  beforeEach(() => {
    jest
      .mocked(findEventCampaign)
      .mockResolvedValue({ id: 'c1', helloSession: 's1' })
    given(true, false)
    jest.mocked(claimRollRequests).mockResolvedValue([])
    jest.mocked(claimNoteWrites).mockResolvedValue([])
    jest.mocked(claimDishes).mockResolvedValue([])
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

  it('hands over removals of items with rolls and moves off, from module 0.33.0, holding the fetch open as for a roll', async () => {
    const removal: RollCommand = {
      id: 'req-remove',
      actorId: 'actor-thorin',
      kind: 'remove',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
      remove: { item: 'rope', quantity: 1, held: 1 },
    }
    given(false, false, false, true)
    jest.mocked(claimRollRequests).mockResolvedValue([removal])

    const cold = await post()

    await expect(cold.json()).resolves.toEqual({
      commands: [removal],
      wait: 10_000,
      open: ['thorin'],
    })
    expect(claimRollRequests).toHaveBeenCalledWith('c1', 's1')

    jest.useFakeTimers()
    given(false, true, false, true)
    jest
      .mocked(claimRollRequests)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([removal])
    let answered: Response | undefined
    void post().then(response => (answered = response))

    await jest.advanceTimersByTimeAsync(500)
    expect(answered).toBeUndefined()
    await jest.advanceTimersByTimeAsync(1000)
    await expect(answered?.json()).resolves.toEqual({
      commands: [removal],
      open: ['thorin'],
    })
  })

  it('hands over favorites with everything else off, from module 0.37.0, holding the fetch open as for a roll', async () => {
    const favorite: RollCommand = {
      id: 'req-favorite',
      actorId: 'actor-thorin',
      kind: 'favorite',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
      favorite: { op: 'add', type: 'item', id: 'rope' },
    }
    given(false, false, false, false, false, true)
    jest.mocked(claimRollRequests).mockResolvedValue([favorite])

    const cold = await post()

    await expect(cold.json()).resolves.toEqual({
      commands: [favorite],
      wait: 10_000,
      open: ['thorin'],
    })
    expect(claimRollRequests).toHaveBeenCalledWith('c1', 's1')

    jest.useFakeTimers()
    given(false, true, false, false, false, true)
    jest
      .mocked(claimRollRequests)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([favorite])
    let answered: Response | undefined
    void post().then(response => (answered = response))

    await jest.advanceTimersByTimeAsync(500)
    expect(answered).toBeUndefined()
    await jest.advanceTimersByTimeAsync(1000)
    await expect(answered?.json()).resolves.toEqual({
      commands: [favorite],
      open: ['thorin'],
    })
  })

  describe('journal notes, from module 0.34.0', () => {
    const note = mockNoteCommand()

    it('hands over notes written here with rolls, moves and removals off, holding the fetch open as for a roll', async () => {
      given(false, false, false, false, true)
      jest.mocked(claimNoteWrites).mockResolvedValue([note])

      const cold = await post()

      await expect(cold.json()).resolves.toEqual({
        commands: [note],
        wait: 10_000,
        open: ['thorin'],
      })
      expect(claimNoteWrites).toHaveBeenCalledWith('c1', 's1')

      jest.useFakeTimers()
      given(false, true, false, false, true)
      jest
        .mocked(claimNoteWrites)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([note])
      let answered: Response | undefined
      void post().then(response => (answered = response))

      await jest.advanceTimersByTimeAsync(500)
      expect(answered).toBeUndefined()
      await jest.advanceTimersByTimeAsync(1000)
      await expect(answered?.json()).resolves.toEqual({
        commands: [note],
        open: ['thorin'],
      })
    })

    it('hands notes over after the rolls, in one answer', async () => {
      given(true, false, false, false, true)
      jest.mocked(claimRollRequests).mockResolvedValue([command])
      jest.mocked(claimNoteWrites).mockResolvedValue([note])

      const response = await post()

      await expect(response.json()).resolves.toEqual({
        commands: [command, note],
        wait: 10_000,
        open: ['thorin'],
      })
    })

    it('asks for a retry, handing over nothing, when notes cannot be handed over', async () => {
      given(false, false, false, false, true)
      jest.mocked(claimNoteWrites).mockRejectedValue(new Error('down'))
      jest.spyOn(console, 'error').mockImplementation(() => {})

      const response = await post()

      await expectRefusal(response, 500, UNAVAILABLE)
    })

    it('claims the notes before any roll, so that failing to claim them loses no roll', async () => {
      given(true, false, false, false, true)
      jest.mocked(claimRollRequests).mockResolvedValue([command])
      jest.mocked(claimNoteWrites).mockRejectedValue(new Error('down'))
      jest.spyOn(console, 'error').mockImplementation(() => {})

      const response = await post()

      await expectRefusal(response, 500, UNAVAILABLE)
      // A roll claimed and then not answered would never be handed over again.
      expect(claimRollRequests).not.toHaveBeenCalled()
    })
  })

  describe('dishes from the Magical Recipe Book, from module 0.38.0', () => {
    const dish: DishCommand = {
      id: 'dish-row-1',
      actorId: 'actor-thorin',
      kind: 'dish',
      dish: { queuedAt: 1_761_319_200_000, body: fireberryBoon },
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
    }
    const note = mockNoteCommand()

    it('hands over dishes with everything else off, holding the fetch open as for a roll', async () => {
      given(false, false, false, false, false, false, true)
      jest.mocked(claimDishes).mockResolvedValue([dish])

      const cold = await post()

      await expect(cold.json()).resolves.toEqual({
        commands: [dish],
        wait: 10_000,
        open: ['thorin'],
      })
      expect(claimDishes).toHaveBeenCalledWith('c1', 's1')

      jest.useFakeTimers()
      given(false, true, false, false, false, false, true)
      jest
        .mocked(claimDishes)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([dish])
      let answered: Response | undefined
      void post().then(response => (answered = response))

      await jest.advanceTimersByTimeAsync(500)
      expect(answered).toBeUndefined()
      await jest.advanceTimersByTimeAsync(1000)
      await expect(answered?.json()).resolves.toEqual({
        commands: [dish],
        open: ['thorin'],
      })
    })

    it('claims dishes first, before notes and rolls, and lists them last', async () => {
      given(true, false, false, false, true, false, true)
      const claimed: string[] = []
      jest.mocked(claimDishes).mockImplementation(async () => {
        claimed.push('dishes')
        return [dish]
      })
      jest.mocked(claimNoteWrites).mockImplementation(async () => {
        claimed.push('notes')
        return [note]
      })
      jest.mocked(claimRollRequests).mockImplementation(async () => {
        claimed.push('rolls')
        return [command]
      })

      const response = await post()

      await expect(response.json()).resolves.toEqual({
        commands: [command, note, dish],
        wait: 10_000,
        open: ['thorin'],
      })
      expect(claimed).toEqual(['dishes', 'notes', 'rolls'])
    })

    it('claims no dishes while the game takes none', async () => {
      given(true, false, false, false, true)
      jest.mocked(claimRollRequests).mockResolvedValue([command])

      const response = await post()

      await expect(response.json()).resolves.toEqual({
        commands: [command],
        wait: 10_000,
        open: ['thorin'],
      })
      expect(claimDishes).not.toHaveBeenCalled()
    })

    it('claims the dishes before any roll, so that failing to claim them loses no roll', async () => {
      given(true, false, false, false, false, false, true)
      jest.mocked(claimRollRequests).mockResolvedValue([command])
      jest.mocked(claimDishes).mockRejectedValue(new Error('down'))
      jest.spyOn(console, 'error').mockImplementation(() => {})

      const response = await post()

      await expectRefusal(response, 500, UNAVAILABLE)
      expect(claimRollRequests).not.toHaveBeenCalled()
    })
  })

  it('answers at once, with the minute’s wait, only while the game takes no rolls, moves, removals nor notes', async () => {
    given(false, true, false, false, false)

    const response = await post()

    await expect(response.json()).resolves.toEqual({
      commands: [],
      wait: 60_000,
      open: ['thorin'],
    })
    expect(claimRollRequests).not.toHaveBeenCalled()
    expect(claimNoteWrites).not.toHaveBeenCalled()
    expect(claimDishes).not.toHaveBeenCalled()
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
