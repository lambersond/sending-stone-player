// The Magical Recipe Book's server, as far as Sending Stone hears from it (module 0.38.0, its contract
// D§10.1): its POST of a dish, made as its own client makes it (its src/server/sending-stone/client.ts
// at b7c6685, read as data, never copied), what it would then tell its player, and version-1 bodies of
// made-up recipes. No real data: every recipe, text, cook and id here is synthetic. A link code the
// UI can't make, for runs where no card is drawn, is made as the app makes one and its row written
// straight to the database. Import it first, before world-030.mjs: the Foundry stand-ins replace
// Node's fetch as they load (fvtt/stub.mjs), and world-030's `launch()` sends it through the game's
// page; this keeps Node's own, as a server's. So it imports nothing of the e2e's at its top, whose
// waits would let the stand-ins load first, and reads env.mjs when it's used.
import { createHash, randomBytes } from 'node:crypto'

/** Node's own fetch, as the cookbook's server has it, taken before any stand-in replaces it. */
const serverFetch = globalThis.fetch.bind(globalThis)
/** What the e2e's environment gives: the app's address and its database, read once it's loaded. */
const env = () => import('./env.mjs')

/** Where Sending Stone takes dishes, under its address. */
export const DISHES_PATH = '/api/cookbook/dishes'

/** The longest of Sending Stone's own words the cookbook shows its player. */
const MOST_WORDS = 200

/**
 * What the cookbook tells its player of an answer: nothing for a dish taken (any 2xx, its body
 * unread); else Sending Stone's own `message`, trimmed and cut to 200 characters, where it gave one;
 * else its own words for the status, as its client words them.
 * @param {number} status
 * @param {*} body   The answer's JSON, or null.
 * @returns {string|null}
 */
function wordsFor(status, body) {
  if (status >= 200 && status < 300) return null
  const message = (typeof body?.message === 'string') ? body.message.trim() : ''
  if (message) return message.slice(0, MOST_WORDS)
  if (status === 401 || status === 403) return 'Sending Stone didn’t accept this character’s link. Link it again.'
  if (status === 404) return 'Sending Stone doesn’t take dishes yet.'
  if (status === 409) return 'The game isn’t taking dishes right now.'
  return 'Sending Stone couldn’t take this dish just now.'
}

/** An answer as the suites read it: its status, its headers, its JSON (or null), and the cookbook's words. */
async function answered(response) {
  if (typeof response?.text !== 'function') throw new Error('cookbook-post.mjs posted through a stand-in\'s fetch: import it before world-030.mjs')
  const text = await response.text()
  let body = null
  try { body = JSON.parse(text) } catch {}
  return { status: response.status, headers: response.headers, body, text, words: wordsFor(response.status, body) }
}

/**
 * Post a dish as the cookbook's server does: to `/api/cookbook/dishes` under Sending Stone's
 * address, as JSON, with the character's link code as a bearer token, in at most 10 seconds,
 * never cached, redirects followed.
 * @param {string} code
 * @param {object} body
 * @returns {Promise<{status: number, headers: Headers, body: object|null, text: string, words: string|null}>}
 */
export async function postDish(code, body) {
  const { BASE } = await env()
  const response = await serverFetch(new URL(DISHES_PATH, BASE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${code}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  })
  return answered(response)
}

/**
 * A request to the same path the cookbook would never make, for what Sending Stone refuses: no
 * code, another content type, a body that isn't JSON or is too large, or another method. `code`
 * left out sends no Authorization; `type` null sends no Content-Type.
 * @param {object} options
 * @param {string} [options.code]
 * @param {string} [options.method]
 * @param {string|null} [options.type]
 * @param {string} [options.text]
 * @returns {Promise<{status: number, headers: Headers, body: object|null, text: string, words: string|null}>}
 */
export async function postRaw({ code, method = 'POST', type = 'application/json', text }) {
  const { BASE } = await env()
  const headers = {
    ...(type !== null && { 'Content-Type': type }),
    ...(code !== undefined && { Authorization: `Bearer ${code}` }),
  }
  const response = await serverFetch(new URL(DISHES_PATH, BASE), {
    method, headers, ...(text !== undefined && { body: text }), signal: AbortSignal.timeout(10_000), cache: 'no-store',
  })
  return answered(response)
}

