// Party sheets (module 0.30.0 and the app, its contract §7 party-e2e.mjs), end to end, in the world
// of world-030.mjs. Alice plays Thorin and is the campaign's Gamemaster; Bob plays Vex. The Iron
// Company, a Group actor Alice's user may observe and Bob's has only Limited on, holds Thorin, Vex
// and Bram, the Gamemaster's hireling, a stash with a bag in it, coin and a description with a
// secret in it; the Hidden Hand no player may see; the Wardens of the Vale, the world's primary
// party, Alice's user owns. Since PR #44 the party sheets open from a "Party" (or "Parties") list on
// the character's Inventory tab, never the table's header: Alice's lists "The Iron Company Party
// sheet", which opens it in the side panel, members by name and portrait alone, her own a link, the
// stash with nothing to use and the description without its secret, then as its own page and back.
// Bob, Limited, has no list, and every way to the sheet or its texts answers 404. The Gamemaster's
// campaign card lists the party sheets, the Hidden Hand's as shared with no one, its page saying so,
// and the Parties list on a character's Inventory opens the panel through the campaign. With the
// Wardens added, "Parties", the primary party first; withheld as too large where the app takes less;
// kept current as the stash and a member change, through a re-hello; gone from the panel as Alice
// loses her access, and the list with the last group deleted. With Thorin's own sheet withheld as too
// large, the list under why there's none still opens the panel, and the Character pane shows on a
// wide screen; with the panel open over Inventory, no id twice and every label inside it; the rows
// fit at every width. The header at 360, 390, 768 and 1280 px in both themes, with a long name and
// "Reconnecting": no sideways scroll, the name cut short, the cluster on one line, no Party button.
// SKEW=029 with MODULE=module 0.29.0: no groups at all, so no Party list and every party route 404.
// Synthetic characters only. Run with --import ./fvtt/unref-timers.mjs --import
// ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import {
  ALICE, BASE, BOB, MODULE, NEW, SKEW, actors, call, changeSetting, character, check, finish, foundryWorld, group, item, launch,
  newCampaign, note, npc, part, posted, postsOf, relay, same, settings, settled, shoot, shootBoth, sideways, sql, startModule,
  theme, until, wait, browse,
} from './world-030.mjs'

const GAME = 'https://ember-gate.forge-vtt.com'
const SECRET = 'ember-party-secret-30'
const TITLE = 'Emberfall'
await launch(GAME)
const { id: A, invite } = await newCampaign({ title: TITLE, address: 'ember-gate.forge-vtt.com', secret: SECRET })
await foundryWorld()

// ---- The world: Thorin and Vex, Bram, and three groups ----
const hits = (formula, type) => ({ formula, damageType: type, label: `${formula} ${type}` })
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], mods: { str: 3, dex: 1, con: 2 }, hp: { value: 30, max: 38, temp: 0 } }, {
  ac: 16,
  items: [{
    id: 'axe', name: 'Battleaxe', type: 'weapon', system: { properties: [], quantity: 1, attackType: 'melee', equipped: true },
    activities: [{ id: 'chop', damage: [{ number: 1, denomination: 8, bonus: '@mod', types: ['slashing'] }], labels: { modifier: '+5', damage: [hits('1d8 + 3', 'slashing')] } }],
  }],
})
thorin.system.details = { level: 5 }
const vex = character({ id: 'vex', name: 'Vex', owners: ['bob'], mods: { wis: 3 }, hp: { value: 24, max: 30, temp: 0 } }, { ac: 14, items: [] })
vex.system.details = { level: 5 }
game.users.get('alice').character = thorin
game.users.get('bob').character = vex
const bram = npc('bram', 'Bram', 12)
const SECRET_TEXT = 'The cult paid them.'
const company = group('company', 'The Iron Company', {
  members: [bram, vex, thorin],
  // Alice's user may observe it; Bob's is Limited, which counts as none.
  ownership: { alice: 2, bob: 1 },
  description: { full: `<p>Sworn at the Ember Gate.</p><section class="secret"><p>${SECRET_TEXT}</p></section>`, summary: '<p>Four of Emberfall.</p>' },
  currency: { gp: 120, sp: 7 },
})
item(company, 'rope', 'loot', 'Hempen Rope', { quantity: 50, description: { value: '<p>Fifty feet of it.</p>' } })
item(company, 'potion', 'consumable', 'Potion of Healing', {
  quantity: 3, uses: { max: 1, spent: 0, value: 1, autoDestroy: true }, activities: new Map([['drink', { id: 'drink', type: 'heal' }]]),
})
item(company, 'bag', 'container', 'Bag of Holding', { capacity: { count: 10 }, contentsCount: 1, description: { value: `<p>Deeper than it looks.</p><section class="secret"><p>${SECRET_TEXT}</p></section>` } })
item(company, 'gem', 'loot', 'Fire Opal', { container: 'bag', price: { value: 50, denomination: 'gp' } })
const hidden = group('hidden', 'The Hidden Hand', { members: [vex], ownership: { bob: 1 }, description: { full: '<p>Unseen.</p>' } })
const wardens = group('wardens', 'Wardens of the Vale', { members: [thorin], ownership: { alice: 3 }, description: { summary: '<p>Keepers of the vale road.</p>' } })
item(wardens, 'horn', 'loot', 'Warden Horn')
Object.defineProperty(actors, 'party', { get: () => actors.get('wardens') ?? null, configurable: true })
const campaign = (groups) => ({ id: 'camp-ember', title: TITLE, characters: ['thorin', 'vex'], groups, rolls: true })

