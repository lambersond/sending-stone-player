import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import {
  LAUNCH_ASK_AGAIN,
  LAUNCH_COLORS,
  LAUNCH_PATIENCE,
  LAUNCH_RUNE,
  LAUNCH_STONE,
} from './constants'
import { launchDocument } from './utils'
import { RUNE } from '@/components/loading-stone/constants'

const STONE = 'data:image/png;base64,c3RvbmU='
const html = launchDocument(STONE)
const page = new DOMParser().parseFromString(html, 'text/html')
const style = page.querySelector('style')?.textContent ?? ''
const script = page.querySelector('script')?.textContent ?? ''

const css = readFileSync(
  path.join(process.cwd(), 'src/app/globals.css'),
  'utf8',
)
/** A stylesheet's text with its spaces and line breaks out, as the launch page writes its own. */
const tight = (text: string) => text.replaceAll(/\s+/g, '')
/** A colour token as globals.css sets it within one of its blocks. */
const token = (block: string, name: string) => {
  const from = css.indexOf(block)
  return new RegExp(String.raw`--color-${name}:\s*(#[\da-f]{6});`, 'i').exec(
    css.slice(from, css.indexOf('\n}', from)),
  )?.[1]
}

/** Lets what the script waits on settle: the server's answer, or its lack of one. */
const settle = () => new Promise(resolve => setTimeout(resolve))

type Device = {
  onLine?: boolean
  standalone?: boolean
  displayMode?: 'browser' | 'standalone' | 'fullscreen'
  workers?: boolean | 'refused' | 'throwing'
  /** The server answers the page's asks, can't be reached, or is slow: they wait to be settled. */
  server?: 'answers' | 'unreachable' | 'slow'
}

/** The launch page's script, run as a device's browser runs it; and what it did there. */
function run({
  onLine = true,
  standalone,
  displayMode = 'browser',
  workers = true,
  server = 'answers',
}: Device = {}) {
  const words = { hidden: true }
  const body = { className: '' }
  const heard: Record<string, () => void> = {}
  const timers = new Map<number, { run: () => void; after: number }>()
  let made = 0
  const state = { server }
  /** The asks a slow server hasn't settled yet, in the order they were made. */
  const slow: Record<'answer' | 'fail', () => void>[] = []
  const replace = jest.fn()
  const register = jest.fn(async () => {
    if (workers === 'refused') throw new Error('refused')
  })
  const fetch = jest.fn(
    () =>
      new Promise((resolve, reject) => {
        const ask = {
          answer: () => resolve({ ok: true }),
          fail: () => reject(new TypeError('Failed to fetch')),
        }
        if (state.server === 'answers') ask.answer()
        else if (state.server === 'unreachable') ask.fail()
        else slow.push(ask)
      }),
  )
  const serviceWorker =
    workers === 'throwing'
      ? {
          register: () => {
            throw new Error('no workers here')
          },
        }
      : { register }
  const device = {
    onLine,
    standalone,
    ...(workers ? { serviceWorker } : {}),
  }
  vm.runInNewContext(script, {
    document: {
      body,
      getElementById: (id: string) =>
        id === 'unreached'
          ? words
          : {
              addEventListener: (_: string, listener: () => void) => {
                heard.again = listener
              },
            },
    },
    location: { replace },
    navigator: device,
    // As a browser answers a list of queries: it matches where any one of them does.
    matchMedia: (query: string) => ({
      matches: query
        .split(',')
        .some(one => one.trim() === `(display-mode: ${displayMode})`),
    }),
    addEventListener: (type: string, listener: () => void) => {
      heard[type] = listener
    },
    fetch,
    setTimeout: (work: () => void, after: number) => {
      made += 1
      timers.set(made, { run: work, after })
      return made
    },
    clearTimeout: (id: number) => void timers.delete(id),
  })
  /** How long each timer the page has set, and not cleared, waits. */
  const waiting = () => [...timers.values()].map(({ after }) => after)
  /** The page's oldest timer goes off, as if its time had passed. */
  const pass = () => {
    const [[id, timer]] = timers
    timers.delete(id)
    timer.run()
  }
  /** The device coming back online, as a browser tells the page so. */
  const backOnline = () => {
    device.onLine = true
    heard.online()
  }
  return {
    words,
    body,
    heard,
    device,
    state,
    slow,
    replace,
    register,
    fetch,
    settle,
    waiting,
    pass,
    backOnline,
  }
}

