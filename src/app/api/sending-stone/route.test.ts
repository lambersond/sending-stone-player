/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { OPTIONS, POST } from './route'
import { applyGameEvent } from '@/db/game-events'
import { chatMessage } from '@/mocks/sending-stone'

jest.mock('@/db/game-events', () => ({ applyGameEvent: jest.fn() }))

const URL = 'https://player.example/api/sending-stone'
const GAME = 'https://my-game.forge-vtt.com'
const world = { id: 'erebor', title: 'Return to Erebor' }

const envelope = (type: string, data: object, fields: object = {}) => ({
  protocol: 1,
  id: 'ev1',
  session: 's1',
  sequence: 1,
  type,
  time: '2026-10-04T19:02:00Z',
  world,
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

describe('app/api/sending-stone', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env, SENDING_STONE_SECRET: 'hunter2' }
  })

  afterAll(() => {
    process.env = env
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
    it('applies an event from a Forge game', async () => {
      const message = chatMessage()
      const response = await post(envelope('chat.message.created', { message }))

      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(GAME)
      expect(applyGameEvent).toHaveBeenCalledWith(GAME, world, {
        type: 'chat.message.created',
        data: { message },
      })
    })

    it('refuses everything until a secret is configured', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      delete process.env.SENDING_STONE_SECRET

      const response = await post(envelope('chat.cleared', {}))

      expect(response.status).toBe(503)
      expect(applyGameEvent).not.toHaveBeenCalled()
      consoleError.mockRestore()
    })

    it.each([
      ['no secret', {}],
      ['the wrong secret', { Authorization: 'Bearer nope' }],
      ['a malformed header', { Authorization: 'hunter2' }],
    ])('refuses %s', async (_, headers) => {
      const request = new Request(URL, {
        method: 'POST',
        headers: { Origin: GAME, ...headers },
        body: JSON.stringify(envelope('chat.cleared', {})),
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
      expect(applyGameEvent).not.toHaveBeenCalled()
    })

    it.each([
      ['no origin', { Origin: '' }],
      ['a site that is not a Forge game', { Origin: 'https://evil.example' }],
      ['a Forge page that is not a game', { Origin: 'https://forge-vtt.com' }],
      ['a game origin with a path', { Origin: `${GAME}/game` }],
    ])('refuses %s', async (_, headers) => {
      const response = await post(envelope('chat.cleared', {}), headers)

      expect(response.status).toBe(403)
      expect(applyGameEvent).not.toHaveBeenCalled()
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

    it('refuses a protocol version it does not understand', async () => {
      const response = await post(envelope('chat.cleared', {}, { protocol: 2 }))

      expect(response.status).toBe(400)
      expect(await response.text()).toBe('Unsupported protocol 2')
    })

    it('answers a connection test without storing anything', async () => {
      const response = await post(
        envelope(
          'bridge.ping',
          { userId: 'u-gm', name: 'Gamemaster' },
          {
            sequence: null,
          },
        ),
      )

      expect(response.status).toBe(204)
      expect(applyGameEvent).not.toHaveBeenCalled()
    })

    it('accepts and ignores an event type it does not use', async () => {
      const response = await post(envelope('actor.updated', {}))

      expect(response.status).toBe(204)
      expect(applyGameEvent).not.toHaveBeenCalled()
    })

    it('refuses an event missing what the app relies on, saying what', async () => {
      const response = await post(
        envelope('chat.message.created', { message: { id: 'm1' } }),
      )

      expect(response.status).toBe(400)
      expect(await response.text()).toMatch(
        /^Malformed chat.message.created\n[\s\S]*timestamp/,
      )
      expect(applyGameEvent).not.toHaveBeenCalled()
    })

    it('asks for a retry when the event cannot be stored', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      jest.mocked(applyGameEvent).mockRejectedValue(new Error('db down'))

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
