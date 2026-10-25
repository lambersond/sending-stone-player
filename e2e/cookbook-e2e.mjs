// Dishes from the Magical Recipe Book (module 0.38.0 and the app, its contract D§10), end to end, in
// the world of world-030.mjs: the cookbook's server posting each dish with a player's link code
// (cookbook-post.mjs, synthetic dishes only), the app keeping it and handing it to Foundry, the real
// module posting its card for the Gamemaster, and the module's own applyDish and dismissDish, as the
// card's dialog calls them, serving it to the characters chosen; their effects, the effects' hooks,
// world time, the card's drawing and its deletion the module's harness's stand-ins
// (fvtt/dish-core.mjs). Ashlands, on dnd5e 5.3.3, has one campaign, Erebor, with dishes on. Alice
// plays Thorin Oakenshield at 1280 × 800 and on a phone at 390 × 844 (360 × 780 where said); Bob
// plays Vex at 768 × 1024; the Gamemaster, Alice's own campaign, at Thorin's page and on the
// campaigns page at 1280, 768, 390 and 360. The player's card on the Biography tab, after the journal's:
// a link code made, shown once and wholly, copied, kept across tabs, made again and revoked, by the
// player and by the Gamemaster; each dish's state as the module reports it, waiting, with the
// Gamemaster, eaten, set aside and removed; the cookbook's refusals, every one JSON and never cached;
// an unknown change listed on Foundry's card; enricher syntax made inert on the Effects tab; a link
// whose seat moved; the switch off; the Gamemaster's section and counts; phones and both themes, and
// Foundry's card in each state as a stand-in chat log draws it with the module's styles. DND5E6=1:
// dnd5e 6.0.5, dishes off with the switch on. SKEW=037 with MODULE=module-0.37.0: no dishes at all,
// and a dish queued by hand never handed over. Synthetic characters only. Run with --import
// ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
// The cookbook's server first: it keeps Node's own fetch, which the Foundry stand-ins replace.
import { dishBody, linkCode, postDish, postRaw } from './cookbook-post.mjs'
import { JSDOM } from 'jsdom'
import {
  BOB, DND5E6, MODULE, SHOTS, SKEW037, VARIANT, W, browse, browser, call, character, check, finish, foundryWorld,
  lastHello, launch, newCampaign, note, part, posted, postsOf, same, sameJson, settled, shoot, shootBoth, sideways, sql,
  startFetching, startModule, stopFetching, theme, until, wait,
} from './world-030.mjs'

const GAME = 'https://ashlands-cookbook.forge-vtt.com'
const ADDRESS = 'ashlands-cookbook.forge-vtt.com'
const SECRET = 'erebor-cookbook-38'
const TITLE = 'Erebor'
const NEW = !SKEW037
/** Dishes taken: module 0.38.0 under dnd5e 5. */
const TAKING = NEW && !DND5E6
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: TITLE, address: ADDRESS, secret: SECRET })
await foundryWorld()
// A checkout's module.json says 0.1.0, which the Gamemaster's card reads as before dishes: the
// version the release would stamp (round 0.38.0 D§10.1).
game.modules.get('sending-stone').version = SKEW037 ? '0.37.0' : '0.38.0'

// The module's harness's stand-ins for what a dish needs: the current checkout's under every
// variant, module 0.37.0's included, which loads none of the module's dish code.
const D = await import('./fvtt/dish-core.mjs')
D.installDishCore()
const notices = []
ui.notifications.error = (message, options) => notices.push({ message, options })
// Foundry's enricher, as far as an inline roll goes (as the module's fvtt/texts.mjs draws one): a
// `[[/r formula]]` that reaches it whole becomes a roll waiting to be rolled, which the module makes a
// roll to click in the app. World-030's hands HTML on as it is.
const INLINE_ROLL = formula => `<a class="inline-roll roll" data-mode="roll" data-flavor="" data-formula="${formula}"><i class="fas fa-dice-d20"></i>${formula}</a>`
{
  const editor = foundry.applications.ux.TextEditor.implementation
  const enrich = editor.enrichHTML.bind(editor)
  editor.enrichHTML = async (html, options) => String(await enrich(html, options) ?? '').replace(/\[\[\/r ([^\]]+)\]\]/g, (match, formula) => INLINE_ROLL(formula))
}

// ---- The world: Thorin, with a charm whose roll is whole, and Vex ----
const thorin = character({ id: 'thorin', name: 'Thorin Oakenshield', owners: ['alice'], mods: { str: 3, con: 2, wis: 1 }, hp: { value: 30, max: 40, temp: 0 } }, { ac: 16, items: [] })
thorin.system.details = { level: 5 }
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { dex: 3, wis: 2 }, hp: { value: 20, max: 30, temp: 0 } }, { ac: 14, items: [] })
vex.system.details = { level: 5 }
D.withDishes(thorin, { hp: { value: 30, max: 40 } })
D.withDishes(vex, { hp: { value: 20, max: 30 } })
thorin.effects.push({
  documentName: 'ActiveEffect', id: 'charm', _id: 'charm', parent: thorin, name: 'Lucky Charm', origin: null, disabled: false,
  isSuppressed: false, isTemporary: true, transfer: false, statuses: new Set(), duration: {}, system: {}, img: 'icons/charm.webp',
  description: '<p>Roll [[/r 1d4]] for luck.</p>',
})
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
const campaign = changes => ({ id: 'erebor', title: TITLE, characters: ['thorin', 'vex'], groups: [], rolls: false, dishes: true, ...changes })
await startModule({ campaigns: [campaign()], secrets: { erebor: SECRET } })
await settled()
// The module's own, the instance its scripts loaded: as the card's dialog calls them.
const cards = TAKING ? await import(`${MODULE}/scripts/dish-card.mjs`) : null

// ---- What's kept, posted and handed over ----
const hello = () => lastHello('erebor')
const enabled = () => sql(`select "dishesEnabled", array_to_string("dishVersions", ',') from campaign where id = '${A}'`)
const rowOf = id => JSON.parse(sql(`select coalesce((select row_to_json(d)::text from (select id, status, reason, "messageId", attempts, "appliedTo", rolled, payload, "linkId" from cookbook_dish where id = '${id}') d), 'null')`))
const linkRow = () => sql(`select coalesce((select id from cookbook_link where "characterId" = 'sheet-thorin'), '')`)
/** Every command the app handed the module, as its answers to the module's fetches said them. */
const handed = () => postsOf('fetch').filter(p => p.url.endsWith('/api/bridge/commands') && p.status === 200)
  .flatMap(p => { try { return JSON.parse(p.body).commands ?? [] } catch { return [] } })