describe('features/launch/utils launchDocument', () => {
  it('draws the stone in the middle, saying it is loading, as a status', () => {
    const status = page.querySelector('[role="status"]')
    const stone = status?.querySelector('img')

    expect(page.querySelectorAll('[role="status"]')).toHaveLength(1)
    expect(status?.textContent?.trim()).toBe('Loading…')
    expect(stone?.getAttribute('src')).toBe(STONE)
    expect(stone?.getAttribute('alt')).toBe('')
    expect(stone?.getAttribute('width')).toBe(String(LAUNCH_STONE.size))
    expect(stone?.getAttribute('height')).toBe(String(LAUNCH_STONE.size))
    expect(LAUNCH_STONE.size).toBe(144)
    expect(tight(style)).toContain(
      'body{display:flex;align-items:center;justify-content:center;',
    )
    expect(tight(style)).toContain(
      '.stone{position:relative;flex:none;width:144px;height:144px}',
    )
    // On a phone it's laid out at the phone's own width, so the stone is the size it says.
    expect(
      page.querySelector('meta[name="viewport"]')?.getAttribute('content'),
    ).toBe('width=device-width, initial-scale=1')
    // "Loading…" is for a screen reader alone: nothing of it is drawn on the stone.
    expect(status?.querySelector('span')?.className).toBe('sr')
    expect(style).toContain(
      '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',
    )
  })

  it('draws the rune where the stone’s design carves it, hidden from assistive technology', () => {
    const svg = page.querySelector('svg')

    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.getAttribute('viewBox')).toBe(RUNE.viewBox)
    expect(svg?.querySelector('circle.dot')?.getAttribute('cx')).toBe(
      String(RUNE.dot.cx),
    )
    expect(svg?.querySelector('circle.dot')?.getAttribute('cy')).toBe(
      String(RUNE.dot.cy),
    )
    expect(svg?.querySelector('circle.dot')?.getAttribute('r')).toBe(
      String(RUNE.dot.r),
    )
    expect(svg?.querySelector('path.inner')?.getAttribute('d')).toBe(RUNE.inner)
    expect(svg?.querySelector('path.outer')?.getAttribute('d')).toBe(RUNE.outer)
    expect(tight(style)).toContain(`stroke-width:${RUNE.arcWidth};`)
    // Over the stone itself, box for box.
    expect(style).toContain(
      '.stone img,.stone svg{position:absolute;inset:0;display:block;width:100%;height:100%}',
    )
  })

  it('needs nothing else: no file of a release, one script, no stylesheet, only the manifest named', () => {
    const named = [...page.querySelectorAll('[src], [href]')].map(
      element => element.getAttribute('src') ?? element.getAttribute('href'),
    )

    expect(named.toSorted()).toEqual(
      ['/manifest.webmanifest', STONE].toSorted(),
    )
    expect(html).not.toContain('/_next/')
    expect(page.querySelectorAll('script')).toHaveLength(1)
    expect(page.querySelectorAll('link[rel="stylesheet"]')).toHaveLength(0)
    expect(
      page.querySelector('meta[name="robots"]')?.getAttribute('content'),
    ).toBe('noindex')
  })

  it('is the night the manifest gives the phone’s own launch screen, in the dark theme’s colours', () => {
    expect(LAUNCH_COLORS).toEqual({
      background: token('.dark {', 'page'),
      text: token('.dark {', 'text-primary'),
      secondary: token('.dark {', 'text-secondary'),
      primary: token('.dark {', 'primary'),
      onPrimary: token('.dark {', 'on-primary'),
      glow: token('@theme {', 'rune-glow'),
    })
    expect(tight(style)).toContain(`background:${LAUNCH_COLORS.background};`)
    expect(
      page.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    ).toBe(LAUNCH_COLORS.background)
    expect(
      page.querySelector('meta[name="color-scheme"]')?.getAttribute('content'),
    ).toBe('dark')
  })

  it.each(['dot', 'inner', 'outer'] as const)(
    'lights the rune’s %s as the loading stone’s keyframes do, every 2 seconds, entered as the dot lights',
    part => {
      const own = new RegExp(
        String.raw`@keyframes rune-${part} \{(.*?)\n {2}\}`,
        's',
      ).exec(css)?.[1]

      expect(own).toBeDefined()
      expect(LAUNCH_RUNE.keyframes[part]).toBe(
        tight(own ?? '').replaceAll(';', ''),
      )
      expect(css).toContain(
        `--animate-rune-${part}: rune-${part} 2s linear infinite;`,
      )
      expect(style).toContain(
        `.${part}{animation:rune-${part} 2s linear -0.48s infinite}`,
      )
      expect(style).toContain(
        `@keyframes rune-${part}{${LAUNCH_RUNE.keyframes[part]}}`,
      )
    },
  )

  it('glows as the design does at 144 pixels, 2 and 8 pixels wide, screened onto the stone', () => {
    expect(style).toContain(
      `mix-blend-mode:screen;filter:drop-shadow(0 0 2px ${LAUNCH_COLORS.glow}) drop-shadow(0 0 8px ${LAUNCH_COLORS.glow})`,
    )
    // The rune is drawn in the glow's own colour: screened, a part left unpainted would not show.
    expect(style).toContain(`.dot{fill:${LAUNCH_COLORS.glow}}`)
    expect(style).toContain(`.arcs{fill:none;stroke:${LAUNCH_COLORS.glow};`)
  })

  it('moves only for someone who hasn’t asked for less motion, who sees the rune lit and still', () => {
    const animated = [...style.matchAll(/animation:rune-/g)]
    const inMotion =
      /@media \(prefers-reduced-motion:no-preference\)\{([^@]*)\}\n/.exec(style)

    expect(animated).toHaveLength(3)
    expect([
      ...(inMotion?.[1] ?? '').matchAll(/animation:rune-/g),
    ]).toHaveLength(3)
    expect(style).toContain(
      `@media (prefers-reduced-motion:reduce){.dot,.arcs path{opacity:${LAUNCH_RUNE.still}}}`,
    )
    expect(LAUNCH_RUNE.still).toBe(0.85)
  })

  it('has its words for a first page that can’t be reached, hidden until then, as an alert', () => {
    const alert = page.querySelector('[role="alert"]')

    expect(alert?.hasAttribute('hidden')).toBe(true)
    expect(alert?.textContent).toBe(
      'Sending Stone couldn’t be reached.It opens once you’re back online.Try again',
    )
    expect(alert?.querySelector('button')?.textContent).toBe('Try again')
    // The second sentence is only for a device with no connection.
    expect(style).toContain('#offline{display:none;')
    expect(style).toContain('.offline #offline{display:block}')
    // Staying, with nothing on its way, the rune is dark and still.
    expect(style).toContain(
      '.staying .dot,.staying .arcs path{animation:none;opacity:0}',
    )
    // A phone on its side has the words beside the stone, where there's no room under it.
    expect(style).toContain(
      '@media (max-height:479px){#unreached{position:static;',
    )
  })
})