await startModule({ campaigns: [campaign(['company', 'hidden'])], secrets: { 'camp-ember': SECRET } })
const hello = postsOf('bridge.hello')[0]
const groupSheet = id => JSON.parse(sql(`select coalesce((select data::text from group_sheet where "campaignId" = '${A}' and "actorId" = '${id}'), 'null')`))
const roster = () => JSON.parse(sql(`select groups::text from campaign where id = '${A}'`))
const updatesOf = id => postsOf('group.updated').filter(p => p.data.group.id === id)
part('1. the wire')
if (NEW) {
  await until(() => groupSheet('company') && updatesOf('hidden').length > 0, 'the groups to be sent')
  check(same(hello.data.groups.map(g => [g.id, g.primary, g.access]), [['company', false, { thorin: 'observer' }], ['hidden', false, {}]]),
    `the hello lists the campaign's two groups, the Iron Company seen by Thorin's player alone, Vex's being Limited, and the Hidden Hand by no one (${JSON.stringify(hello.data.groups)})`)
  const [sent] = updatesOf('company')
  check(postsOf('character.updated').length >= 2 && posted.indexOf(sent) > Math.max(...postsOf('character.updated').slice(0, 2).map(p => posted.indexOf(p))),
    "each group's sheet follows the hello's characters")
  check(sent.data.group.sheet.members.every(m => same(Object.keys(m).sort(), ['character', 'id', 'img', 'name', 'type']))
    && same(sent.data.group.sheet.members.map(m => m.name), ['Thorin', 'Vex', 'Bram']) && !/"hp"|"level"|"xp"/i.test(JSON.stringify(sent.data.group.sheet.members)),
    `its members are characters then NPCs, each by its id, name, portrait, kind and whether it's the campaign's: nothing else (${JSON.stringify(sent.data.group.sheet.members)})`)
  const hiddenSent = updatesOf('hidden')[0].data.group
  check(hiddenSent.sheet === null && same(hiddenSent.sheetWithheld, { reason: 'private' }) && groupSheet('hidden') === null,
    `the Hidden Hand goes without its sheet, as private, and the app keeps none (${JSON.stringify(hiddenSent)})`)
  check(same(roster().map(g => [g.id, g.access]), [['company', { thorin: 'observer' }], ['hidden', {}]]) && !JSON.stringify(roster()).includes('"sheet"'),
    'the app keeps both on the roster, without their sheets')
} else {
  await settled()
  check(!('groups' in hello.data) && postsOf('group.updated').length === 0 && same(roster(), []) && sql('select count(*) from group_sheet') === '0',
    `module 0.29.0 lists no groups and sends none; the app keeps none (${JSON.stringify(roster())})`)
}
const textHash = NEW ? groupSheet('company').description.full : 'a1b2c3d4e5f6a7'
const NOT_FOUND = "This party sheet isn't open here."

// ---- Alice plays Thorin; Bob follows the invite and chooses Vex ----
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)
const phone = await browse({ width: 390, height: 844, path: '/characters/sheet-thorin' })
await phone.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const bobs = await browse({ width: 390, height: 844, scheme: 'dark', who: BOB })
await bobs.page.goto(invite)
await bobs.page.getByRole('radio', { name: /^Vex/ }).check()
await bobs.page.getByRole('button', { name: 'Join as this character' }).click()
await bobs.page.waitForURL(/\/characters\/[\w-]+$/)
await bobs.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
const vexSheet = sql(`select id from "character" where "actorId" = 'vex' and "campaignId" = '${A}'`)

const header = who => who.page.locator('header').first()
/** Since PR #44, nothing of the parties in the table's header. */
const headerParty = who => header(who).getByRole('button', { name: /^Part(y|ies)/ })
/** The Inventory tab's party list, "Party" or "Parties", and its rows, by what each shows. */
const partyList = who => who.page.getByRole('tabpanel').getByRole('region', { name: /^Part(y|ies)$/ })
const partyRows = who => partyList(who).getByRole('button')
const rowNames = who => partyRows(who).evaluateAll(buttons => buttons.map(b => b.textContent))
const panelOf = (who, name) => who.page.getByRole('dialog', { name })
/** A party sheet's members, as read: each its name. */
const membersList = scope => scope.locator('section[aria-labelledby]').first().locator(':scope > ul')
const membersOf = scope => membersList(scope).locator(':scope > li').allTextContents()

