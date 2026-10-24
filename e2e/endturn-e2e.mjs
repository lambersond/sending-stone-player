// End Turn (module 0.36.0 and the app, its contract §2.8, §5.5, §6.13, §6.14, §8.11, §13.8, §13.9),
// end to end, in the world of world-030.mjs with scenes and tokens (fvtt/token-core.mjs), its
// screens as the user's End Turn prototype draws them, with Undo. Alice plays Thorin, with Brakka
// (owned, linked) and a Bat the Gamemaster summoned with Thorin's Find Familiar; Bob plays Vex, with
// his own wolf; a goblin; a fight started at round 1 on Thorin (Thorin 20, Brakka 18, the Bat 15, the
// goblin 12, Vex 10, the wolf 8), moved as Foundry's Next Turn moves it. The hello takes `endTurn`
// and `undoEndTurn`, a companion's kinds neither. On Alice's phone: the turn panel's End turn, its
// hint, on its way and once the turn has moved on, with the toast and Undo, which takes the turn back
// by one write with Foundry's turn events off; the toast's 8 seconds, paused under the pointer; the
// Combat tab held from the Character tab, by a real touch: its fill from the left, nothing for its
// first sixth, the toast at half a second, the end at a second with a buzz, the clicks after it
// quiet, a finger kept down; an early let-go, a tap and a drift; the tablet's rail and the laptop's
// column, held by a touch and by a mouse, and a right-click; refusals from the button and from the
// hold, and Undo's once the turn has moved; a companion's turn; nobody's, Bob's, and the
// Gamemaster's page; stale and doubled requests; the keyboard; the words a screen reader hears;
// reduced motion; Banner and Send to the table off; the turn moving under a hold, and a tap as it
// moves; a rewind; a companion's tab chosen; numbered companions; every width in both themes.
// MIDI=1: an area damage of Vex's holding the Gamemaster's targets, then Alice's Undo, made after
// it. DND5E6=1: the same. SKEW=035 with MODULE=module-0.35.0: no End Turn in the hello or on the
// page, and the app refuses one. Holds on a touch screen are CDP touches, as a phone's; the page's
// timings are read on the page itself (performance.now), never from here. Synthetic characters
// only. Run with --import ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots
// to SHOTS.
import {
  BASE, BOB, MIDI, SHOTS, SKEW035, VARIANT, W, activeScene, actors, browse, call, character, check, companion, finish,
  foundryWorld, launch, newCampaign, note, npc, part, place, postsOf, problems, same, sceneWorld, settled, shootBoth, sideways, sql,
  startModule, summoned, theme, until, wait,
} from './world-030.mjs'

const GAME = 'https://ashlands-turns.forge-vtt.com'
const SECRET = 'ashlands-endturn-36'
const TITLE = 'Ashlands'
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: TITLE, address: 'ashlands-turns.forge-vtt.com', secret: SECRET })
await foundryWorld()
const T = await sceneWorld()
game.modules.get('sending-stone').version = SKEW035 ? '0.35.0' : '0.36.0'

// ---- The world ----
const capital = text => text.charAt(0).toUpperCase() + text.slice(1)
const hits = (formula, type) => ({ formula, damageType: type, label: `${formula} ${capital(type)}` })
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, dex: 2 }, hp: { value: 30, max: 40, temp: 0 } }, {
  ac: 18, items: [{ id: 'findFamiliar', name: 'Find Familiar', type: 'spell', system: { level: 1, method: 'spell', properties: [] }, activities: [{ id: 'ffSummon', type: 'summon' }] }],
})
thorin.system.details = { level: 5 }
// Under Midi-QOL, Vex's Fireball, whose damage holds the Gamemaster's targets while it waits (step 22).
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { dex: 3, int: 4 }, hp: { value: 24, max: 30, temp: 0 } }, {
  ac: 14,
  ...(MIDI && {
    spells: { spell3: { value: 3, max: 3, level: 3 } },
    items: [{
      id: 'fireball', name: 'Fireball', type: 'spell', system: { level: 3, method: 'spell', prepared: 1, canPrepare: true, properties: [], duration: { units: 'inst' } },
      activities: [{ id: 'blast', type: 'save', template: 'sphere', affects: 'creature', save: ['dex'], dc: 15, damage: [{ number: 8, denomination: 6, types: ['fire'], scaling: 1 }], labels: { damage: [hits('8d6', 'fire')] } }],
    }],
  }),
  ...(!MIDI && { items: [] }),
})
vex.system.details = { level: 5 }
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
const goblin = npc('goblin', 'Goblin', 12, { dex: 1 })
const brakka = companion('brakka', 'Brakka', { owners: ['alice'], linked: true, ac: 14, npc: { spec: { mods: { str: 3, dex: 1 }, hp: { value: 30, max: 30, temp: 0 } }, system: { details: { cr: 2, type: { value: 'humanoid', label: 'Humanoid' } } } } })
const wolf = companion('wolf', 'Wolf', { owners: ['bob'], linked: true, ac: 13, npc: { spec: { mods: { dex: 2 }, hp: { value: 11, max: 11, temp: 0 } }, system: { details: { cr: 0.25, type: { value: 'beast', label: 'Beast' } } } } })
const bat = companion('bat', 'Bat', { linked: false, ac: 12, npc: { flags: { dnd5e: { isAutoImported: true } }, spec: { mods: { dex: 2 }, hp: { value: 1, max: 1, temp: 0 } } } })
const arena = await activeScene('arena')
const tokenOf = {}
for (const actor of [thorin, vex, goblin, brakka, wolf]) tokenOf[actor.id] = await place(arena, actor, { id: `tok${actor.id}`, actorLink: true, tell: false })
const bat1 = await summoned(arena, bat, thorin, 'findFamiliar', { id: 'bat1', name: 'Bat', activity: 'ffSummon', tell: false })
Object.defineProperty(actors, 'party', { get: () => null, configurable: true })
W.gm.targets = new Set()
await startModule({ campaigns: [{ id: 'camp-ash', title: TITLE, characters: ['thorin', 'vex'], groups: [], rolls: true, attacks: true }], secrets: { 'camp-ash': SECRET } })
await settled()
const fight = T.combatOf('fight', [
  { id: 'cbThorin', actor: thorin, token: tokenOf.thorin, fields: { name: 'Thorin', initiative: 20 } },
  { id: 'cbBrakka', actor: brakka, token: tokenOf.brakka, fields: { name: 'Brakka', initiative: 18 } },
  { id: 'cbBat', token: bat1, fields: { name: 'Bat', initiative: 15 } },
  { id: 'cbGoblin', actor: goblin, token: tokenOf.goblin, fields: { name: 'Goblin', initiative: 12 } },
  { id: 'cbVex', actor: vex, token: tokenOf.vex, fields: { name: 'Vex', initiative: 10 } },
  { id: 'cbWolf', actor: wolf, token: tokenOf.wolf, fields: { name: 'Wolf', initiative: 8 } },
])
fight.round = 1
fight.turn = 0
Object.defineProperty(game, 'combat', { get: () => game.combats.get('fight') ?? null, configurable: true })
await Hooks.callAll('createCombat', fight)
await until(() => sql('select count(*) from combat') === '1', 'the app to hear of the fight', 15_000)
// What the bridge heard of turns moving by Foundry's own Next and Previous Turn.
const heard = { combatTurn: 0, combatRound: 0 }
Hooks.on('combatTurn', () => { heard.combatTurn++ })
Hooks.on('combatRound', () => { heard.combatRound++ })

// ---- The pages, and what they're watched by ----
const HINT = 'Or press and hold the Combat tab, from any tab.'
const HOLD_LINE = 'Keep holding to end it, or let go to keep it.'
const GAME_WORDS = 'your Gamemaster’s game'
/**
 * What a page of Alice's records of itself, on the page and in its own time: the device's buzzes,
 * its posts of rolls with the app's answers, the turn's toast cards as they show, change and go, the
 * presses with the drawn fill of the tab pressed each frame, context menus, clicks, and the turn
 * panel's heading and End turn as they change. Its own fetch stays for the suite's own requests.
 */
