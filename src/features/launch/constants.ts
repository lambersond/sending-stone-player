/**
 * The installed app's launch page (ROADMAP item 56): where the app opens, as the manifest's
 * `start_url`, and the one address the launch worker answers. It stays the app's for good: an
 * installed app keeps opening at the address it was installed with.
 */
export const LAUNCH_PATH = '/launch'

/** The first page the launch page hands over to: your characters, or signed out, sign-in. */
export const LAUNCH_NEXT = '/characters'

/**
 * The launch worker's script, in `public/`, which the launch page registers for `LAUNCH_PATH`
 * alone. Never renamed: a browser that has the worker asks for it again by this address.
 */
export const LAUNCH_WORKER = '/launch-worker.js'

/** How long the launch page waits for the first page before it says it couldn't be reached. */
export const LAUNCH_PATIENCE = 15_000

/**
 * The launch page's look: the night an Android phone's own launch screen is drawn on, which is
 * the manifest's `background_color`, and the dark theme's own colours on it (globals.css).
 */
export const LAUNCH_COLORS = {
  background: '#0d0d14',
  text: '#ececf3',
  secondary: '#a3a3b5',
  primary: '#00a86b',
  onPrimary: '#0d0d14',
  glow: '#9dffd6',
} as const

/**
 * The stone on the launch page: its size in CSS pixels, and the size its design's glows of 2px
 * and 8px are for. The launch page's route draws it from the 288px image, twice this size.
 */
export const LAUNCH_STONE = {
  size: 144,
  designSize: 144,
} as const

/** The rune's cycle on the launch page, as globals.css times the loading stone's. */
export const LAUNCH_RUNE = {
  seconds: 2,
  /**
   * It's entered where the dot begins to light, 24% of the way in: the phone's still launch
   * screen was the dark step, and the stone lights the moment the page is drawn.
   */
  startAt: -0.48,
  keyframes: {
    dot: '0%,24%{opacity:0}28%,96%{opacity:1}100%{opacity:0}',
    inner: '0%,49%{opacity:0}53%,96%{opacity:1}100%{opacity:0}',
    outer: '0%,74%{opacity:0}78%,96%{opacity:1}100%{opacity:0}',
  },
  /** Lit and still, for someone who'd rather nothing moved. */
  still: 0.85,
} as const

/** The launch page's words. */
export const LAUNCH_WORDS = {
  title: 'Sending Stone',
  loading: 'Loading…',
  unreached: 'Sending Stone couldn’t be reached.',
  offline: 'It opens once you’re back online.',
  again: 'Try again',
} as const
