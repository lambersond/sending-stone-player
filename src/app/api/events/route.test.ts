/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { OPTIONS, POST } from './route'
import { applyCampaignEvent } from '@/db/campaign-events'
import { checkGameSecret, findEventCampaign, markSeen } from '@/db/campaigns'
import { recordCommandResult } from '@/db/roll-requests'
import { chatMessage } from '@/mocks/sending-stone'

jest.mock('@/db/campaign-events', () => ({ applyCampaignEvent: jest.fn() }))
jest.mock('@/db/campaigns', () => ({
  checkGameSecret: jest.fn(),
  findEventCampaign: jest.fn(),
  markSeen: jest.fn(),
}))
jest.mock('@/db/roll-requests', () => ({ recordCommandResult: jest.fn() }))

const URL = 'https://player.example/api/events'
const GAME = 'https://my-game.forge-vtt.com'
const world = { id: 'erebor', title: 'Return to Erebor' }
const campaign = { id: 'camp-a', title: 'The Lonely Mountain' }

const envelope = (type: string, data: object, fields: object = {}) => ({
  protocol: 2,
  id: 'ev1',
  session: 's1',
  sequence: 1,
  type,
  time: '2026-10-04T19:02:00Z',
  world,
  campaign,
  data,
  ...fields,
})

const post = (
  body: unknown,
  headers: Record<string, string> = {},
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
    }),
  )

/** A connection test from a module that names the campaign tested. */
const testCampaign = () =>
  post(
    envelope(
      'bridge.ping',
      { userId: 'u-gm', name: 'Gamemaster' },
      { sequence: null },
    ),
  )

const ping = () =>
  envelope(
    'bridge.ping',
    { userId: 'u-gm', name: 'Gamemaster' },
    { sequence: null, campaign: null },
  )