const INSTRUMENT = () => {
  const now = () => performance.now()
  const e2e = { buzz: [], posts: [], cards: [], presses: [], menus: [], clicks: [], headings: [], buttons: [] }
  window.__e2e = e2e
  const original = window.fetch
  window.__e2eFetch = original.bind(window)
  try {
    Object.defineProperty(navigator, 'vibrate', { configurable: true, writable: true, value: ms => { e2e.buzz.push({ t: now(), ms }); return true } })
  } catch {}
  window.fetch = function (input, init) {
    let record
    try {
      const url = new URL(typeof input === 'string' ? input : (input.href ?? input.url), location.href)
      if (String(init?.method ?? 'GET').toUpperCase() === 'POST' && /\/rolls$/.test(url.pathname)) {
        const body = JSON.parse(init.body)
        record = { t: now(), path: url.pathname, kind: body.kind, body, status: null, reason: null, id: null }
        e2e.posts.push(record)
      }
    } catch {}
    const made = original.apply(this, arguments)
    if (record) {
      made.then(response => {
        record.status = response.status
        response.clone().json().then(json => { record.reason = json?.reason ?? null; record.id = json?.id ?? null }).catch(() => {})
      }).catch(() => {})
    }
    return made
  }
  const cards = new WeakMap()
  let heading = null
  let button = null
  const scan = () => {
    const t = now()
    const live = new Set()
    for (const card of document.querySelectorAll('[data-turn-toast]')) {
      let record = cards.get(card)
      if (!record) {
        record = { n: e2e.cards.length, kind: card.dataset.turnToast, at: t, gone: null, seen: [] }
        cards.set(card, record)
        e2e.cards.push(record)
      }
      live.add(record)
      const p = card.querySelector('p')
      const line = p?.querySelector('small')?.textContent ?? null
      const words = p ? p.textContent.slice(0, p.textContent.length - (line?.length ?? 0)) : ''
      const undo = [...card.querySelectorAll('button')].some(b => b.textContent === 'Undo')
      const look = `${words}|${line}|${undo}`
      if (record.seen.at(-1)?.look !== look) record.seen.push({ t, look, words, line, undo })
    }
    for (const record of e2e.cards) if (record.gone === null && !live.has(record)) record.gone = t
    const h = document.getElementById('turn-heading')?.textContent ?? null
    if (h !== heading) { heading = h; e2e.headings.push({ t, text: h }) }
    const b = document.querySelector('#turn-heading ~ button')
    const look = b ? `${b.textContent}|${b.getAttribute('aria-disabled') ?? ''}` : null
    if (look !== button) { button = look; e2e.buttons.push({ t, look }) }
  }
  new MutationObserver(scan).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-disabled', 'data-turn-toast'] })
  // Each press: when, and each frame after the page's own (registered after React's handler, so
  // run after the hold's frame in each), the tab's fill as drawn, by its box. When is taken as the
  // press reaches the window, before the page's own handler, which times the hold: here, after it,
  // it would be late by whatever React draws in between, a few milliseconds or more under load.
  let reached = null
  window.addEventListener('pointerdown', () => { reached = now() }, true)
  window.addEventListener('pointerdown', event => {
    const tab = event.target?.closest?.('button')
    const press = { at: reached ?? now(), type: event.pointerType, button: event.button, label: tab?.textContent ?? null, up: null, cancelled: false, frames: [] }
    // Where it was pressed, to tell each frame whether what's under it is still the tab's own.
    const x = event.clientX
    const y = event.clientY
    e2e.presses.push(press)
    if (!tab) return
    const step = () => {
      const t = now() - press.at
      const fill = tab.querySelector(':scope > span.origin-left')
      const box = tab.getBoundingClientRect()
      const drawn = fill?.getBoundingClientRect()
      press.frames.push({ t, w: drawn ? drawn.width : null, bw: box.width, left: drawn ? drawn.left - box.left : null, primary: tab.classList.contains('text-text-primary'), secondary: tab.classList.contains('text-text-secondary'), over: tab.contains(document.elementFromPoint(x, y)) })
      if (t < 6000 && (press.up === null || t - press.up < 250)) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
  const lift = cancelled => () => {
    const press = e2e.presses.at(-1)
    if (press && press.up === null) { press.up = now() - press.at; press.cancelled = cancelled }
  }
  window.addEventListener('pointerup', lift(false))
  window.addEventListener('pointercancel', lift(true))
  window.addEventListener('contextmenu', event => { e2e.menus.push({ t: now(), prevented: event.defaultPrevented }) })
  window.addEventListener('click', event => { e2e.clicks.push({ t: now(), label: event.target?.closest?.('button')?.textContent ?? null }) }, true)
}

const API = '/api/characters/sheet-thorin'
/**
 * The table's polls of a page of Alice's, which a step may hold back to make the page stale: held,
 * each poll waits, unanswered, until let through; `next()` is the one held now, for a step to answer
 * with the app's answer at a moment of its choosing.
 */
async function pollGate(who) {
  const held = []
  let on = false
  await who.page.route(url => url.pathname === `${API}/table`, route => {
    if (on) held.push(route)
    else route.continue().catch(() => {})
  })
  return {
    /** Polls held from now; resolved once one is, so no poll begun before is still on its way. */
    async hold() {
      on = true
      await until(() => held.length > 0, 'a poll of the table held back', 10_000)
    },
    async release() {
      on = false
      for (const route of held.splice(0)) await route.continue().catch(() => {})
    },
    /** The poll held now, taken from the gate, for its step to answer. */
    take: () => held.shift(),
  }
}
/** A page of Alice's, watched, its polls through a gate. */
async function seat(width, height) {
  const who = await browse({ width, height, toasts: false })
  await who.view.addInitScript(INSTRUMENT)
  who.gate = await pollGate(who)
  await who.page.goto(`${BASE}/characters/sheet-thorin`)
  await who.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 }).catch(async error => {
    note(`the page at ${width} never showed its sheet: ${JSON.stringify(problems)}; ${(await who.page.locator('body').innerText().catch(() => '')).slice(0, 400)}`)
    throw error
  })
  return who
}
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const alice = await seat(390, 844)
const bob = await browse({ width: 390, height: 844, who: BOB, toasts: false })
await bob.page.goto(invite)
await bob.page.getByRole('radio', { name: /^Vex/ }).check()
await bob.page.getByRole('button', { name: 'Join as this character' }).click()
await bob.page.waitForURL(/\/characters\/[\w-]+$/)
await bob.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const BOB_API = `/api/characters/${sql(`select id from "character" where "actorId" = 'vex' and "campaignId" = '${A}'`)}`

// ---- What's said, kept and made ----
const hello = () => postsOf('bridge.hello').at(-1)
const current = () => fight.combatant?.id ?? null
const turnOf = combatantId => ({ combatId: 'fight', round: fight.round, combatantId })
const ROLL = { mode: 0, explicit: false, extras: [], dice: [] }
const endTurnBody = turn => ({ kind: 'endTurn', turn, ...ROLL })
const undoBody = (undo, turn) => ({ kind: 'undoEndTurn', undo, turn, ...ROLL })
const endTurn = (who, api, turn) => call(who.page, `${api}/rolls`, { method: 'POST', body: endTurnBody(turn) })
/** A POST from a watched page by its own fetch, not the app's, so its record stays the app's. */
const post = (who, path, body) => who.page.evaluate(async ({ path, body }) => {
  const response = await window.__e2eFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const text = await response.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: response.status, text, json }
}, { path, body })
const rollRow = id => JSON.parse(sql(`select row_to_json(r)::text from (select id, kind, status, result, "completedAt" from roll_request where id = '${id}') r`) || 'null')
const lastOf = kind => sql(`select id from roll_request where kind = '${kind}' and "campaignId" = '${A}' order by "createdAt" desc limit 1`)
const paced = () => until(() => Number(sql(`select count(*) from roll_request where "campaignId" = '${A}' and "createdAt" > now() - interval '1 minute'`)) < 14, 'room under the rate limit', 70_000)
/** The combat as the app has it stored, as its own checks read it. */
const stored = () => JSON.parse(sql(`select json_build_object('round', data->'round', 'combatantId', data->'combatantId')::text from combat where "combatId" = 'fight'`) || '{}')
/** The Gamemaster's own Next Turn, to this combatant, made in Foundry; once the app has heard it. */
async function gmTurnTo(id, round = 1) {
  const before = postsOf('combat.turn').length
  await fight.setTurn(round, fight.turns.findIndex(cb => cb.id === id))
  await until(() => postsOf('combat.turn').length > before && stored().combatantId === id && stored().round === round, `the app to hear the Gamemaster move the turn to ${id}`, 15_000)
}
/** Until the app's view of the fight has this combatant's turn, as a page polls it. */
const viewOn = (who, api, name) => until(async () => {
  const combat = (await call(who.page, `${api}/table`)).json?.combat
  return combat?.combatants?.find(c => c.id === combat.currentId)?.name === name
}, `${name}'s turn in the app`, 20_000)
/** A turn ended through a seat: its POST's answer, and its row once the game has made it. */
async function ended(who, api, turn, what, send = endTurn) {
  const answer = await send(who, api, turn)
  if (answer.status !== 202) return { answer, made: null }
  await until(() => ['done', 'failed'].includes(rollRow(answer.json.id)?.status), `${what} to be made`, 30_000)
  return { answer, made: rollRow(answer.json.id) }
}

/** What a watched page has recorded. */
const logOf = who => who.page.evaluate(() => JSON.parse(JSON.stringify(window.__e2e)))
const nowIn = who => who.page.evaluate(() => performance.now())
/** Where each record stands now, to read what comes after. */
const mark = async who => {
  const log = await logOf(who)
  return { t: await nowIn(who), cards: log.cards.length, posts: log.posts.length, presses: log.presses.length, buzz: log.buzz.length, menus: log.menus.length, clicks: log.clicks.length, headings: log.headings.length, buttons: log.buttons.length }
}
const since = async (who, m) => {
  const log = await logOf(who)
  return {
    log, cards: log.cards.slice(m.cards), posts: log.posts.slice(m.posts), presses: log.presses.slice(m.presses), buzz: log.buzz.slice(m.buzz),
    menus: log.menus.slice(m.menus), clicks: log.clicks.slice(m.clicks), headings: log.headings.slice(m.headings), buttons: log.buttons.slice(m.buttons),
  }
}
/** A card after a mark, of a kind, once shown. */
async function cardOf(who, m, kind, what) {
  let found
  await until(async () => { found = (await since(who, m)).cards.find(c => c.kind === kind); return !!found }, what, 20_000)
  return found
}
const cardNow = async (who, n) => (await logOf(who)).cards[n]
const words = card => card.seen.at(-1)