const fetchesAnswered = () => postsOf('fetch').filter(p => p.url.endsWith('/api/bridge/commands')).length
/** Foundry's dish cards, in order, and one by its row in the app. */
const dishCards = () => [...W.messages.values()].filter(m => m.flags?.['sending-stone']?.dish)
const cardFor = id => dishCards().find(m => m.flags['sending-stone'].dish.command === `dish-${id}`)
/** Until the module has posted a row's card and the app holds it as delivered: the card. */
async function delivered(id, what) {
  await until(() => rowOf(id)?.status === 'delivered', `${what} to be delivered`, 30_000)
  return cardFor(id)
}
/** The dishes through a link in the last minute, as the app counts them for its limit of 5. */
const lastMinute = link => Number(sql(`select count(*) from cookbook_dish where "linkId" = '${link}' and "createdAt" > now() - interval '60 seconds'`))
/** Until a link has room under its limit of 5 dishes a minute. */
const room = (link, under = 5) => until(() => lastMinute(link) < under, 'room under the limit of 5 dishes a minute', 75_000)
/** Every answer the cookbook was given, for what each must carry. */
const answers = []
const post = async (code, body) => { const answer = await postDish(code, body); answers.push(answer); return answer }
const raw = async options => { const answer = await postRaw(options); answers.push(answer); return answer }

// ---- The app's words ----
const UNKNOWN_CODE = 'Sending Stone doesn’t know this link code. Make a new one on your character’s page in Sending Stone and link again.'
const MOVED = 'This link code is for a character you no longer play in Sending Stone. Make a new one and link again.'
const OFF_WORDS = 'Your Gamemaster hasn’t turned on dishes from the Magical Recipe Book for this game.'
const NOT_TAKING = 'Your Gamemaster’s game isn’t taking dishes right now.'
const COPY_NOW = 'Copy it now: Sending Stone keeps only a check of it, so it can’t be shown again. In the Magical Recipe Book, open this character’s menu and choose Link Sending Stone, or Sending Stone Link if it’s linked already. Paste it there.'
const GM_ON = 'On in Foundry. Players send dishes from the Magical Recipe Book, and each reaches you as a card only Gamemasters see.'
const GM_BEFORE = 'Your Sending Stone module doesn’t take dishes yet. Version 0.38.0 or later does.'
const GM_SYSTEM = 'Off. Dishes need dnd5e 5.x in Foundry for now.'
const GM_OFF = 'Off. To take dishes, tick Dishes from the Magical Recipe Book on the campaign’s Player actions tab in Sending Stone’s settings in Foundry.'
const flat = text => String(text ?? '').replace(/\s+/g, ' ').trim()

// ---- The pages and their parts ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin Oakenshield', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const desk = await browse({ width: 1280, height: 800, path: '/characters/sheet-thorin', toasts: false })
await desk.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
/** The player's card, by its heading. */
const cardOf = who => who.page.getByRole('region', { name: 'Magical Recipe Book', exact: true })
const journalOf = who => who.page.getByRole('region', { name: 'Journal', exact: true })
/** The card's dishes, newest first: each its recipe, its chip and what became of it. */
const shown = who => cardOf(who).getByRole('list', { name: 'Dishes sent' }).locator(':scope > li').evaluateAll(lis => lis.map(li => {
  const [head, state] = li.querySelectorAll(':scope > span')
  return { recipe: head?.children[0]?.textContent ?? null, chip: head?.children[1]?.textContent ?? null, state: state?.textContent ?? null }
}))
/** Until the newest dish on a page's card reads so. */
const newestSays = (who, recipe, state, what) => until(async () => {
  const [first] = await shown(who)
  return first?.recipe === recipe && first.state === state
}, what, 30_000)
/** The Biography tab, and the journal's card on it, drawn. */
async function biography(who) {
  await who.tab('Biography')
  await journalOf(who).waitFor({ timeout: 15_000 })
}
/** The regions on the Biography tab, by name, in order. */
const regionsOf = who => who.page.getByRole('tabpanel').first().evaluate(panel => [...panel.querySelectorAll('section[aria-labelledby]')]
  .map(section => document.getElementById(section.getAttribute('aria-labelledby'))?.textContent.trim()))
/** The code just made: its block's words, the code, whether it's wholly shown, and on how many lines. */
const freshOf = who => cardOf(who).getByRole('status').evaluate(block => {
  const code = block.querySelector('code')
  const style = getComputedStyle(code)
  const lines = Math.round(code.getBoundingClientRect().height / parseFloat(style.lineHeight))
  return {
    words: block.querySelector('p')?.textContent ?? '', code: code.textContent, whole: code.scrollWidth <= code.clientWidth,
    ellipsis: style.textOverflow === 'ellipsis', lines,
    copy: [...block.querySelectorAll('button')].map(b => b.getAttribute('aria-label') ?? b.textContent.trim()),
  }
})
/** Every button on the card, by its name, and how tall it is. */
const buttonsOf = who => cardOf(who).locator('button').evaluateAll(buttons => buttons.filter(b => b.checkVisibility())
  .map(b => ({ name: b.getAttribute('aria-label') ?? b.textContent.trim(), height: b.getBoundingClientRect().height })))
/** The linked line, as read. */
const linkedLine = who => cardOf(who).getByText(/^Linked with a code ending /).textContent().then(flat)
/** Make a link code on the card: the code shown, as read from its field. */
async function makeCode(who) {
  await cardOf(who).getByRole('button', { name: 'Make a link code', exact: true }).click()
  await cardOf(who).getByRole('status').waitFor({ timeout: 15_000 })
  return (await cardOf(who).getByRole('status').locator('code').textContent()).trim()
}
const done = who => cardOf(who).getByRole('button', { name: 'Done', exact: true }).click()
/** A confirm dialog, named by its title, and its button. */
const confirmIn = (who, title, label) => who.page.getByRole('dialog', { name: title, exact: true }).getByRole('button', { name: label, exact: true })

// The Gamemaster's campaign card, its roster and its section on dishes.
const gmCard = who => who.page.getByRole('article', { name: TITLE })
const gmSection = who => gmCard(who).locator('section').filter({ has: who.page.getByRole('heading', { name: 'Cookbook dishes', exact: true }) })
const gmLines = async who => (await gmSection(who).locator('p').allTextContents()).map(flat)
const thorinRow = who => gmCard(who).getByRole('listitem').filter({ hasText: 'Thorin Oakenshield' }).first()
const gmReload = async who => { await who.page.reload(); await gmSection(who).waitFor({ timeout: 15_000 }) }

