import { act } from '@testing-library/react'

/*
 * The jsdom suites' test kit (v0.43): fetch's answers, fake timers moved on, the requests a test
 * made, a roll server, times and broken images, and the normalizers that make a page's markup the
 * same from run to run and machine to machine. Tests import it; nothing else does.
 */

/** A fetch answer: its status, `ok` as the status says, and what `json()` reads. */
export const respond = (status: number, body?: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response

/** `respond`'s answer, already a promise, as fetch hands it back. */
export const responding = (status: number, body?: unknown) =>
  Promise.resolve(respond(status, body))

/** Fake timers moved on by `ms`, with what they set off settled inside `act`. */
export const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })

/** What was posted, and where: each POST's URL and its body, parsed. */
export const posts = () =>
  jest
    .mocked(fetch)
    .mock.calls.filter(([, init]) => init?.method === 'POST')
    .map(([url, init]) => ({ url, body: JSON.parse(String(init?.body)) }))

/** Code-unit order, the same on every machine (no locale). */
const byKey = ([a]: [string, unknown], [b]: [string, unknown]) => {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/** A request's headers as one object, sorted by name, however they were given. */
const headersOf = (
  headers: HeadersInit | undefined,
): Record<string, string> => {
  if (headers === undefined) return {}
  let pairs: [string, string][]
  if (Array.isArray(headers))
    pairs = headers.map(([name, value]) => [name, value])
  else if (typeof (headers as Headers).entries === 'function') {
    pairs = [...(headers as Headers).entries()]
  } else pairs = Object.entries(headers as Record<string, string>)
  return Object.fromEntries(pairs.toSorted(byKey))
}

/** Where a fetch went, however it was given. */
const urlOf = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input
  return 'href' in input ? input.href : input.url
}

/**
 * Every request fetch was asked for, in order, whole: its URL, method (GET where none was given),
 * headers as one object sorted by name, the body as the raw string sent (key order and all), the
 * rest of what was asked of fetch (such as `cache`) sorted by name, and `signal: true` where one
 * was given.
 */
export const sent = () =>
  jest.mocked(fetch).mock.calls.map(([input, init = {}]) => {
    const { method = 'GET', headers, body, signal, ...rest } = init
    return {
      url: urlOf(input),
      method,
      headers: headersOf(headers),
      body: body === undefined || body === null ? undefined : String(body),
      ...Object.fromEntries(Object.entries(rest).toSorted(byKey)),
      ...(signal && { signal: true }),
    }
  })

/**
 * A server for a sheet's rolls: each POST is taken (202, `{id: 'req-N'}`, its body kept in the
 * list given back, in order), and each roll asked after answers as `answers` says by its id, or
 * pending. Fetch is replaced for the rest of the test file.
 * @param answers - What each roll asked after answers, by its id.
 */
export const rollServer = (
  answers: Record<string, Record<string, unknown>> = {},
) => {
  const posted: Record<string, unknown>[] = []
  globalThis.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      posted.push(JSON.parse(String(init.body)) as Record<string, unknown>)
      return {
        ok: true,
        status: 202,
        json: async () => ({ id: `req-${posted.length}` }),
      } as Response
    }
    const id = String(url).split('/').at(-1) ?? ''
    return {
      ok: true,
      status: 200,
      json: async () => ({ id, ...(answers[id] ?? { status: 'pending' }) }),
    } as Response
  }) as typeof fetch
  return posted
}

/** A time `minutes` before now, as an ISO string. */
export const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString()

/**
 * Every image broken before the page mounts: it has loaded, with no width, before React hydrates,
 * so its error never reaches `onError`, and it has nothing to decode.
 */
export const brokenImages = () => {
  jest
    .spyOn(HTMLImageElement.prototype, 'complete', 'get')
    .mockReturnValue(true)
  jest
    .spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get')
    .mockReturnValue(0)
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    writable: true,
    value: () => Promise.reject(new Error('EncodingError')),
  })
}

/** An id React's `useId` made: 19.1's on (`_r_3_`, `_R_1H2_`), 19.0's (`«r3»`), 18's (`:r3:`). */
const REACT_ID =
  /_r_[\da-z]+_|_R_[\da-z]+(?:H[\da-z]+)?_|«r[\da-z]+»|:r[\da-z]+:/g

/**
 * Markup with each id React made named by where it first appears: `id-1`, `id-2` and so on, the
 * same id the same name wherever it's used, inside another value too (`_r_3_-panel` →
 * `id-1-panel`). Ids a pane gives itself, such as `creature-wolf-sheet-tab-actions`, stay.
 */
export const normalizeIds = (html: string) => {
  const names = new Map<string, string>()
  return html.replaceAll(REACT_ID, id => {
    let name = names.get(id)
    if (name === undefined) {
      name = `id-${names.size + 1}`
      names.set(id, name)
    }
    return name
  })
}

/** What's shown inside a `<time>`, its `dateTime` aside. */
const TIME_TEXT = /(<time\b[^>]*>)[^<]+(<\/time>)/g
/** A clock time: `7:30 PM` (a space, or the narrow one some locales print, or none), `19:30`. */
const CLOCK = String.raw`\d{1,2}:\d{2}(?:\s?[AP]M)?`
/** A note's full time, as its title gives it: `Sunday, October 4, 2026 at 7:30 PM`. */
const FULL_TIME = new RegExp(
  String.raw`(?:[A-Z][a-z]+, )?[A-Z][a-z]+ \d{1,2}, \d{4}(?:,| at) ${CLOCK}`,
  'g',
)
/** LocalTime's time on another day: `Oct 4, 7:30 PM`. */
const DAY_TIME = new RegExp(String.raw`[A-Z][a-z]{2} \d{1,2}, ${CLOCK}`, 'g')
/** A clock time on its own, never one inside an ISO time (`T19:30:00`). */
const LONE_CLOCK = new RegExp(String.raw`(?<![\dT:])${CLOCK}(?![\d:])`, 'g')
/** A note's day, as its list gives one before yesterday: `4 Oct`, `4 Oct 2025`. */
const NOTE_DAY =
  /\b\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?: \d{4})?\b/g

/**
 * Times as words that hang on the machine's locale and clock, each as `⟨time⟩`: in markup, what
 * each `<time>` shows (its `dateTime` kept); and anywhere, in text or an attribute such as a
 * title, the clock times and days LocalTime and a note's time print. "just now", "3 minutes ago"
 * and "yesterday" stay, as words.
 */
export const normalizeTimes = (text: string) =>
  text
    .replaceAll(TIME_TEXT, '$1⟨time⟩$2')
    .replaceAll(FULL_TIME, '⟨time⟩')
    .replaceAll(DAY_TIME, '⟨time⟩')
    .replaceAll(LONE_CLOCK, '⟨time⟩')
    .replaceAll(NOTE_DAY, '⟨time⟩')

/**
 * Fake timers, with the clock at `iso`; what tests then advance.
 * @returns The time, in milliseconds.
 */
export const atFixedTime = (iso: string) => {
  const now = new Date(iso)
  jest.useFakeTimers({ now })
  return now.getTime()
}

/** The page's markup, portals included, its React ids and times normalized. */
export const markup = () =>
  normalizeTimes(normalizeIds(document.body.innerHTML))

/**
 * A value as JSON, one space a level, its keys in the order they're in: the only way a snapshot
 * pins key order, as snapshots sort an object's keys.
 */
export const ordered = (value: unknown) => JSON.stringify(value, undefined, 1)