// The page's parts.
const heading = who => who.page.locator('#turn-heading')
const headingText = who => heading(who).textContent()
const button = who => who.page.locator('#turn-heading ~ button')
const panel = who => who.page.locator('section[aria-labelledby="turn-heading"]')
const alertLine = who => panel(who).locator('[role="alert"]')
const hint = who => who.page.getByText(HINT, { exact: true })
const undoButton = who => who.page.locator('[data-turn-toast] button', { hasText: 'Undo' })
const wide = who => who.width >= 1024
const COMBAT_BAR = 'nav[aria-label="Table"] > button:nth-child(2)'
const COMBAT_COLUMN = '[role="tablist"][aria-label="Combat or chat"] > button:nth-child(1)'
const combatSelector = who => (wide(who) ? COMBAT_COLUMN : COMBAT_BAR)
const combatTab = who => who.page.locator(combatSelector(who))
const barTab = (who, name) => who.nav.locator(':scope > button').filter({ hasText: new RegExp(`^${name}`) })
/** Which of the bottom bar's or rail's tabs is shown. */
const shownTab = who => who.page.evaluate(() => document.querySelector('nav[aria-label="Table"] > button[aria-current="page"]')?.textContent.match(/^(Character|Combat|Chat)/)?.[1] ?? null)
/** A control pressed as each device presses it: a finger's tap below 1024 px, a mouse's click above. */
const press = (who, locator) => (wide(who) ? locator.click() : locator.tap())
async function showTab(who, name) {
  await press(who, barTab(who, name))
  await until(async () => (await shownTab(who)) === name, `${name} shown at ${who.width}`, 5_000)
}
/** The column on Combat, where the page has one. */
async function combatShown(who) {
  if (!wide(who)) return showTab(who, 'Combat')
  if ((await combatTab(who).getAttribute('aria-selected')) !== 'true') await combatTab(who).click()
  await until(async () => (await combatTab(who).getAttribute('aria-selected')) === 'true', 'the column on Combat', 5_000)
}
const untilHeading = (who, text, ms = 20_000) => until(async () => (await headingText(who).catch(() => null)) === text, `"${text}" at ${who.width}`, ms)
/** Until End turn is offered: shown, not on its way, and no longer aria-disabled. */
const armed = who => until(async () => (await button(who).count()) === 1 && (await button(who).textContent()) === 'End turn' && (await button(who).getAttribute('aria-disabled')) === null, `End turn offered at ${who.width}`, 15_000)
/** The page's accessible name and description of one element, as Chromium computes them for screen readers. */
async function axOf(who, selector) {
  const cdp = await who.view.newCDPSession(who.page)
  try {
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 })
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector })
    if (!nodeId) return null
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false })
    return { name: nodes[0]?.name?.value ?? null, description: nodes[0]?.description?.value ?? null }
  } finally {
    await cdp.detach().catch(() => {})
  }
}

/** A finger on an element, as a phone's: CDP touches, so Chromium's own long press is met. */
async function finger(who, locator) {
  const box = await locator.boundingBox()
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  const cdp = await who.view.newCDPSession(who.page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  return {
    move: (dx, dy) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx, y: y + dy }] }),
    async up() {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await cdp.detach().catch(() => {})
    },
  }
}
/** A mouse's main button down on an element. */
async function mouseDown(who, locator) {
  const box = await locator.boundingBox()
  await who.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await who.page.mouse.down()
  return { up: () => who.page.mouse.up(), move: (dx, dy) => who.page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy) }
}
/** Until the press after the mark has been down this long, by the page's own clock. */
const downFor = (who, m, ms) => who.page.waitForFunction(([n, ms]) => {
  const press = window.__e2e.presses[n]
  return press && performance.now() - press.at >= ms
}, [m.presses, ms], { polling: 'raf', timeout: 15_000 })
/** The Combat tab of the layout shown held this long, by a finger, or by the mouse on a wide screen; what the page recorded. */
async function hold(who, ms, { during } = {}) {
  const m = await mark(who)
  const down = wide(who) ? await mouseDown(who, combatTab(who)) : await finger(who, combatTab(who))
  if (during) await during(m, down)
  await downFor(who, m, ms)
  await down.up()
  return m
}
/** The press after a mark: its frames, and the fill's share of the tab in each. */
const pressAfter = async (who, m) => (await logOf(who)).presses[m.presses]
const share = frame => (frame.w ?? 0) / frame.bw
const framesIn = (press, from, to) => press.frames.filter(f => f.t >= from && f.t <= to)
/** The fill as a hold draws it, by its frames: nothing for the first sixth, about half at 600 ms. */
function fillLook(press) {
  const quiet = framesIn(press, 0, 160)
  const half = framesIn(press, 560, 640)
  return {
    quiet: quiet.length > 0 && quiet.every(f => (f.w ?? 0) === 0),
    half: half.length > 0 && half.every(f => Math.abs(share(f) - 0.52) <= 0.08),
    left: half.length > 0 && half.every(f => f.left !== null && Math.abs(f.left) <= 1 && share(f) > 0 && share(f) < 1),
    primary: half.length > 0 && half.every(f => f.primary && !f.secondary),
    shares: half.map(f => `${Math.round(f.t)}:${share(f).toFixed(2)}`).join(' '),
    quietShares: quiet.map(f => `${Math.round(f.t)}:${f.w}`).join(' '),
  }
}
/** Undo, from the toast, as each device presses it; once Foundry is back on the turn it ended. */
async function undoFromToast(who, back, heading) {
  await undoButton(who).waitFor({ timeout: 20_000 })
  await paced()
  await press(who, undoButton(who))
  await until(() => current() === back, `the turn taken back to ${back}`, 30_000)
  await untilHeading(who, heading)
}
/** Undo, by its request, as the page would send it, for a step whose toast has gone. */
async function undoByRequest(who, left, back, heading) {
  await paced()
  const answer = await post(who, `${API}/rolls`, undoBody(lastOf('endTurn'), { combatId: 'fight', round: 1, combatantId: left }))
  check(answer.status === 202, `Undo sent for the next step (${answer.status} ${answer.text})`)
  await until(() => current() === back, `the turn taken back to ${back}`, 30_000)
  await untilHeading(who, heading)
}
/** End turn pressed, and the page shown the turn moved on, with the toast's card. */
async function endByButton(who, nextHeading, nextId) {
  await armed(who)
  await paced()
  const m = await mark(who)
  await press(who, button(who))
  await until(() => current() === nextId, `the turn ended, ${nextId} current`, 30_000)
  await untilHeading(who, nextHeading)
  const card = await cardOf(who, m, 'ended', 'the toast saying the turn has ended')
  return { m, card }
}
/** A screenshot taken at once, for a state that lasts under a second. */
async function quickShot(who, name) {
  if (!SHOTS) return
  await who.page.screenshot({ path: `${SHOTS}/${name}-${who.width}-${who.scheme}${VARIANT}.png`, style: '[id^=dice-canvas-threejs] { visibility: hidden !important; }' })
}

if (SKEW035) {
  // =================================================================================================
  // 26. Module 0.35.0
  // =================================================================================================
  part('26. module 0.35.0')
  const kinds = hello().data.features?.rolls?.kinds ?? []
  check(!kinds.includes('endTurn') && !kinds.includes('undoEndTurn'), `module 0.35.0's hello takes no endTurn or undoEndTurn (${JSON.stringify(kinds)})`)
  await viewOn(alice, API, 'Thorin')
  await untilHeading(alice, 'Your turn')
  await wait(1500)
  check(await button(alice).count() === 0 && await hint(alice).count() === 0, 'no End turn and no hint on Thorin\'s turn')
  const m = await hold(alice, 2000)
  await wait(400)
  const after = await since(alice, m)
  const tab = await combatTab(alice).evaluate(el => ({ described: el.getAttribute('aria-describedby'), cls: el.className }))
  check(after.posts.length === 0 && after.cards.length === 0 && after.presses[0]?.frames.every(f => f.w === null) && tab.described === null && !/touch-manipulation|select-none/.test(tab.cls),
    `a 2 s hold of the Combat tab: nothing sent, no toast, no fill; the tab as before (${JSON.stringify({ posts: after.posts.length, cards: after.cards.length, tab })})`)
  const answer = await endTurn(alice, API, turnOf('cbThorin'))
  await wait(2000)
  check(answer.status !== 202 && fight.advances === 0 && current() === 'cbThorin', `a POST of endTurn is refused, and nothing moves (${answer.status} ${answer.text})`)
  await finish()
}

// =================================================================================================
// 1. Offered
// =================================================================================================
part('1. offered')
{
  const features = hello().data.features
  const kinds = features.rolls.kinds
  check(kinds.includes('endTurn') && kinds.indexOf('undoEndTurn') === kinds.indexOf('endTurn') + 1
    && !features.companions.kinds.includes('endTurn') && !features.companions.kinds.includes('undoEndTurn'),
  `the hello's kinds have endTurn and, right after it, undoEndTurn; features.companions.kinds has neither (${JSON.stringify(kinds)}; ${JSON.stringify(features.companions.kinds)})`)
}

// =================================================================================================
// 2. The button
// =================================================================================================
part('2. the button')
await untilHeading(alice, 'Your turn')
await showTab(alice, 'Combat')
await armed(alice)
{
  const look = await alice.page.evaluate(hintText => {
    const b = document.querySelector('#turn-heading ~ button')
    const section = b.closest('section')
    const style = getComputedStyle(section)
    const inner = section.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const hint = [...section.querySelectorAll('p')].find(p => p.textContent === hintText)
    const box = b.getBoundingClientRect()
    return { text: b.textContent, width: box.width, inner, hint: !!hint, under: hint ? hint.getBoundingClientRect().top >= box.bottom - 0.5 : false, heading: document.getElementById('turn-heading').textContent }
  }, HINT)
  check(look.heading === 'Your turn' && look.text === 'End turn' && Math.abs(look.width - look.inner) <= 1 && look.hint && look.under,
    `at 390 on Combat: "Your turn", End turn as wide as the panel's inner width, the hint under it (${JSON.stringify(look)})`)
  const m = await mark(alice)
  // The table's poll held back while it's on its way, so that its state stays to be read.
  await alice.gate.hold()
  await button(alice).tap()
  let way = null
  await until(async () => {
    way = await button(alice).evaluate(b => ({ text: b.textContent, aria: b.getAttribute('aria-disabled'), disabled: b.disabled, spinner: !!b.querySelector('span[aria-hidden].rounded-full'), sending: b.hasAttribute('data-sending') }))
    return way.text === 'Ending your turn…'
  }, 'the button on its way', 5_000)
  await until(() => fight.advances === 1 && current() === 'cbBrakka', "Foundry's turn moved on", 30_000)
  const meanwhile = await since(alice, m)
  check(way.aria === 'true' && !way.disabled && way.spinner && way.sending && meanwhile.cards.length === 0 && fight.advances === 1 && current() === 'cbBrakka',
    `tapped: "Ending your turn…", aria-disabled and not disabled, a spinner; no toast; Foundry's turn moved on once, Brakka current (${JSON.stringify({ way, cards: meanwhile.cards.length, advances: fight.advances })})`)
  await alice.gate.release()
  await untilHeading(alice, 'Brakka’s turn')
  const card = await cardOf(alice, m, 'ended', 'the toast once the panel shows Brakka\'s turn')
  const said = words(card)
  const focused = await alice.page.evaluate(() => document.activeElement?.id ?? document.activeElement?.tagName)
  check(said.words === 'Your turn has ended.' && said.line === 'Brakka is acting.' && said.undo && (await since(alice, m)).cards[0].kind === 'ended' && focused === 'turn-heading',
    `once the panel shows "Brakka’s turn", the toast "Your turn has ended." · "Brakka is acting." · Undo, its first; focus on #turn-heading (${JSON.stringify({ said, focused })})`)
}

