/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- the link's seat uses null for an absent value */
import * as route from './route'
import {
  acceptDish,
  deleteCookbookLink,
  findCookbookLink,
  type CookbookLinkFound,
} from '@/db/cookbook'
import { hashCookbookCode } from '@/lib/cookbook-code'
import { fireberryBoon } from '@/mocks/cookbook'

// The waiting cap's words are built from its constant: mocked here to another number, so words
// written out with 50 fail.
jest.mock('@/constants/cookbook', () => ({
  ...jest.requireActual('@/constants/cookbook'),
  MOST_DISHES_WAITING: 7,
}))
jest.mock('@/db/cookbook', () => ({
  acceptDish: jest.fn(),
  deleteCookbookLink: jest.fn(),
  findCookbookLink: jest.fn(),
}))

const { POST } = route
const CODE = 'sscb_1gT6dhjwOQSMNgkDXiyDOPt2ltW_RKU4XDAdTsRU2d4'
const URL = 'https://player.example/api/cookbook/dishes'

const UNKNOWN_CODE =
  'Sending Stone doesn’t know this link code. Make a new one on your character’s page in Sending Stone and link again.'

const link: CookbookLinkFound = {
  id: 'link-1',
  campaignId: 'c1',
  actorId: 'actor-thorin',
  characterId: 'char-1',
  character: { campaignId: 'c1', actorId: 'actor-thorin' },
  campaign: { dishesEnabled: true, dishVersions: [1] },
}

type Post = {
  code?: string | null
  type?: string
  body?: unknown
  headers?: Record<string, string>
}