// Foundry's card, drawn as a Gamemaster's client or a player's draws it, with jsdom's document as
// the page's, as alone-e2e draws a badge; and as a stand-in chat log shows it, the module's own
// stylesheet and icons served under modules/sending-stone/, at three widths in both themes.
async function drawn(message, { asGm = true } = {}) {
  const dom = new JSDOM('')
  const held = { document: globalThis.document, HTMLElement: globalThis.HTMLElement }
  Object.assign(globalThis, { document: dom.window.document, HTMLElement: dom.window.HTMLElement })
  try {
    return await D.renderCard(message, { asGm })
  } finally {
    Object.assign(globalThis, held)
  }
}
const controlsOf = html => [...html.querySelectorAll('.sending-stone-dish-actions > *')].map(el => flat(el.textContent))
const FOUNDRY = 'https://foundry-chat.test'
const CHAT = html => `<!doctype html><html><head><meta charset="utf-8"><title>Chat</title>
<link rel="stylesheet" href="/modules/sending-stone/styles/sending-stone.css">
<style>
  body { margin: 0; font: 14px/1.4 "Signika", system-ui, sans-serif; min-height: 100vh; }
  body.theme-dark { background: #0b0a13; color: #efe6d8; --color-text-primary: #efe6d8; }
  body.theme-light { background: #c9c7b8; color: #191813; --color-text-primary: #191813; }
  #sidebar { margin-left: auto; width: min(300px, 100vw); box-sizing: border-box; padding: 8px; }
  #chat-log { list-style: none; margin: 0; padding: 0; }
  .chat-message { padding: 6px 8px; border-radius: 6px; }
  .theme-dark .chat-message { background: #23212d; border: 1px solid #4b4a44; }
  .theme-light .chat-message { background: #ece9dd; border: 1px solid #a8a596; }
  .message-header { display: flex; justify-content: space-between; font-size: 12px; opacity: .8; }
  .chat-message h3 { font-size: 16px; }
  .chat-message .hint { font-size: 12px; opacity: .8; }
  .chat-message button { font: inherit; padding: 4px 8px; border-radius: 4px; border: 1px solid currentColor; background: transparent; color: inherit; }
</style></head><body class="theme-light"><aside id="sidebar"><ol id="chat-log">${html}</ol></aside></body></html>`
async function foundryShots(name, message, { asGm = true } = {}) {
  if (!SHOTS) return
  const html = (await drawn(message, { asGm })).outerHTML
  for (const width of [390, 768, 1280]) {
    const view = await browser.newContext({ viewport: { width, height: 900 } })
    await view.route(`${FOUNDRY}/**`, route => {
      const path = new URL(route.request().url()).pathname
      if (path === '/chat') return route.fulfill({ contentType: 'text/html', body: CHAT(html) })
      if (path.startsWith('/modules/sending-stone/')) return route.fulfill({ path: `${MODULE}/${path.slice('/modules/sending-stone/'.length)}` })
      return route.fulfill({ status: 404, body: '' })
    })
    const page = await view.newPage()
    await page.goto(`${FOUNDRY}/chat`)
    for (const scheme of ['light', 'dark']) {
      await page.evaluate(s => { document.body.className = `theme-${s}` }, scheme)
      await page.waitForTimeout(150)
      await page.locator('#chat-log > li').screenshot({ path: `${SHOTS}/foundry-dish-${name}-${width}-${scheme}${VARIANT}.png` })
    }
    await view.close()
  }
}

// =================================================================================================
// Module 0.37.0, and dnd5e 6.0.5: no dishes
// =================================================================================================
if (!TAKING) {
  part(SKEW037 ? 'module 0.37.0: no dishes' : 'dnd5e 6.0.5: dishes off')
  const features = hello().data.features ?? {}
  if (SKEW037) {
    check(!('dishes' in features), `module 0.37.0's hello says nothing of dishes (${JSON.stringify(Object.keys(features))})`)
  } else {
    check(same(features.dishes, { enabled: false, kinds: [], reason: 'system', versions: [] }) && same(Object.keys(features).slice(-2), ['favorites', 'dishes']),
      `under dnd5e 6.0.5, with the switch on, the hello says dishes are off for the system, after favorites (${JSON.stringify({ dishes: features.dishes, keys: Object.keys(features) })})`)
  }
  await wait(3000)
  check(enabled() === 'f|', `the app keeps dishes off, with no versions (${enabled()})`)
  // Alice's card: read, and drawn as nothing.
  let read = null
  desk.page.on('response', response => { if (response.url().includes('/cookbook')) read = response.status() })
  await biography(desk)
  await until(() => read === 200, 'her card to be read', 20_000)
  await wait(1000)
  check(await cardOf(desk).count() === 0 && same((await regionsOf(desk)).slice(0, 1), ['Journal']),
    `with dishes off and no link, Alice's Biography tab draws no Magical Recipe Book card (${JSON.stringify(await regionsOf(desk))})`)
  const code = await linkCode('sheet-thorin', A, 'thorin')
  const refused = await post(code, dishBody({ recipe: 'Ember Skewers' }))
  check(refused.status === 409 && refused.body?.reason === 'off' && refused.words === OFF_WORDS,
    `a dish through a link made by hand is refused 409 off, the cookbook telling its player "${refused.words}"`)
  await until(async () => (await cardOf(desk).count()) > 0, 'her card, once linked', 30_000)
  const said = flat(await cardOf(desk).textContent())
  check(said.includes(`Linked with a code ending …${code.slice(-4)}`) && said.includes(NOT_TAKING) && said.includes('No dishes sent yet.'),
    `linked, her card says so and that the game isn't taking dishes right now: "${said}"`)
  const gm = await browse({ width: 1280, height: 800, path: '/campaigns', toasts: false })
  await gmSection(gm).waitFor({ timeout: 15_000 })
  const lines = await gmLines(gm)
  check(same(lines, [SKEW037 ? GM_BEFORE : GM_SYSTEM]), `the Gamemaster's card says "${lines.join(' / ')}"`)
  await shootBoth(gm, 'cookbook-gm', gmSection(gm))
  if (SKEW037) {
    // A dish queued by hand, as one from before a downgrade: module 0.37.0 is never handed it.
    sql(`insert into cookbook_dish (id, "campaignId", "characterId", "actorId", "dishId", version, recipe, outcome, payload, "updatedAt")
      values ('e2equeued037', '${A}', 'sheet-thorin', 'thorin', 'cme2equeued037', 1, 'Ember Skewers', 'boon', '${JSON.stringify(dishBody({ id: 'cme2equeued037' })).replaceAll("'", "''")}', now())`)
    const from = fetchesAnswered()
    await until(() => fetchesAnswered() >= from + 2, 'two more of the module\'s fetches answered', 120_000)
    const row = rowOf('e2equeued037')
    check(!handed().some(command => command.kind === 'dish') && row.status === 'queued' && row.attempts === 0,
      `module 0.37.0 still fetches, and no answer hands it a dish: the row stays queued, never tried (${JSON.stringify({ fetches: fetchesAnswered() - from, status: row.status, attempts: row.attempts })})`)
  } else {
    await wait(3000)
    check(!handed().some(command => command.kind === 'dish'), 'and nothing is ever handed over as a dish')
  }
  check(answers.every(a => a.headers.get('cache-control') === 'no-store' && !a.headers.get('access-control-allow-origin') && a.status !== 404),
    'every answer the cookbook was given is never cached, has no CORS header, and none is a 404')
  await finish()
}

// =================================================================================================
// 1. The hello and the answer
// =================================================================================================
part('1. the hello and the answer')
{
  const features = hello().data.features
  check(same(features.dishes, { enabled: true, kinds: ['dish'], reason: null, versions: [1] })
    && same(Object.keys(features), ['rolls', 'transfers', 'removals', 'notes', 'companions', 'favorites', 'dishes']),
  `the hello takes dishes, by the campaign's switch, version 1, its key last, after favorites (${JSON.stringify({ dishes: features.dishes, keys: Object.keys(features) })})`)
  check(JSON.parse(hello().body ?? '{}').features?.dishes === 1, `the app answers dishes: 1 (${hello().body})`)
  await until(() => enabled() === 't|1', 'the app to keep dishes on', 15_000)
  check(enabled() === 't|1', 'the campaign row keeps dishesEnabled on, and dishVersions {1}')
}