/**
 * The made-up recipes, by name: what each is, and what it does, as the cookbook's changes say it.
 * None is the cookbook's own, nor anyone's.
 */
export const RECIPES = {
  'Ember Skewers': {
    outcome: 'boon',
    message: 'Charred at the edges and warm all the way through.',
    ingredients: [{ name: 'Emberroot', text: 'Gain 3+1d6 Maximum Hit Points and resistance to fire damage.' }],
    changes: [{ type: 'maxHitPoints', value: 7, formula: '3+1d6' }, { type: 'damageResistance', damageType: 'fire' }],
  },
  'Gloom Stew': {
    outcome: 'bane',
    message: 'Grey, thin and somehow colder than the pot.',
    ingredients: [{ name: 'Gloomcap', text: '-1 to ability checks and saving throws.' }],
    changes: [{ type: 'rollBonus', roll: 'check', value: -1 }, { type: 'rollBonus', roll: 'save', value: -1 }],
  },
  'Ink Risotto': {
    outcome: 'bane',
    message: 'Black as a moonless night, and it stays with you.',
    ingredients: [{ name: 'Inkweed', text: '-4 to Intelligence and a level of exhaustion.' }],
    changes: [{ type: 'abilityScore', ability: 'int', value: -4 }, { type: 'exhaustion', levels: 1 }],
  },
  'Plain Porridge': {
    outcome: 'standard',
    message: 'Filling, and nothing more.',
    ingredients: [],
    changes: [],
  },
}

let made = 0
/** An id shaped as a cuid, as the cookbook's ids are, and the e2e's own: `cme2e…`, 25 characters. */
export const dishId = () => `cme2e${Date.now().toString(36)}${String(++made).padStart(4, '0')}${randomBytes(3).toString('hex')}`.slice(0, 25)

/**
 * A version-1 body, as the cookbook's server builds one: a recipe of RECIPES by its name, with any
 * of its parts given instead; a boon's or bane's effect named for it, lasting a day; a standard
 * dish's none.
 * @param {object} options
 * @returns {object}
 */
export function dishBody({ id = dishId(), recipe = 'Ember Skewers', outcome, message, ingredients, changes, cook = 'Rook', status, seconds = 86_400 } = {}) {
  const base = RECIPES[recipe] ?? RECIPES['Ember Skewers']
  const how = outcome ?? base.outcome
  return {
    version: 1,
    dish: { id, recipe, status: status ?? ((how === 'standard') ? 'success' : how), outcome: how, cookedOnDay: 3, consumedOnDay: 3 },
    cook: { name: cook },
    message: message ?? base.message,
    effect: (how === 'standard') ? null : {
      name: `${recipe} (${how === 'boon' ? 'Boon' : 'Bane'})`,
      ingredients: ingredients ?? base.ingredients,
      duration: { seconds },
      stacks: false,
      changes: changes ?? base.changes,
    },
  }
}

/**
 * A link code for a seat, made as the app makes one (`sscb_` and 32 random bytes, base64url), and
 * its link row written straight to the database, kept as the app keeps it, by its SHA-256 and its
 * last four characters: for runs whose player's card draws nothing to make one with.
 * @param {string} characterId   The `character` row's id.
 * @param {string} campaignId
 * @param {string} actorId
 * @returns {Promise<string>}
 */
export async function linkCode(characterId, campaignId, actorId) {
  const { sql } = await env()
  const code = `sscb_${randomBytes(32).toString('base64url')}`
  const hash = createHash('sha256').update(code).digest('hex')
  sql(`insert into cookbook_link (id, "codeHash", hint, "characterId", "campaignId", "actorId", "createdAt")
    values ('e2elink-${randomBytes(6).toString('hex')}', '${hash}', '${code.slice(-4)}', '${characterId}', '${campaignId}', '${actorId}', now())
    on conflict ("characterId") do update set "codeHash" = excluded."codeHash", hint = excluded.hint, "campaignId" = excluded."campaignId",
      "actorId" = excluded."actorId", "createdAt" = excluded."createdAt", "lastUsedAt" = null`)
  return code
}