/** The cookbook's post, as its server makes it: a bearer code and JSON. */
function post({
  code = CODE,
  type = 'application/json',
  body = fireberryBoon,
  headers = {},
}: Post = {}): Promise<Response> {
  return POST(
    new Request(URL, {
      method: 'POST',
      headers: {
        ...(code !== null && { Authorization: `Bearer ${code}` }),
        'Content-Type': type,
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
}

/** Every answer: JSON, never cached, no CORS, never a 404, any message under 200 characters. */
async function answered(response: Response) {
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(
    [...response.headers.keys()].filter(key =>
      key.toLowerCase().startsWith('access-control-'),
    ),
  ).toEqual([])
  expect(response.status).not.toBe(404)
  const body = await response.json()
  if ('message' in body) {
    expect(typeof body.message).toBe('string')
    expect(body.message.length).toBeLessThan(200)
  }
  return body
}

describe('POST /api/cookbook/dishes', () => {
  beforeEach(() => {
    jest.mocked(findCookbookLink).mockResolvedValue(link)
    jest.mocked(acceptDish).mockResolvedValue({
      kind: 'new',
      id: 'dish-row-1',
      status: 'queued',
    })
  })

  it('takes a new dish, 202, for the link its code names', async () => {
    const response = await post()

    expect(response.status).toBe(202)
    await expect(answered(response)).resolves.toEqual({
      id: 'dish-row-1',
      status: 'queued',
    })
    expect(findCookbookLink).toHaveBeenCalledWith(hashCookbookCode(CODE))
    expect(acceptDish).toHaveBeenCalledWith(link, fireberryBoon)
  })

  it('answers a dish held already 200, as it stands', async () => {
    jest.mocked(acceptDish).mockResolvedValue({
      kind: 'repeat',
      id: 'dish-row-1',
      status: 'applied',
    })

    const response = await post()

    expect(response.status).toBe(200)
    await expect(answered(response)).resolves.toEqual({
      id: 'dish-row-1',
      status: 'applied',
    })
  })

  it.each([
    ['no header', null],
    ['no code', ''],
    ['a short code', 'sscb_short'],
    ['a code of another shape', 'x'.repeat(48)],
  ])('refuses %s 401, before any database read', async (_name, code) => {
    const response = await post({ code })

    expect(response.status).toBe(401)
    await expect(answered(response)).resolves.toEqual({
      reason: 'noCode',
      message: UNKNOWN_CODE,
    })
    expect(findCookbookLink).not.toHaveBeenCalled()
  })

  it('refuses a code no link has 401, in the same words', async () => {
    jest.mocked(findCookbookLink).mockResolvedValue(null)

    const response = await post()

    expect(response.status).toBe(401)
    await expect(answered(response)).resolves.toEqual({
      reason: 'unlinked',
      message: UNKNOWN_CODE,
    })
    expect(acceptDish).not.toHaveBeenCalled()
  })

  it.each([
    ['another actor', { campaignId: 'c1', actorId: 'actor-vex' }],
    ['no actor', { campaignId: 'c1', actorId: null }],
    ['another campaign', { campaignId: 'c2', actorId: 'actor-thorin' }],
    ['no campaign', { campaignId: null, actorId: 'actor-thorin' }],
  ])(
    'refuses, and deletes, a link whose seat now plays %s',
    async (_name, character) => {
      jest.mocked(findCookbookLink).mockResolvedValue({ ...link, character })

      // Before the body is read: a moved link is refused whatever it sends.
      const response = await post({ type: 'text/plain' })

      expect(response.status).toBe(401)
      await expect(answered(response)).resolves.toEqual({
        reason: 'moved',
        message:
          'This link code is for a character you no longer play in Sending Stone. Make a new one and link again.',
      })
      expect(deleteCookbookLink).toHaveBeenCalledWith('link-1')
      expect(acceptDish).not.toHaveBeenCalled()
    },
  )

  it('refuses a body that is not JSON 415, after the code', async () => {
    const response = await post({ type: 'text/plain' })

    expect(response.status).toBe(415)
    await expect(answered(response)).resolves.toEqual({
      reason: 'notJson',
      message: 'Sending Stone takes dishes as JSON.',
    })
    // A code is checked first.
    const unknown = await post({ code: 'x', type: 'text/plain' })
    expect(unknown.status).toBe(401)
  })

  it('takes JSON with a charset', async () => {
    const response = await post({ type: 'application/json; charset=utf-8' })
    expect(response.status).toBe(202)
  })

  it('refuses a body larger than it takes 413, declared or read', async () => {
    const large = JSON.stringify({
      ...fireberryBoon,
      message: 'x'.repeat(40_000),
    })

    // Declared too large over a small body (a Request given a string sends no length of itself),
    // so only the header can refuse it.
    const declared = await post({
      headers: { 'Content-Length': String(Buffer.byteLength(large)) },
    })
    expect(declared.status).toBe(413)
    await expect(answered(declared)).resolves.toEqual({
      reason: 'tooLarge',
      message: 'This dish is larger than Sending Stone takes.',
      limit: 32_768,
    })

    // Sent with no length, as a stream: refused once read.
    const bytes = new TextEncoder().encode(large)
    const streamed = await POST(
      new Request(URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CODE}`,
          'Content-Type': 'application/json',
        },
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(bytes)
            controller.close()
          },
        }),
        duplex: 'half',
      } as RequestInit),
    )
    expect(streamed.status).toBe(413)
    expect(acceptDish).not.toHaveBeenCalled()
  })

  it('refuses what it cannot parse 400', async () => {
    const response = await post({ body: '{' })

    expect(response.status).toBe(400)
    await expect(answered(response)).resolves.toEqual({
      reason: 'invalid',
      message: 'Sending Stone couldn’t read this dish (not JSON).',
    })
  })

  it('tells a newer cookbook why, before the schema', async () => {
    const response = await post({ body: { ...fireberryBoon, version: 2 } })

    expect(response.status).toBe(400)
    await expect(answered(response)).resolves.toEqual({
      reason: 'version',
      message:
        'This dish comes from a newer Magical Recipe Book than Sending Stone reads.',
    })
    // Even a body that's otherwise unreadable.
    const unread = await post({ body: { version: 2 } })
    await expect(unread.json()).resolves.toMatchObject({ reason: 'version' })
  })

  it('refuses a body the schema refuses 400, naming the first part wrong', async () => {
    const quoted = await post({ body: { ...fireberryBoon, version: '2' } })
    expect(quoted.status).toBe(400)
    await expect(answered(quoted)).resolves.toEqual({
      reason: 'invalid',
      message: 'Sending Stone couldn’t read this dish (version).',
      field: 'version',
    })

    const change = await post({
      body: {
        ...fireberryBoon,
        effect: {
          ...fireberryBoon.effect,
          changes: [{ type: 'tempHitPoints', huge: 'x'.repeat(1100) }],
        },
      },
    })
    expect(change.status).toBe(400)
    await expect(answered(change)).resolves.toMatchObject({
      reason: 'invalid',
      field: 'effect.changes.0',
    })

    // A body that isn't an object at all.
    const list = await post({ body: [1] })
    await expect(answered(list)).resolves.toEqual({
      reason: 'invalid',
      message: 'Sending Stone couldn’t read this dish (body).',
      field: 'body',
    })
    expect(acceptDish).not.toHaveBeenCalled()
  })

  it.each([
    [
      'off',
      409,
      'Your Gamemaster hasn’t turned on dishes from the Magical Recipe Book for this game.',
    ],
    [
      'update',
      409,
      'Your Gamemaster’s Sending Stone module needs updating to take this dish.',
    ],
    // The waiting cap's words name its constant, mocked to 7 here.
    [
      'full',
      409,
      'Your Gamemaster already has 7 dishes waiting for Foundry. Try again once they’ve served some.',
    ],
  ] as const)('refuses %s %i in its words', async (kind, status, message) => {
    jest.mocked(acceptDish).mockResolvedValue({ kind })

    const response = await post()

    expect(response.status).toBe(status)
    await expect(answered(response)).resolves.toEqual({ reason: kind, message })
  })

  it('asks a busy link to wait a minute, 429', async () => {
    jest.mocked(acceptDish).mockResolvedValue({ kind: 'busy' })

    const response = await post()

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
    await expect(answered(response)).resolves.toEqual({
      reason: 'busy',
      message: 'That’s a lot of dishes at once. Wait a minute and send again.',
    })
  })

  it('refuses a link past its day’s dishes, 429, in the user’s words', async () => {
    jest.mocked(acceptDish).mockResolvedValue({ kind: 'daily' })

    const response = await post()

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('3600')
    await expect(answered(response)).resolves.toEqual({
      reason: 'daily',
      message:
        'That’s the most dishes Sending Stone takes from one link in a day. Try again tomorrow.',
    })
  })

  it('answers 500 when a database step fails, for the cookbook to send again', async () => {
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {})
    const unavailable = {
      reason: 'unavailable',
      message:
        'Sending Stone couldn’t take this dish just now. Try again in a moment.',
    }
    jest.mocked(findCookbookLink).mockRejectedValueOnce(new Error('down'))
    const lookup = await post()
    expect(lookup.status).toBe(500)
    await expect(answered(lookup)).resolves.toEqual(unavailable)

    jest.mocked(acceptDish).mockRejectedValueOnce(new Error('down'))
    const taking = await post()
    expect(taking.status).toBe(500)
    await expect(answered(taking)).resolves.toEqual(unavailable)
    quiet.mockRestore()
  })

  it('cleans text Postgres cannot store, never refusing it', async () => {
    const dirty = JSON.stringify({
      ...fireberryBoon,
      cook: { name: 'Tho\u0000rin' },
      effect: {
        ...fireberryBoon.effect,
        ingredients: [{ name: 'Fireberries', text: 'Hot \uD800 berries.' }],
        changes: [
          ...fireberryBoon.effect!.changes,
          {
            type: 'tempHitPoints',
            value: 5,
            'bad\u0000key': 1,
            'bad\uDBFFkey': 2,
          },
        ],
      },
    })
    // Written as JSON escapes, as a hand-made body may send them.
    expect(dirty).toContain(String.raw`\u0000`)
    expect(dirty).toContain(String.raw`\ud800`)
    expect(dirty).toContain(String.raw`bad\udbffkey`)

    const response = await post({ body: dirty })

    expect(response.status).toBe(202)
    const taken = jest.mocked(acceptDish).mock.calls[0][1]
    expect(taken.cook.name).toBe('Thorin')
    expect(taken.effect?.ingredients[0].text).toBe('Hot � berries.')
    expect(taken.effect?.changes[2]).toEqual({
      type: 'tempHitPoints',
      value: 5,
    })
    expect(JSON.stringify(taken)).not.toMatch(/\\u0000|\\ud800|\\udbff/i)
  })

  it('keeps a cook’s name well formed where its cut splits a surrogate pair', async () => {
    // 201 units, the emoji's two at 199 and 200: cut at 200, its first half is left alone.
    const name = `${'a'.repeat(199)}\u{1F600}`
    expect(name).toHaveLength(201)

    const response = await post({ body: { ...fireberryBoon, cook: { name } } })

    expect(response.status).toBe(202)
    const taken = jest.mocked(acceptDish).mock.calls[0][1]
    expect(taken.cook.name).toBe(`${'a'.repeat(199)}�`)
    expect(taken.cook.name.isWellFormed()).toBe(true)
  })

  it('answers every refusal within the cookbook’s 200 characters', async () => {
    for (const kind of ['off', 'update', 'busy', 'daily', 'full'] as const) {
      jest.mocked(acceptDish).mockResolvedValueOnce({ kind })
      await answered(await post())
    }
  })

  it('exports no OPTIONS, so Next answers a preflight with Allow alone', () => {
    expect(Object.keys(route)).toEqual(['POST'])
  })
})
