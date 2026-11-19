// Sign-in reads (ROADMAP item 62), end to end, with no Foundry: the session's cookie as a browser
// holds it. Who is signed in is taken from Better Auth's cookie cache, `better-auth.session_data`,
// sealed (JWE) and good for a minute, beside the signed `better-auth.session_token`; every Server
// Action asks the database. Each part has its own browser context and its own session for Alice
// (e2e-signin-1 … e2e-signin-5), inserted here and deleted by id; seed.sql's own sessions are never
// touched, no token is read from the database, and no cookie's value is printed.
// 1. The page's first read of the app sets the cookie: HttpOnly, SameSite Lax, Path /, for a
//    minute; sealed. (Those are the journal's and the recipe card's, as the page loads; the table's
//    first poll comes 3 s later and takes the cookie.)
// 2. Signed out in another tab: the session and both cookies gone, Thorin's tab to Sign in.
// 3. A session deleted from the database still reads Thorin's table while its cookie lasts, but
//    deleting Thorin asks the database: sent to Sign in, Thorin kept, both cookies gone.
// 4. Once its cookie is gone, a deleted session's table goes to Sign in.
// 5. Removed from the campaign, Vex's table is not found at its next read, cookie or no.
// 6. A Server Action writes no cookie, so its page isn't read again.
// Parts 3 to 5 delete a row as soon as the cookie is fresh and every read the page asked before it
// is answered, and `cacheHeld` fails, as "too slow to test the cache", rather than let a check run
// once the cookie may have lapsed. Run with --import ./fvtt/unref-timers.mjs --import
// ./fvtt/dnd5e-register.mjs, as regress.sh does.
import { chromium } from 'playwright'
import { BASE, cookieFor, sql } from './env.mjs'