// =================================================================================================
// 3. Undo
// =================================================================================================
part('3. undo')
{
  const was = { updates: fight.updates.length, advances: fight.advances, turnEvents: fight.turnEvents, heard: { ...heard }, turns: postsOf('combat.turn').length }
  const m = await mark(alice)
  await press(alice, undoButton(alice))
  const taking = await cardOf(alice, m, 'taking', 'the toast taking the turn back')
  await until(() => current() === 'cbThorin', 'Foundry back on Thorin', 30_000)
  await until(() => postsOf('combat.turn').length > was.turns, 'the app told of the turn back', 15_000)
  await settled()
  const update = fight.updates.slice(was.updates)
  const told = postsOf('combat.turn').slice(was.turns)
  check(words(taking).words === 'Taking your turn back…' && words(taking).line === null && !words(taking).undo, `Undo → "Taking your turn back…" (${JSON.stringify(words(taking))})`)
  check(update.length === 1 && update[0].data.round === 1 && update[0].data.turn === 0 && update[0].options.turnEvents === false && update[0].options.direction === -1
    && fight.round === 1 && current() === 'cbThorin' && fight.advances === was.advances && fight.turnEvents === was.turnEvents && same(heard, was.heard),
  `Foundry back on Thorin, round 1, by one update with turnEvents false and direction -1; no advance, no turn events, no combatTurn or combatRound heard (${JSON.stringify({ update, advances: fight.advances, turnEvents: fight.turnEvents, heard })})`)
  check(told.length === 1 && told[0].data.direction === 'backward' && told[0].data.combatant?.id === 'cbThorin',
    `combat.turn with Thorin, direction "backward", posted once (${JSON.stringify(told.map(p => [p.data.direction, p.data.combatant?.id]))})`)
  await untilHeading(alice, 'Your turn')
  await armed(alice)
  const after = await since(alice, m)
  const back = after.headings.find(h => h.text === 'Your turn')
  const offered = after.buttons.find(b => b.t >= back.t && b.look === 'End turn|')
  const taken = after.cards.find(c => c.kind === 'taking')
  check(!!offered && offered.t - back.t >= 590 && offered.t - back.t <= 900 && taken.gone !== null && taken.gone <= back.t + 200,
    `the panel "Your turn" again, the toast gone; End turn offered ${offered ? Math.round(offered.t - back.t) : '?'} ms after the panel shows the turn (600 ms)`)
}

// =================================================================================================
// 4. The toast's life
// =================================================================================================
part('4. the toast\'s life')
{
  const { card } = await endByButton(alice, 'Brakka’s turn', 'cbBrakka')
  await until(async () => (await cardNow(alice, card.n)).gone !== null, 'the toast with Undo to go', 15_000)
  const life = (await cardNow(alice, card.n))
  check(life.gone - life.at >= 7950 && life.gone - life.at <= 8250, `ended again, untouched: the toast with Undo gone at ${Math.round(life.gone - life.at)} ms (8 s)`)
  await undoByRequest(alice, 'cbBrakka', 'cbThorin', 'Your turn')
}
{
  const { card } = await endByButton(alice, 'Brakka’s turn', 'cbBrakka')
  await alice.page.waitForFunction(at => performance.now() - at >= 7000, card.at, { polling: 100, timeout: 15_000 })
  const box = await alice.page.locator('[data-turn-toast]').boundingBox()
  await alice.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await alice.page.waitForFunction(at => performance.now() - at >= 9500, card.at, { polling: 100, timeout: 15_000 })
  const resting = await cardNow(alice, card.n)
  await alice.page.mouse.move(5, 600)
  const left = await nowIn(alice)
  await until(async () => (await cardNow(alice, card.n)).gone !== null, 'the toast to go once the pointer leaves', 5_000)
  const gone = (await cardNow(alice, card.n)).gone
  check(resting.gone === null && gone > left && gone - left <= 1200, `the pointer resting on the toast at 7 s: still there at 9.5 s; gone ${Math.round(gone - left)} ms after the pointer leaves (within 1.2 s)`)
  await undoByRequest(alice, 'cbBrakka', 'cbThorin', 'Your turn')
}

// =================================================================================================
// 5. The hold
// =================================================================================================
part('5. the hold')
await showTab(alice, 'Character')
await armed(alice)
{
  let onEnd = null
  const m = await hold(alice, 1050, {
    during: async m => {
      await downFor(alice, m, 1020)
      onEnd = await shownTab(alice)
    },
  })
  // Within 700 ms of the hold's end, a tap on Chat opens nothing.
  await barTab(alice, 'Chat').tap()
  await wait(150)
  const quietTab = await shownTab(alice)
  const after = await since(alice, m)
  const p = after.presses[0]
  const fill = fillLook(p)
  const toast = after.cards.find(c => c.kind === 'holding')
  const sent = after.posts.filter(x => x.kind === 'endTurn')
  const buzz = after.buzz
  const chat = after.clicks.filter(c => /^Chat/.test(c.label ?? '')).at(-1)
  check(fill.quiet, `at 120 ms the fill's drawn width 0, the quiet sixth (${fill.quietShares})`)
  check(!!toast && toast.at - p.at >= 495 && toast.at - p.at <= 620 && words(toast).words === 'Ending your turn…' && words(toast).line === HOLD_LINE,
    `at 600 ms the toast "Ending your turn…" · "${HOLD_LINE}", shown at ${toast ? Math.round(toast.at - p.at) : '?'} ms`)
  check(fill.half && fill.primary, `at 600 ms the fill about half the tab's width, as drawn (${fill.shares}); the label text-text-primary`)
  check(sent.length === 1 && sent[0].t - p.at >= 995 && sent[0].t - p.at <= 1100 && buzz.length === 1 && buzz[0].ms === 12 && buzz[0].t - p.at >= 995 && buzz[0].t - p.at <= 1100 && onEnd === 'Character',
    `at 1 s the POST (${sent[0] ? Math.round(sent[0].t - p.at) : '?'} ms), navigator.vibrate called with 12, the page still on Character (${onEnd})`)
  check(!!chat && chat.t - buzz[0].t < 700 && quietTab === 'Character', `a tap on Chat ${chat ? Math.round(chat.t - buzz[0].t) : '?'} ms after the hold's end opens nothing (${quietTab})`)
  await alice.page.waitForFunction(at => performance.now() - at >= 800, buzz[0].t, { polling: 50, timeout: 5_000 })
  await barTab(alice, 'Chat').tap()
  await until(async () => (await shownTab(alice)) === 'Chat', 'Chat shown after the quiet clicks', 5_000)
  check(true, 'one after, Chat')
  await until(() => current() === 'cbBrakka', 'the hold\'s End Turn made', 30_000)
  const card = await cardOf(alice, m, 'ended', 'the toast once the turn has moved on')
  const way = (await since(alice, m)).cards.find(c => c.kind === 'sending')
  const lines = way?.seen.map(s => s.line) ?? []
  check(!!way && words(way).words === 'Ending your turn…' && lines.length > 0 && lines.every(l => [`Sending to ${GAME_WORDS}…`, `Ending it in ${GAME_WORDS}…`].includes(l))
    && words(card).words === 'Your turn has ended.' && words(card).line === 'Brakka is acting.' && words(card).undo,
  `the toast "Ending your turn…" · ${JSON.stringify(lines)}, then "Your turn has ended." · "Brakka is acting." · Undo`)
  await undoFromToast(alice, 'cbThorin', 'Your turn')
}
{
  // Again from Character, the finger kept down 2 s: the turn ends at 1 s, and the page stays.
  await showTab(alice, 'Character')
  await armed(alice)
  await paced()
  const m = await hold(alice, 2000)
  await wait(600)
  const after = await since(alice, m)
  const sent = after.posts.filter(x => x.kind === 'endTurn')
  check(sent.length === 1 && sent[0].t - after.presses[0].at <= 1100 && (await shownTab(alice)) === 'Character',
    `held 2 s before letting go: the turn ends at ${sent[0] ? Math.round(sent[0].t - after.presses[0].at) : '?'} ms, and after the let-go the page is still on Character`)
  await until(() => current() === 'cbBrakka', 'the turn ended', 30_000)
  await undoFromToast(alice, 'cbThorin', 'Your turn')
}

// =================================================================================================
// 6. An early let-go
// =================================================================================================
part('6. an early let-go')
await armed(alice)
{
  const m = await hold(alice, 700)
  await wait(500)
  const after = await since(alice, m)
  const p = after.presses[0]
  const toast = after.cards.find(c => c.kind === 'holding')
  const fillNow = await combatTab(alice).evaluate(tab => tab.querySelector(':scope > span.origin-left')?.getBoundingClientRect().width ?? 0)
  check(after.posts.length === 0 && !!toast && toast.gone !== null && fillNow === 0 && p.up < 1000 && (await shownTab(alice)) === 'Character' && current() === 'cbThorin',
    `held 700 ms and let go (at ${Math.round(p.up)} ms): nothing POSTed, the toast gone, the fill empty, the page still on Character`)
}
{
  const m = await mark(alice)
  const down = await finger(alice, combatTab(alice))
  await wait(150)
  await down.up()
  await until(async () => (await shownTab(alice)) === 'Combat', 'Combat shown by a tap', 5_000)
  const after = await since(alice, m)
  check(after.posts.length === 0 && after.cards.length === 0, `a ${Math.round(after.presses[0].up)} ms touch → Combat shown, nothing sent`)
  await showTab(alice, 'Character')
}