// =================================================================================================
// 2. Where the card is
// =================================================================================================
part('2. where the card is')
await biography(desk)
await cardOf(desk).waitFor({ timeout: 20_000 })
{
  const regions = await regionsOf(desk)
  check(same(regions.slice(0, 2), ['Journal', 'Magical Recipe Book']) && await cardOf(desk).getByRole('button', { name: 'Make a link code', exact: true }).isVisible()
    && await cardOf(desk).getByRole('list', { name: 'Dishes sent' }).count() === 0,
  `on Alice's Biography tab, the Magical Recipe Book card comes right after the journal's, offering "Make a link code", no dishes listed (${JSON.stringify(regions)})`)
  const words = flat(await cardOf(desk).locator('p').first().textContent())
  check(words === 'Send dishes you cook in the Magical Recipe Book to this game. Your Gamemaster chooses who ate them in Foundry.', `its words: "${words}"`)
}
const bob = await browse({ width: 768, height: 1024, who: BOB, toasts: false })
await bob.page.goto(invite)
await bob.page.getByRole('radio', { name: /^Vex/ }).check()
await bob.page.getByRole('button', { name: 'Join as this character' }).click()
await bob.page.waitForURL(/\/characters\/[\w-]+$/)
await bob.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const BOB_SHEET = sql(`select id from "character" where "actorId" = 'vex' and "campaignId" = '${A}'`)
await biography(bob)
await cardOf(bob).waitFor({ timeout: 20_000 })
check(await cardOf(bob).getByRole('button', { name: 'Make a link code', exact: true }).isVisible(), "Bob's Biography tab has his own card, offering him a code")
{
  const gmSheet = await browse({ width: 1280, height: 800, path: `/campaigns/${A}/characters/thorin`, toasts: false })
  const reads = []
  gmSheet.page.on('request', request => { if (request.url().includes('/cookbook')) reads.push(request.url()) })
  await gmSheet.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
  await biography(gmSheet)
  await wait(3000)
  check(await cardOf(gmSheet).count() === 0 && reads.length === 0,
    `at Thorin's page as the Gamemaster, the Biography tab draws no card and reads none (${JSON.stringify({ regions: await regionsOf(gmSheet), reads })})`)
  await gmSheet.view.close()
}

// =================================================================================================
// 3. Making a code, on a phone
// =================================================================================================
part('3. making a code at 390')
const phone = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin', toasts: false })
await phone.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await biography(phone)
await cardOf(phone).waitFor({ timeout: 20_000 })
await shootBoth(phone, 'cookbook-unlinked', () => cardOf(phone))
{
  const buttons = await buttonsOf(phone)
  check(buttons.length === 1 && buttons.every(b => b.height >= 44), `unlinked, its one button is at least 44 px tall (${JSON.stringify(buttons)})`)
}
const code = await makeCode(phone)
{
  const fresh = await freshOf(phone)
  check(flat(fresh.words) === COPY_NOW, `the code's block says: "${flat(fresh.words)}"`)
  check(/^sscb_[A-Za-z0-9_-]{43}$/.test(fresh.code) && fresh.code.length === 48 && fresh.whole && !fresh.ellipsis && fresh.lines >= 2,
    `the 48-character code is shown whole, wrapped over ${fresh.lines} lines at 390, never cut (${JSON.stringify({ ...fresh, words: undefined })})`)
  check(fresh.copy.includes('Copy link code') && fresh.copy.includes('Done'), `beside it "Copy link code", and "Done" (${JSON.stringify(fresh.copy)})`)
  check(Boolean(sql(`select 1 from cookbook_link where "characterId" = 'sheet-thorin' and "codeHash" = encode(sha256('${code}'::bytea), 'hex') and hint = '${code.slice(-4)}'`)),
    'the app keeps only its hash, and its last four characters')
  await until(async () => (await buttonsOf(phone)).some(b => b.name === 'Make a new code'), 'the card to say it is linked', 15_000)
  const buttons = await buttonsOf(phone)
  check(buttons.every(b => b.height >= 44), `every button on the card is at least 44 px tall (${JSON.stringify(buttons)})`)
  await shootBoth(phone, 'cookbook-code', () => cardOf(phone))
}
await phone.tab('Effects')
await phone.tab('Biography')
await cardOf(phone).getByRole('status').waitFor({ timeout: 10_000 })
check((await freshOf(phone)).code === code, 'to the Effects tab and back, the code is still shown')
await done(phone)
await until(async () => (await cardOf(phone).getByRole('status').count()) === 0, 'the code to go', 5_000)
await until(async () => (await linkedLine(phone)) === `Linked with a code ending …${code.slice(-4)}, made just now · not used yet`, 'the linked line', 10_000).catch(() => {})
{
  const line = await linkedLine(phone)
  const focused = await phone.page.evaluate(() => document.activeElement?.textContent.trim())
  check(line === `Linked with a code ending …${code.slice(-4)}, made just now · not used yet` && focused === 'Make a new code',
    `Done: "${line}", and the focus on "${focused}"`)
}

// =================================================================================================
// 4-6. A dish, a repeat, and delivered
// =================================================================================================
part('4. a dish')
const LINK = linkRow()
const ember = dishBody({ recipe: 'Ember Skewers' })
const first = await post(code, ember)
check(first.status === 202 && same(Object.keys(first.body ?? {}), ['id', 'status']) && first.body.status === 'queued' && first.words === null,
  `the cookbook's post of Ember Skewers: ${first.status} ${JSON.stringify(first.body)}, nothing for its player to read`)
const EMBER = first.body.id

part('5. a repeat')
{
  const again = await post(code, { ...ember, effect: { ...ember.effect, changes: [{ type: 'maxHitPoints', value: 9, formula: '3+1d6' }, ember.effect.changes[1]] } })
  const value = sql(`select payload->'effect'->'changes'->0->>'value' from cookbook_dish where id = '${EMBER}'`)
  check(again.status === 200 && again.body?.id === EMBER && value === '7' && Number(sql(`select count(*) from cookbook_dish where "campaignId" = '${A}'`)) === 1,
    `posted again, its dice rolled again to 9: ${again.status}, the same id, the first body kept (${value}), one row`)
}

