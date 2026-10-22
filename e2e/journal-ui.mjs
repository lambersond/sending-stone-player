// The journal as a player finds it in the app (module 0.35.0 and the app, its contract §13.1): its
// card on the Biography tab, the party sheet's Description tab or under why there's no sheet; the
// modal its button opens, with its header, its Contents (a pane, or below 640 px of the modal a
// drawer), and its reader (a note, a group's page, the editor or a Reorder); Move to chapter; and
// Reorder by keys, buttons or a drag. Shared by notes-e2e, partynotes-e2e, notesoffline-e2e and
// notesorder-e2e, so they find the journal one way. Exact names wherever one begins another: New note
// and New note in …, Move to chapter and Move … to a chapter, Contents and Close contents.
import { until, wait } from './world-030.mjs'

export const button = (scope, name) => scope.getByRole('button', { name, exact: true })
const pageOf = scope => ((typeof scope.page === 'function') ? scope.page() : scope)
const quote = text => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A tab's or a panel's Journal card: the region named Journal. */
export const journalCard = scope => scope.getByRole('region', { name: 'Journal', exact: true })
/** The card's line of counts: "No notes yet", "1 chapter · 2 notes · Last changed by …". */
export const cardCounts = card => card.getByText(/^(No notes yet|Loading notes…|Notes couldn’t be loaded|\d+ chapters? · \d+ notes?)/).first()
/** The journal's dialog, named by its title: "My Journal", "Thorin’s Journal". */
export const journalOf = (page, title) => page.getByRole('dialog', { name: title, exact: true })
/** Its header: the journal's own details, whatever the reader shows. */
export const header = dialog => dialog.locator('header')
/** What the header says was just done, or is loading or on its way. */
export const said = dialog => header(dialog).locator('[aria-live="polite"]')
/** The header's "Last changed by …", or null where the journal shows none. */
export async function headerLastChanged(dialog) {
  const line = header(dialog).locator('[title^="The last change to anything in this journal"]')
  return (await line.count()) ? (await line.textContent()).trim() : null
}

/** Until the journal's view is read: the header no longer says it loads. */
export async function loaded(dialog) {
  await until(async () => !/Loading notes…/.test(await header(dialog).textContent()), 'the journal to load', 20_000)
}

/** The card's Open button clicked: the journal's dialog, once open and read. */
export async function openJournal(scope, title) {
  await button(journalCard(scope), `Open ${title}`).click()
  const dialog = journalOf(pageOf(scope), title)
  await dialog.getByRole('heading', { level: 2, name: title, exact: true }).waitFor({ timeout: 15_000 })
  // Its pop as it opens over, so it's measured at its size.
  await dialog.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))))
  await loaded(dialog)
  return dialog
}
/** Closed by its header's Close. */
export async function closeJournal(dialog) {
  await button(header(dialog), 'Close').click()
  await dialog.waitFor({ state: 'hidden', timeout: 10_000 })
}

/** The Contents button, in the reader's bar below 640 px of the modal. */
export const contentsButton = dialog => button(dialog, 'Contents')
/** The nav Contents, the drawer opened by the Contents button first where the modal is under 640 px wide. */
export async function contents(dialog) {
  const nav = dialog.getByRole('navigation', { name: 'Contents', exact: true })
  const open = contentsButton(dialog)
  if (await open.count() && await open.isVisible() && (await open.getAttribute('aria-expanded')) !== 'true') {
    await open.click()
    // Slid in: its left edge at the modal's.
    await until(async () => (await nav.evaluate(el => {
      const pane = el.parentElement.getBoundingClientRect()
      const box = el.closest('dialog').getBoundingClientRect()
      return Math.abs(pane.left - box.left) <= 1.5 && !el.parentElement.closest('[inert]')
    })), 'the contents drawer to open', 5_000)
  }
  return nav
}
/** The contents' own pane: the search, the nav and its footer of New note and New chapter. */
export const contentsPane = dialog => dialog.locator('nav[aria-label="Contents"]').locator('xpath=..')