// =================================================================================================
// 7. A drift
// =================================================================================================
part('7. a drift')
await armed(alice)
{
  const m = await hold(alice, 1300, {
    during: async (m, down) => {
      await downFor(alice, m, 250)
      await down.move(0, -30)
    },
  })
  await wait(400)
  const after = await since(alice, m)
  check(after.posts.length === 0 && after.cards.length === 0 && (await shownTab(alice)) === 'Character' && current() === 'cbThorin',
    'touched and moved 30 px up before 1 s: nothing POSTed, nothing shown, the page on Character')
}

// =================================================================================================
// 8. 768
// =================================================================================================
part('8. 768')
const tablet = await seat(768, 1024)
await untilHeading(tablet, 'Your turn')
await armed(tablet)
{
  await paced()
  const m = await hold(tablet, 1100)
  const after = await since(tablet, m)
  const fill = fillLook(after.presses[0])
  await until(() => current() === 'cbBrakka', 'the rail\'s hold ends the turn', 30_000)
  check(fill.left && after.posts.filter(x => x.kind === 'endTurn').length === 1, `the rail's Combat tab held 1.1 s → the turn ends; at 600 ms the fill's drawn box starts at the tab's left edge, narrower than the tab (${fill.shares})`)
  await untilHeading(tablet, 'Brakka’s turn')
  await undoFromToast(tablet, 'cbThorin', 'Your turn')
}

// =================================================================================================
// 9. 1280
// =================================================================================================
part('9. 1280')
const laptop = await seat(1280, 800)
await untilHeading(laptop, 'Your turn')
await combatShown(laptop)
await armed(laptop)
{
  const look = await laptop.page.evaluate(sel => {
    const tab = document.querySelector(sel).getBoundingClientRect()
    const h = document.getElementById('turn-heading').getBoundingClientRect()
    const b = document.querySelector('#turn-heading ~ button').getBoundingClientRect()
    return { tab: tab.height, beside: b.top < h.bottom && b.bottom > h.top && b.left >= h.right - 0.5 }
  }, COMBAT_COLUMN)
  check(Math.round(look.tab) === 36 && look.beside, `the column's Combat tab ${look.tab} px tall; End turn beside the heading (${JSON.stringify(look)})`)
  await paced()
  const m = await hold(laptop, 1100)
  const after = await since(laptop, m)
  const fill = fillLook(after.presses[0])
  await until(() => current() === 'cbBrakka', 'the column\'s hold ends the turn', 30_000)
  check(after.presses[0].type === 'mouse' && fill.left && fill.half && after.posts.filter(x => x.kind === 'endTurn').length === 1,
    `held with the mouse 1.1 s → the fill left to right (${fill.shares}), the turn ends`)
  // Fixed in the final round (036f): the toast centred on the screen came up over the column's
  // Combat tab from 0.5 s, hiding the fill under the pointer, and its card with Undo then waited
  // under the pointer, resting, for it to move. Beside the sheet it keeps to the sheet's side.
  const under = after.presses[0].frames.filter(f => f.t <= 1000)
  const hidden = under.filter(f => !f.over).map(f => Math.round(f.t))
  check(under.length > 0 && hidden.length === 0, `while held, what's under the pointer is the tab's own throughout, no toast over it (${under.length} frames; covered at ${hidden.slice(0, 3).join(', ') || 'none'} ms)`)
  await untilHeading(laptop, 'Brakka’s turn')
  await undoFromToast(laptop, 'cbThorin', 'Your turn')
  await armed(laptop)
  const r = await mark(laptop)
  const box = await combatTab(laptop).boundingBox()
  await laptop.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' })
  await wait(1500)
  const right = await since(laptop, r)
  check(right.menus.length === 1 && right.menus[0].prevented && right.posts.length === 0 && current() === 'cbThorin',
    `a right-click on the tab → no menu (contextmenu's default prevented), nothing sent (${JSON.stringify(right.menus)})`)
  // Held again, the mouse left resting where it let go: the card with Undo clears the column and
  // goes in its 8 s, as it would where the pointer isn't on it.
  await armed(laptop)
  await paced()
  const rest = await hold(laptop, 1100)
  const done = await cardOf(laptop, rest, 'ended', 'the card with Undo after the hold at 1280')
  await until(async () => (await cardNow(laptop, done.n)).seen.some(seen => seen.undo), 'Undo on the card at 1280', 10_000)
  const place = await laptop.page.evaluate(sel => {
    const tab = document.querySelector(sel)
    const card = document.querySelector('[data-turn-toast]')?.getBoundingClientRect()
    const column = tab.closest('[role="tablist"]').parentElement.parentElement.getBoundingClientRect()
    return { card: card ? [Math.round(card.left), Math.round(card.right)] : null, column: Math.round(column.left), under: tab.contains(document.elementFromPoint(tab.getBoundingClientRect().x + tab.getBoundingClientRect().width / 2, tab.getBoundingClientRect().y + tab.getBoundingClientRect().height / 2)) }
  }, COMBAT_COLUMN)
  await until(async () => (await cardNow(laptop, done.n)).gone !== null, 'the card with Undo to go at 1280', 15_000)
  const life = await cardNow(laptop, done.n)
  check(place.card !== null && place.card[1] <= place.column && place.under && life.gone - life.at >= 7950 && life.gone - life.at <= 8250,
    `held again, the mouse resting where it let go: the card with Undo over the sheet, clear of the column (${JSON.stringify(place)}), the tab still under the pointer; gone at ${Math.round(life.gone - life.at)} ms (8 s)`)
  await undoByRequest(laptop, 'cbBrakka', 'cbThorin', 'Your turn')
}

// =================================================================================================
// 10. A refusal from the button
// =================================================================================================
part('10. a refusal from the button')
await showTab(alice, 'Combat')
// Thorin's turn as this page shows it, taken back a moment ago at 1280: armed alone would also be
// met on Brakka's turn still shown, whose End Turn the app then takes.
await untilHeading(alice, 'Your turn')
await armed(alice)
{
  await alice.gate.hold()
  await gmTurnTo('cbBrakka')
  const m = await mark(alice)
  await button(alice).focus()
  await button(alice).tap()
  await until(async () => (await since(alice, m)).posts[0]?.status !== null && (await since(alice, m)).posts[0]?.reason !== null, 'the app\'s answer', 10_000)
  await alertLine(alice).waitFor({ timeout: 10_000 })
  const answer = (await since(alice, m)).posts[0]
  const line = await alertLine(alice).textContent()
  const state = await alice.page.evaluate(() => { const b = document.querySelector('#turn-heading ~ button'); return { focus: document.activeElement === b, text: b?.textContent, aria: b?.getAttribute('aria-disabled') } })
  await wait(800)
  check(answer.status === 422 && answer.reason === 'moved' && line === 'Your turn wasn’t ended: the turn had already moved on.' && (await since(alice, m)).cards.length === 0
    && state.focus && state.text === 'End turn' && state.aria === 'true',
  `the table's poll held back, Thorin's turn ended in Foundry, End turn tapped on the stale page → 422 moved → "${line}", role alert, no "Try again", no toast, focus on End turn, aria-disabled (${JSON.stringify({ answer: [answer.status, answer.reason], state })})`)
  await alice.gate.release()
  await untilHeading(alice, 'Brakka’s turn')
  await until(async () => (await alertLine(alice).count()) === 0, 'the line to go', 5_000)
  check(true, 'the poll let through → the panel moves on and the line goes')
}
{
  await gmTurnTo('cbThorin')
  await untilHeading(alice, 'Your turn')
  await armed(alice)
  await alice.gate.hold()
  await gmTurnTo('cbBrakka')
  const m = await hold(alice, 1100)
  const card = await cardOf(alice, m, 'refused', 'the hold\'s refusal in the toast')
  await alertLine(alice).waitFor({ timeout: 10_000 })
  const line = await alertLine(alice).textContent()
  const answer = (await since(alice, m)).posts[0]
  await until(async () => (await cardNow(alice, card.n)).gone !== null, 'the refusal\'s toast to go', 10_000)
  const life = await cardNow(alice, card.n)
  check(answer?.status === 422 && answer.reason === 'moved' && words(card).words === 'Your turn wasn’t ended.' && words(card).line === 'The turn had already moved on.'
    && life.gone - life.at >= 4950 && life.gone - life.at <= 5200 && line === 'Your turn wasn’t ended: the turn had already moved on.',
  `from the hold, with Combat shown, the same staged → the toast "Your turn wasn’t ended." · "The turn had already moved on.", gone at ${Math.round(life.gone - life.at)} ms, and the line`)
  await alice.gate.release()
  await untilHeading(alice, 'Brakka’s turn')
}

// =================================================================================================
// 11. Undo refused
// =================================================================================================
part('11. undo refused')
{
  await gmTurnTo('cbThorin')
  await untilHeading(alice, 'Your turn')
  await endByButton(alice, 'Brakka’s turn', 'cbBrakka')
  await alice.gate.hold()
  await gmTurnTo('cbBat')
  const m = await mark(alice)
  await paced()
  await undoButton(alice).tap()
  const card = await cardOf(alice, m, 'kept', 'Undo\'s refusal in the toast')
  const answer = (await since(alice, m)).posts.find(x => x.kind === 'undoEndTurn')
  check(answer?.status === 422 && answer.reason === 'moved' && words(card).words === 'Your turn wasn’t taken back.' && words(card).line === 'The turn had already moved on.' && current() === 'cbBat',
    `Thorin's turn ended, the poll held back, the Gamemaster on to the Bat; Undo → the app's own 422 moved, "Your turn wasn’t taken back." · "The turn had already moved on."; Foundry's turn still the Bat's (${JSON.stringify([answer?.status, answer?.reason, current()])})`)
  await alice.gate.release()
  await untilHeading(alice, 'Bat’s turn')
}