part('6. delivered')
const emberCard = await delivered(EMBER, 'Ember Skewers')
{
  const dishes = handed().filter(command => command.kind === 'dish')
  const flags = emberCard?.flags['sending-stone'].dish
  check(dishes.length === 1 && dishes[0].id === `dish-${EMBER}` && dishes[0].actorId === 'thorin' && sameJson(dishes[0].dish.body, ember),
    `the module was handed one dish, for Thorin, the body as sent (${JSON.stringify(dishes.map(c => c.id))})`)
  check(dishCards().length === 1 && same(emberCard.whisper, ['gm']) && emberCard.author?.id === 'gm' && flags.state === 'waiting' && flags.app === EMBER && flags.campaignId === 'erebor',
    `and posted one card, whispered to the Gamemaster alone, by the bridge's user, waiting (${JSON.stringify({ whisper: emberCard?.whisper, author: emberCard?.author?.id, state: flags?.state })})`)
  // The app records the result before it answers it, so its post is listed a moment after.
  await until(() => postsOf('command.result').some(p => p.data?.id === `dish-${EMBER}`), 'the dish\'s result as posted', 10_000)
  const result = postsOf('command.result').find(p => p.data?.id === `dish-${EMBER}`)?.data
  check(result?.status === 'done' && result.visible === false && same(result.rolls, []) && same(result.dish, { card: emberCard.id, state: 'waiting' }) && rowOf(EMBER).messageId === emberCard.id,
    `its result: done, not visible, its card waiting (${JSON.stringify(result)})`)
  const gmView = await drawn(emberCard)
  const playerView = await drawn(emberCard, { asGm: false })
  check(same(controlsOf(gmView), ['Apply…', 'Set aside']) && controlsOf(playerView).length === 0 && gmView.querySelector('.sending-stone-dish-badge'),
    `drawn for a Gamemaster, the card offers ${JSON.stringify(controlsOf(gmView))} under its bowl badge; for a player, nothing`)
  await foundryShots('waiting', emberCard)
  await foundryShots('player', emberCard, { asGm: false })
}
await newestSays(desk, 'Ember Skewers', 'With your Gamemaster', 'Alice\'s card to say it\'s with her Gamemaster')
check(same((await shown(desk))[0], { recipe: 'Ember Skewers', chip: 'Boon', state: 'With your Gamemaster' }), 'within a poll, Alice\'s card: Ember Skewers, Boon, "With your Gamemaster"')

// =================================================================================================
// 7. Applied
// =================================================================================================
part('7. applied')
{
  const served = await cards.applyDish(emberCard, ['thorin', 'vex'])
  check(same(served.map(s => s.name), ['Thorin Oakenshield', 'Vex']), `served to ${JSON.stringify(served.map(s => s.name))}`)
  await until(() => rowOf(EMBER).status === 'applied', 'the row to be applied', 20_000)
  const row = rowOf(EMBER)
  check(same(row.appliedTo?.map(c => c.name), ['Thorin Oakenshield', 'Vex']) && sameJson(row.rolled, [{ type: 'maxHitPoints', value: 7, formula: '3+1d6' }]),
    `the app keeps who ate it and what was rolled (${JSON.stringify({ appliedTo: row.appliedTo, rolled: row.rolled })})`)
  await newestSays(desk, 'Ember Skewers', 'Eaten by Thorin Oakenshield and Vex · Max HP +7 (3+1d6)', 'Alice\'s card to say who ate it')
  check(true, 'within a poll, Alice\'s card: "Eaten by Thorin Oakenshield and Vex · Max HP +7 (3+1d6)"')
  const gmView = await drawn(emberCard)
  check(same(controlsOf(gmView), ['Eaten by Thorin Oakenshield, Vex', 'Thorin Oakenshield regained 7 HP', 'Vex regained 7 HP', 'Apply to others…']),
    `Foundry's card, for a Gamemaster: ${JSON.stringify(controlsOf(gmView))}`)
  await foundryShots('applied', emberCard)
  await desk.tab('Effects')
  const temporary = desk.page.getByRole('region', { name: 'Temporary Effects' })
  await until(async () => (await temporary.count()) > 0 && (await temporary.textContent()).includes('Ember Skewers (Boon)'), 'the effect on Thorin\'s Effects tab', 30_000)
  check(true, 'Thorin\'s Effects tab lists "Ember Skewers (Boon)"')
  await biography(desk)
  const bobsCard = (await call(bob.page, `/api/characters/${BOB_SHEET}/cookbook`)).json
  check(bobsCard?.dishes?.length === 0 && bobsCard.link === null && await cardOf(bob).getByRole('list', { name: 'Dishes sent' }).count() === 0,
    `Bob's card shows no dishes, though Vex ate it: only the sender's card shows a dish (${JSON.stringify(bobsCard)})`)
}

// =================================================================================================
// 8-9. Set aside, and deleted
// =================================================================================================
part('8. set aside')
let porridgeCard
{
  const answer = await post(code, dishBody({ recipe: 'Plain Porridge' }))
  check(answer.status === 202, `Plain Porridge: ${answer.status}`)
  porridgeCard = await delivered(answer.body.id, 'Plain Porridge')
  check(same(controlsOf(await drawn(porridgeCard)), ['Who ate it…', 'Set aside']), 'a standard dish\'s card asks who ate it, or sets it aside')
  await foundryShots('standard', porridgeCard)
  await cards.dismissDish(porridgeCard)
  await until(() => rowOf(answer.body.id).status === 'dismissed', 'the row to be set aside', 20_000)
  check(rowOf(answer.body.id).reason === 'dismissed', 'the app keeps it dismissed, set aside')
  check(same(controlsOf(await drawn(porridgeCard)), ['Set aside by Gamemaster']), 'Foundry\'s card: "Set aside by Gamemaster"')
  await foundryShots('dismissed', porridgeCard)
  await newestSays(desk, 'Plain Porridge', 'Set aside by your Gamemaster', 'Alice\'s card to say it was set aside')
  check(true, 'within a poll, Alice\'s card: Plain Porridge "Set aside by your Gamemaster"')
}
part('9. deleted')
{
  const answer = await post(code, dishBody({ recipe: 'Gloom Stew' }))
  check(answer.status === 202, `Gloom Stew: ${answer.status}`)
  const gloom = await delivered(answer.body.id, 'Gloom Stew')
  await D.deleteCards([gloom])
  await until(() => rowOf(answer.body.id).status === 'dismissed', 'the row to be dismissed', 20_000)
  check(rowOf(answer.body.id).reason === 'deleted' && !cardFor(answer.body.id), 'its card deleted in Foundry, the app keeps it dismissed, deleted')
  await newestSays(desk, 'Gloom Stew', 'Removed in Foundry', 'Alice\'s card to say it was removed')
  const list = await shown(desk)
  check(same(list, [
    { recipe: 'Gloom Stew', chip: 'Bane', state: 'Removed in Foundry' },
    { recipe: 'Plain Porridge', chip: 'Standard', state: 'Set aside by your Gamemaster' },
    { recipe: 'Ember Skewers', chip: 'Boon', state: 'Eaten by Thorin Oakenshield and Vex · Max HP +7 (3+1d6)' },
  ]), `within a poll, Alice's card lists her three dishes, newest first: ${JSON.stringify(list)}`)
  const line = await linkedLine(desk)
  check(/ · last dish (just now|\d+ minutes? ago)$/.test(line), `and its link was last used just now: "${line}"`)
}
// Her card, linked, with three dishes, at each width and in both themes.
const tablet = await browse({ width: 768, height: 1024, path: '/characters/sheet-thorin', toasts: false })
await tablet.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await biography(tablet)
for (const who of [phone, tablet, desk]) {
  await until(async () => (await shown(who)).length === 3, `her three dishes at ${who.width}`, 30_000)
  await shootBoth(who, 'cookbook-card', () => cardOf(who))
}
await tablet.view.close()