/** The reader: the pane after the contents, holding a note, a group's page, the editor or a Reorder. */
export const reader = dialog => dialog.locator('[id$="-contents"] + *')
/** The reader's h3: a note's title, a group's, the editor's or Reorder's. */
export const readerTitle = dialog => reader(dialog).getByRole('heading', { level: 3 }).first()
/** Until the reader's h3 says `title`. */
export async function readerShows(dialog, title, ms = 15_000) {
  await until(async () => ((await readerTitle(dialog).count()) && (await readerTitle(dialog).textContent()).trim() === title), `the reader to show "${title}"`, ms)
}
/** A note's lines under its title: [written, last changed]. */
export const noteLines = async dialog => (await reader(dialog).locator('article > h3 + p > span').allTextContents()).map(t => t.trim())
/** A note or group picked in the contents, by its button's name, exact; the reader then shows it. */
export async function pickNote(dialog, title) {
  await button(await contents(dialog), title).click()
  await readerShows(dialog, title)
}
export async function pickGroup(dialog, title) {
  await button(await contents(dialog), title).click()
  await readerShows(dialog, title)
}

/** The contents as listed: each group's title and its notes', in order; read as they are, the drawer left as it is. */
export const listed = async dialog => dialog.locator('nav[aria-label="Contents"]').evaluate(nav => [...nav.children].filter(el => el.tagName === 'DIV').map(group => ({
  group: group.querySelectorAll('button')[1]?.getAttribute('aria-label'),
  notes: [...group.querySelectorAll('ul > li > button')].map(b => b.getAttribute('aria-label')),
})))
/** One group's notes in the contents' order. */
export const notesIn = async (dialog, group) => (await listed(dialog)).find(g => g.group === group)?.notes ?? null
/** A group page's cards, in order, by their titles. */
export const cardsOn = dialog => reader(dialog).locator('article article h4').allTextContents()

/**
 * A note written and saved. `chapter`, a chapter's title: from that chapter's page, its dashed New
 * note in …; null: the contents' New note, put in No chapter; undefined: the contents' New note as it
 * starts (an empty journal's own New note where there are no contents). The editor's footer Save,
 * then until the editor goes.
 */
export async function writeNote(dialog, { title, body = '', chapter } = {}) {
  if (typeof chapter === 'string') {
    await pickGroup(dialog, chapter)
    await button(reader(dialog), `New note in ${chapter}`).click()
  } else if (await dialog.locator('nav[aria-label="Contents"]').count()) {
    await contents(dialog)
    await button(contentsPane(dialog), 'New note').click()
  } else await button(dialog, 'New note').click()
  const form = dialog.getByRole('form', { name: 'New note', exact: true })
  await form.waitFor({ timeout: 10_000 })
  if (chapter === null && await form.locator('select').count()) await form.locator('select').selectOption({ label: 'No chapter' })
  await form.getByLabel('Title', { exact: true }).fill(title)
  if (body) await form.getByLabel('Note', { exact: true }).fill(body)
  await button(form, 'Save').click()
  await form.waitFor({ state: 'detached', timeout: 15_000 })
}
/** A chapter added from the contents' New chapter (or an empty journal's), and saved. */
export async function addChapter(dialog, title) {
  if (await dialog.locator('nav[aria-label="Contents"]').count()) {
    await contents(dialog)
    await button(contentsPane(dialog), 'New chapter').click()
  } else await button(dialog, 'New chapter').click()
  const form = dialog.getByRole('form', { name: 'New chapter', exact: true })
  await form.getByLabel('Chapter title', { exact: true }).fill(title)
  await button(form, 'Save').click()
  await form.waitFor({ state: 'detached', timeout: 15_000 })
}
/** The editor open in the reader, by its heading: "New note", "Edit {title}", "Rename {title}". */
export const editorOf = (dialog, name) => dialog.getByRole('form', { name, exact: true })

/** The Move menu, open. */
export const moveMenu = dialog => pageOf(dialog).getByRole('menu', { name: 'Move to', exact: true })
/** A note moved to a chapter (or `null`, none) by its bar's Move menu, the note opened first. */
export async function moveTo(dialog, title, chapter) {
  if ((await readerTitle(dialog).textContent()).trim() !== title) await pickNote(dialog, title)
  await button(reader(dialog), `Move ${title} to a chapter`).click()
  const menu = moveMenu(dialog)
  await menu.waitFor({ timeout: 5_000 })
  await menu.getByRole('menuitemradio', { name: chapter ?? 'No chapter', exact: true }).click()
  await menu.waitFor({ state: 'hidden', timeout: 5_000 })
}
/** A loose note's card on the Not in a chapter page. */
export const cardOf = (dialog, title) => reader(dialog).locator('article article').filter({ has: pageOf(dialog).getByRole('heading', { level: 4, name: title, exact: true }) })
/** A note moved from its card's Move to chapter, on the Not in a chapter page. */
export async function moveCard(dialog, title, chapter) {
  await button(cardOf(dialog, title), 'Move to chapter').click()
  const menu = moveMenu(dialog)
  await menu.waitFor({ timeout: 5_000 })
  await menu.getByRole('menuitemradio', { name: chapter ?? 'No chapter', exact: true }).click()
  await menu.waitFor({ state: 'hidden', timeout: 5_000 })
}