// =================================================================================================
// 12. A companion's turn
// =================================================================================================
part('12. a companion\'s turn')
{
  await gmTurnTo('cbBrakka')
  await untilHeading(alice, 'Brakka’s turn')
  await armed(alice)
  const tab = await axOf(alice, COMBAT_BAR)
  const order = await panel(alice).evaluate((section, hintText) => {
    const paragraphs = [...section.querySelectorAll('p')].map(p => p.textContent)
    return { hint: paragraphs.indexOf(hintText), roll: paragraphs.findIndex(p => p === 'Roll for it on its tab.'), row: !!section.querySelector('div.flex-wrap > #turn-heading + button') }
  }, HINT)
  check(tab?.description === 'Press and hold to end Brakka’s turn' && order.row && order.hint >= 0 && order.roll > order.hint,
    `on Brakka's turn the Combat tab described "${tab?.description}"; End turn in the heading row, the hint, then "Roll for it on its tab." (${JSON.stringify(order)})`)
  const m = await mark(alice)
  await paced()
  await alice.gate.hold()
  await button(alice).tap()
  await until(async () => (await button(alice).textContent()) === 'Ending Brakka’s turn…', 'Ending Brakka’s turn…', 5_000)
  await alice.gate.release()
  await until(() => current() === 'cbBat', 'Brakka\'s turn ended', 30_000)
  await untilHeading(alice, 'Bat’s turn')
  const card = await cardOf(alice, m, 'ended', 'the toast for Brakka\'s turn')
  check(words(card).words === 'Brakka’s turn has ended.' && words(card).line === 'Bat is acting.' && words(card).undo,
    `End turn → "Ending Brakka’s turn…" → "Brakka’s turn has ended." · "Bat is acting." · Undo (${JSON.stringify(words(card))})`)
  const u = await mark(alice)
  await undoFromToast(alice, 'cbBrakka', 'Brakka’s turn')
  const taking = (await since(alice, u)).cards.find(c => c.kind === 'taking')
  check(words(taking)?.words === 'Taking Brakka’s turn back…' && current() === 'cbBrakka', `Undo → "Taking Brakka’s turn back…" → Brakka current again (${JSON.stringify(words(taking))})`)
}

// =================================================================================================
// 13. Not hers
// =================================================================================================
part('13. not hers')
{
  await gmTurnTo('cbGoblin')
  await untilHeading(alice, 'Goblin is acting')
  await wait(900)
  check(await button(alice).count() === 0 && await hint(alice).count() === 0, 'on the goblin\'s turn no End turn and no hint')
  await showTab(alice, 'Character')
  const m = await hold(alice, 2000)
  await wait(400)
  const after = await since(alice, m)
  const described = await combatTab(alice).getAttribute('aria-describedby')
  check(after.presses[0].frames.every(f => f.w === null) && after.cards.length === 0 && after.posts.length === 0 && described === null,
    'a 2 s hold → no fill, no toast, no description, nothing sent')
  const down = await finger(alice, combatTab(alice))
  await wait(120)
  await down.up()
  await until(async () => (await shownTab(alice)) === 'Combat', 'Combat shown by a tap', 5_000)
  check(true, 'a tap shows Combat')
  await gmTurnTo('cbBrakka')
  await viewOn(bob, BOB_API, 'Brakka')
  await wait(1000)
  check(await button(bob).count() === 0, 'Bob on Brakka\'s turn: no End turn')
  const answer = await endTurn(bob, BOB_API, turnOf('cbBrakka'))
  check(answer.status === 422 && answer.json?.reason === 'not-turn', `his POST of endTurn → 422 not-turn (${answer.status} ${answer.text})`)
  const undo = await call(bob.page, `${BOB_API}/rolls`, { method: 'POST', body: undoBody(lastOf('endTurn'), turnOf('cbBrakka')) })
  check(undo.status === 422 && undo.json?.reason === 'not-undoable', `his POST of undoEndTurn naming Alice's last End Turn → 422 not-undoable (${undo.status} ${undo.text})`)
}

// =================================================================================================
// 14. Stale and twice
// =================================================================================================
part('14. stale and twice')
let staleUndo
{
  await untilHeading(alice, 'Brakka’s turn')
  const stale = await post(alice, `${API}/rolls`, endTurnBody(turnOf('cbThorin')))
  check(stale.status === 422 && stale.json?.reason === 'moved', `a POST naming Thorin's ended turn → 422 moved (${stale.status} ${stale.text})`)
  await paced()
  const was = fight.advances
  const brakkas = await ended(alice, API, turnOf('cbBrakka'), "Brakka's turn", (who, api, turn) => post(who, `${api}/rolls`, endTurnBody(turn)))
  check(brakkas.made?.status === 'done' && fight.advances === was + 1 && current() === 'cbBat', `Brakka's turn ended from Thorin's seat: the Bat current (${current()})`)
  staleUndo = { id: brakkas.answer.json.id, done: Date.parse(brakkas.made.completedAt) }
  await untilHeading(alice, 'Bat’s turn')
  const batTurn = turnOf('cbBat')
  const answers = await Promise.all([post(alice, `${API}/rolls`, endTurnBody(batTurn)), post(alice, `${API}/rolls`, endTurnBody(batTurn))])
  const accepted = answers.filter(a => a.status === 202)
  for (const a of accepted) await until(() => ['done', 'failed'].includes(rollRow(a.json.id)?.status), 'each end of the Bat\'s turn to be made', 30_000)
  const outcomes = accepted.map(a => [rollRow(a.json.id).status, rollRow(a.json.id).result?.reason ?? null])
  const refusedByApp = answers.filter(a => a.status === 422 && a.json?.reason === 'moved').length
  const done = outcomes.filter(([status]) => status === 'done').length
  const moved = outcomes.filter(([status, reason]) => status === 'failed' && reason === 'moved').length + refusedByApp
  check(done === 1 && moved === 1 && fight.advances === was + 2 && current() === 'cbGoblin',
    `two POSTs at once for the Bat's turn: one done, the other refused moved, one advance (${JSON.stringify({ statuses: answers.map(a => a.status), outcomes, current: current() })})`)
  const batsEnd = accepted.find(a => rollRow(a.json.id).status === 'done').json.id
  await untilHeading(alice, 'Goblin is acting')
  const updates = fight.updates.length
  const left = { combatId: 'fight', round: 1, combatantId: 'cbGoblin' }
  await paced()
  const undos = await Promise.all([post(alice, `${API}/rolls`, undoBody(batsEnd, left)), post(alice, `${API}/rolls`, undoBody(batsEnd, left))])
  const taken = undos.filter(a => a.status === 202)
  for (const a of taken) await until(() => ['done', 'failed'].includes(rollRow(a.json.id)?.status), 'each Undo to be made', 30_000)
  const undone = taken.map(a => [rollRow(a.json.id).status, rollRow(a.json.id).result?.reason ?? null]).sort()
  check(taken.length === 2 && same(undone, [['done', null], ['failed', 'not-undoable']]) && fight.updates.length === updates + 1 && current() === 'cbBat',
    `two undoEndTurn POSTs of one End Turn at once → one done, the other refused not-undoable by the module; one step back (${JSON.stringify({ statuses: undos.map(a => a.status), undone, current: current() })})`)
  await untilHeading(alice, 'Bat’s turn')
}

// =================================================================================================
// 15. The Gamemaster's page and a companion's route
// =================================================================================================
part('15. the gamemaster and a companion\'s route')
{
  await gmTurnTo('cbThorin')
  const was = fight.advances
  const gmPage = await browse({ width: 390, height: 844, path: `/campaigns/${A}/characters/thorin`, toasts: false })
  await gmPage.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await viewOn(gmPage, `/api/campaigns/${A}/characters/thorin`, 'Thorin')
  await wait(1500)
  check(await button(gmPage).count() === 0 && await hint(gmPage).count() === 0, 'the Gamemaster\'s page on Thorin\'s turn: no End turn, no hint')
  const tab = gmPage.page.locator(COMBAT_BAR)
  const box = await tab.boundingBox()
  const cdp = await gmPage.view.newCDPSession(gmPage.page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] })
  let seen = { fill: 0, cards: 0 }
  for (let i = 0; i < 10; i++) {
    await wait(200)
    const now = await gmPage.page.evaluate(() => ({ fill: document.querySelectorAll('span.origin-left').length, cards: document.querySelectorAll('[data-turn-toast]').length }))
    seen = { fill: Math.max(seen.fill, now.fill), cards: Math.max(seen.cards, now.cards) }
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
  check(seen.fill === 0 && seen.cards === 0 && await tab.getAttribute('aria-describedby') === null && fight.advances === was, `a 2 s hold there → no fill, no toast, no description (${JSON.stringify(seen)})`)
  const GM_API = `/api/campaigns/${A}/characters/thorin`
  const gm = await endTurn(gmPage, GM_API, turnOf('cbThorin'))
  const gmUndo = await call(gmPage.page, `${GM_API}/rolls`, { method: 'POST', body: undoBody(lastOf('endTurn'), turnOf('cbThorin')) })
  const viaCompanion = await post(alice, `${API}/companions/brakka/rolls`, endTurnBody(turnOf('cbThorin')))
  const undoCompanion = await post(alice, `${API}/companions/brakka/rolls`, undoBody(lastOf('endTurn'), turnOf('cbThorin')))
  check(gm.status === 409 && gmUndo.status === 409 && viaCompanion.status === 409 && undoCompanion.status === 409 && current() === 'cbThorin',
    `endTurn and undoEndTurn POSTs → 409 at the Gamemaster's page and at …/companions/brakka/rolls (${[gm, gmUndo, viaCompanion, undoCompanion].map(a => a.status).join(', ')})`)
  await gmPage.view.close()
}
{
  // Step 14's last: an Undo 31 s after its End Turn.
  await until(() => Date.now() - staleUndo.done > 31_000, '31 s since Brakka\'s End Turn', 40_000)
  const late = await post(alice, `${API}/rolls`, undoBody(staleUndo.id, turnOf('cbThorin')))
  check(late.status === 422 && late.json?.reason === 'not-undoable', `(14) an undoEndTurn POST 31 s after its End Turn → 422 not-undoable (${late.status} ${late.text})`)
}

