/**
 * @jest-environment node
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { LAUNCH_PATH, LAUNCH_WORKER } from './constants'
import { launchDocument } from './utils'

// The launch worker itself, public/launch-worker.js as it's served, and the worker that retires
// it, each run in a stand-in for a worker's scope: its caches, the server's answers and the events
// a browser sends it. They're tested here, beside the launch page they serve, as nothing under
// public/ can hold a test.

const PUBLIC = path.join(process.cwd(), 'public')
const SOURCE = readFileSync(path.join(PUBLIC, LAUNCH_WORKER), 'utf8')
const RETIRING = readFileSync(
  path.join(PUBLIC, 'launch-worker-retire.js'),
  'utf8',
)
const ORIGIN = 'https://sendingstone.example'

/** The name the worker gives its cache, as its source writes it. */
const CACHE = `sending-stone-launch-${/const CACHE = `\$\{PREFIX\}(\w+)`\n/.exec(SOURCE)?.[1]}`

type Answer = {
  status?: number
  redirected?: boolean
  contentType?: string
  body?: string
}

/** A response as a browser's fetch gives one: what the worker reads of it. */
const answer = ({
  status = 200,
  redirected = false,
  contentType = 'text/html; charset=utf-8',
  body = 'the launch page',
}: Answer = {}) => {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    redirected,
    body,
    headers: new Headers({ 'content-type': contentType }),
    clone: () => response,
  }
  return response
}

type Kept = Map<string, Map<string, ReturnType<typeof answer>>>
type Sent = {
  waitUntil: (work: Promise<unknown>) => void
  respondWith: (response: Promise<unknown>) => void
}

/** A worker's scope with a worker's script run in it: what it listens for, keeps and asks. */
function worker(
  serves: (input: unknown) => Answer | Error = () => ({}),
  source = SOURCE,
) {
  const listeners: Record<string, (event: Sent) => void> = {}
  const kept: Kept = new Map()
  const fetch = jest.fn(async (input: unknown, init?: RequestInit) => {
    const served = serves(input)
    if (served instanceof Error) throw served
    return answer({
      body: `the server’s page, ${init ? 'asked' : 'opened'}`,
      ...served,
    })
  })
  const scope = {
    URL,
    fetch,
    caches: {
      open: async (name: string) => {
        const cache = kept.get(name) ?? new Map()
        kept.set(name, cache)
        return {
          match: async (key: string) => cache.get(key),
          put: async (key: string, value: ReturnType<typeof answer>) =>
            void cache.set(key, value),
        }
      },
      keys: async () => [...kept.keys()],
      delete: async (name: string) => kept.delete(name),
    },
    addEventListener: (type: string, listener: (event: Sent) => void) => {
      listeners[type] = listener
    },
    skipWaiting: jest.fn(async () => {}),
    registration: { unregister: jest.fn(async () => true) },
  }
  vm.runInNewContext(source, scope)

  /** Sends the worker an event, and waits for all it asked the browser to wait for. */
  const send = async (type: string, more: object = {}) => {
    const waits: Promise<unknown>[] = []
    let responded: Promise<unknown> | undefined
    listeners[type]?.({
      ...more,
      waitUntil: work => void waits.push(work),
      respondWith: response => {
        responded = response
      },
    })
    const response = await responded
    await Promise.all(waits)
    return { answered: responded !== undefined, response }
  }
  /** A request for a page, as tapping the app's icon makes it. */
  const opening = (url: string = LAUNCH_PATH, more: object = {}) =>
    send('fetch', {
      request: { url: ORIGIN + url, method: 'GET', mode: 'navigate', ...more },
    })
  return { fetch, kept, listeners, scope, send, opening }
}