if (SKEW) {
  part('skew')
  await wait(4000)
  await phone.tab('Inventory')
  await phone.page.getByRole('tabpanel').getByText('Currency', { exact: true }).first().waitFor({ timeout: 15_000 })
  check(await headerParty(phone).count() === 0 && await partyList(phone).count() === 0, 'with module 0.29.0, no Party list on Alice\'s Inventory, and nothing in her header')
  for (const path of ['/api/characters/sheet-thorin/party/company', `/api/characters/sheet-thorin/party/company/texts/${textHash}`, `/api/campaigns/${A}/party/company`]) {
    check((await call(phone.page, path)).status === 404, `${path} answers 404`)
  }
  await phone.page.goto(`${BASE}/characters/sheet-thorin/party/company`)
  check(await phone.page.getByText(NOT_FOUND).isVisible(), 'and the party page says it isn\'t open here')
  // Changed on purpose (round 0.39.0 §4.8): on a phone, the campaign chosen in the address.
  await phone.page.goto(`${BASE}/campaigns?campaign=${A}`)
  await phone.page.getByRole('article', { name: TITLE }).waitFor()
  check(await phone.page.getByRole('heading', { name: 'Party sheets' }).count() === 0, 'the campaign card lists no party sheets')
  await finish()
}

// =================================================================================================
// 1. Alice, who may observe the Iron Company
// =================================================================================================
part('2. the side panel')
await phone.tab('Inventory')
await partyList(phone).waitFor({ timeout: 15_000 })
{
  const region = phone.page.getByRole('tabpanel').getByRole('region', { name: 'Party', exact: true })
  const row = region.getByRole('button', { name: 'The Iron Company Party sheet', exact: true })
  check(await region.count() === 1 && await partyRows(phone).count() === 1 && await row.count() === 1 && await row.textContent() === 'The Iron Company Party sheet'
    && await row.getAttribute('aria-label') === null && await headerParty(phone).count() === 0,
    `Alice's Inventory has a "Party" list, its one row named by what it shows, "The Iron Company Party sheet"; her header has no Party button (${JSON.stringify(await rowNames(phone))})`)
}
await shootBoth(phone, 'party-button', partyList(phone))
const textRequests = []
phone.page.on('request', request => { if (/\/party\/[^/]+\/texts\//.test(request.url())) textRequests.push(new URL(request.url()).pathname) })
await phone.party('The Iron Company')
let panel = panelOf(phone, 'The Iron Company')
await panel.getByRole('heading', { name: 'Members · 3' }).waitFor({ timeout: 15_000 })
check(await panel.locator('header p').first().textContent() === 'Party', 'it opens the side panel, titled with its name and subtitled "Party"')
{
  const members = await membersOf(panel)
  const looks = await membersList(panel).locator(':scope > li').evaluateAll(lis => lis.map(li => ({
    portrait: !!li.querySelector('img') || !!li.querySelector('svg.lucide-user-round'), parts: li.children.length,
  })))
  const text = await panel.textContent()
  check(same(members, ['Thorin', 'Vex', 'Bram']) && looks.every(l => l.portrait && l.parts === 2),
    `"Members · 3": Thorin, Vex and Bram, each a portrait and a name, nothing more (${JSON.stringify([members, looks])})`)
  check(!/\bHP\b|\bLevel\b|\bXP\b|Fighter|Cleric|Sorcerer|Wizard|\b38\b|\/ 30\b/.test(text), 'nothing of any member\'s hit points, level, experience or class anywhere in the panel')
  const thorinLink = membersList(panel).getByRole('link', { name: 'Thorin', exact: true })
  check(await thorinLink.getAttribute('href') === '/characters/sheet-thorin'
    && await membersList(panel).getByRole('link').count() === 1,
    "Thorin, her own, links to his sheet; Vex and Bram aren't links")
}
// Inventory, the default: coin, the stash and the bag that opens to what it holds.
check(await panel.getByRole('tab', { name: 'Inventory' }).getAttribute('aria-selected') === 'true', 'Inventory is the tab it opens on')
await panel.getByText('Hempen Rope').waitFor()
{
  const coin = await panel.locator('dl li[title]').evaluateAll(lis => lis.map(li => `${li.getAttribute('title')}: ${li.textContent.trim()}`))
  check(coin.some(c => /^Gold: 120\s*gp$/.test(c)) && coin.some(c => /^Silver: 7\s*sp$/.test(c)), `its coin shows: ${JSON.stringify(coin)}`)
  await panel.locator('summary').filter({ hasText: 'Bag of Holding' }).click()
  await panel.getByText('Fire Opal').waitFor()
  check(await panel.getByText('Fire Opal').isVisible(), 'the Bag of Holding opens to the Fire Opal in it')
  const controls = await panel.locator('button, [role="button"], a').evaluateAll(els => els.map(el => el.getAttribute('aria-label') ?? el.textContent.trim()))
  check(!controls.some(c => /^(Use|Roll|Spend|Cast|Drink|Attack|Favou?rite|Star)\b|attack|damage/i.test(c)) && await panel.locator('.lucide-star').count() === 0,
    `nothing in it is used, rolled, starred or spent: its only controls are ${JSON.stringify(controls)}`)
  const potion = panel.locator('li').filter({ hasText: 'Potion of Healing' }).first()
  check(await potion.isVisible() && await potion.getByRole('button').count() === 0, 'the potion, which has a use, shows it with no button to spend it')
}
await shootBoth(phone, 'party-panel', panel)
await panel.getByRole('tab', { name: 'Description' }).click()
await panel.getByText('Sworn at the Ember Gate.').waitFor({ timeout: 15_000 })
check(!(await panel.textContent()).includes(SECRET_TEXT) && textRequests.some(p => p === `/api/characters/sheet-thorin/party/company/texts/${textHash}`),
  `its description shows, without its secret, fetched through the party's own route (${JSON.stringify(textRequests)})`)
check(sql(`select count(*) from sheet_text where "campaignId" = '${A}' and hash = '${textHash}'`) === '1'
  && !sql(`select coalesce(string_agg(html, ''), '') from sheet_text where "campaignId" = '${A}'`).includes(SECRET_TEXT),
  "nor does the app keep the secret, in the party's description or its bag's")

// =================================================================================================
// 2. As its own page, and back
// =================================================================================================
part('3. the page')
await panel.getByRole('link', { name: /^Open as page/ }).click()
await phone.page.waitForURL(`${BASE}/characters/sheet-thorin/party/company`)
const pageHead = phone.page.locator('header').first()
await phone.page.getByRole('heading', { level: 1, name: 'The Iron Company' }).waitFor()
await phone.page.getByRole('heading', { name: 'Members · 3' }).waitFor()
check(await pageHead.locator('p').first().textContent() === `Party · ${TITLE}` && same(await membersOf(phone.page), ['Thorin', 'Vex', 'Bram'])
  && await phone.page.getByText('Hempen Rope').isVisible() && await phone.page.getByText('Bag of Holding').isVisible(),
  '"Open as page" opens /characters/sheet-thorin/party/company: its name, "Party · Emberfall", the same members and the same stash')
check(same(await pageHead.locator(':scope > div').last().locator(':scope > *').evaluateAll(els => els.map(el => el.getAttribute('aria-label') ?? el.getAttribute('role'))), ['status', 'Full screen']),
  'its header ends with whether the game is live, then full screen')
await shootBoth(phone, 'party-page')
{
  const tablet = await browse({ width: 768, height: 1024, scheme: 'dark', path: '/characters/sheet-thorin/party/company' })
  await tablet.page.getByRole('heading', { name: 'Members · 3' }).waitFor({ timeout: 15_000 })
  check(await sideways(tablet.page) === 0, 'at 768 px too, with nothing to scroll sideways')
  await shootBoth(tablet, 'party-page')
  await tablet.view.close()
}
await phone.page.getByRole('link', { name: 'Back to Thorin' }).click()
await phone.page.waitForURL(`${BASE}/characters/sheet-thorin`)
await phone.page.getByRole('tablist', { name: 'Character sheet' }).waitFor()
check(true, 'its back arrow, "Back to Thorin", returns to his sheet')

// =================================================================================================
// 3. Bob, whose user is Limited on it
// =================================================================================================
part('4. limited')
await wait(3500)
await bobs.tab('Inventory')
await bobs.page.getByRole('tabpanel').getByText('Currency', { exact: true }).first().waitFor({ timeout: 15_000 })
check(await partyList(bobs).count() === 0 && await headerParty(bobs).count() === 0, "Bob's Inventory has no Party list, and his header nothing of it")
for (const [path, why] of [
  [`/api/characters/${vexSheet}/party/company`, 'the party sheet'],
  [`/api/characters/${vexSheet}/party/company/texts/${textHash}`, "a text of the party's, through the party's route"],
  [`/api/characters/${vexSheet}/texts/${textHash}`, "and through his character's texts"],
  [`/api/characters/${vexSheet}/party/hidden`, 'the Hidden Hand'],
]) check((await call(bobs.page, path)).status === 404, `for Bob, ${why} answers 404`)
check((await call(phone.page, `/api/characters/sheet-thorin/texts/${textHash}`)).status === 404 && (await call(phone.page, `/api/characters/sheet-thorin/party/company/texts/${textHash}`)).status === 200
  && (await call(phone.page, '/api/characters/sheet-thorin/party/hidden')).status === 404,
  "for Alice, the party's text is served through the party's route alone, never her character's, and the Hidden Hand answers 404")
await bobs.page.goto(`${BASE}/characters/${vexSheet}/party/company`)
check(await bobs.page.getByRole('heading', { name: NOT_FOUND }).isVisible() && await bobs.page.getByRole('link', { name: 'All characters' }).isVisible(),
  `Bob's party page says "${NOT_FOUND}", with the way to all characters`)
await bobs.page.goto(`${BASE}/characters/${vexSheet}`)

// =================================================================================================
// 4. The Gamemaster
// =================================================================================================
part('5. the Gamemaster')
// Changed on purpose (round 0.39.0 §4.8): on a phone, the campaign chosen in the address; its
// sections' headings h3s, one level up; and a party's page leads back to its campaign.
const gm = await browse({ width: 390, height: 844, path: `/campaigns?campaign=${A}` })
const card = gm.page.getByRole('article', { name: TITLE })
await card.getByRole('heading', { name: 'Party sheets' }).waitFor({ timeout: 15_000 })
{
  const rows = await card.locator('h3:has-text("Party sheets") + ul > li').evaluateAll(lis => lis.map(li => li.textContent))
  check(await card.getByRole('link', { name: "Open The Iron Company's party sheet" }).getAttribute('href') === `/campaigns/${A}/party/company`
    && rows.length === 2 && !rows[0].includes('Not shared') && rows[1].includes('Not shared with any player in Foundry'),
    `the campaign card lists "Party sheets", the Hidden Hand "Not shared with any player in Foundry" (${JSON.stringify(rows)})`)
}
await shootBoth(gm, 'gm-campaigns-party', card.locator('h3:has-text("Party sheets")').locator('xpath=..'))
await card.getByRole('link', { name: "Open The Hidden Hand's party sheet" }).click()
await gm.page.waitForURL(`${BASE}/campaigns/${A}/party/hidden`)
await gm.page.getByText('Not shared with any player in Foundry').waitFor({ timeout: 15_000 })
check(await gm.page.getByText('No player in this campaign has Observer or Owner on The Hidden Hand in Foundry').isVisible()
  && await gm.page.getByRole('link', { name: 'Your campaigns' }).isVisible() && await gm.page.locator('header p').first().textContent() === `Party · ${TITLE}`
  && await gm.page.getByRole('link', { name: 'Your campaigns' }).getAttribute('href') === `/campaigns?campaign=${A}`,
  'its own page says no player may see it, and why, and leads back to its campaign')
await shootBoth(gm, 'party-private')
await gm.page.goto(`${BASE}/campaigns/${A}/characters/vex`)
await gm.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await gm.tab('Inventory')
await partyList(gm).waitFor({ timeout: 15_000 })
{
  const region = gm.page.getByRole('tabpanel').getByRole('region', { name: 'Parties', exact: true })
  const names = await partyRows(gm).evaluateAll(buttons => buttons.map(b => b.textContent))
  check(await region.count() === 1 && same(names, ['The Iron Company Party sheet', 'The Hidden Hand Party sheet']) && await headerParty(gm).count() === 0,
    `on a character's page, the Gamemaster's Inventory lists "Parties", every group, neither primary, in the campaign's order (${JSON.stringify(names)})`)
}
const viaCampaign = gm.page.waitForRequest(request => request.url().includes(`/api/campaigns/${A}/party/company`))
await partyRows(gm).filter({ hasText: 'The Iron Company' }).click()
await viaCampaign
panel = panelOf(gm, 'The Iron Company')
await panel.getByRole('heading', { name: 'Members · 3' }).waitFor({ timeout: 15_000 })
check(await membersList(panel).getByRole('link').count() === 0 && await panel.getByRole('link', { name: /^Open as page/ }).getAttribute('href') === `/campaigns/${A}/party/company`,
  "it opens the panel through the campaign's route, no member a link of hers, and its page the campaign's")
await panel.getByRole('button', { name: 'Close' }).click()
await gm.page.goto(`${BASE}/campaigns/${A}/party/hidden`)

// =================================================================================================
// 5. Texts survive a re-hello; the panel kept current
// =================================================================================================
part('6. re-hello')
const { announce } = await import(`${MODULE}/scripts/bridge.mjs`)
let before = postsOf('bridge.hello').length
announce()
await until(() => postsOf('bridge.hello').length > before, 'the re-hello')
await settled()
check(groupSheet('company') && Number(sql(`select count(*) from sheet_text where "campaignId" = '${A}' and hash = '${textHash}'`)) === 1,
  "after a re-hello, the app still has the party's sheet and its description")
await phone.page.reload()
await phone.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 20_000 })
await phone.party('The Iron Company')
panel = panelOf(phone, 'The Iron Company')
await panel.getByRole('tab', { name: 'Description' }).click()
await panel.getByText('Sworn at the Ember Gate.').waitFor({ timeout: 15_000 })
check(true, 'and the description loads in the panel again')
await panel.getByRole('tab', { name: 'Inventory' }).click()

part('7. live')
const poll = 3000
item(company, 'lantern', 'loot', 'Hooded Lantern')
let at = Date.now()
await Hooks.callAll('createItem', company.items.get('lantern'), {}, 'gm')
await panel.getByText('Hooded Lantern').waitFor({ timeout: 15_000 })
check(Date.now() - at < poll + 4000, `an item added in Foundry shows in the open panel within a poll (${Date.now() - at} ms)`)
bram.name = 'Bram the Bold'
at = Date.now()
await Hooks.callAll('updateActor', bram, { name: 'Bram the Bold' }, {}, 'gm')
await until(async () => same(await membersOf(panel), ['Thorin', 'Vex', 'Bram the Bold']), "Bram's new name in the panel", 15_000)
check(Date.now() - at < poll + 4000, `a member renamed shows in it too (${Date.now() - at} ms)`)
before = updatesOf('company').length
await thorin.update({ 'system.attributes.hp.value': 21 })
await settled(1200)
check(updatesOf('company').length === before && postsOf('character.updated').at(-1).data.character.id === 'thorin', "a member's hit points changing sends his sheet, and nothing of the group's")

// =================================================================================================
// 6. Two groups: the Parties menu
// =================================================================================================
part('8. two groups')
await panel.getByRole('button', { name: 'Close' }).click()
before = postsOf('bridge.hello').length
await game.settings.set('sending-stone', 'campaigns', [campaign(['company', 'hidden', 'wardens'])])
await until(() => postsOf('bridge.hello').length > before && groupSheet('wardens'), 'the Wardens to be added')
const PARTIES = phone.page.getByRole('tabpanel').getByRole('region', { name: 'Parties', exact: true })
await PARTIES.waitFor({ timeout: 15_000 })
{
  const names = await rowNames(phone)
  const wardensRow = PARTIES.getByRole('button', { name: 'Wardens of the Vale Primary party', exact: true })
  check(same(names, ['Wardens of the Vale Primary party', 'The Iron Company Party sheet']) && await wardensRow.count() === 1 && await headerParty(phone).count() === 0,
    `with a second group she may see, the list is "Parties", of both, the primary party, the Wardens, first, saying "Primary party" (${JSON.stringify(names)})`)
}
await shootBoth(phone, 'party-menu', PARTIES)
await PARTIES.getByRole('button', { name: 'Wardens of the Vale Primary party', exact: true }).click()
panel = panelOf(phone, 'Wardens of the Vale')
await panel.getByRole('heading', { name: 'Members · 1' }).waitFor({ timeout: 15_000 })
await panel.getByRole('tab', { name: 'Description' }).click()
await panel.getByText('Keepers of the vale road.').waitFor({ timeout: 15_000 })
check(await panel.locator('header p').first().textContent() === 'Primary party', 'the Wardens open as the "Primary party", their description their summary, having no other')

// ---- Withheld where the app takes less ----
part('9. too large')
relay.answerAs = body => {
  const answer = JSON.parse(body)
  if (answer.features) answer.features.maxBytes = 1_000_000
  return JSON.stringify(answer)
}
const HOARD = 8000
for (let n = 0; n < HOARD; n++) item(wardens, `coin${n}`, 'loot', `Coin ${n} of the Wyrm's Hoard, an old electrum piece stamped with a sleeping dragon on one side and a burning tower on the other`)
// The game connects again: the app's answer to its hello says it takes no more than a megabyte.
before = updatesOf('wardens').length
announce()
await until(() => updatesOf('wardens').length > before, 'the Wardens sent again', 30_000)
await settled()
{
  const since = updatesOf('wardens').slice(before)
  const sent = since.at(-1).data.group
  check(since.length === 1 && sent.sheet === null && sent.sheetWithheld?.reason === 'tooLarge' && sent.sheetWithheld.limit === 1_000_000 && sent.sheetWithheld.bytes > 1_000_000,
    `${HOARD} coins make the Wardens' sheet larger than the 1,000,000 bytes the app's answer says it takes: it goes without it, as too large (${JSON.stringify(sent.sheetWithheld)}; ${since.at(-1).bytes} bytes posted)`)
}
await panel.getByText('Wardens of the Vale is too large to send').waitFor({ timeout: 15_000 })
check(/^It came to \d+\.\d MB, more than the 1\.0 MB this app takes\./.test(await panel.getByText(/^It came to/).textContent()),
  `the panel says "Wardens of the Vale is too large to send", and how large: "${await panel.getByText(/^It came to/).textContent()}"`)
await shootBoth(phone, 'party-too-large', panel)
for (let n = 0; n < HOARD; n++) wardens.items.map.delete(`coin${n}`)
relay.answerAs = null
before = updatesOf('wardens').length
await Hooks.callAll('deleteItem', { id: 'coin0', parent: wardens, documentName: 'Item' }, {}, 'gm')
await until(() => updatesOf('wardens').some((p, i) => i >= before && p.data.group.sheet), 'the Wardens\' sheet to go again', 30_000)
await panel.getByRole('heading', { name: 'Members · 1' }).waitFor({ timeout: 15_000 })
check(true, 'once the hoard is spent, the sheet goes again, and the panel shows it')
await panel.getByRole('button', { name: 'Close' }).click()

// =================================================================================================
// 6b. PR #44's review: ids under the panel, rows that fit, and the list where there's no sheet
// =================================================================================================
part('9b. ids, widths and no sheet')
await phone.party('The Iron Company')
panel = panelOf(phone, 'The Iron Company')
await panel.getByRole('heading', { name: 'Members · 3' }).waitFor({ timeout: 15_000 })
await panel.getByText('Hempen Rope').waitFor()
{
  const ids = await phone.page.evaluate(() => {
    const all = [...document.querySelectorAll('[id]')].map(el => el.id)
    const twice = [...new Set(all.filter((id, at) => all.indexOf(id) !== at))]
    const dialog = [...document.querySelectorAll('dialog[open]')].at(-1)
    const outside = [...dialog.querySelectorAll('[aria-labelledby]')].flatMap(el => el.getAttribute('aria-labelledby').split(/\s+/)
      .filter(id => !dialog.querySelector(`[id="${CSS.escape(id)}"]`)).map(id => `${el.tagName.toLowerCase()} → ${id}`))
    return { twice, outside, labelled: dialog.querySelectorAll('[aria-labelledby]').length }
  })
  check(ids.twice.length === 0 && ids.outside.length === 0 && ids.labelled > 2,
    `with the Iron Company's panel open over her Inventory, no id is in the page twice, and each of its ${ids.labelled} labelled parts is labelled from inside it (${JSON.stringify(ids)})`)
}
await panel.getByRole('button', { name: 'Close' }).click()
for (const width of [360, 390, 768, 1280]) {
  await phone.page.setViewportSize({ width, height: width < 1024 ? 844 : 800 })
  phone.width = width
  await phone.tab('Inventory')
  await PARTIES.waitFor()
  const rows = await partyRows(phone).evaluateAll(buttons => buttons.map(b => {
    const name = b.querySelector('span span')
    const box = b.getBoundingClientRect()
    return { name: name.textContent, whole: name.scrollWidth <= name.clientWidth, inView: box.left >= 0 && box.right <= document.documentElement.clientWidth }
  }))
  check(await sideways(phone.page) === 0 && rows.length === 2 && rows.every(r => r.whole && r.inView),
    `at ${width} px, the party rows fit: nothing scrolls sideways, and each row and its name are in view (${JSON.stringify(rows)})`)
}
await phone.page.setViewportSize({ width: 390, height: 844 })
phone.width = 390
// Thorin's own sheet withheld as too large, as the module sends it where it's more than the app takes.
const { buildEnvelope, post } = await import(`${MODULE}/scripts/transport.mjs`)
const told = postsOf('character.updated').filter(p => p.data.character.id === 'thorin').at(-1).data.character
const { sheet: _sheet, ...thorinEntry } = told
before = postsOf('character.updated').length
post(buildEnvelope('character.updated', { character: { ...thorinEntry, sheet: null, sheetWithheld: { reason: 'tooLarge', bytes: 1_500_000, limit: 1_000_000 } } },
  { campaign: settings.get('campaigns')[0] }))
await until(() => postsOf('character.updated').length > before && postsOf('character.updated').at(-1).status < 300, 'the withheld sheet taken')
const pane = phone.page.getByRole('region', { name: 'Character', exact: true })
await pane.getByText("Thorin's sheet is too large to send").waitFor({ timeout: 15_000 })
{
  const list = pane.getByRole('region', { name: /^Part(y|ies)$/ })
  await list.waitFor({ timeout: 15_000 })
  const names = await list.getByRole('button').evaluateAll(buttons => buttons.map(b => b.textContent))
  check(await phone.page.getByRole('tablist', { name: 'Character sheet' }).count() === 0
    && same(names, ['Wardens of the Vale Primary party', 'The Iron Company Party sheet']),
    `his sheet withheld, at 390 the Character tab says "Thorin's sheet is too large to send", and under it lists the parties (${JSON.stringify(names)})`)
  await shootBoth(phone, 'party-no-sheet')
  await list.getByRole('button', { name: 'The Iron Company Party sheet', exact: true }).click()
  panel = panelOf(phone, 'The Iron Company')
  await panel.getByRole('heading', { name: 'Members · 3' }).waitFor({ timeout: 15_000 })
  check(await panel.getByText('Hempen Rope').isVisible(), 'and its row opens the Iron Company\'s panel, with no sheet behind it')
  await panel.getByRole('button', { name: 'Close' }).click()
  await phone.page.setViewportSize({ width: 1280, height: 800 })
  phone.width = 1280
  await wait(300)
  const look = await phone.page.evaluate(() => {
    const pane = document.getElementById('character-pane')
    const column = pane?.nextElementSibling
    return { pane: pane ? pane.getBoundingClientRect().width : 0, column: column ? column.getBoundingClientRect().width : 0, shown: pane ? getComputedStyle(pane).display !== 'none' : false }
  })
  check(look.shown && look.pane > 600 && look.column >= 320 && look.column <= 500 && await pane.getByRole('region', { name: /^Part(y|ies)$/ }).isVisible(),
    `at 1280 the Character pane, with why there's no sheet and the party list, shows beside the narrow column of combat and chat (${JSON.stringify(look)})`)
  await shoot(phone, 'party-no-sheet')
  await phone.page.setViewportSize({ width: 390, height: 844 })
  phone.width = 390
}
// Sent again: the sheet's Inventory lists the parties as before.
before = postsOf('character.updated').length
await thorin.update({ 'system.attributes.hp.value': 20 })
await until(() => postsOf('character.updated').slice(before).some(p => p.data.character.id === 'thorin' && p.data.character.sheet), "Thorin's sheet sent again")
await phone.page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 15_000 })
await phone.tab('Inventory')
await PARTIES.waitFor({ timeout: 15_000 })
check(same(await rowNames(phone), ['Wardens of the Vale Primary party', 'The Iron Company Party sheet']) && await phone.page.getByText("Thorin's sheet is too large to send").count() === 0,
  "his sheet sent again, its Inventory lists the parties as before, and nothing says it's too large")