/** A row's grip in Reorder, by the note's title. */
export const gripOf = (dialog, title) => button(reader(dialog), `Reorder ${title}: drag it, or press the up and down arrows`)
/** Reorder's list as it stands, by the grips' names. */
export const reorderList = async dialog => (await reader(dialog).getByRole('button', { name: /^Reorder .*: drag it, or press the up and down arrows$/ }).evaluateAll(grips => grips.map(g => g.getAttribute('aria-label'))))
  .map(name => name.replace(/^Reorder /, '').replace(/: drag it, or press the up and down arrows$/, ''))
/** What Reorder's live region last said. */
export const announced = dialog => reader(dialog).locator('p[aria-live="polite"][aria-atomic="true"]')
/** A group's Reorder opened from its page. */
export async function openReorder(dialog, group) {
  await pickGroup(dialog, group)
  await button(reader(dialog), 'Reorder').click()
  await readerShows(dialog, `Reorder ${group}`)
}
/** A row dragged with the mouse by its grip, from where it is to `to` (from 0), and let go. */
export async function dragRow(dialog, title, to, { steps = 12 } = {}) {
  const page = pageOf(dialog)
  const grip = gripOf(dialog, title)
  await grip.scrollIntoViewIfNeeded()
  const from = await grip.boundingBox()
  const order = await reorderList(dialog)
  const at = order.indexOf(title)
  const target = await gripOf(dialog, order[to]).boundingBox()
  // Past the target row's middle, toward where it goes.
  const y = target.y + target.height / 2 + (to < at ? -target.height * 0.3 : target.height * 0.3)
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2, y, { steps })
  await wait(250)
  await page.mouse.up()
}
/**
 * A group put in `titles`' order: Reorder from its page (unless it's open), then each note brought to its place by its
 * grip's Up key, its Move … up button, or a mouse drag of its grip (`by`); then Save order, unless
 * `save` is false. Returns the alert Save met, or null once Reorder closed.
 */
export async function reorder(dialog, group, titles, { by = 'keys', save = true } = {}) {
  // Already open, as one opened before something changed meanwhile, it's kept as it is.
  if ((await readerTitle(dialog).textContent().catch(() => '')).trim() !== `Reorder ${group}`) await openReorder(dialog, group)
  for (const [place, title] of titles.entries()) {
    const at = (await reorderList(dialog)).indexOf(title)
    if (at < 0) throw new Error(`"${title}" isn't in ${group}'s Reorder (${JSON.stringify(await reorderList(dialog))})`)
    if (at === place) continue
    if (by === 'keys') {
      await gripOf(dialog, title).focus()
      for (let n = at; n > place; n -= 1) await pageOf(dialog).keyboard.press('ArrowUp')
    } else if (by === 'buttons') {
      for (let n = at; n > place; n -= 1) await button(reader(dialog), `Move ${title} up`).click()
    } else await dragRow(dialog, title, place)
    await until(async () => (await reorderList(dialog)).indexOf(title) === place, `"${title}" moved to ${place + 1}`, 5_000)
  }
  if (!save) return null
  return saveOrder(dialog)
}
/** Save order: null once Reorder closed, else the alert it met. */
export async function saveOrder(dialog) {
  await button(reader(dialog), 'Save order').click()
  const alert = reader(dialog).getByRole('alert')
  let result
  await until(async () => {
    if (await alert.count()) result = (await alert.textContent()).trim()
    else if (!/^Reorder /.test((await readerTitle(dialog).textContent().catch(() => '')).trim())) result = null
    return result !== undefined
  }, 'Save order answered', 15_000)
  return result
}
/** Where an element is on screen, and the viewport. */
export const boxOf = locator => locator.evaluate(el => {
  const b = el.getBoundingClientRect()
  return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height, vw: document.documentElement.clientWidth, vh: innerHeight }
})
/** How far a box scrolls sideways inside itself: 0 when it doesn't. */
export const scrollsSideways = locator => locator.evaluate(el => el.scrollWidth - el.clientWidth)
export { quote }
