import { Prisma, type JournalTidyEntry } from '@prisma/client'
import prisma from '@/clients/prisma'
import { noteHtml } from '@/lib/note-html'
import { listedIn } from '@/utils/roster'
import type { JournalDrawings, Tx } from './types'
import type { JournalTidy, TidyPage } from '@/types/sending-stone'

// Tidy 5e Sheets' journal (module 0.45.0): what a character's players keep on its Journal tab in
// Tidy, as the module sends it, whole, in `journal.tidy`; kept here beside the character's personal
// book, read only, never written back. Tidy keeps no dates, so the app keeps two of its own: when
// it first heard of each entry, and when its revision last changed. Entries there before the app
// knows the character's Tidy journal, by the first sent of it, are undated, as they were written
// before the app could see them; a hello that says the character holds none makes it known, empty.

/** An entry's key among its book's Tidy entries: where Tidy keeps it, and its key there. */
function keyOf(entry: { from: string; id: string }): string {
  return `${entry.from}:${entry.id}`
}

/** A held entry's key, as `keyOf` names a sent one. */
function heldKey(entry: Pick<JournalTidyEntry, 'source' | 'entryId'>) {
  return keyOf({ from: entry.source, id: entry.entryId })
}

/** An entry as drawn here: Foundry's HTML enriched and made safe, its secrets kept. */
function drawn(page: TidyPage, origin: string): string {
  return noteHtml({ format: 1, body: page.html }, origin, true)
}

