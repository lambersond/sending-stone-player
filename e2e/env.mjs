// What every suite takes from where it runs, in one place, read from the environment the e2e scripts
// (lanes/checks-lanes.sh, checks-cycle.sh, rerun.sh) give it, never from the app's .env:
// - BASE, the app's address: APP_URL (a lane's, e.g. http://localhost:3001), else http://localhost:3000.
// - dbUrl and sql(), the app's database: E2E_DB_URL, the lane's own (or the serial run's) database.
// - authSecret and cookieFor(), the app's signed session cookie for one of seed.sql's sessions:
//   E2E_AUTH_SECRET, the secret the scripts made for this pass and started the app with.
// - MODULE, the module under test: MODULE or MODULE_DIR (a SKEW run's older module), else
//   SENDING_STONE_MODULE, the module's checkout, else fvtt-sending-stone beside this checkout.
import { execFileSync } from 'node:child_process'
import { webcrypto } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const needs = name =>
  `${name} is unset: run the suites through e2e/lanes/checks-lanes.sh, e2e/checks-cycle.sh or e2e/rerun.sh (e2e/README.md), which set it`

export const BASE = process.env.APP_URL || 'http://localhost:3000'

export const authSecret = process.env.E2E_AUTH_SECRET
if (!authSecret) throw new Error(needs('E2E_AUTH_SECRET'))

export const dbUrl = process.env.E2E_DB_URL
export const sql = query => {
  if (!dbUrl) throw new Error(needs('E2E_DB_URL'))
  return execFileSync('psql', [dbUrl, '-qAtc', query], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
}

const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(authSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
/** The app's session cookie for one of the suites' own sessions (seed.sql): `cookieFor('e2e-token')`. */
export const cookieFor = async token => {
  const sig = Buffer.from(await webcrypto.subtle.sign('HMAC', key, new TextEncoder().encode(token))).toString('base64')
  return { name: 'better-auth.session_token', value: encodeURIComponent(`${token}.${sig}`), url: BASE }
}

export const SENDING_STONE_MODULE = process.env.SENDING_STONE_MODULE
  || fileURLToPath(new URL('../../fvtt-sending-stone', import.meta.url))
export const MODULE = process.env.MODULE ?? process.env.MODULE_DIR ?? SENDING_STONE_MODULE
