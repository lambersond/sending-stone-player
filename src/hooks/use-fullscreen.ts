import { useSyncExternalStore } from 'react'

/** Whether the page runs as an app of its own, as from a phone's Home Screen, not in a browser. */
const STANDALONE = '(display-mode: standalone), (display-mode: fullscreen)'

// Nothing to listen to: whether the browser can fill the screen, and what it is, never change.
const noop = () => {}
const unchanging = () => noop
const never = () => false

/** Ignore a refusal: the page is left as it was, and the button with it. */
const ignore = () => {}

function onFullscreenChange(onChange: () => void) {
  document.addEventListener('fullscreenchange', onChange)
  return () => document.removeEventListener('fullscreenchange', onChange)
}

function onDisplayModeChange(onChange: () => void) {
  const list = globalThis.matchMedia(STANDALONE)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

const isSupported = () => document.fullscreenEnabled === true

// The iPhone Home Screen app matches `display-mode: fullscreen` rather than `standalone`, and
// says so on `navigator.standalone` too, which only Safari on iOS has.
const isStandalone = () =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  globalThis.matchMedia(STANDALONE).matches

const isIos = () => /iPhone|iPod/.test(navigator.userAgent)

const isActive = () => document.fullscreenElement === document.documentElement

/**
 * Fill the screen with the whole page: never one element of it, which would hide what's portalled
 * to the body over it, such as the dice, roll toasts and menus. Called within the click itself, as
 * the browser requires.
 */
function enter() {
  document.documentElement
    .requestFullscreen({ navigationUI: 'hide' })
    .catch(ignore)
}

/** Leave full screen, if anything fills it. */
function exit() {
  if (document.fullscreenElement) document.exitFullscreen().catch(ignore)
}

/**
 * Whether the page can fill the screen, as a video does, and does now; and a way in and out. Each
 * is false on the server and in the first render in the browser, so that both render the same.
 * It follows the page out of full screen however it leaves, such as by Escape or the back gesture.
 * Leaving the page doesn't end it: the pages a game fills keep it between them, and the guard in
 * the layout ends it on leaving them.
 */
export function useFullscreen(): {
  /** The browser lets the page fill the screen. Never on an iPhone. */
  supported: boolean
  /** The page runs as an app of its own, as from a phone's Home Screen. */
  standalone: boolean
  /** An iPhone or iPod, which can only show the page without its browser from the Home Screen. */
  ios: boolean
  /** The page fills the screen now. */
  active: boolean
  enter: () => void
  exit: () => void
} {
  const supported = useSyncExternalStore(unchanging, isSupported, never)
  const standalone = useSyncExternalStore(
    onDisplayModeChange,
    isStandalone,
    never,
  )
  const ios = useSyncExternalStore(unchanging, isIos, never)
  const active = useSyncExternalStore(onFullscreenChange, isActive, never)
  return { supported, standalone, ios, active, enter, exit }
}