const TOKEN = 'better-auth.session_token'
const DATA = 'better-auth.session_data'
const check = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok -', msg) }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(test, what, ms = 15_000) {
  const end = Date.now() + ms
  while (!(await test())) {
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`)
    await wait(100)
  }
}
const began = Date.now()
const part = name => console.log(`# ${name}, at ${((Date.now() - began) / 1000).toFixed(1)} s`)

const browser = await chromium.launch()
const problems = []

/** A context of its own, signed in as Alice with a session of its own, inserted for it. */
async function signedIn(n) {
  const id = `e2e-signin-${n}`
  const token = `e2e-signin-token-${n}`
  sql(`insert into "session" (id, token, "userId", "expiresAt", "createdAt", "updatedAt")
    values ('${id}', '${token}', 'e2e-user', now() + interval '7 days', now(), now())`)
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.addCookies([await cookieFor(token)])
  const page = await context.newPage()
  page.on('pageerror', e => problems.push(`${id} pageerror: ${e.message}`))
  return { id, context, page, open: openReads(page) }
}
const sessionRows = id => Number(sql(`select count(*) from "session" where id = '${id}'`))
const characterRows = id => Number(sql(`select count(*) from "character" where id = '${id}'`))
/** The session's cookies the context holds, by name: never their values. */
const cookiesOf = async context => (await context.cookies()).filter(c => c.name === TOKEN || c.name === DATA)
const names = async context => (await cookiesOf(context)).map(c => c.name).sort()
const dataCookie = async context => (await cookiesOf(context)).find(c => c.name === DATA)

/** Whether a request, or the response to one, is a read of the app. */
const isApp = r => r.url().startsWith(`${BASE}/api/`)
const setsData = async response => ((await response.headerValue('set-cookie')) ?? '').includes(`${DATA}=`)
/** The page's reads of the app asked and not yet answered, kept from its first. */
function openReads(page) {
  const open = new Set()
  page.on('request', r => { if (isApp(r)) open.add(r) })
  page.on('requestfinished', r => open.delete(r))
  page.on('requestfailed', r => open.delete(r))
  return open
}
/**
 * Waits for a read of the app that sets the session's cookie cache, then for every read the page
 * asked before it to be answered, and says when the cache landed. As it loads, a page asks for its
 * journal and its recipe card together, with no cache yet, so both go to the database: a session
 * deleted while one of them is on its way is found gone there, and both cookies are expired. Begin
 * it before the navigation it waits on.
 */
async function freshCache({ page, open }) {
  const landed = await page.waitForResponse(async r => isApp(r) && await setsData(r), { timeout: 20_000 }).then(() => Date.now())
  const asked = [...open]
  await until(() => asked.every(r => !open.has(r)), 'the reads asked before the cookie cache to be answered')
  return landed
}
/** The answer to a table's next read: one asked from now on, never one already on its way. */
const nextTable = async (page, sheet) => {
  const asked = await page.waitForRequest(r => r.url().startsWith(`${BASE}/api/characters/${sheet}/table`), { timeout: 15_000 })
  return asked.response()
}
/** Fails the run unless the cookie cache is held with at least `seconds` left: a check after it could pass once it lapsed. */
async function cacheHeld(context, seconds, what) {
  const data = await dataCookie(context)
  const left = data ? data.expires - Date.now() / 1000 : -1
  if (left < seconds) {
    throw new Error(`FAIL: too slow to test the cache, ${what}: ${data ? `${left.toFixed(1)} s of the cookie left` : 'no cookie'}, ${seconds} s needed`)
  }
}
const atSignIn = page => page.getByRole('heading', { level: 1, name: 'Sign in' }).isVisible()

// ---- 1. The cookie ----
part('1. the cookie')
const one = await signedIn(1)
const thorin = one.page
let fresh = freshCache(one)
await thorin.goto(`${BASE}/characters/seedthorin`)
let at = await fresh
const cache = await dataCookie(one.context)
const life = cache ? cache.expires - at / 1000 : NaN
check(cache?.httpOnly === true && cache.sameSite === 'Lax' && cache.path === '/' && life >= 55 && life <= 65,
  `the page's first read sets the session's cookie cache: HttpOnly, SameSite Lax, Path /, for a minute (${JSON.stringify(cache && { httpOnly: cache.httpOnly, sameSite: cache.sameSite, path: cache.path, life: Math.round(life) })})`)
const parts = cache.value.split('.')
const readable = parts.map(p => Buffer.from(p, 'base64url').toString('latin1'))
check(parts.length === 5 && !readable.some(text => /Alice|Adventurer|alice@/.test(text)),
  `the cookie is sealed: nobody holding it can read Alice's name or email (${parts.length} parts)`)

// ---- 2. Signed out in another tab ----
part('2. signed out in another tab')
const list = await one.context.newPage()
list.on('pageerror', e => problems.push(`${one.id} list pageerror: ${e.message}`))
await list.goto(`${BASE}/characters`)
const signOut = list.getByRole('button', { name: 'Sign out' })
await signOut.waitFor()
// A read of Thorin's table that went to the database just as the session ended could write the
// cache again: sign out well inside the cookie's minute, where every read takes it from the cookie.
await cacheHeld(one.context, 15, 'before signing out')
const signedOut = list.waitForResponse(r => r.url().startsWith(`${BASE}/api/auth/sign-out`))
await signOut.click()
const answered = (await signedOut).status()
await until(async () => (await names(one.context)).length === 0, 'both cookies gone', 5_000).catch(() => {})
const kept = await names(one.context)
check(answered === 200 && sessionRows(one.id) === 0 && kept.length === 0,
  `signed out in another tab, the session is gone and the browser keeps neither cookie (${answered}, ${JSON.stringify(kept)})`)
await thorin.bringToFront()
await thorin.waitForURL(/\/login/, { timeout: 15_000 })
await thorin.getByRole('heading', { level: 1, name: 'Sign in' }).waitFor({ timeout: 15_000 })
check(await atSignIn(thorin), "Thorin's tab, signed out elsewhere, goes to Sign in at its next read")
await one.context.close()

// ---- 3. A session deleted from the database ----
part('3. a session deleted from the database')
const two = await signedIn(2)
fresh = freshCache(two)
await two.page.goto(`${BASE}/characters/seedthorin`)
await fresh
sql(`delete from "session" where id = '${two.id}'`)
await cacheHeld(two.context, 10, 'after the session was deleted')
const reads = []
for (let i = 0; i < 2; i++) reads.push((await nextTable(two.page, 'seedthorin')).status())
check(reads.every(status => status === 200 || status === 204),
  `a session deleted from the database still reads the table while its cookie lasts (${reads.join(', ')})`)
await two.page.getByRole('button', { name: 'Delete Thorin Oakenshield', exact: true }).click()
const confirm = two.page.getByRole('dialog', { name: 'Delete Thorin Oakenshield?' })
await confirm.waitFor()
await cacheHeld(two.context, 10, 'before deleting Thorin')
await confirm.getByRole('button', { name: 'Delete', exact: true }).click()
await two.page.waitForURL(/\/login/, { timeout: 15_000 })
await two.page.getByRole('heading', { level: 1, name: 'Sign in' }).waitFor({ timeout: 15_000 })
const left = await names(two.context)
check(characterRows('seedthorin') === 1 && left.length === 0,
  `…but deleting Thorin asks the database: sent to Sign in, Thorin kept, both cookies gone (${JSON.stringify(left)})`)
await two.context.close()

// ---- 4. The cookie runs out ----
part('4. the cookie runs out')
const three = await signedIn(3)
fresh = freshCache(three)
await three.page.goto(`${BASE}/characters/seedthorin`)
await fresh
sql(`delete from "session" where id = '${three.id}'`)
// As at its Max-Age.
await three.context.clearCookies({ name: DATA })
const refused = (await nextTable(three.page, 'seedthorin')).status()
await three.page.waitForURL(/\/login/, { timeout: 15_000 })
await three.page.getByRole('heading', { level: 1, name: 'Sign in' }).waitFor({ timeout: 15_000 })
check(refused === 401 && await atSignIn(three.page),
  `once its cookie is gone, a deleted session's table goes to Sign in (${refused})`)
await three.context.close()

// ---- 5. Removed from the campaign ----
part('5. removed from the campaign')
const four = await signedIn(4)
fresh = freshCache(four)
await four.page.goto(`${BASE}/characters/seedvex`)
await fresh
// As the Gamemaster's Remove does (removePlayer deletes the row).
sql(`delete from "character" where id = 'seedvex'`)
await cacheHeld(four.context, 10, 'after Vex was removed')
const gone = (await nextTable(four.page, 'seedvex')).status()
const notFound = four.page.getByRole('heading', { name: 'This page could not be found.' })
await notFound.waitFor({ timeout: 15_000 })
check(gone === 404 && await notFound.isVisible(),
  `removed from the campaign, Vex's table is not found at the next read, cookie or no (${gone})`)
await four.context.close()
sql(`delete from "session" where id = '${four.id}'`)

// ---- 6. A Server Action writes no cookie ----
part('6. a Server Action writes no cookie')
const five = await signedIn(5)
await five.page.goto(`${BASE}/characters`)
const invite = five.page.getByRole('textbox', { name: 'Invite link' })
await invite.waitFor()
// So that any read that may use the cache goes to the database.
await five.context.clearCookies({ name: DATA })
await invite.fill('not an invite')
const action = five.page.waitForResponse(r => r.request().method() === 'POST' && Boolean(r.request().headers()['next-action']))
await five.page.getByRole('button', { name: 'Join campaign' }).click()
const answer = await action
const wrote = await setsData(answer)
const revalidated = await answer.headerValue('x-action-revalidated')
const said = five.page.getByText('Paste the invite link your Gamemaster shared.')
await said.waitFor({ timeout: 15_000 })
const held = await dataCookie(five.context)
check(!wrote && revalidated === null && await said.isVisible() && !held,
  `a Server Action reads the session without writing its cookie, so its page isn't read again (cookie written: ${wrote}, x-action-revalidated: ${revalidated}, cookie held: ${Boolean(held)})`)
await five.context.close()
sql(`delete from "session" where id = '${five.id}'`)

await browser.close()
if (problems.length) throw new Error(`FAIL: page errors ${JSON.stringify(problems)}`)
