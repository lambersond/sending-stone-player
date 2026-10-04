/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { OPTIONS, POST } from './route'
import { applyCampaignEvent } from '@/db/campaign-events'
import { checkGameSecret, findEventCampaign, markSeen } from '@/db/campaigns'
import { chatMessage } from '@/mocks/sending-stone'

jest.mock('@/db/campaign-events', () => ({ applyCampaignEvent: jest.fn() }))
jest.mock('@/db/campaigns', () => ({
  checkGameSecret: jest.fn(),
  findEventCampaign: jest.fn(),
  markSeen: jest.fn(),
}))

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

const ping = () =>
  envelope(
    'bridge.ping',
    { userId: 'u-gm', name: 'Gamemaster' },
    { sequence: null, campaign: null },
  )

describe('app/api/events', () => {
  beforeEach(() => {
    jest.mocked(findEventCampaign).mockResolvedValue({ id: 'c1' })
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
      expect(applyCampaignEvent).toHaveBeenCalledWith('c1', world, campaign, {
        type: 'chat.message.created',
        data: { message },
      })
    })

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
      const response = await post(envelope(type, {}, { sequence: null }))

      expect(response.status).toBe(204)
      expect(markSeen).toHaveBeenCalledWith('c1')
      expect(applyCampaignEvent).not.toHaveBeenCalled()
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