describe('the launch page’s script', () => {
  it('opens your characters at once, in the launch page’s place, and says nothing', () => {
    const { replace, words, body, fetch } = run()

    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/characters')
    expect(words.hidden).toBe(true)
    expect(body.className).toBe('')
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    ['an iPhone’s Home Screen app', { standalone: true }],
    ['an installed app, by its display mode', { displayMode: 'standalone' }],
  ] as const)(
    'registers the launch worker for the launch page alone in %s',
    (_, device) => {
      const { register, replace } = run(device)

      expect(register).toHaveBeenCalledTimes(1)
      expect(register).toHaveBeenCalledWith('/launch-worker.js', {
        scope: '/launch',
        updateViaCache: 'none',
      })
      expect(replace).toHaveBeenCalledWith('/characters')
    },
  )

  it.each([
    ['a browser’s tab', {}],
    ['a browser’s window made full screen', { displayMode: 'fullscreen' }],
    ['Safari’s own tab on an iPhone', { standalone: false }],
  ] as const)(
    'registers nothing in %s, and opens all the same',
    (_, device) => {
      const { register, replace } = run(device)

      expect(register).not.toHaveBeenCalled()
      expect(replace).toHaveBeenCalledWith('/characters')
    },
  )

  it.each([
    ['has no workers', { workers: false }],
    ['refuses the worker', { workers: 'refused' }],
    ['throws at the worker', { workers: 'throwing' }],
  ] as const)(
    'opens all the same in an installed app whose browser %s',
    async (_, device) => {
      const { replace, settle } = run({ standalone: true, ...device })
      await settle()

      expect(replace).toHaveBeenCalledWith('/characters')
    },
  )

  it('says the first page couldn’t be reached once it has waited long enough, still waiting', () => {
    const { waiting, pass, words, body, replace } = run()

    expect(waiting()).toEqual([LAUNCH_PATIENCE])
    expect(LAUNCH_PATIENCE).toBe(15_000)
    pass()

    expect(words.hidden).toBe(false)
    // Not the second sentence, and the rune still lighting: the device has a connection.
    expect(body.className).toBe('')
    expect(replace).toHaveBeenCalledTimes(1)
    expect(waiting()).toEqual([])
  })

  it('after that wait, Try again stays where the server can’t be reached, and opens once it answers, saying nothing again until it has waited again', async () => {
    const { heard, pass, waiting, state, words, body, replace, settle } = run()
    pass()

    state.server = 'unreachable'
    heard.again()
    await settle()

    // Dark, with nothing on its way; and only the first sentence: the device has a connection,
    // so its coming back online is nothing to wait for.
    expect(replace).toHaveBeenCalledTimes(1)
    expect(body.className).toBe('staying')
    expect(words.hidden).toBe(false)
    expect(waiting()).toEqual([])

    state.server = 'answers'
    heard.again()
    await settle()

    expect(replace).toHaveBeenCalledTimes(2)
    expect(body.className).toBe('')
    expect(words.hidden).toBe(true)
    expect(waiting()).toEqual([LAUNCH_PATIENCE])
  })

  it('on a device that says it has no connection, stays, dark and still, and says so', async () => {
    const { replace, words, body, fetch, waiting, settle } = run({
      onLine: false,
      server: 'unreachable',
    })
    await settle()

    expect(replace).not.toHaveBeenCalled()
    expect(words.hidden).toBe(false)
    expect(body.className).toBe('staying offline')
    // It asked the server once all the same, in case the device was wrong.
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/launch', {
      method: 'HEAD',
      cache: 'no-store',
    })
    expect(waiting()).toEqual([])
  })

  it('opens at once where the device says it has no connection and the server answers', async () => {
    const { replace, words, body, waiting, settle } = run({ onLine: false })
    await settle()

    expect(replace).toHaveBeenCalledWith('/characters')
    expect(body.className).toBe('')
    expect(words.hidden).toBe(true)
    expect(waiting()).toEqual([LAUNCH_PATIENCE])
  })

  it('on Try again, stays as it is while the server still can’t be reached, and opens once it answers, saying nothing until it has waited', async () => {
    const { heard, replace, words, body, state, waiting, settle } = run({
      onLine: false,
      server: 'unreachable',
    })
    await settle()

    heard.again()
    await settle()

    // The browser's own error page never takes the launch page's place.
    expect(replace).not.toHaveBeenCalled()
    expect(words.hidden).toBe(false)
    expect(body.className).toBe('staying offline')
    expect(waiting()).toEqual([])

    state.server = 'answers'
    heard.again()
    await settle()

    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/characters')
    expect(body.className).toBe('')
    // "Couldn't be reached" isn't so while the first page is on its way.
    expect(words.hidden).toBe(true)
    expect(waiting()).toEqual([LAUNCH_PATIENCE])
  })

  it('on the device coming back online, its first ask unanswered, says only that it couldn’t be reached, asks again a second later, and opens saying nothing', async () => {
    const {
      backOnline,
      pass,
      replace,
      words,
      body,
      state,
      fetch,
      waiting,
      settle,
    } = run({ onLine: false, server: 'unreachable' })
    await settle()

    backOnline()
    await settle()

    expect(replace).not.toHaveBeenCalled()
    expect(body.className).toBe('staying')
    expect(words.hidden).toBe(false)
    expect(waiting()).toEqual([1000])

    state.server = 'answers'
    pass()
    await settle()

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith('/characters')
    expect(body.className).toBe('')
    expect(words.hidden).toBe(true)
    expect(waiting()).toEqual([LAUNCH_PATIENCE])
  })

  it('back online with a server that never answers, asks again after 1, 2 and 4 seconds, then waits for Try again', async () => {
    const { backOnline, pass, replace, words, body, fetch, waiting, settle } =
      run({ onLine: false, server: 'unreachable' })
    await settle()
    backOnline()
    await settle()

    // Each ask unanswered, it waits longer before the next.
    for (const after of LAUNCH_ASK_AGAIN) {
      expect(waiting()).toEqual([after])
      pass()
      await settle()
    }

    expect(LAUNCH_ASK_AGAIN).toEqual([1000, 2000, 4000])
    // Its ask as it opened, the one as the device came back, and three more.
    expect(fetch).toHaveBeenCalledTimes(5)
    expect(waiting()).toEqual([])
    expect(replace).not.toHaveBeenCalled()
    expect(body.className).toBe('staying')
    expect(words.hidden).toBe(false)
  })

  it('while it waits to ask again, a Try again that fails doesn’t call that ask off', async () => {
    const { backOnline, heard, pass, state, replace, fetch, waiting, settle } =
      run({ onLine: false, server: 'unreachable' })
    await settle()
    backOnline()
    await settle()

    heard.again()
    await settle()

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(waiting()).toEqual([1000])

    state.server = 'answers'
    pass()
    await settle()

    expect(replace).toHaveBeenCalledTimes(1)
    expect(waiting()).toEqual([LAUNCH_PATIENCE])
  })

  it('while it waits to ask again, a Try again that’s answered opens once, and asks no more', async () => {
    const { backOnline, heard, state, replace, fetch, waiting, settle } = run({
      onLine: false,
      server: 'unreachable',
    })
    await settle()
    backOnline()
    await settle()

    state.server = 'answers'
    heard.again()
    await settle()

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(replace).toHaveBeenCalledTimes(1)
    // The one timer is the wait for the first page: the ask again is called off.
    expect(waiting()).toEqual([LAUNCH_PATIENCE])
  })

  it('stops asking again once the device says it’s offline again, and says so', async () => {
    const { backOnline, device, pass, body, fetch, waiting, settle } = run({
      onLine: false,
      server: 'unreachable',
    })
    await settle()
    backOnline()
    await settle()

    device.onLine = false
    pass()
    await settle()

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(body.className).toBe('staying offline')
    expect(waiting()).toEqual([])
  })

  it.each([
    [
      'answered, an earlier ask failing late',
      'answer',
      'fail',
      { opened: 1, body: '', hidden: true },
    ],
    [
      'failing, an earlier ask answered late',
      'fail',
      'answer',
      { opened: 0, body: 'staying offline', hidden: false },
    ],
  ] as const)(
    'counts only its latest ask: Try again %s changes nothing',
    async (_, latest, earlier, end) => {
      const { heard, slow, replace, words, body, settle } = run({
        onLine: false,
        server: 'slow',
      })
      // Its ask as it opened, then Try again's: both on their way.
      heard.again()
      expect(slow).toHaveLength(2)

      slow[1][latest]()
      await settle()
      slow[0][earlier]()
      await settle()

      expect(replace).toHaveBeenCalledTimes(end.opened)
      expect(body.className).toBe(end.body)
      expect(words.hidden).toBe(end.hidden)
    },
  )
})
