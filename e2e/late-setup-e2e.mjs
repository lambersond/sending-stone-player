// A campaign set up in the app while Foundry is already open: does its roster arrive?
import { actor, settings, user, users } from './fvtt/stub.mjs'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'

const GAME = 'https://lonely-mountain.forge-vtt.com'
const SECRET = 'ashlands-secret-123'
const EXPECT_FIX = process.env.EXPECT_FIX === '1'
const check = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok -', msg) }

const browser = await chromium.launch()
const foundry = await browser.newContext()
await foundry.grantPermissions(['local-network-access'], { origin: GAME })
await foundry.route(`${GAME}/**`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Foundry VTT</title>' }))
const gmTab = await foundry.newPage()
await gmTab.goto(`${GAME}/game`)
const posted = []
let inFlight = 0
let lastActivity = Date.now()
const realNow = Date.now
globalThis.fetch = async (url, init) => {
  inFlight++
  try {
    const answer = await gmTab.evaluate(async ({ url, init }) => {
      const response = await fetch(url, init)
      return { status: response.status, statusText: response.statusText, type: response.headers.get('content-type'), body: await response.text() }
    }, { url: String(url), init: { method: init.method, headers: init.headers, body: init.body, mode: init.mode, credentials: init.credentials, cache: init.cache } })
    posted.push({ envelope: JSON.parse(init.body), ...answer })
    return {
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      statusText: answer.statusText,
      headers: new Headers(answer.type ? { 'content-type': answer.type } : {}),
      json: async () => JSON.parse(answer.body),
      text: async () => answer.body,
    }
  } finally { inFlight--; lastActivity = realNow() }
}
const idle = async () => {
  await new Promise(resolve => setTimeout(resolve, 50))
  while (inFlight > 0 || realNow() - lastActivity < 300) await new Promise(resolve => setTimeout(resolve, 25))
}
const take = () => posted.splice(0)
const show = list => list.map(p => `${p.envelope.type} → ${p.envelope.campaign?.title} (${p.status}${p.body ? ` ${p.body}` : ''})`)

// Foundry is open before the campaign exists in the app.
users.activeGM = user('gm', 'Gamemaster', true)
user('alice', 'Alice')
actor('thorin', 'Thorin Oakenshield', ['alice'])
await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-ash': SECRET })
settings.set('campaigns', [{ id: 'camp-ash', title: 'Ashlands', characters: ['thorin'] }])
await Hooks.callAll('ready')
await idle()
console.log('on load:', show(take()))

// The Gamemaster sets the campaign up in the app.
const context = await browser.newContext()
await context.addCookies([await cookieFor('e2e-token')])
const gm = await context.newPage()
await gm.goto(`${BASE}/campaigns`)
await gm.getByRole('button', { name: 'New campaign' }).click()
const modal = gm.getByRole('dialog', { name: 'New campaign' })
await modal.getByLabel('Campaign title').fill('Ashlands')
await modal.getByLabel('Forge game address').fill('lonely-mountain.forge-vtt.com')
await modal.getByLabel('Secret', { exact: true }).fill(SECRET)
await modal.getByRole('button', { name: 'Set up campaign' }).click()
await modal.getByRole('button', { name: 'Done' }).click()
await gm.getByRole('article', { name: 'Ashlands' }).waitFor()

// The next heartbeat, 30 seconds on.
const { heartbeat } = await import(`${MODULE}/scripts/heartbeat.mjs`)
Date.now = () => realNow() + 31_000
heartbeat()
await idle()
Date.now = realNow
await idle()
console.log('after set-up:', show(take()))
const roster = sql(`select jsonb_array_length(characters) || ' characters, bound ' || ("foundryId" is not null) from campaign where title = 'Ashlands'`)
console.log('Ashlands in the app:', roster)

if (EXPECT_FIX) {
  check(roster === '1 characters, bound true', "the app asked for the campaign's hello, and its characters arrived")
  await gm.reload()
  check(await gm.getByRole('article', { name: 'Ashlands' }).getByText('Thorin Oakenshield').isVisible(), 'the Gamemaster sees them')
  heartbeat(); await idle()
  check(take().length === 0, 'no hello is asked for again once it arrived')
  Date.now = () => realNow() + 62_000
  heartbeat(); await idle()
  Date.now = realNow
  const after = take()
  check(after.length === 1 && after[0].envelope.type === 'bridge.heartbeat' && after[0].status === 200 && !JSON.parse(after[0].body).resend, 'the next heartbeat asks for no hello')
}
await browser.close()
process.exit(0)