// =================================================================================================
// 10. Refusals
// =================================================================================================
part('10. refusals')
{
  const body = JSON.stringify(dishBody({ recipe: 'Gloom Stew' }))
  let answer = await raw({ text: body })
  check(answer.status === 401 && answer.body?.reason === 'noCode' && answer.words === UNKNOWN_CODE, `no code: ${answer.status} ${answer.body?.reason}, its player told "${answer.words}"`)
  answer = await raw({ code: 'sscb_short', text: body })
  check(answer.status === 401 && answer.body?.reason === 'noCode', `"sscb_short": ${answer.status} ${answer.body?.reason}`)
  answer = await raw({ code, type: 'text/plain', text: body })
  check(answer.status === 415 && answer.body?.reason === 'notJson' && answer.words === 'Sending Stone takes dishes as JSON.', `as text/plain: ${answer.status} ${answer.body?.reason}`)
  const large = JSON.stringify(dishBody({ recipe: 'Gloom Stew', message: 'x'.repeat(40_000) }))
  answer = await raw({ code, text: large })
  check(Buffer.byteLength(large) > 40_000 && answer.status === 413 && answer.body?.reason === 'tooLarge' && answer.body.limit === 32_768,
    `${Buffer.byteLength(large)} bytes: ${answer.status} ${answer.body?.reason}, limit ${answer.body?.limit}`)
  answer = await raw({ code, text: '{' })
  check(answer.status === 400 && answer.body?.reason === 'invalid' && answer.words === 'Sending Stone couldn’t read this dish (not JSON).', `"{": ${answer.status} ${answer.body?.reason}, "${answer.words}"`)
  answer = await post(code, { ...dishBody({ recipe: 'Gloom Stew' }), version: 2 })
  check(answer.status === 400 && answer.body?.reason === 'version' && answer.words === 'This dish comes from a newer Magical Recipe Book than Sending Stone reads.',
    `version 2: ${answer.status} ${answer.body?.reason}, "${answer.words}"`)
  answer = await post(code, dishBody({ recipe: 'Gloom Stew', changes: [{ type: '<img>', value: 1 }] }))
  check(answer.status === 400 && answer.body?.reason === 'invalid' && answer.body.field === 'effect.changes.0.type' && answer.words === 'Sending Stone couldn’t read this dish (effect.changes.0.type).',
    `a change of type "<img>": ${answer.status} ${answer.body?.reason}, field ${answer.body?.field}`)
  // Five within the minute, counted as the app counts them, then one more: room for all six first,
  // so that none of the earlier ones ages out of the minute meanwhile.
  await until(() => {
    const oldest = Number(sql(`select coalesce(extract(epoch from now() - min("createdAt")), 0) from cookbook_dish where "linkId" = '${LINK}' and "createdAt" > now() - interval '60 seconds'`))
    return oldest < 40
  }, 'the minute\'s oldest dish to be recent enough', 75_000)
  let sent = 0
  while (lastMinute(LINK) < 5) {
    answer = await post(code, dishBody({ recipe: 'Gloom Stew' }))
    check(answer.status === 202, `another dish within the minute: ${answer.status} (${lastMinute(LINK)} so far)`)
    sent++
  }
  answer = await post(code, dishBody({ recipe: 'Gloom Stew' }))
  check(answer.status === 429 && answer.body?.reason === 'busy' && answer.headers.get('retry-after') === '60' && answer.words === 'That’s a lot of dishes at once. Wait a minute and send again.',
    `with five through the link in the last minute (${sent} of them here), the sixth: ${answer.status} ${answer.body?.reason}, Retry-After ${answer.headers.get('retry-after')}`)
  const options = await raw({ method: 'OPTIONS', type: null })
  check(!options.headers.get('access-control-allow-origin') && /\bPOST\b/.test(options.headers.get('allow') ?? '') && options.status < 300,
    `an OPTIONS: ${options.status}, Allow "${options.headers.get('allow')}", no Access-Control-Allow-Origin`)
  answers.pop()
  check(answers.length > 10 && answers.every(a => a.headers.get('cache-control') === 'no-store' && !a.headers.get('access-control-allow-origin') && a.status !== 404),
    `every one of the ${answers.length} answers so far is never cached, has no CORS header, and none is a 404`)
  check(answers.filter(a => a.status >= 400).every(a => typeof a.body?.message === 'string' && a.body.message.length < 200),
    'and every refusal\'s message is under 200 characters')
}

// =================================================================================================
// 11. An unknown kind
// =================================================================================================
part('11. an unknown kind')
await room(LINK)
{
  const body = dishBody({ recipe: 'Ember Skewers', changes: [...dishBody().effect.changes, { type: 'tempHitPoints', value: 5 }] })
  const answer = await post(code, body)
  check(answer.status === 202, `Ember Skewers with a change the app doesn't know, tempHitPoints: ${answer.status}`)
  const card = await delivered(answer.body.id, 'the unknown kind')
  check(sameJson(rowOf(answer.body.id).payload.effect.changes.at(-1), { type: 'tempHitPoints', value: 5 }), 'kept as sent')
  check(card.content.includes('Not applied automatically: tempHitPoints.'), 'its card in Foundry says "Not applied automatically: tempHitPoints."')
}

// =================================================================================================
// 12. Enricher strings
// =================================================================================================
part('12. enricher strings')
await room(LINK)
{
  // The stand-in's own proof: Thorin's charm, whose roll reaches it whole, is a roll to click.
  await desk.tab('Effects')
  const temporary = desk.page.getByRole('region', { name: 'Temporary Effects' })
  const row = name => temporary.locator('li').filter({ hasText: name }).first()
  await row('Lucky Charm').locator('summary').click()
  await row('Lucky Charm').getByRole('button', { name: '1d4, roll it' }).waitFor({ timeout: 15_000 })
  check(true, 'a whole [[/r 1d4]] in an effect\'s description, enriched, is a roll to click on the Effects tab')
  const body = dishBody({ recipe: 'Ember Skewers', ingredients: [{ name: 'Emberroot', text: 'Gain 3+1d6 Maximum Hit Points; roll [[/r 1d20]] for luck.' }] })
  const answer = await post(code, body)
  check(answer.status === 202, `Ember Skewers with [[/r 1d20]] in an ingredient's text: ${answer.status}`)
  const card = await delivered(answer.body.id, 'the enricher dish')
  const served = await cards.applyDish(card, ['thorin'])
  check(served[0]?.replaced?.recipe === 'Ember Skewers' && thorin.effects.filter(e => e.getFlag?.('sending-stone', 'dish')).length === 1,
    `served to Thorin, it replaces his earlier dish (${JSON.stringify(served[0]?.replaced)}), one dish effect left`)
  let text = ''
  await until(async () => {
    const li = row('Ember Skewers (Boon)')
    if (!(await li.count())) return false
    if ((await li.locator('details').getAttribute('open')) === null) await li.locator('summary').click()
    text = await li.textContent()
    return text.includes('for luck')
  }, 'the new dish\'s description on the Effects tab', 30_000)
  const rolls = await row('Ember Skewers (Boon)').getByRole('button', { name: /roll it$/ }).count()
  check(text.includes('roll [​[/r 1d20]​] for luck') && rolls === 0,
    `his Effects tab shows it as text, the zero-width spaces in it, with no roll to click (${JSON.stringify(text.slice(text.indexOf('roll')))}, ${rolls} rolls)`)
  await biography(desk)
}

