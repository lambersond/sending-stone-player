// A very long name (item 17), end to end, in the world of world-030.mjs, at 360, 390, 768, 1024 and
// 1280 px in the light theme, where the layout suite's stand-in world has none of it: a party's and a
// character's names as long as one at the table. Alice runs the campaign and plays Thorin; Seraphina
// Nightingale-Ashworth of the Ever-Burning Lighthouse is Bob's, and both are members of The Sworn
// Keepers of the Ever-Burning Lighthouse of Saint Aldric, which holds coin, moves on. In Give coins'
// To and Distribute coins' Among each long name wraps, whole, inside the dialog, which never scrolls
// sideways, nor does the page itself. Synthetic characters only. Run with --import
// ./fvtt/unref-timers.mjs --import ./fvtt/dnd5e-register.mjs. Screenshots to SHOTS.
import {
  browse, character, check, embedded, finish, foundryWorld, group, launch, newCampaign, settled, shoot, sql, startModule,
} from './world-030.mjs'

const GAME = 'https://lighthouse.forge-vtt.com'
const SECRET = 'lighthouse-names-17'
const TITLE = 'Ever-Burning'
const LONG = 'Seraphina Nightingale-Ashworth of the Ever-Burning Lighthouse'
const PARTY = 'The Sworn Keepers of the Ever-Burning Lighthouse of Saint Aldric'

await launch(GAME)
const { id: A } = await newCampaign({ title: TITLE, address: 'lighthouse.forge-vtt.com', secret: SECRET })
await foundryWorld()
const thorin = character({ id: 'thorin', name: 'Thorin', owners: ['alice'], hp: { value: 30, max: 38, temp: 0 } }, { ac: 16, items: [] })
thorin.system.details = { level: 5 }
const sera = character({ id: 'sera', name: LONG, owners: ['bob'], hp: { value: 30, max: 38, temp: 0 } }, { ac: 15, items: [] })
sera.system.details = { level: 5 }
game.users.get('alice').character = thorin
embedded(thorin, { currency: { gp: 40 } })
embedded(sera, {})
const keepers = group('keepers', PARTY, { members: [thorin, sera], ownership: { alice: 3 }, currency: { gp: 103 } })
embedded(keepers, {})
await startModule({
  campaigns: [{ id: 'ever', title: TITLE, characters: ['thorin', 'sera'], groups: ['keepers'], rolls: false, transfers: true }],
  secrets: { ever: SECRET },
})
await settled()
sql(`insert into "character" (id, name, "gameUrl", "campaignTitle", "campaignId", "actorId", "userId", "updatedAt")
  values ('sheet-thorin', 'Thorin', '${GAME}', '${TITLE}', '${A}', 'thorin', 'e2e-user', now())`)

/** How far the page itself scrolls sideways. */
const pageX = page => page.evaluate(() => document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth)
/**
 * In a dialog: how far its content scrolls sideways, and each long name in it, cut short or past
 * the content's edge.
 */
const dialogRoom = dialog => dialog.evaluate((d, names) => {
  const body = d.querySelector(':scope > .overflow-y-auto')
  const edge = body.getBoundingClientRect().right
  const shown = [...body.querySelectorAll('span')].filter(span => span.childElementCount === 0 && names.includes(span.textContent))
  return {
    scrollX: body.scrollWidth - body.clientWidth, names: shown.length,
    cut: shown.filter(span => span.scrollWidth > span.clientWidth || span.getBoundingClientRect().right > edge + 0.5).length,
  }
}, [LONG, PARTY])

const seen = {}
for (const width of [360, 390, 768, 1024, 1280]) {
  const alice = await browse({ width, height: width < 768 ? 844 : 900, path: '/characters/sheet-thorin', toasts: false })
  const { page } = alice
  await page.getByRole('tablist', { name: 'Character sheet' }).waitFor({ timeout: 30_000 })
  const r = seen[width] = {}
  await alice.tab('Inventory')
  const sheet = page.getByRole('tabpanel').first()
  await alice.currency(sheet).getByRole('button', { name: 'Send to', exact: true }).click()
  const give = page.getByRole('dialog', { name: 'Give coins' })
  await give.getByRole('radio', { name: LONG }).waitFor()
  r.give = { ...await dialogRoom(give), pageX: await pageX(page) }
  await shoot(alice, 'names-give', give)
  await give.getByRole('button', { name: 'Cancel' }).click()
  await give.waitFor({ state: 'hidden' })

  await alice.party(PARTY)
  const panel = page.getByRole('dialog', { name: PARTY })
  await panel.getByRole('tab', { name: 'Inventory' }).click()
  await alice.currency(panel).getByRole('button', { name: 'Distribute', exact: true }).click()
  const distribute = page.getByRole('dialog', { name: 'Distribute coins' })
  await distribute.getByRole('list', { name: 'Among' }).waitFor()
  r.distribute = { ...await dialogRoom(distribute), pageX: await pageX(page) }
  await shoot(alice, 'names-distribute', distribute)
  await alice.view.close()
}
console.log(JSON.stringify(seen, null, 1))
for (const [width, { give, distribute }] of Object.entries(seen)) {
  check(give.names === 2 && give.cut === 0 && give.scrollX === 0 && give.pageX === 0,
    `${width}: in Give coins' To the long names wrap, whole, inside the dialog, which doesn't scroll sideways (${JSON.stringify(give)})`)
  check(distribute.names === 1 && distribute.cut === 0 && distribute.scrollX === 0 && distribute.pageX === 0,
    `${width}: in Distribute coins' Among the long name wraps, whole, inside the dialog, which doesn't scroll sideways (${JSON.stringify(distribute)})`)
}
await finish()