// =================================================================================================
// 16. Keyboard
// =================================================================================================
part('16. keyboard')
await showTab(alice, 'Combat')
await untilHeading(alice, 'Your turn')
await armed(alice)
{
  await alice.page.evaluate(() => document.getElementById('turn-heading').focus())
  await alice.page.keyboard.press('Tab')
  const onButton = await alice.page.evaluate(() => document.activeElement === document.querySelector('#turn-heading ~ button'))
  const m = await mark(alice)
  await paced()
  await alice.page.keyboard.press('Enter')
  await until(() => current() === 'cbBrakka', 'ended by the keyboard', 30_000)
  await untilHeading(alice, 'Brakka’s turn')
  await until(() => alice.page.evaluate(() => document.activeElement?.id === 'turn-heading'), 'focus on the heading', 5_000)
  check(onButton, 'Tab to End turn, Enter → ended; focus on the heading')
  const card = await cardOf(alice, m, 'ended', 'the toast with Undo')
  let reached = false
  for (let i = 0; i < 80 && !reached; i++) {
    await alice.page.keyboard.press('Tab')
    reached = await alice.page.evaluate(() => document.activeElement?.closest('[data-turn-toast]') !== null && document.activeElement?.textContent === 'Undo')
  }
  await alice.page.waitForFunction(at => performance.now() - at >= 9000, card.at, { polling: 100, timeout: 15_000 })
  const resting = await cardNow(alice, card.n)
  check(reached && resting.gone === null, 'Tab onward reaches Undo in the toast, its time paused while focused (still there at 9 s)')
  await alice.page.keyboard.press('Enter')
  await until(() => current() === 'cbThorin', 'taken back by the keyboard', 30_000)
  await until(() => alice.page.evaluate(() => document.activeElement?.id === 'turn-heading'), 'focus on the heading', 5_000)
  check(true, 'Enter → taken back; focus on the heading')
  await untilHeading(alice, 'Your turn')
}

// =================================================================================================
// 17. Screen readers' words
// =================================================================================================
part('17. screen readers\' words')
await showTab(alice, 'Character')
await armed(alice)
{
  const named = await alice.nav.getByRole('button', { name: 'Combat , your turn', exact: true }).count()
  const tab = await axOf(alice, COMBAT_BAR)
  check(named === 1 && tab?.description === 'Press and hold to end your turn',
    `the Combat tab named "Combat , your turn" on Thorin's turn while Combat isn't shown; its description "${tab?.description}"`)
  // End turn, where it's shown.
  await showTab(alice, 'Combat')
  await armed(alice)
  const end = await axOf(alice, '#turn-heading ~ button')
  const region = await alice.page.evaluate(() => {
    const regions = [...document.querySelectorAll('[aria-live="polite"][aria-atomic="true"]')].filter(el => el.classList.contains('fixed'))
    return regions.map(el => ({ role: el.getAttribute('role'), live: el.getAttribute('aria-live'), atomic: el.getAttribute('aria-atomic') }))
  })
  const statuses = await alice.page.getByRole('status').count()
  check(end?.name === 'End turn' && end?.description === 'Your turn', `End turn described by the heading ("${end?.name}", "${end?.description}")`)
  check(region.length === 1 && region[0].role === null && statuses === 1, `the toast region aria-live polite, aria-atomic true, no role; getByRole('status') the live state alone (${JSON.stringify({ region, statuses })})`)
}

// =================================================================================================
// 18. Reduced motion
// =================================================================================================
part('18. reduced motion')
await alice.page.emulateMedia({ reducedMotion: 'reduce' })
{
  await showTab(alice, 'Combat')
  await armed(alice)
  const m = await mark(alice)
  await paced()
  await alice.gate.hold()
  await button(alice).tap()
  let spin = null
  await until(async () => {
    spin = await button(alice).evaluate(b => { const s = b.querySelector('span[aria-hidden].rounded-full'); return s ? getComputedStyle(s).animationDuration : null })
    return spin !== null
  }, 'the spinner', 5_000)
  await alice.gate.release()
  await until(() => current() === 'cbBrakka', 'the turn ended', 30_000)
  await cardOf(alice, m, 'ended', 'the toast')
  const motion = await alice.page.locator('[data-turn-toast]').evaluate(card => getComputedStyle(card).animationName)
  check(spin === '2s' && motion === 'none', `the toast's computed animation-name ${motion}; the spinner's animation-duration ${spin}`)
  await undoFromToast(alice, 'cbThorin', 'Your turn')
  await showTab(alice, 'Character')
  await armed(alice)
  await paced()
  const h = await hold(alice, 1100)
  const fill = fillLook((await since(alice, h)).presses[0])
  check(fill.half, `the fill still follows the hold: about half at 600 ms (${fill.shares})`)
  await until(() => current() === 'cbBrakka', 'the turn ended', 30_000)
  await untilHeading(alice, 'Brakka’s turn')
  await undoFromToast(alice, 'cbThorin', 'Your turn')
}
await alice.page.emulateMedia({ reducedMotion: 'no-preference' })

// =================================================================================================
// 19. Banner and Send
// =================================================================================================
part('19. banner and send')
{
  await showTab(alice, 'Character')
  const setting = await alice.page.evaluate(() => { try { return localStorage.getItem('sending-stone:roll-toasts') } catch { return null } })
  const dialog = alice.page.getByRole('dialog', { name: 'Settings' })
  await alice.page.getByRole('button', { name: 'Settings', exact: true }).click()
  await dialog.waitFor()
  const banner = await dialog.getByRole('radio', { name: 'Banner' }).isChecked()
  const shown = (await logOf(alice)).cards.filter(c => c.kind === 'ended').length
  check(setting === 'off' && banner && shown > 0, `under Roll results: Banner the turn's toasts still show (${shown} shown so far)`)
  const send = dialog.getByRole('switch', { name: 'Send to the table', exact: true })
  await send.locator('xpath=ancestor::label[1]').click()
  await until(async () => !(await send.isChecked()), 'Send to the table off', 5_000)
  await alice.page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  await until(async () => (await button(alice).count()) === 0, 'End turn gone', 5_000)
  const m = await hold(alice, 2000)
  await wait(400)
  const after = await since(alice, m)
  check(await hint(alice).count() === 0 && after.presses[0].frames.every(f => f.w === null) && after.cards.length === 0 && after.posts.length === 0
    && await combatTab(alice).getAttribute('aria-describedby') === null && current() === 'cbThorin',
  'with Send to the table off: no End turn, no hint, no hold')
  // A long touch with no hold is the browser's, which may open Combat: back to the cog's tab.
  await showTab(alice, 'Character')
  await alice.page.getByRole('button', { name: 'Settings', exact: true }).click()
  await dialog.waitFor()
  await send.locator('xpath=ancestor::label[1]').click()
  await until(async () => send.isChecked(), 'Send to the table on', 5_000)
  await alice.page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  await armed(alice)
}

// =================================================================================================
// 20. The turn moves under a hold
// =================================================================================================
part('20. the turn moves under a hold')
{
  await alice.gate.hold()
  const poll = alice.gate.take()
  await gmTurnTo('cbBrakka')
  const answer = await poll.fetch()
  const was = fight.advances
  const m = await hold(alice, 1400, {
    during: async m => {
      await downFor(alice, m, 600)
      await poll.fulfill({ response: answer })
      await alice.gate.release()
    },
  })
  await untilHeading(alice, 'Brakka’s turn')
  await wait(300)
  const after = await since(alice, m)
  const p = after.presses[0]
  const moved = after.headings.find(h => h.text === 'Brakka’s turn')
  const toast = after.cards.find(c => c.kind === 'holding')
  const later = p.frames.filter(f => f.t > moved.t - p.at + 50)
  check(after.posts.length === 0 && fight.advances === was && moved.t - p.at < 1000 && !!toast && toast.gone !== null && toast.gone - moved.t <= 100
    && later.length > 0 && later.every(f => (f.w ?? 0) === 0),
  `on Thorin's turn, from Character, at 600 ms the Gamemaster makes Brakka current and the page polls (${Math.round(moved.t - p.at)} ms) → the fill empties, the toast goes, no POST, no advance`)
}
{
  await showTab(alice, 'Combat')
  await armed(alice)
  await alice.gate.hold()
  const poll = alice.gate.take()
  await gmTurnTo('cbThorin')
  const answer = await poll.fetch()
  // The finger is on End turn as the page changes: tapped the moment the panel shows Thorin's turn.
  const end = await button(alice).boundingBox()
  const m = await mark(alice)
  await poll.fulfill({ response: answer })
  await alice.gate.release()
  await alice.page.waitForFunction(() => document.getElementById('turn-heading')?.textContent === 'Your turn', null, { polling: 'raf', timeout: 10_000 })
  const cdp = await alice.view.newCDPSession(alice.page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: end.x + end.width / 2, y: end.y + end.height / 2 }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
  await wait(1200)
  const after = await since(alice, m)
  const shown = after.headings.find(h => h.text === 'Your turn')
  const tap = after.clicks.find(c => /^End turn/.test(c.label ?? ''))
  check(!!tap && tap.t - shown.t < 600 && after.posts.length === 0 && current() === 'cbThorin',
    `a tap on End turn ${tap ? Math.round(tap.t - shown.t) : '?'} ms after Thorin's turn shows (within 600 ms) → no POST`)
}

// =================================================================================================
// 21. A rewind
// =================================================================================================
part('21. a rewind')
{
  const was = fight.advances
  await endByButton(alice, 'Brakka’s turn', 'cbBrakka')
  await gmTurnTo('cbThorin')
  await untilHeading(alice, 'Your turn')
  await until(async () => (await undoButton(alice).count()) === 0, 'the Undo gone as the turn moved', 5_000)
  const { m } = await endByButton(alice, 'Brakka’s turn', 'cbBrakka')
  check(fight.advances === was + 2, `the Gamemaster's setTurn back to Thorin in round 1 → End turn offered again, and a tap ends it (advances +${fight.advances - was})`)
  await gmTurnTo('cbBat')
  await untilHeading(alice, 'Bat’s turn')
  await wait(300)
  const after = await since(alice, m)
  const card = after.cards.find(c => c.kind === 'ended')
  const moved = after.headings.find(h => h.text === 'Bat’s turn')
  check(!!card && card.gone !== null && card.gone - moved.t <= 150, `with the toast's Undo up, the Gamemaster on to the Bat → the toast goes at once (${card?.gone ? Math.round(card.gone - moved.t) : '?'} ms)`)
}