// =================================================================================================
// 13-14. Revoke, and a new code
// =================================================================================================
part('13. revoke')
await cardOf(desk).getByRole('button', { name: 'Revoke', exact: true }).click()
await confirmIn(desk, 'Revoke this link code?', 'Revoke').click()
await cardOf(desk).getByRole('button', { name: 'Make a link code', exact: true }).waitFor({ timeout: 15_000 })
{
  const answer = await post(code, dishBody({ recipe: 'Gloom Stew' }))
  check(answer.status === 401 && answer.body?.reason === 'unlinked' && answer.words === UNKNOWN_CODE && linkRow() === '',
    `revoked on the card, the code is refused: ${answer.status} ${answer.body?.reason}; the card offers "Make a link code"`)
}
part('14. a new code')
{
  const a = await makeCode(desk)
  await done(desk)
  await cardOf(desk).getByRole('button', { name: 'Make a new code', exact: true }).click()
  await confirmIn(desk, 'Make a new link code?', 'Make a new code').click()
  await until(async () => (await cardOf(desk).getByRole('status').count()) > 0 && (await freshOf(desk)).code !== a, 'the new code', 15_000)
  const b = (await freshOf(desk)).code
  await done(desk)
  const old = await post(a, dishBody({ recipe: 'Gloom Stew' }))
  await room(linkRow())
  const fresh = await post(b, dishBody({ recipe: 'Ink Risotto' }))
  check(a !== b && old.status === 401 && old.body?.reason === 'unlinked' && fresh.status === 202,
    `Make a new code: the old code is refused ${old.status} ${old.body?.reason}, the new one taken ${fresh.status}`)
  await delivered(fresh.body.id, 'Ink Risotto')

  // ===============================================================================================
  // 15. The Gamemaster's revoke
  // ===============================================================================================
  part('15. the Gamemaster\'s revoke')
  const gmDesk = await browse({ width: 1280, height: 800, path: '/campaigns', toasts: false })
  const gmTablet = await browse({ width: 768, height: 1024, path: '/campaigns', toasts: false })
  const gmPhone = await browse({ width: 390, height: 844, path: '/campaigns', toasts: false })
  for (const who of [gmDesk, gmTablet, gmPhone]) await gmSection(who).waitFor({ timeout: 15_000 })
  const LABEL = 'Revoke Alice Adventurer’s cookbook link for Thorin Oakenshield'
  check(await thorinRow(gmDesk).getByText('Cookbook linked', { exact: true }).isVisible() && await thorinRow(gmDesk).getByRole('button', { name: LABEL, exact: true }).isVisible()
    && await gmCard(gmDesk).getByRole('listitem').filter({ hasText: 'Vex' }).getByText('Cookbook linked').count() === 0,
  `the campaigns page lists "Cookbook linked" beside Alice's Thorin, with "${LABEL}", and nothing beside Bob's Vex`)
  for (const who of [gmPhone, gmTablet, gmDesk]) await shootBoth(who, 'cookbook-gm-roster', () => thorinRow(who))
  /** A roster row on a phone: how far it scrolls, what in it runs past it, and the page's own scroll sideways. */
  async function rowOnPhone(who, row) {
    const fit = await row.evaluate(li => {
      const box = li.getBoundingClientRect()
      const past = [...li.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > box.right + 0.5).map(el => `${el.tagName.toLowerCase()} ${flatText(el)}`)
      function flatText(el) { return (el.getAttribute('aria-label') ?? el.textContent).replace(/\s+/g, ' ').trim().slice(0, 40) }
      return { scroll: li.scrollWidth, client: li.clientWidth, past }
    })
    const page = await sideways(who.page)
    // What runs past the page's right edge, the outermost of each, should the page scroll sideways.
    const wide = page === 0 ? [] : await who.page.evaluate(() => {
      const edge = document.documentElement.clientWidth
      const over = [...document.body.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > edge + 0.5)
      return over.filter(el => ![...el.children].some(child => over.includes(child))).map(el => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} ${Math.round(el.getBoundingClientRect().right)}: ${(el.getAttribute('aria-label') ?? el.textContent).replace(/\s+/g, ' ').trim().slice(0, 50)}`)
    })
    return { ...fit, page, wide }
  }
  const fits = row => row.scroll <= row.client && row.past.length === 0 && row.page === 0
  {
    const row = await rowOnPhone(gmPhone, thorinRow(gmPhone))
    check(fits(row),
      `at 390, the row's chip and buttons wrap under its name: nothing runs past the row, and the page doesn't scroll sideways (${JSON.stringify(row)})`)
  }
  // A player's name of 29 characters beside the chip, at 390 and at 360: Bob's, renamed for this
  // check alone, his Vex linked by hand. The name wraps first, and still nothing runs past a row.
  {
    const LONG = 'Bartholomew Underhill-Baggins'
    sql(`update "user" set name = '${LONG}' where id = 'e2e-bob'`)
    await linkCode(BOB_SHEET, A, 'vex')
    const vexRow = who => gmCard(who).getByRole('listitem').filter({ hasText: 'Vex' }).first()
    for (const [width, height] of [[390, 844], [360, 780]]) {
      await gmPhone.page.setViewportSize({ width, height })
      gmPhone.width = width
      await gmReload(gmPhone)
      await vexRow(gmPhone).getByText('Cookbook linked', { exact: true }).waitFor({ timeout: 15_000 })
      const rows = { thorin: await rowOnPhone(gmPhone, thorinRow(gmPhone)), vex: await rowOnPhone(gmPhone, vexRow(gmPhone)) }
      const named = flat(await vexRow(gmPhone).textContent()).includes(LONG)
      check(named && fits(rows.thorin) && fits(rows.vex),
        `at ${width}, "${LONG}" and its chip on Vex's row, and Alice's on Thorin's: nothing runs past either row, and the page doesn't scroll sideways (${JSON.stringify({ named, ...rows })})`)
    }
    await shootBoth(gmPhone, 'cookbook-gm-roster-long', () => thorinRow(gmPhone).locator('xpath=..'))
    sql(`delete from cookbook_link where "characterId" = '${BOB_SHEET}'`)
    sql(`update "user" set name = 'Bob' where id = 'e2e-bob'`)
    await gmPhone.page.setViewportSize({ width: 390, height: 844 })
    gmPhone.width = 390
    await gmReload(gmPhone)
  }
  await thorinRow(gmDesk).getByRole('button', { name: LABEL, exact: true }).click()
  const dialog = gmDesk.page.getByRole('dialog', { name: `${LABEL}?`, exact: true })
  await dialog.waitFor()
  const said = flat(await dialog.locator('p').first().textContent())
  check(said === `Dishes from Alice Adventurer’s Magical Recipe Book stop reaching ${TITLE} until they make a new link code.`, `its dialog: "${said}"`)
  await dialog.getByRole('button', { name: 'Revoke link', exact: true }).click()
  await until(async () => (await thorinRow(gmDesk).getByText('Cookbook linked', { exact: true }).count()) === 0, 'the chip to go', 15_000)
  const after = await post(b, dishBody({ recipe: 'Gloom Stew' }))
  check(after.status === 401 && after.body?.reason === 'unlinked' && linkRow() === '', `revoked by the Gamemaster, the code is refused: ${after.status} ${after.body?.reason}`)
  await cardOf(desk).getByRole('button', { name: 'Make a link code', exact: true }).waitFor({ timeout: 30_000 })
  check(true, 'within a poll, Alice\'s card offers "Make a link code" again')
  await gmTablet.view.close()

  // ===============================================================================================
  // 16. Moved
  // ===============================================================================================
  part('16. moved')
  {
    const c = await makeCode(desk)
    await done(desk)
    sql(`update "character" set "actorId" = 'thorin-elsewhere' where id = 'sheet-thorin'`)
    const answer = await post(c, dishBody({ recipe: 'Gloom Stew' }))
    sql(`update "character" set "actorId" = 'thorin' where id = 'sheet-thorin'`)
    check(answer.status === 401 && answer.body?.reason === 'moved' && answer.words === MOVED && linkRow() === '',
      `its seat moved to another actor, the code is refused ${answer.status} ${answer.body?.reason}, "${answer.words}", and its link is gone`)
  }

  // ===============================================================================================
  // 17. The switch off
  // ===============================================================================================
  part('17. the switch off')
  await cardOf(desk).getByRole('button', { name: 'Make a link code', exact: true }).waitFor({ timeout: 30_000 })
  const d = await makeCode(desk)
  await done(desk)
  await game.settings.set('sending-stone', 'campaigns', [campaign({ dishes: false })])
  await until(() => enabled().startsWith('f|'), 'the app to keep dishes off', 20_000)
  // The app keeps the hello before it answers it, so its post is listed a moment after.
  await until(() => hello().data.features.dishes?.enabled === false, 'the hello with the switch off, as posted', 10_000).catch(() => {})
  check(same(hello().data.features.dishes, { enabled: false, kinds: [], reason: 'off', versions: [] }), 'the switch off, the hello says dishes are off')
  {
    const answer = await post(d, dishBody({ recipe: 'Gloom Stew' }))
    check(answer.status === 409 && answer.body?.reason === 'off' && answer.words === OFF_WORDS, `a dish now: ${answer.status} ${answer.body?.reason}, "${answer.words}"`)
  }
  await until(async () => flat(await cardOf(desk).textContent()).includes(NOT_TAKING), 'Alice\'s card to say the game isn\'t taking dishes', 30_000)
  check(flat(await linkedLine(desk)).startsWith(`Linked with a code ending …${d.slice(-4)}`), `within a poll, Alice's card is still linked, and says "${NOT_TAKING}"`)
  await gmReload(gmDesk)
  check(same((await gmLines(gmDesk)).slice(0, 1), [GM_OFF]), `the Gamemaster's card: "${(await gmLines(gmDesk))[0]}"`)

  // ===============================================================================================
  // 18. The Gamemaster's section
  // ===============================================================================================
  part('18. the Gamemaster\'s section')
  await game.settings.set('sending-stone', 'campaigns', [campaign({ dishes: true })])
  await until(() => enabled() === 't|1', 'the app to keep dishes on again', 20_000)
  await until(() => Number(sql(`select count(*) from cookbook_dish where "campaignId" = '${A}' and status in ('queued', 'claimed')`)) === 0, 'every dish so far to reach Foundry', 60_000)
  await gmReload(gmDesk)
  check((await gmLines(gmDesk))[0] === GM_ON, `the switch on again: "${(await gmLines(gmDesk))[0]}"`)
  await stopFetching()
  await room(linkRow())
  const held = await post(d, dishBody({ recipe: 'Ink Risotto' }))
  check(held.status === 202, `a dish while Foundry fetches nothing: ${held.status}`)
  const inFoundry = Number(sql(`select count(*) from cookbook_dish where "campaignId" = '${A}' and status = 'delivered'`))
  for (const who of [gmDesk, gmPhone]) await gmReload(who)
  const lines = await gmLines(gmDesk)
  check(inFoundry > 0 && same(lines, [GM_ON, `1 waiting for Foundry · ${inFoundry} in Foundry for you`]) && same(await gmLines(gmPhone), lines), `with it held, at 1280 and 390: ${JSON.stringify([lines, await gmLines(gmPhone)])}`)
  const gmTablet2 = await browse({ width: 768, height: 1024, path: '/campaigns', toasts: false })
  await gmSection(gmTablet2).waitFor({ timeout: 15_000 })
  for (const who of [gmPhone, gmTablet2, gmDesk]) await shootBoth(who, 'cookbook-gm', () => gmSection(who))
  await gmTablet2.view.close()
  startFetching()
  // A fetch given up on may still have claimed it: handed over again once its claim is 75 s old.
  await until(() => rowOf(held.body.id)?.status === 'delivered', 'the held dish to be delivered', 120_000)
  await gmReload(gmDesk)
  check(same(await gmLines(gmDesk), [GM_ON, `0 waiting for Foundry · ${inFoundry + 1} in Foundry for you`]), `Foundry open again, it reaches it: ${JSON.stringify(await gmLines(gmDesk))}`)
  await gmDesk.view.close()
  await gmPhone.view.close()
}

// =================================================================================================
// 19. Phones and themes
// =================================================================================================
part('19. phones and themes')
for (const [width, height] of [[390, 844], [360, 780]]) {
  await phone.page.setViewportSize({ width, height })
  phone.width = width
  await wait(400)
  await until(async () => (await shown(phone)).length > 0, `her dishes at ${width}`, 30_000)
  const buttons = await buttonsOf(phone)
  check(await sideways(phone.page) === 0 && buttons.length >= 2 && buttons.every(b => b.height >= 44),
    `at ${width}, the Biography tab doesn't scroll sideways, and every button on the card is at least 44 px tall (${JSON.stringify(buttons)})`)
}
await theme(phone, 'dark')
check(await sideways(phone.page) === 0, 'and in the dark theme')
await shoot(phone, 'cookbook-card', cardOf(phone))
await theme(phone, 'light')
check(notices.length === 0, `Foundry showed no error (${JSON.stringify(notices)})`)
check(posted.filter(p => p.type?.startsWith('dish.')).every(p => p.status === 204 || p.status === 200),
  `the app took every dish event the module sent (${posted.filter(p => p.type?.startsWith('dish.')).map(p => `${p.type} ${p.status}`).join(', ')})`)
note(`${dishCards().length} cards in Foundry; ${Number(sql(`select count(*) from cookbook_dish where "campaignId" = '${A}'`))} dishes kept`)
await finish()