describe('public/launch-worker.js, the launch worker', () => {
  it('names its cache for the launch page it keeps, so that a changed page is a changed worker', () => {
    const stone = readFileSync(
      path.join(PUBLIC, 'brand', 'stone-icon-288.png'),
    ).toString('base64')
    const page = launchDocument(`data:image/png;base64,${stone}`)
    const version = createHash('sha256').update(page).digest('hex').slice(0, 12)

    // When this fails the launch page has changed: give the worker's CACHE the name expected here,
    // so that the worker changes with it and browsers take the new page.
    expect(CACHE).toBe(`sending-stone-launch-${version}`)
    expect(SOURCE).toContain("const PREFIX = 'sending-stone-launch-'\n")
    expect(SOURCE).toContain(`const LAUNCH = '${LAUNCH_PATH}'\n`)
  })

  it('keeps the launch page as it installs, fetched with no cookies past every cache, and takes over at once', async () => {
    const { fetch, kept, scope, send } = worker()

    await send('install')

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(LAUNCH_PATH, {
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
    })
    expect([...kept.keys()]).toEqual([CACHE])
    expect([...(kept.get(CACHE)?.keys() ?? [])]).toEqual([LAUNCH_PATH])
    expect(scope.skipWaiting).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['an error', { status: 500 }],
    ['a redirect followed, such as to sign-in', { redirected: true }],
    ['something other than a page', { contentType: 'application/json' }],
  ])(
    'keeps nothing, and does not install, where the server answers %s',
    async (_, served) => {
      const { kept, scope, send } = worker(() => served)

      await expect(send('install')).rejects.toThrow('not the launch page')

      expect(kept.get(CACHE)?.size ?? 0).toBe(0)
      expect(scope.skipWaiting).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['your characters', '/characters', {}],
    ['a character’s sheet', '/characters/abc', {}],
    ['a page whose address only begins the same', '/launchpad', {}],
    ['its own script, opened as a page', LAUNCH_WORKER, {}],
    ['the launch page asked for, not opened', LAUNCH_PATH, { mode: 'cors' }],
    ['something sent to the launch page', LAUNCH_PATH, { method: 'POST' }],
    [
      'the launch page’s own look for the server',
      LAUNCH_PATH,
      { method: 'HEAD', mode: 'cors' },
    ],
  ])('leaves %s to the server, untouched', async (_, url, more) => {
    const { fetch, opening, send } = worker()
    await send('install')
    fetch.mockClear()

    const { answered } = await opening(url, more)

    expect(answered).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('opens with the page it keeps, and asks the server for nothing', async () => {
    const { fetch, kept, opening, send } = worker()
    await send('install')
    const page = kept.get(CACHE)?.get(LAUNCH_PATH)
    fetch.mockClear()

    const { response } = await opening()

    expect(page).toBeDefined()
    expect(response).toBe(page)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('with nothing kept, such as after the device cleared it, opens with the server’s page and keeps it', async () => {
    const { fetch, kept, opening } = worker()

    const { response } = await opening()

    expect(response).toMatchObject({ body: 'the server’s page, asked' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(kept.get(CACHE)?.get(LAUNCH_PATH)).toBe(response)
  })

  it('whatever goes wrong in it, lets the server answer the opening as if there were no worker', async () => {
    // Its own look for the launch page fails; the opening's own request is answered.
    const { opening } = worker(input =>
      input === LAUNCH_PATH ? new TypeError('Failed to fetch') : {},
    )

    const { response } = await opening()

    expect(response).toMatchObject({ body: 'the server’s page, opened' })
  })

  it('with nothing kept and no server, lets the browser say so', async () => {
    const { opening } = worker(() => new TypeError('Failed to fetch'))

    await expect(opening()).rejects.toThrow('Failed to fetch')
  })

  it('as it takes over, deletes the launch caches of workers before it and no other cache', async () => {
    const { kept, send } = worker()
    kept.set('sending-stone-launch-before', new Map())
    kept.set('something-else', new Map())
    await send('install')

    await send('activate')

    expect([...kept.keys()].toSorted()).toEqual(
      [CACHE, 'something-else'].toSorted(),
    )
  })
})

describe('public/launch-worker-retire.js, the worker that retires it', () => {
  it('takes over at once, deletes every launch cache and no other, and unregisters itself', async () => {
    const { fetch, kept, scope, send } = worker(() => ({}), RETIRING)
    kept.set(CACHE, new Map())
    kept.set('sending-stone-launch-before', new Map())
    kept.set('something-else', new Map())

    await send('install')
    await send('activate')

    expect(scope.skipWaiting).toHaveBeenCalledTimes(1)
    expect([...kept.keys()]).toEqual(['something-else'])
    expect(scope.registration.unregister).toHaveBeenCalledTimes(1)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('answers no request: the launch page comes from the server', () => {
    const { listeners } = worker(() => ({}), RETIRING)

    expect(Object.keys(listeners).toSorted()).toEqual(['activate', 'install'])
  })
})