// =================================================================================================
// 7. The header, at every width, in both themes, with a long name and "Reconnecting"
// =================================================================================================
part('10. the header')
// The header names the character as its player chose it: a long name, as one may be.
const LONG = 'Thorin Oakenshield, Son of Thráin, King under the Mountain'
sql(`update "character" set name = '${LONG}' where id = 'sheet-thorin'`)
await phone.page.reload()
await until(async () => (await phone.page.locator('header h1').first().textContent()) === LONG, 'the long name on the page', 15_000)
await phone.page.route('**/api/characters/*/table**', route => route.abort())
await header(phone).getByText('Reconnecting').waitFor({ timeout: 20_000 })
for (const width of [360, 390, 768, 1280]) {
  await phone.page.setViewportSize({ width, height: width < 1024 ? 844 : 800 })
  phone.width = width
  for (const scheme of ['light', 'dark']) {
    await theme(phone, scheme)
    await wait(300)
    const look = await phone.page.evaluate(() => {
      const head = document.querySelector('header')
      const h1 = head.querySelector('h1')
      const cluster = head.querySelector(':scope > div:last-child')
      // What shows of it: a dialog its Delete opens is in it, unopened.
      const shown = [...cluster.children].filter(el => el.getBoundingClientRect().width > 0)
      const tops = shown.map(el => Math.round(el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2))
      return {
        cut: h1.scrollWidth > h1.clientWidth, ellipsis: getComputedStyle(h1).textOverflow,
        oneLine: tops.every(top => Math.abs(top - tops[0]) <= 2), labels: shown.map(el => el.getAttribute('aria-label') ?? el.textContent.trim()),
        fits: cluster.getBoundingClientRect().right <= document.documentElement.clientWidth,
      }
    })
    const wide = await sideways(phone.page)
    check(wide === 0 && look.ellipsis === 'ellipsis' && look.oneLine && look.fits && /^Reconnecting/.test(look.labels[0])
      && same(look.labels.slice(1, 2), ['Full screen']) && /^Delete /.test(look.labels[2] ?? '') && look.labels.length === 3 && (width >= 768 || look.cut),
      `at ${width} px, ${scheme}: no sideways scroll, the long name ${look.cut ? 'cut short with an ellipsis' : 'whole'}, "Reconnecting" and Full screen on one line, no Party button (${JSON.stringify(look)})`)
    await shoot(phone, 'party-header')
  }
}
await phone.page.unroute('**/api/characters/*/table**')
await phone.page.setViewportSize({ width: 390, height: 844 })
phone.width = 390
await theme(phone, 'light')
sql(`update "character" set name = 'Thorin' where id = 'sheet-thorin'`)
await phone.page.reload()