describe('app/api/events', () => {
  beforeEach(() => {
    jest
      .mocked(findEventCampaign)
      .mockResolvedValue({ id: 'c1', helloSession: 's1' })
    jest.mocked(checkGameSecret).mockResolvedValue('ok')
  })

  describe('OPTIONS', () => {
    it('lets the game page post from its own origin', () => {
      const response = OPTIONS(
        new Request(URL, { method: 'OPTIONS', headers: { Origin: GAME } }),
      )

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(GAME)
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'POST, OPTIONS',
      )
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type, Authorization',
      )
      expect(
        response.headers.get('Access-Control-Allow-Private-Network'),
      ).toBeNull()
    })

    it('allows a public page to reach a private listener when asked', () => {
      const response = OPTIONS(
        new Request(URL, {
          method: 'OPTIONS',
          headers: {
            Origin: GAME,
            'Access-Control-Request-Private-Network': 'true',
          },
        }),
      )

      expect(response.headers.get('Access-Control-Allow-Private-Network')).toBe(
        'true',
      )
    })

    it('allows any origin when none is sent', () => {
      const response = OPTIONS(new Request(URL, { method: 'OPTIONS' }))

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
    })
  })

  describe('POST', () => {
    it("applies an event to its campaign, once the secret is checked as that campaign's", async () => {
      const message = chatMessage()
      const response = await post(envelope('chat.message.created', { message }))

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(GAME)
      expect(findEventCampaign).toHaveBeenCalledWith(GAME, campaign, 'hunter2')
      expect(applyCampaignEvent).toHaveBeenCalledWith(
        'c1',
        world,
        campaign,
        { type: 'chat.message.created', data: { message } },
        's1',
      )
    })

    it.each([
      ['a campaign set up after its hello was refused', undefined],
      ['a new session of the module', 's0'],
    ])(
      "asks for the campaign's hello again for %s",
      async (_, helloSession) => {
        jest
          .mocked(findEventCampaign)
          .mockResolvedValue({ id: 'c1', helloSession })

        const response = await post(
          envelope('bridge.heartbeat', {}, { sequence: null }),
        )

        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Type')).toMatch(
          /^application\/json/,
        )
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(GAME)
        await expect(response.json()).resolves.toEqual({
          resend: 'hello',
          features: { commands: true },
        })
        expect(markSeen).toHaveBeenCalledWith('c1')
      },
    )

    it("doesn't ask for a hello in answer to a hello", async () => {
      jest.mocked(findEventCampaign).mockResolvedValue({ id: 'c1' })

      const response = await post(
        envelope('bridge.hello', { characters: [], combats: [] }),
      )

      await expect(response.json()).resolves.toEqual({
        features: { commands: true },
      })
      expect(applyCampaignEvent).toHaveBeenCalledWith(
        'c1',
        world,
        campaign,
        { type: 'bridge.hello', data: { characters: [], combats: [] } },
        's1',
      )
    })

    it('takes descriptions sent ahead of their session’s hello, without asking for it', async () => {
      jest.mocked(findEventCampaign).mockResolvedValue({ id: 'c1' })
      const texts = { '0f1a2b3c4d5e6f': '<p>Second Wind</p>' }

      const response = await post(
        envelope(
          'character.texts',
          { texts: { ...texts, bad: '<p/>' } },
          { sequence: null },
        ),
      )

      expect(response.status).toBe(204)
      expect(applyCampaignEvent).toHaveBeenCalledWith(
        'c1',
        world,
        campaign,
        { type: 'character.texts', data: { texts } },
        's1',
      )
    })

    it.each([
      ['a hello', envelope('bridge.hello', { characters: [], combats: [] })],
      [
        'a changed character',
        envelope('character.updated', {
          character: { id: 'actor-thorin', name: 'Thorin', sheet: null },
        }),
      ],
    ])(
      'asks for everything again when %s refers to a description not held',
      async (_, event) => {
        jest
          .mocked(applyCampaignEvent)
          .mockResolvedValueOnce({ lacksTexts: true })

        const response = await post(event)

        expect(response.status).toBe(200)
        await expect(response.json()).resolves.toMatchObject({
          resend: 'hello',
        })
      },
    )

    it('refuses an event for a campaign not set up, saying so', async () => {
      jest.mocked(findEventCampaign).mockResolvedValue('unknown')

      const response = await post(envelope('chat.cleared', {}))

      expect(response.status).toBe(404)
      expect(await response.text()).toBe(
        `No campaign titled “The Lonely Mountain” is set up for ${GAME} in Sending Stone`,
      )
      expect(applyCampaignEvent).not.toHaveBeenCalled()
    })

    it("refuses an event without the campaign's secret", async () => {
      jest.mocked(findEventCampaign).mockResolvedValue('refused')

      const response = await post(envelope('chat.cleared', {}))

      expect(response.status).toBe(401)
      expect(applyCampaignEvent).not.toHaveBeenCalled()
    })

    it.each([
      ['a heartbeat', 'bridge.heartbeat'],
      ['an event type it does not use', 'actor.updated'],
    ])('notes %s as the game being connected', async (_, type) => {
      await post(envelope(type, {}, { sequence: null }))

      expect(markSeen).toHaveBeenCalledWith('c1')
      expect(applyCampaignEvent).not.toHaveBeenCalled()
    })

    it('tells the module, in answer to its hello or heartbeat only, that it has commands to fetch', async () => {
      const heartbeat = await post(
        envelope('bridge.heartbeat', {}, { sequence: null }),
      )
      expect(heartbeat.status).toBe(200)
      expect(heartbeat.headers.get('Access-Control-Allow-Origin')).toBe(GAME)
      await expect(heartbeat.json()).resolves.toEqual({
        features: { commands: true },
      })

      const other = await post(envelope('actor.updated', {}))
      expect(other.status).toBe(204)
    })

    describe('command.result', () => {
      const result = {
        id: 'req-1',
        status: 'done',
        reason: null,
        error: null,
        messageId: 'msg-1',
        visible: true,
        rolls: [],
      }

      it("records what became of a player's roll, without bumping the campaign's version", async () => {
        const response = await post(
          envelope('command.result', result, { sequence: null }),
        )

        expect(response.status).toBe(204)
        expect(recordCommandResult).toHaveBeenCalledWith('c1', result)
        expect(markSeen).toHaveBeenCalledWith('c1')
        expect(applyCampaignEvent).not.toHaveBeenCalled()
      })

      it('records what came of an attack, and the dice its damage throws', async () => {
        const attack = {
          ...result,
          attack: { critical: false, fumble: false, outcome: 'miss' },
          damage: {
            critical: false,
            plannable: true,
            rolls: [
              {
                formula: '1d8 + 4',
                type: 'bludgeoning',
                dice: [{ faces: 8, number: 1 }],
              },
            ],
          },
        }
        const response = await post(
          envelope('command.result', attack, { sequence: null }),
        )

        expect(response.status).toBe(204)
        expect(recordCommandResult).toHaveBeenCalledWith('c1', attack)
      })

      it('refuses a result without its id', async () => {
        const response = await post(
          envelope('command.result', { ...result, id: '' }, { sequence: null }),
        )

        expect(response.status).toBe(400)
        expect(recordCommandResult).not.toHaveBeenCalled()
      })

      it('asks for a retry when the result cannot be stored', async () => {
        const consoleError = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {})
        jest
          .mocked(recordCommandResult)
          .mockRejectedValueOnce(new Error('db down'))

        const response = await post(
          envelope('command.result', result, { sequence: null }),
        )

        expect(response.status).toBe(500)
        expect(consoleError).toHaveBeenCalledWith(
          `Failed to apply command.result from ${GAME}`,
          expect.any(Error),
        )
        consoleError.mockRestore()
      })
    })

    it('refuses an event sent to no campaign', async () => {
      const response = await post(
        envelope('chat.cleared', {}, { campaign: null }),
      )

      expect(response.status).toBe(400)
      expect(await response.text()).toBe('No campaign for chat.cleared')
      expect(applyCampaignEvent).not.toHaveBeenCalled()
    })

    it('refuses a campaign without a title', async () => {
      const response = await post(
        envelope(
          'chat.cleared',
          {},
          { campaign: { id: 'camp-a', title: ' ' } },
        ),
      )

      expect(response.status).toBe(400)
      expect(applyCampaignEvent).not.toHaveBeenCalled()
    })

    it.each([
      ['no secret', {}],
      ['a malformed header', { Authorization: 'hunter2' }],
    ])('refuses %s', async (_, headers) => {
      const request = new Request(URL, {
        method: 'POST',
        headers: { Origin: GAME, ...headers },
        body: JSON.stringify(envelope('chat.cleared', {})),
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
      expect(findEventCampaign).not.toHaveBeenCalled()
    })

    it.each([
      ['no origin', { Origin: '' }],
      ['a site that is not a Forge game', { Origin: 'https://evil.example' }],
      ['a Forge page that is not a game', { Origin: 'https://forge-vtt.com' }],
      ['a game origin with a path', { Origin: `${GAME}/game` }],
    ])('refuses %s', async (_, headers) => {
      const response = await post(envelope('chat.cleared', {}), headers)

      expect(response.status).toBe(403)
      expect(applyCampaignEvent).not.toHaveBeenCalled()
    })

    it('refuses an oversized body', async () => {
      const response = await post('x'.repeat(1_000_001))

      expect(response.status).toBe(413)
    })

    it('refuses a declared oversized body without reading it', async () => {
      const request = new Request(URL, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer hunter2',
          Origin: GAME,
          'Content-Length': '2000000',
        },
        body: '{}',
      })
      const text = jest.spyOn(request, 'text')

      const response = await POST(request)

      expect(response.status).toBe(413)
      expect(text).not.toHaveBeenCalled()
    })

    it.each([
      ['not JSON', 'nope'],
      ['not an envelope', { hello: 'world' }],
    ])('refuses a body that is %s', async (_, body) => {
      const response = await post(body)

      expect(response.status).toBe(400)
      expect(await response.text()).toBe('Not a Sending Stone envelope')
    })

    it.each([1, 3])('refuses protocol %i', async protocol => {
      const response = await post(envelope('chat.cleared', {}, { protocol }))

      expect(response.status).toBe(400)
      expect(await response.text()).toBe(`Unsupported protocol ${protocol}`)
    })

    it("answers a connection test with the secret of one of the game's campaigns", async () => {
      const response = await post(ping())

      expect(response.status).toBe(204)
      expect(checkGameSecret).toHaveBeenCalledWith(GAME, 'hunter2')
      expect(findEventCampaign).not.toHaveBeenCalled()
      expect(applyCampaignEvent).not.toHaveBeenCalled()
    })

    it('tests the campaign a connection test names', async () => {
      let response = await testCampaign()
      expect(response.status).toBe(204)
      expect(findEventCampaign).toHaveBeenCalledWith(GAME, campaign, 'hunter2')
      expect(checkGameSecret).not.toHaveBeenCalled()

      jest.mocked(findEventCampaign).mockResolvedValue('unknown')
      response = await testCampaign()
      expect(response.status).toBe(404)
      expect(await response.text()).toBe(
        `No campaign titled “The Lonely Mountain” is set up for ${GAME} in Sending Stone`,
      )

      jest.mocked(findEventCampaign).mockResolvedValue('refused')
      response = await testCampaign()
      expect(response.status).toBe(401)
      expect(applyCampaignEvent).not.toHaveBeenCalled()
      expect(markSeen).not.toHaveBeenCalled()
    })

    it('tells a connection test when no campaign is set up, or the secret is wrong', async () => {
      jest.mocked(checkGameSecret).mockResolvedValue('unknown')
      let response = await post(ping())
      expect(response.status).toBe(404)
      expect(await response.text()).toBe(
        `No campaign is set up for ${GAME} in Sending Stone`,
      )

      jest.mocked(checkGameSecret).mockResolvedValue('refused')
      response = await post(ping())
      expect(response.status).toBe(401)
    })

    it('asks for a retry when the campaign cannot be looked up', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      jest.mocked(findEventCampaign).mockRejectedValue(new Error('db down'))
      jest.mocked(checkGameSecret).mockRejectedValue(new Error('db down'))

      const event = await post(envelope('chat.cleared', {}))
      const test = await post(ping())

      expect(event.status).toBe(500)
      expect(event.headers.get('Access-Control-Allow-Origin')).toBe(GAME)
      expect(test.status).toBe(500)
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to check a Sending Stone event',
        expect.any(Error),
      )
      consoleError.mockRestore()
    })

    it('refuses an event missing what the app relies on, saying what', async () => {
      const response = await post(
        envelope('chat.message.created', { message: { id: 'm1' } }),
      )

      expect(response.status).toBe(400)
      expect(await response.text()).toMatch(
        /^Malformed chat.message.created\n[\s\S]*timestamp/,
      )
      expect(applyCampaignEvent).not.toHaveBeenCalled()
    })

    it('asks for a retry when the event cannot be stored', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      jest.mocked(applyCampaignEvent).mockRejectedValue(new Error('db down'))

      const response = await post(envelope('chat.cleared', {}))

      expect(response.status).toBe(500)
      expect(consoleError).toHaveBeenCalledWith(
        `Failed to apply chat.cleared from ${GAME}`,
        expect.any(Error),
      )
      consoleError.mockRestore()
    })
  })
})
