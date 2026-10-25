/**
 * Dishes from the Magical Recipe Book, from module 0.38.0: what this app takes from the cookbook's
 * server by a player's link code, and how it hands each dish to its campaign's Foundry.
 */

/** The cookbook body versions this app reads. */
export const COOKBOOK_VERSIONS = [1] as const

/**
 * A link code's shape, checked before any database read: `sscb_` and 32 random bytes, base64url.
 */
export const COOKBOOK_CODE = /^sscb_[A-Za-z0-9_-]{43}$/

/** The largest body read, in bytes: the seeded recipes make at most 991. */
export const MAX_DISH_BYTES = 32_768

/** The most dishes through one link in a minute. */
export const DISHES_PER_MINUTE = 5

/**
 * The most dishes through one link in a day (round 0.38.0, the user's answer): a leaked code can't
 * fill a Gamemaster's chat while their Foundry is open and serving them.
 */
export const DISHES_PER_DAY = 50

/** The most dishes of a campaign waiting for its Foundry, queued or claimed. */
export const MOST_DISHES_WAITING = 50

/** The most dishes handed over per fetch, oldest first. */
export const DISH_CLAIM_LIMIT = 5

/** How many times a dish is handed over unanswered before it fails for good. */
export const DISH_ATTEMPTS = 5

/** How long a dish is kept after its last change, in milliseconds. */
export const DISHES_KEPT_FOR = 30 * 24 * 60 * 60 * 1000

/** How often a claim may prune a campaign's old dishes, per server process, in milliseconds. */
export const DISHES_PRUNE_EVERY = 10 * 60 * 1000

/** How many of a character's dishes its card shows, newest first. */
export const DISHES_SHOWN = 10

/** How often the player's card asks after its dishes, in milliseconds. */
export const COOKBOOK_POLL_EVERY = 15_000

/**
 * The most a change this app doesn't know is kept as sent: its keys, and its JSON's length
 * (round 0.38.0): unknown kinds are forwarded to Foundry and listed on its card.
 */
export const MOST_KEPT_CHANGE_KEYS = 20
export const MOST_KEPT_CHANGE_BYTES = 1024

/** Why the cookbook's post was refused, as its answer's `reason` says. */
export const COOKBOOK_REFUSAL = {
  NO_CODE: 'noCode',
  UNLINKED: 'unlinked',
  MOVED: 'moved',
  NOT_JSON: 'notJson',
  TOO_LARGE: 'tooLarge',
  INVALID: 'invalid',
  VERSION: 'version',
  OFF: 'off',
  UPDATE: 'update',
  BUSY: 'busy',
  DAILY: 'daily',
  FULL: 'full',
  UNAVAILABLE: 'unavailable',
} as const
export type CookbookRefusalReason =
  (typeof COOKBOOK_REFUSAL)[keyof typeof COOKBOOK_REFUSAL]
