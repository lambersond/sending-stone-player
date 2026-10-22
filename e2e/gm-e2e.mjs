// GM-set-up campaigns, invite links, heartbeats and combat highlights, end to end: the real
// Sending Stone module (through a stand-in Foundry) posting from a Forge game's origin in
// Chromium to the player app, with a Gamemaster and an invited player in their own browsers.
import { actor, combat, combatant, combats, message, settings, user, users } from './fvtt/stub.mjs'
import { chromium } from 'playwright'
import { BASE, MODULE, cookieFor, sql } from './env.mjs'

const GAME = 'https://lonely-mountain.forge-vtt.com'
const OTHER_GAME = 'https://other-game.forge-vtt.com'
const SECRET = 'module-secret-123'
const SECRET_B = 'mirkwood-secret-456'
const SHOTS = process.env.SHOTS
const check = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('ok -', msg) }

const browser = await chromium.launch()
const problems = []
const watch = (page, who) => {
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) problems.push(`${who} ${m.type()}: ${m.text()}`) })
  page.on('pageerror', e => problems.push(`${who} pageerror: ${e.message}`))
}

// ---- The Gamemaster's browser on the Forge game, which every module post goes through ----
const foundry = await browser.newContext()
for (const origin of [GAME, OTHER_GAME]) {
  await foundry.grantPermissions(['local-network-access'], { origin })
  await foundry.route(`${origin}/**`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Foundry VTT</title>' }))
}
const gmTab = await foundry.newPage(); watch(gmTab, 'foundry')
await gmTab.goto(`${GAME}/game`)
const posted = []
let inFlight = 0
let lastActivity = Date.now()
const realNow = Date.now
globalThis.fetch = async (url, init) => {
  inFlight++
  try {
    const { status, statusText } = await gmTab.evaluate(async ({ url, init }) => {
      const response = await fetch(url, init)
      return { status: response.status, statusText: response.statusText }
    }, { url: String(url), init: { method: init.method, headers: init.headers, body: init.body, mode: init.mode, credentials: init.credentials, cache: init.cache } })
    posted.push({ url: String(url), envelope: JSON.parse(init.body), status, auth: init.headers.Authorization })
    return { ok: status >= 200 && status < 300, status, statusText }
  } finally { inFlight--; lastActivity = realNow() }
}
const idle = async () => {
  await new Promise(resolve => setTimeout(resolve, 50))
  while (inFlight > 0 || realNow() - lastActivity < 150) await new Promise(resolve => setTimeout(resolve, 25))
}
const take = () => posted.splice(0)
const sentTo = list => list.map(p => `${p.envelope.type} → ${p.envelope.campaign?.title} (${p.status})`)
const raw = (page, origin, body, secret = SECRET) => page.evaluate(async ({ url, body, secret }) => {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` }, body: JSON.stringify(body) })
  // A refusal is JSON (cluster A), `{reason, message}`, its message what the app said before.
  const text = await response.text()
  let refusal = {}
  try { refusal = JSON.parse(text) } catch {}
  return { status: response.status, type: response.headers.get('content-type'), text, reason: refusal.reason, message: refusal.message }
}, { url: `${BASE}/api/events`, body, secret })

// ---- 1. The Gamemaster sets up two campaigns ----
const gmContext = await browser.newContext({ viewport: { width: 1180, height: 900 }, colorScheme: 'dark' })
await gmContext.addCookies([await cookieFor('e2e-token')])
await gmContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
const gm = await gmContext.newPage(); watch(gm, 'gm')
await gm.goto(`${BASE}/characters`)
await gm.getByRole('link', { name: 'Campaigns' }).click()
await gm.getByRole('heading', { name: 'Your campaigns' }).waitFor()
check(await gm.getByText(/You haven't set up a campaign yet/).isVisible(), 'a Gamemaster with no campaigns is invited to set one up')
await gm.getByRole('button', { name: 'Connect Foundry' }).click()
const help = gm.getByRole('dialog', { name: 'Connect your Foundry game' })
check(await help.getByText(BASE, { exact: true }).isVisible() && (await help.textContent()).includes('choose Open Settings under Sending Stone, and under General set the App address'), "Connect Foundry explains the module's setup, with this app's address")
await gm.screenshot({ path: `${SHOTS}/gm-connect-help.png` })
await help.getByRole('button', { name: 'Close' }).click()
check(!(await help.isVisible()), 'and closes')

const modal = gm.getByRole('dialog', { name: 'New campaign' })
await gm.getByRole('button', { name: 'New campaign' }).click()
const suggested = await modal.getByLabel('Secret', { exact: true }).inputValue()
check(/^[\w-]{32}$/.test(suggested), 'New campaign opens a form with a random secret suggested')
await modal.getByRole('button', { name: 'Generate' }).click()
check((await modal.getByLabel('Secret', { exact: true }).inputValue()) !== suggested, 'another can be generated')
const setUp = async (title, secret, { open = false } = {}) => {
  if (open) await gm.getByRole('button', { name: 'New campaign' }).click()
  await modal.getByLabel('Campaign title').fill(title)
  await modal.getByLabel('Forge game address').fill('lonely-mountain.forge-vtt.com/game')
  await modal.getByLabel('Secret', { exact: true }).fill(secret)
  await modal.getByRole('button', { name: 'Set up campaign' }).click()
}
await setUp('the lonely mountain', 'short')
check(await modal.getByLabel('Secret', { exact: true }).evaluate(input => input.validity.tooShort), 'the browser will not send a short secret')
await setUp('the lonely mountain', '   short-ish    ')
await modal.getByText('Use a secret of at least 12 characters.').waitFor()
check(true, 'and the server refuses one padded out with spaces')
await setUp('the lonely mountain', SECRET)
await modal.getByRole('status').filter({ hasText: 'is set up' }).waitFor()
check(await modal.getByText(SECRET, { exact: true }).isVisible(), 'the secret is shown once, to copy')
await gm.screenshot({ path: `${SHOTS}/gm-set-up.png` })
await modal.getByRole('button', { name: 'Done' }).click()
check(!(await modal.isVisible()), 'Done closes the form')
await setUp('The Lonely Mountain', SECRET, { open: true })
await modal.getByText('You have already set up a campaign with this title for this game.').waitFor()
check(true, 'the same campaign cannot be set up twice')
await modal.getByRole('button', { name: 'Close' }).click()
await setUp('Shadows of Mirkwood', SECRET_B, { open: true })
await modal.getByRole('button', { name: 'Done' }).click()
await gm.getByRole('article', { name: 'Shadows of Mirkwood' }).waitFor()
const lonely = gm.getByRole('article', { name: 'the lonely mountain' })
check(await lonely.getByText('Waiting for Foundry').isVisible(), 'a new campaign waits for Foundry')
check(sql(`select count(*) from campaign where "secretHash" like 'scrypt$%' and "secretHash" not like '%-secret-%'`) === '2', 'secrets are stored only as scrypt hashes')

// ---- 2. Foundry connects: the real module, with the secret, in a world from before ----
const gmUser = user('gm', 'Gamemaster', true)
users.activeGM = gmUser
const alice = user('alice', 'Alice')
user('bob', 'Bob')
const thorin = actor('thorin', 'Thorin Oakenshield', ['alice'], 'character', { value: 31, max: 44, temp: 5 })
const vex = actor('vex', 'Vex', ['alice'], 'character', { value: 12, max: 38, temp: 0 })
const bard = actor('bard', 'Bard the Bowman', ['bob'], 'character', { value: 40, max: 40, temp: 0 })
const boss = actor('boss', 'Goblin Boss', [], 'npc', { value: 21, max: 21, temp: 0 })
await import(`${MODULE}/scripts/module.mjs`)
await Hooks.callAll('init')
settings.set('listenerUrl', new URL(BASE).host)
settings.set('campaignSecrets', { 'camp-a': SECRET, 'camp-b': SECRET_B })
settings.set('chatEvents', true)
settings.set('combatEvents', true)
settings.set('gmContent', true)
// The same ids the campaigns had before Gamemasters set them up here.
settings.set('campaigns', [
  { id: 'camp-a', title: 'The Lonely Mountain', characters: ['thorin'] },
  { id: 'camp-b', title: 'Shadows of Mirkwood', characters: ['vex', 'bard'] },
])
await Hooks.callAll('ready')
await idle()
let out = take()
check(sentTo(out.filter(p => p.envelope.type === 'bridge.hello')).sort().join() === 'bridge.hello → Shadows of Mirkwood (200),bridge.hello → The Lonely Mountain (200)', 'both hellos are accepted')
// From module 0.22.0 a hello lists its characters without their sheets, and each follows it, once
// it's answered, in a post of its own.
const followed = out.filter(p => p.envelope.type === 'character.updated')
check(out.filter(p => p.envelope.type === 'bridge.hello').every(p => p.envelope.data.sheetsApart === true && p.envelope.data.characters.every(c => !('sheet' in c)))
  && out.every(p => ['bridge.hello', 'character.updated'].includes(p.envelope.type))
  && followed.map(p => `${p.envelope.campaign.title}: ${p.envelope.data.character.id} (${p.status})`).sort().join() === 'Shadows of Mirkwood: bard (200),Shadows of Mirkwood: vex (200),The Lonely Mountain: thorin (200)'
  && followed.every(p => out.indexOf(p) > out.findIndex(h => h.envelope.type === 'bridge.hello' && h.envelope.campaign.id === p.envelope.campaign.id)),
  `and after each, its characters, each in a post of its own, accepted (${sentTo(out).join(', ')})`)
check(Object.fromEntries(out.map(p => [p.envelope.campaign.title, p.auth]))['Shadows of Mirkwood'] === `Bearer ${SECRET_B}` && out.find(p => p.envelope.campaign.id === 'camp-a').auth === `Bearer ${SECRET}`
  && out.every(p => p.auth === `Bearer ${p.envelope.campaign.id === 'camp-b' ? SECRET_B : SECRET}`), "each campaign's events carry its own secret")
check(sql(`select count(*) from campaign`) === '2', 'each set-up moved onto the campaign it was before, rather than a copy')
check(sql(`select count(*) from campaign where "ownerId" = 'e2e-user' and "foundryId" in ('camp-a', 'camp-b')`) === '2', 'both are now bound and owned by the Gamemaster')
await gm.reload()
check(await lonely.getByText('Live').isVisible(), 'the Gamemaster sees the campaign live')
const mirkwood = gm.getByRole('article', { name: 'Shadows of Mirkwood' })
check(await mirkwood.getByText('Bard the Bowman').isVisible() && await mirkwood.getByText('Not chosen yet').isVisible(), "the campaign's characters arrived, Bard not yet chosen")
check(await lonely.getByText('Alice Adventurer').isVisible(), "Thorin, from before invites, is still Alice's")
await gm.screenshot({ path: `${SHOTS}/gm-campaigns-live.png`, fullPage: true })

// ---- 3. What the endpoint refuses ----
const { buildEnvelope } = await import(`${MODULE}/scripts/transport.mjs`)
const ping = campaign => buildEnvelope('bridge.ping', {}, { campaign, sequenced: false })
const lonelyRef = { id: 'camp-a', title: 'The Lonely Mountain' }
check((await raw(gmTab, GAME, ping(lonelyRef), SECRET)).status === 204, "a campaign's Test passes with its secret")
check((await raw(gmTab, GAME, ping(lonelyRef), SECRET_B)).status === 401, "and is refused with another campaign's secret")
const untitled = await raw(gmTab, GAME, ping({ id: 'camp-z', title: 'Erebor' }), SECRET)
check(untitled.status === 404 && untitled.reason === 'notSetUp' && untitled.type === 'application/json' && untitled.message.includes('No campaign titled “Erebor”'), 'testing a campaign not set up in the app says so, as JSON naming its reason')
check((await raw(gmTab, GAME, ping(null), SECRET_B)).status === 204, "an older module's test, naming no campaign, still passes")
const otherTab = await foundry.newPage()
await otherTab.goto(`${OTHER_GAME}/game`)
const notSetUp = await raw(otherTab, OTHER_GAME, ping(null))
check(notSetUp.status === 404 && notSetUp.reason === 'notSetUp' && notSetUp.message === `No campaign is set up for ${OTHER_GAME} in Sending Stone`, 'a game with nothing set up is told so')
const stray = buildEnvelope('chat.cleared', {}, { campaign: { id: 'camp-z', title: 'Erebor', characters: new Set() } })
const strayAnswer = await raw(gmTab, GAME, stray)
check(strayAnswer.status === 404 && strayAnswer.reason === 'notSetUp' && strayAnswer.message.includes('No campaign titled “Erebor”'), 'a campaign not set up is refused by title')
const forged = buildEnvelope('chat.cleared', {}, { campaign: { id: 'camp-a', title: 'The Lonely Mountain', characters: new Set() } })
check((await raw(gmTab, GAME, forged, 'wrong-secret-123')).status === 401, "an event without its campaign's secret is refused")
take()

// ---- 4. A player follows the invite link ----
const inviteUrl = await mirkwood.locator('code').first().textContent()
check(inviteUrl.startsWith(`${BASE}/join/`), 'the invite link is on the campaign')
const playerContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, colorScheme: 'light' })
const bob = await playerContext.newPage(); watch(bob, 'bob')
await bob.goto(inviteUrl)
await bob.waitForURL(/\/login\?next=/)
check(await bob.getByText('Sign in to join the campaign and choose your character.').isVisible(), 'signed out, the invite asks them to sign in, to come back')
await playerContext.addCookies([await cookieFor('e2e-bob-token')])
await bob.goto(new URL(bob.url()).searchParams.get('next').replace(/^/, BASE))
await bob.getByRole('heading', { name: 'Shadows of Mirkwood' }).waitFor()
check(await bob.getByText(/run by Alice Adventurer/).isVisible(), 'the invite names the campaign and its Gamemaster')
check(await bob.getByRole('radio', { name: 'Vex Taken' }).isDisabled(), "Vex, already Alice's, is taken")
await bob.screenshot({ path: `${SHOTS}/player-invite-phone.png`, fullPage: true })
await bob.getByRole('radio', { name: 'Bard the Bowman' }).check()
await bob.getByRole('button', { name: 'Join as this character' }).click()
await bob.waitForURL(/\/characters\/[\w]+$/)
await bob.getByRole('heading', { level: 1, name: 'Bard the Bowman', exact: true }).waitFor()
check(await bob.getByRole('status').filter({ hasText: 'Live' }).isVisible(), "the player's table shows the game live")
await gm.reload()
check(await mirkwood.getByText('Bob', { exact: true }).isVisible(), 'the Gamemaster sees who chose Bard')

// Someone else can't take Bard now.
const alicePlayer = await gmContext.newPage(); watch(alicePlayer, 'alice')
await alicePlayer.goto(inviteUrl)
check(await alicePlayer.getByRole('radio', { name: 'Bard the Bowman Taken' }).isDisabled(), 'Bard now shows as taken')
check(await alicePlayer.getByText("You're already playing Vex in this campaign.").isVisible(), 'a player is told who they already play')
const bardId = sql(`select id from character where "actorId" = 'bard'`)
const stolen = await alicePlayer.evaluate(async () => {
  // The radio is disabled, so post the form as a stale page would.
  const form = document.querySelector('form')
  const input = form.querySelector('input[value="bard"]')
  input.disabled = false
  input.checked = true
  form.requestSubmit()
})
// Next's route announcer is an alert too, so look for the chooser's own.
const refused = alicePlayer.getByRole('alert').filter({ hasText: 'Another player has just chosen that character. Choose another.' })
await refused.waitFor()
check(true, 'a stale page cannot take a character already chosen')
check(sql(`select count(*) from character where "actorId" = 'bard'`) === '1' && sql(`select id from character where "actorId" = 'bard'`) === bardId, 'Bard is still only Bob’s')

// ---- 5. Liveness: offline after two quiet minutes, live again at the next heartbeat ----
sql(`update campaign set "lastSeenAt" = now() - interval '3 minutes'`)
await bob.getByRole('status').filter({ hasText: 'Offline' }).waitFor({ timeout: 10_000 })
check(true, 'two quiet minutes later, the player sees Offline')
const { heartbeat } = await import(`${MODULE}/scripts/heartbeat.mjs`)
Date.now = () => realNow() + 60_000
heartbeat(); await idle()
Date.now = realNow
out = take()
check(out.length === 2 && out.every(p => p.envelope.type === 'bridge.heartbeat' && p.status === 200 && p.envelope.sequence === null), 'the module sends each quiet campaign a heartbeat')
await bob.getByRole('status').filter({ hasText: 'Live' }).waitFor({ timeout: 10_000 })
check(true, 'and the player sees it live again')

// ---- 6. Combat: initiative tiebreakers, attack, spell and damage highlights, targets ----
class D20Roll {}
const DamageRoll = CONFIG.Dice.DamageRoll
const die = (faces, values) => ({ expression: `${values.length}d${faces}`, faces, number: values.length, results: values.map(result => ({ result, active: true })) })
const d20 = (formula, total, value, extra = {}) => Object.assign(new D20Roll(), { formula, total, dice: [die(20, [value])], hasAdvantage: false, hasDisadvantage: false, isCritical: false, isFumble: false, ...extra })
const damage = (formula, total, faces, values, type) => Object.assign(new DamageRoll(), { formula, total, dice: [die(faces, values)], options: { type } })
const by = (who, owner) => ({ speakerActor: who, speaker: { actor: who.id }, alias: who.name, author: users.get(owner), _source: { author: owner } })
const dnd5e = (roll, item, targets = [], extra = {}) => ({ flags: { dnd5e: { messageType: 'roll', roll, item: { id: item.name, type: item.type }, targets, ...extra } }, getAssociatedItem: () => item })
const target = { name: 'Goblin Boss', uuid: 'Actor.boss', ac: 15 }

const fight = combat('cmbt1')
await Hooks.callAll('createCombat', fight)
for (const [id, who, initiative] of [['c-boss', boss, 18.14], ['c-bard', bard, 18.09], ['c-vex', vex, 7]]) {
  await Hooks.callAll('createCombatant', combatant(fight, id, who, { initiative }))
}
fight.started = true; fight.round = 1; fight.turn = 1
await Hooks.callAll('combatTurnChange', fight, { round: 0, turn: null, combatantId: null }, { round: 1, turn: 1, combatantId: 'c-bard' })
await idle()
check(take().every(p => p.status === 204), 'the fight reaches Mirkwood')

const say = async msg => { await Hooks.callAll('createChatMessage', msg); await idle(); return take() }
out = await say(message('m-attack', { ...by(bard, 'bob'), rolls: [d20('1d20 + 7', 22, 15)], ...dnd5e({ type: 'attack' }, { name: 'Black Arrow', type: 'weapon' }, [target]) }))
check(out.every(p => p.status === 204), 'an attack on the Goblin Boss is sent')
await say(message('m-damage', { ...by(bard, 'bob'), rolls: [damage('2d8 + 4', 15, 8, [6, 5], 'piercing')], ...dnd5e({ type: 'damage' }, { name: 'Black Arrow', type: 'weapon' }, [], { originatingMessage: 'm-attack' }) }))
await say(message('m-spell', { ...by(vex, 'alice'), rolls: [d20('1d20 + 5', 9, 4)], ...dnd5e({ type: 'attack' }, { name: 'Fire Bolt', type: 'spell' }, [target]) }))
await say(message('m-heal', { ...by(vex, 'alice'), rolls: [damage('1d8 + 3', 8, 8, [5], 'healing')], ...dnd5e({ type: 'damage' }, { name: 'Cure Wounds', type: 'spell' }, [{ name: 'Bard the Bowman', uuid: 'Actor.bard' }]) }))

await bob.getByRole('button', { name: /Combat/ }).click()
await bob.getByRole('heading', { name: 'Your turn' }).waitFor({ timeout: 10_000 })
const boxes = await bob.locator('li span.w-15').allTextContents()
check(boxes.join('|') === 'Initiative 18.14|Initiative 18.09|Initiative 7', 'tiebreaker initiatives show to two places')
const widths = await bob.locator('li span.w-15').evaluateAll(spans => spans.map(span => [span.clientWidth, span.scrollWidth]))
check(widths.every(([client, scroll]) => client === widths[0][0] && scroll <= client), 'every initiative box is the same width and fits its number')
await bob.screenshot({ path: `${SHOTS}/player-combat-phone.png` })

await bob.getByRole('button', { name: /Chat/ }).click()
const log = bob.getByRole('list', { name: 'Chat log' })
await log.getByText('Cure Wounds').waitFor({ timeout: 10_000 })
const card = text => log.getByRole('listitem').filter({ hasText: text })
check(await card('Black Arrow').first().getByText('Attack', { exact: true }).isVisible(), 'the attack is marked Attack')
check(await card('Black Arrow').first().getByText('Hit', { exact: true }).isVisible() && await card('Black Arrow').first().getByText('AC 15').isVisible(), 'and calls out the Goblin Boss, AC 15, hit')
// From app 0.28's damage card: its kind's chip, "15 Piercing", in place of the old "piercing damage" footer.
const damageCard = log.getByRole('listitem').filter({ hasText: '15 Piercing' })
check(await damageCard.getByText('Damage', { exact: true }).isVisible() && await damageCard.getByText('Goblin Boss').isVisible(), "the damage is marked Damage, against the attack's target")
check(await card('Fire Bolt').getByText('Spell attack').isVisible() && await card('Fire Bolt').getByText('Miss', { exact: true }).isVisible(), 'the spell attack is marked, and missed AC 15 with 9')
// From app 0.28 the card's chip for its kind says "Healing" too, after the head's own chip.
const healingWords = card('Cure Wounds').getByText('Healing', { exact: true })
check(await healingWords.count() === 2 && await healingWords.first().evaluate(el => el.classList.contains('uppercase')) && await healingWords.first().isVisible()
  && await card('Cure Wounds').getByText('8 Healing').isVisible(), 'the healing is marked Healing, its chip "8 Healing"')
await bob.waitForTimeout(300)
await bob.screenshot({ path: `${SHOTS}/player-chat-phone.png`, fullPage: true })
const desktop = await gmContext.newPage(); watch(desktop, 'alice-desktop')
const vexId = sql(`select id from character where "actorId" = 'vex'`)
await desktop.goto(`${BASE}/characters/${vexId}`)
await desktop.getByRole('region', { name: 'Combat' }).getByRole('heading', { name: 'Initiative' }).waitFor()
// From module 0.34.0 a seat at a character always has its notes, so the Character pane shows with no sheet too;
// from 0.35.0 they're its Journal card.
await desktop.getByRole('region', { name: 'Character', exact: true }).getByRole('region', { name: 'Journal', exact: true }).waitFor({ timeout: 15_000 })
const wideNoSheet = await desktop.evaluate(() => {
  const pane = document.getElementById('character-pane')
  const column = pane?.nextElementSibling
  return { column: column?.getBoundingClientRect().width ?? 0, holdsCombat: Boolean(column?.querySelector('section[aria-label="Combat"]')) }
})
check(!(await desktop.getByRole('navigation', { name: 'Table' }).isVisible()) && await desktop.getByRole('region', { name: 'Combat' }).getByRole('heading', { name: 'Initiative' }).isVisible()
  && await desktop.getByRole('region', { name: 'Character', exact: true }).isVisible() && await desktop.getByRole('region', { name: 'Character', exact: true }).getByRole('region', { name: 'Journal', exact: true }).isVisible()
  && wideNoSheet.holdsCombat && wideNoSheet.column >= 320 && wideNoSheet.column <= 500,
  `on a wide screen without a sheet, the Character pane, with why there's no sheet and the Journal card, beside combat, without the bottom tabs (${JSON.stringify(wideNoSheet)})`)
await desktop.getByRole('tab', { name: /^Chat/ }).click()
check(await desktop.getByRole('region', { name: 'Chat' }).isVisible() && !(await desktop.getByRole('region', { name: 'Combat' }).isVisible()), 'and the chat is a tab away')
check(await desktop.evaluate(() => document.scrollingElement.scrollHeight === document.scrollingElement.clientHeight), 'and only the panes scroll, not the page')
await desktop.waitForTimeout(300)
await desktop.screenshot({ path: `${SHOTS}/vex-chat-desktop-dark.png` })

// ---- 7. Deleting: the Gamemaster removes a player, players delete their own ----
await gm.bringToFront()
await gm.reload()
await mirkwood.getByRole('button', { name: 'Remove Bob as Bard the Bowman' }).click()
const removeBob = gm.getByRole('dialog', { name: 'Remove Bob as Bard the Bowman?' })
check((await removeBob.textContent()).includes('Bob stops following Shadows of Mirkwood as Bard the Bowman'), 'removing a player asks first, saying what it does')
await gm.screenshot({ path: `${SHOTS}/gm-remove-player.png` })
await removeBob.getByRole('button', { name: 'Remove' }).click()
await mirkwood.getByRole('listitem').filter({ hasText: 'Bard the Bowman' }).getByText('Not chosen yet').waitFor()
check(sql(`select count(*) from character where "actorId" = 'bard'`) === '0', 'the Gamemaster removes Bob as Bard, so Bard can be chosen again')
await bob.goto(`${BASE}/characters`)
check(await bob.getByRole('link', { name: /Bard the Bowman/ }).count() === 0, "Bard is gone from Bob's characters")

await bob.goto(inviteUrl)
await bob.getByRole('radio', { name: 'Bard the Bowman' }).check()
await bob.getByRole('button', { name: 'Join as this character' }).click()
await bob.getByRole('heading', { level: 1, name: 'Bard the Bowman', exact: true }).waitFor()
check(true, 'Bob can choose Bard again')
await bob.getByRole('button', { name: 'Delete Bard the Bowman' }).click()
const deleteBard = bob.getByRole('dialog', { name: 'Delete Bard the Bowman?' })
await bob.screenshot({ path: `${SHOTS}/player-delete-phone.png` })
await deleteBard.getByRole('button', { name: 'Delete' }).click()
await bob.waitForURL(/\/characters$/)
check(await bob.getByRole('link', { name: /Bard the Bowman/ }).count() === 0 && sql(`select count(*) from character where "actorId" = 'bard'`) === '0', "a player deletes their character from its page, and is taken back to their characters")

await alicePlayer.goto(`${BASE}/characters`)
await alicePlayer.getByRole('button', { name: 'Delete Vex' }).click()
const deleteVex = alicePlayer.getByRole('dialog', { name: 'Delete Vex?' })
await deleteVex.getByRole('button', { name: 'Cancel' }).click()
check(sql(`select count(*) from character where "actorId" = 'vex'`) === '1', 'deleting from the list asks first, and Cancel keeps the character')
await alicePlayer.getByRole('button', { name: 'Delete Vex' }).click()
await deleteVex.getByRole('button', { name: 'Delete' }).click()
await alicePlayer.getByRole('link', { name: /Vex/ }).waitFor({ state: 'detached' })
check(sql(`select count(*) from character where "actorId" = 'vex'`) === '0', 'and Delete removes it')

// ---- 8. Resetting the invite link retires the old one ----
await gm.bringToFront()
await mirkwood.getByRole('button', { name: 'Reset link' }).click()
await gm.getByRole('dialog', { name: 'Reset the invite link?' }).getByRole('button', { name: 'Reset link' }).click()
// The page's embedded render data still holds the old link, so compare only what is shown.
await gm.waitForFunction(old => [...document.querySelectorAll('code')].every(code => code.textContent !== old), inviteUrl)
check(true, 'the Gamemaster resets the invite link, after asking')
await bob.goto(inviteUrl)
check(await bob.getByRole('heading', { name: "This invite link doesn't work" }).isVisible(), 'the old invite link no longer works')

// ---- 9. Deleting a campaign ----
await mirkwood.getByRole('button', { name: 'Delete campaign' }).click()
const deleteCampaign = gm.getByRole('dialog', { name: 'Delete Shadows of Mirkwood?' })
await deleteCampaign.getByRole('button', { name: 'Delete campaign' }).click()
await mirkwood.waitFor({ state: 'detached' })
check(sql(`select count(*) from campaign where title = 'Shadows of Mirkwood'`) === '0', 'the Gamemaster deletes a campaign, after asking')

console.log('console problems:', JSON.stringify(problems, null, 1))
await browser.close()
process.exit(0)