/** A journal.tidy's entries, each once, the first of any sent twice. */
function sentOnce(event: JournalTidy): TidyPage[] {
  const seen = new Set<string>()
  return event.entries.filter(page => {
    const key = keyOf(page)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Draw a `journal.tidy`'s entries ahead, before the transaction that keeps them, as a journal's
 * notes are: hundreds of long entries take longer to draw than a transaction may stay open. Each is
 * drawn every time, as a journal's Foundry HTML is: only its drawing is kept, which the campaign's
 * origin, moved since, may change.
 * @returns Undefined where nothing is to be drawn.
 */
export async function drawTidy(
  campaignId: string,
  event: JournalTidy,
): Promise<JournalDrawings | undefined> {
  if (event.withheld || event.entries.length === 0) return
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { origin: true },
  })
  if (!campaign) return
  const html = new Map(
    sentOnce(event).map(page => [keyOf(page), drawn(page, campaign.origin)]),
  )
  return { origin: campaign.origin, html }
}

/** An entry as the book keeps it, but for how it's drawn and its dates. */
function fieldsOf(page: TidyPage) {
  return {
    title: page.title,
    sort: page.sort,
    cut: page.cut === true,
    secret: page.secret === true,
    revision: page.rev,
  }
}

/**
 * A character's Tidy journal as Foundry holds it now, from module 0.45.0's `journal.tidy`, kept on
 * its personal book: held back, which keeps the entries as they were; or its entries, which the
 * book's become, those gone deleted, each new one dated when first seen, each whose revision moved
 * dated as changed. The book's version moves only where something did. A character the campaign
 * doesn't have is ignored.
 * @param drawings - Its entries drawn ahead, outside the transaction (`drawTidy`).
 */
export async function applyJournalTidy(
  tx: Tx,
  campaignId: string,
  event: JournalTidy,
  drawings?: JournalDrawings,
): Promise<void> {
  const campaign = await tx.campaign.findUnique({
    where: { id: campaignId },
    select: { origin: true, characters: true, groups: true },
  })
  const book = { kind: 'personal' as const, actorId: event.actorId }
  if (!campaign || !listedIn(campaign, book)) return

  const held = await tx.journalBook.upsert({
    where: { campaignBook: { campaignId, ...book } },
    create: { campaignId, ...book },
    update: {},
    select: { id: true, tidySyncedAt: true, tidyWithheld: true, tidy: true },
  })
  const now = new Date()

  if (event.withheld) {
    const changed =
      JSON.stringify(held.tidyWithheld) !== JSON.stringify(event.withheld)
    if (changed) {
      await tx.journalBook.update({
        where: { id: held.id },
        data: {
          tidyWithheld: event.withheld as Prisma.InputJsonObject,
          version: { increment: 1 },
        },
      })
    }
    return
  }

  const ahead = drawings?.origin === campaign.origin ? drawings.html : undefined
  const draw = (page: TidyPage) =>
    ahead?.get(keyOf(page)) ?? drawn(page, campaign.origin)
  // Until the app knows the journal, sent it or told it holds none, what it holds was there before
  // the app could see it.
  const firstSeenAt = held.tidySyncedAt ? now : null
  let changed = await mirrorTidy(tx, held, sentOnce(event), {
    draw,
    now,
    firstSeenAt,
  })
  changed ||= held.tidyWithheld !== null
  await tx.journalBook.update({
    where: { id: held.id },
    data: {
      tidySyncedAt: now,
      tidyWithheld: Prisma.DbNull,
      ...(changed && { version: { increment: 1 } }),
    },
  })
}

/**
 * A book's Tidy entries made those sent: those gone deleted, each changed written again, its
 * drawing among what may change, and new ones made in one go.
 * @returns Whether any entry changed.
 */
async function mirrorTidy(
  tx: Tx,
  book: { id: string; tidy: JournalTidyEntry[] },
  pages: TidyPage[],
  {
    draw,
    now,
    firstSeenAt,
  }: {
    draw: (page: TidyPage) => string
    now: Date
    firstSeenAt: Date | null
  },
): Promise<boolean> {
  let changed = false
  const held = new Map(book.tidy.map(entry => [heldKey(entry), entry]))
  const sent = new Set(pages.map(page => keyOf(page)))
  const gone = book.tidy.filter(entry => !sent.has(heldKey(entry)))
  if (gone.length > 0) {
    changed = true
    await tx.journalTidyEntry.deleteMany({
      where: {
        bookId: book.id,
        OR: gone.map(({ source, entryId }) => ({ source, entryId })),
      },
    })
  }
  const made: Prisma.JournalTidyEntryCreateManyInput[] = []
  for (const page of pages) {
    const before = held.get(keyOf(page))
    const fields = fieldsOf(page)
    if (!before) {
      made.push({
        bookId: book.id,
        source: page.from,
        entryId: page.id,
        ...fields,
        html: draw(page),
        firstSeenAt,
      })
      continue
    }
    const html = draw(page)
    const differs =
      html !== before.html ||
      (Object.keys(fields) as (keyof typeof fields)[]).some(
        key => fields[key] !== before[key],
      )
    if (!differs) continue
    changed = true
    await tx.journalTidyEntry.update({
      where: {
        bookEntry: {
          bookId: book.id,
          source: page.from,
          entryId: page.id,
        },
      },
      data: {
        ...fields,
        html,
        // Only a change in Foundry moves its revision: never what's sent of it changing with the
        // character's owners.
        ...(before.revision !== page.rev && { changedAt: now }),
      },
    })
  }
  if (made.length > 0) {
    changed = true
    await tx.journalTidyEntry.createMany({ data: made })
  }
  return changed
}

/**
 * On each hello (module 0.45.0): the Tidy entries of every character the hello's
 * `features.notes.tidy` doesn't list as holding some go, as do those of every character where it
 * says nothing of Tidy, as a module before 0.45.0, which never sends them. Only the app's copy
 * goes: a character that has entries after all sends them in the `journal.tidy` that follows.
 *
 * And what the app knows of each journal, which its entries' dates rest on: a character the hello
 * doesn't list holds none, so each entry it's sent later is new, and dated, as its first, written
 * while no Gamemaster was in Foundry, is when the next hello brings it. Where the hello says
 * nothing of Tidy, the app knows none: once a module says again, what it sends is as new as at
 * first, and undated, never dated by when it came back.
 * @param characters - The hello's characters, by their actors' ids.
 * @param actors - Those it lists as holding Tidy entries; none where it says nothing of Tidy.
 */
export async function reconcileTidy(
  tx: Tx,
  campaignId: string,
  characters: string[],
  actors: string[] | undefined,
): Promise<void> {
  const unlisted = {
    campaignId,
    kind: 'personal' as const,
    actorId: { notIn: actors ?? [] },
  }
  // Each such book holding any is new: its entries are gone, and what was held back with them.
  await tx.journalBook.updateMany({
    where: {
      ...unlisted,
      OR: [{ tidy: { some: {} } }, { tidyWithheld: { not: Prisma.DbNull } }],
    },
    data: { tidyWithheld: Prisma.DbNull, version: { increment: 1 } },
  })
  await tx.journalTidyEntry.deleteMany({ where: { book: unlisted } })
  if (!actors) {
    await tx.journalBook.updateMany({
      where: { campaignId, tidySyncedAt: { not: null } },
      data: { tidySyncedAt: null },
    })
    return
  }
  const empty = characters.filter(actorId => !actors.includes(actorId))
  if (empty.length === 0) return
  const now = new Date()
  // A book made for it shows nothing until a journal or an entry comes.
  await tx.journalBook.createMany({
    data: empty.map(actorId => ({
      campaignId,
      kind: 'personal' as const,
      actorId,
      tidySyncedAt: now,
    })),
    skipDuplicates: true,
  })
  await tx.journalBook.updateMany({
    where: {
      campaignId,
      kind: 'personal',
      actorId: { in: empty },
      tidySyncedAt: null,
    },
    data: { tidySyncedAt: now },
  })
}