// =================================================================================================
// 8. Access taken away while the panel is open; the last group deleted
// =================================================================================================
part('11. revoked')
await header(phone).getByText(/^(Live|Offline)/).waitFor({ timeout: 20_000 })
await phone.party('The Iron Company')
panel = panelOf(phone, 'The Iron Company')
await panel.getByRole('heading', { name: /^Members · 3/ }).waitFor({ timeout: 15_000 })
at = Date.now()
await company.update({ ownership: { ...company.ownership, alice: 1 } })
await panel.getByText("This party sheet isn't available").waitFor({ timeout: 15_000 })
check(Date.now() - at < poll + 5000 && await panel.getByText("It's no longer shared with your character in Foundry.").isVisible(),
  `her user made Limited on it in Foundry, the open panel says "This party sheet isn't available" within a poll (${Date.now() - at} ms)`)
check((await call(phone.page, '/api/characters/sheet-thorin/party/company')).status === 404 && (await call(phone.page, `/api/characters/sheet-thorin/party/company/texts/${textHash}`)).status === 404,
  'and every way to it answers 404')
await shootBoth(phone, 'party-revoked', panel)
await panel.getByRole('button', { name: 'Close' }).click()
const PARTY = phone.page.getByRole('tabpanel').getByRole('region', { name: 'Party', exact: true })
await PARTY.waitFor({ timeout: 15_000 })
check(same(await rowNames(phone), ['Wardens of the Vale Primary party']) && await headerParty(phone).count() === 0,
  `her Inventory's list, now "Party", offers the Wardens alone (${JSON.stringify(await rowNames(phone))})`)
actors.delete('wardens')
await Hooks.callAll('deleteActor', wardens, {}, 'gm')
await until(() => postsOf('group.removed').some(p => p.data.id === 'wardens'), 'the Wardens removed')
await until(async () => (await partyList(phone).count()) === 0, 'the Party list to go from Inventory', 15_000)
check(!roster().some(g => g.id === 'wardens') && !groupSheet('wardens') && await headerParty(phone).count() === 0,
  'the Wardens deleted in Foundry, the app drops them, and her Inventory has no Party list, nor her header a button')

await finish()