// =================================================================================================
// 22. MIDI=1
// =================================================================================================
if (MIDI) {
  part('22. midi')
  const midi = W.midi
  midi.autoRemoveTargets = 'allGM'
  midi.settings.confirmAttackDamage = 'onlyGM'
  const gmTargets = () => [...game.user.targets].map(t => t.id)
  await gmTurnTo('cbThorin')
  await untilHeading(alice, 'Your turn')
  const { card } = await endByButton(alice, 'Brakka’s turn', 'cbBrakka')
  // The toast's time paused under the pointer while Vex casts.
  const box = await alice.page.locator('[data-turn-toast]').boundingBox()
  await alice.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  const cast = await call(bob.page, `${BOB_API}/rolls`, { method: 'POST', body: { kind: 'use', item: 'fireball', activity: 'blast', slot: 'spell3', targets: [{ combatId: 'fight', combatantId: 'cbGoblin' }], ...ROLL } })
  check(cast.status === 202, `Vex's Fireball at the goblin sent (${cast.status} ${cast.text})`)
  await until(() => ['done', 'failed'].includes(rollRow(cast.json.id)?.status), 'Vex\'s Fireball made', 30_000)
  const made = rollRow(cast.json.id)
  const flow = midi.made.find(w => w.workflowOptions?.sendingStone === cast.json.id)
  const plan = (made.result?.damage?.rolls ?? []).flatMap(roll => roll.dice ?? []).map(({ faces, number }) => ({ faces, results: Array.from({ length: number }, () => 3) }))
  const damage = await call(bob.page, `${BOB_API}/rolls`, { method: 'POST', body: { kind: 'damage', use: cast.json.id, ...ROLL, dice: plan } })
  check(made.status === 'done' && !!flow && damage.status === 202, `made through Midi's workflow, its damage sent (${made.status}, ${damage.status} ${damage.text})`)
  await until(() => flow.suspended && flow.currentAction === flow.WorkflowState_ConfirmRoll, 'the damage waiting for the Gamemaster', 30_000)
  check(same(gmTargets(), ['tokgoblin']), `the area's damage holding the Gamemaster's targets (${JSON.stringify(gmTargets())})`)
  const updates = fight.updates.length
  const m = await mark(alice)
  await undoButton(alice).tap()
  await until(async () => (await since(alice, m)).posts.find(x => x.kind === 'undoEndTurn')?.id, 'Undo sent', 10_000)
  const undo = (await since(alice, m)).posts.find(x => x.kind === 'undoEndTurn').id
  await until(() => rollRow(undo)?.status === 'claimed', 'the game to take the Undo', 30_000)
  await wait(1500)
  const held = { status: rollRow(undo).status, updates: fight.updates.length, targets: gmTargets() }
  await flow.confirmDamage()
  await until(() => ['done', 'failed'].includes(rollRow(undo)?.status), 'the Undo made', 15_000)
  await until(() => ['done', 'failed'].includes(rollRow(damage.json.id)?.status), 'the damage made', 15_000)
  const after = { undo: rollRow(undo), damage: rollRow(damage.json.id) }
  check(held.status === 'claimed' && held.updates === updates && same(held.targets, ['tokgoblin']) && after.undo.status === 'done' && after.damage.status === 'done'
    && Date.parse(after.damage.completedAt) <= Date.parse(after.undo.completedAt) && current() === 'cbThorin' && fight.updates.length === updates + 1,
  `an area damage of Vex's holding the Gamemaster's targets, then Alice's Undo: made after it, the targets the area's until then (${JSON.stringify({ held, undo: after.undo.status, damage: after.damage.status })})`)
  await alice.page.mouse.move(5, 600)
  midi.settings.confirmAttackDamage = 'none'
  midi.autoRemoveTargets = 'dead'
  void card
  await untilHeading(alice, 'Your turn')
}

// =================================================================================================
// 23. With a companion's tab chosen
// =================================================================================================
part('23. with a companion\'s tab chosen')
{
  await gmTurnTo('cbBrakka')
  await showTab(alice, 'Character')
  const batTab = alice.page.locator('#creature-tab-arena-bat1')
  await batTab.click()
  await until(async () => (await batTab.getAttribute('aria-selected')) === 'true', 'Bat\'s tab chosen', 5_000)
  await showTab(alice, 'Combat')
  await untilHeading(alice, 'Brakka’s turn')
  await armed(alice)
  const order = await panel(alice).evaluate(section => {
    const row = section.querySelector('#turn-heading').parentElement
    const roll = [...section.querySelectorAll('p')].find(p => p.textContent === 'Roll for it on its tab.')
    return { button: !!row.querySelector(':scope > button'), after: !!roll && !!(row.compareDocumentPosition(roll) & Node.DOCUMENT_POSITION_FOLLOWING) }
  })
  check(order.button && order.after, 'Combat shows "Brakka’s turn", "Roll for it on its tab." under the heading row with End turn')
  await showTab(alice, 'Character')
  await armed(alice)
  await paced()
  await hold(alice, 1100)
  await until(() => current() === 'cbBat', 'Brakka\'s turn ended by the hold', 30_000)
  await untilHeading(alice, 'Bat’s turn')
  check(await shownTab(alice) === 'Character' && await batTab.getAttribute('aria-selected') === 'true', 'Bat\'s tab chosen on Character, the hold ends Brakka\'s turn, the page stays on Bat\'s tab')
  await undoFromToast(alice, 'cbBrakka', 'Brakka’s turn')
  await alice.page.locator('#creature-tab-self').click()
}

// =================================================================================================
// 24. Numbered companions
// =================================================================================================
part('24. numbered companions')
{
  const bat2 = await summoned(arena, bat, thorin, 'findFamiliar', { id: 'bat2', name: 'Bat', activity: 'ffSummon' })
  await fight.createEmbeddedDocuments('Combatant', [{ id: 'cbBat2', token: bat2, fields: { name: 'Bat', initiative: 14 } }])
  // The tabs' names, without their news (", its turn").
  const names = () => alice.page.getByRole('tablist', { name: 'Character and companions' }).getByRole('tab').evaluateAll(tabs => tabs.map(tab => tab.getAttribute('aria-label').split(',')[0]))
  await until(async () => (await names()).includes('Bat 2'), 'Bat 2\'s tab', 20_000)
  await gmTurnTo('cbBat')
  await untilHeading(alice, 'Bat’s turn')
  await armed(alice)
  await paced()
  const m = await hold(alice, 1100)
  await until(() => current() === 'cbBat2', 'the Bat\'s turn ended', 30_000)
  const card = await cardOf(alice, m, 'ended', 'the toast for the Bat\'s turn')
  const holding = (await since(alice, m)).cards.find(c => c.kind === 'holding')
  check(same((await names()).filter(n => /^Bat/.test(n)), ['Bat 1', 'Bat 2']) && words(holding)?.words === 'Ending Bat’s turn…' && words(card).words === 'Bat’s turn has ended.',
    `with Bat 1 and Bat 2 in the fight (${JSON.stringify(await names())}), on a Bat's turn the panel names it "Bat’s turn"; the toast "${words(holding)?.words}", then "${words(card).words}"`)
  await undoFromToast(alice, 'cbBat', 'Bat’s turn')
}

// =================================================================================================
// 25. Widths and themes
// =================================================================================================
part('25. widths and themes')
const phone = await seat(360, 780)
{
  for (const who of [phone, alice, tablet, laptop]) check(await sideways(who.page) === 0, `no horizontal page scroll at ${who.width}`)
}
if (SHOTS) {
  await gmTurnTo('cbThorin')
  await combatShown(phone)
  await untilHeading(phone, 'Your turn')
  await armed(phone)
  await shootBoth(phone, 'endturn-panel', panel(phone))
  await phone.view.close()
  for (const who of [alice, tablet, laptop]) {
    await combatShown(who)
    await untilHeading(who, 'Your turn')
    await armed(who)
    await shootBoth(who, 'endturn-panel', panel(who))
    // On its way, ended, taken back: the table's poll held back, so that each stays for its shots.
    await paced()
    await who.gate.hold()
    await press(who, button(who))
    await until(async () => (await button(who).textContent()) === 'Ending your turn…', 'on its way', 5_000)
    await shootBoth(who, 'endturn-sending', panel(who))
    await who.gate.release()
    await until(() => current() === 'cbBrakka', 'the turn ended', 30_000)
    await undoButton(who).waitFor({ timeout: 20_000 })
    const box = await who.page.locator('[data-turn-toast]').boundingBox()
    await who.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await shootBoth(who, 'endturn-ended')
    await who.gate.hold()
    await paced()
    await press(who, undoButton(who))
    await who.page.locator('[data-turn-toast="taking"]').waitFor({ timeout: 10_000 })
    await shootBoth(who, 'endturn-takingback')
    await who.gate.release()
    await who.page.mouse.move(5, 600)
    await until(() => current() === 'cbThorin', 'taken back', 30_000)
    await untilHeading(who, 'Your turn')
    // Refused: Thorin's turn ended in Foundry while the page didn't know.
    await armed(who)
    await who.gate.hold()
    await gmTurnTo('cbBrakka')
    await press(who, button(who))
    await alertLine(who).waitFor({ timeout: 10_000 })
    await shootBoth(who, 'endturn-refused', panel(who))
    await who.gate.release()
    await untilHeading(who, 'Brakka’s turn')
    await armed(who)
    await shootBoth(who, 'endturn-companion', panel(who))
    // Mid-fill, with the half-second toast: a hold in each theme, each taken back.
    await gmTurnTo('cbThorin')
    await untilHeading(who, 'Your turn')
    for (const scheme of ['light', 'dark']) {
      await theme(who, scheme)
      await armed(who)
      await paced()
      await hold(who, 1100, { during: async m => { await downFor(who, m, 620); await quickShot(who, 'endturn-hold') } })
      await until(() => current() === 'cbBrakka', 'the turn ended', 30_000)
      await undoFromToast(who, 'cbThorin', 'Your turn')
    }
    await theme(who, 'light')
  }
} else await phone.view.close()

await finish()
