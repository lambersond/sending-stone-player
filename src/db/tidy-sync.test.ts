/**
 * @jest-environment node
 */
import { Prisma, type JournalTidyEntry } from '@prisma/client'
import { applyJournalTidy, drawTidy, reconcileTidy } from './tidy-sync'
import { mockJournalTidy, PARTY } from '@/mocks/sending-stone'
import { prismaMock } from '@/utils/test-utils-node'
import type { TidyPage } from '@/types/sending-stone'

const NOW = Date.parse('2026-11-10T12:00:00Z')
const SYNCED = new Date(NOW - 86_400_000)
const ORIGIN = 'https://my-game.forge-vtt.com'
const tx = prismaMock as unknown as Prisma.TransactionClient

/** An entry sent as the book holds it, drawn as `html` says. */
function held(page: TidyPage, html = 'drawn'): JournalTidyEntry {
  return {
    bookId: 'book-1',
    source: page.from,
    entryId: page.id,
    title: page.title,
    html,
    sort: page.sort,
    cut: page.cut === true,
    secret: page.secret === true,
    revision: page.rev,
    firstSeenAt: null,
    changedAt: null,
  }
}

/** Thorin's book, last sent a Tidy journal `tidySyncedAt` (none: never), holding `tidy`. */
function heldBook(
  tidy: JournalTidyEntry[] = [],
  fields: { tidySyncedAt?: Date | null; tidyWithheld?: unknown } = {},
) {
  prismaMock.journalBook.upsert.mockResolvedValue({
    id: 'book-1',
    tidySyncedAt: SYNCED,
    tidyWithheld: null,
    tidy,
    ...fields,
  } as any)
}

const made = () =>
  prismaMock.journalTidyEntry.createMany.mock.calls[0]?.[0]
    ?.data as Prisma.JournalTidyEntryCreateManyInput[]
const bookData = () => prismaMock.journalBook.update.mock.calls.at(-1)?.[0].data

describe('db/tidy-sync', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    prismaMock.campaign.findUnique.mockResolvedValue({
      origin: ORIGIN,
      characters: [{ id: PARTY.thorin }, { id: PARTY.vex }],
      groups: [{ id: 'company' }],
    } as any)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('applyJournalTidy', () => {
    it('keeps the first journal’s entries undated, in one go, each drawn with its links as Foundry’s HTML is', async () => {
      heldBook([], { tidySyncedAt: null })

      await applyJournalTidy(tx, 'c1', mockJournalTidy())

      expect(prismaMock.journalBook.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaignBook: {
              campaignId: 'c1',
              kind: 'personal',
              actorId: PARTY.thorin,
            },
          },
          create: { campaignId: 'c1', kind: 'personal', actorId: PARTY.thorin },
        }),
      )
      expect(prismaMock.journalTidyEntry.createMany).toHaveBeenCalledTimes(1)
      expect(made()).toHaveLength(5)
      expect(made()[0]).toEqual({
        bookId: 'book-1',
        source: 'journal',
        entryId: 'tidyRavenhill01',
        title: 'Ravenhill',
        html: '<p>The ravens speak of <strong>the old watch</strong>.</p>',
        sort: 1,
        cut: false,
        secret: false,
        revision: '00000000000029',
        firstSeenAt: null,
      })
      expect(made()[2]).toMatchObject({ secret: true })
      expect(made()[3]).toMatchObject({ source: 'classic', entryId: 'notes3' })
      expect(bookData()).toEqual({
        tidySyncedAt: new Date(NOW),
        tidyWithheld: Prisma.DbNull,
        version: { increment: 1 },
      })
    })

    it('dates an entry new since the book was first sent by now, and one whose revision moved as changed', async () => {
      const [ravenhill, untitled, ...rest] = mockJournalTidy().entries
      heldBook([held(ravenhill), ...rest.map(page => held(page))])
      const edited = {
        ...ravenhill,
        html: '<p>Gone quiet.</p>',
        rev: 'abcdef01234567',
      }

      await applyJournalTidy(
        tx,
        'c1',
        mockJournalTidy({ entries: [edited, untitled, ...rest] }),
      )

      expect(made()).toEqual([
        expect.objectContaining({
          entryId: untitled.id,
          firstSeenAt: new Date(NOW),
        }),
      ])
      expect(prismaMock.journalTidyEntry.update).toHaveBeenCalledTimes(1)
      expect(prismaMock.journalTidyEntry.update).toHaveBeenCalledWith({
        where: {
          bookId_source_entryId: {
            bookId: 'book-1',
            source: 'journal',
            entryId: ravenhill.id,
          },
        },
        data: {
          title: 'Ravenhill',
          sort: 1,
          cut: false,
          secret: false,
          revision: 'abcdef01234567',
          html: '<p>Gone quiet.</p>',
          changedAt: new Date(NOW),
        },
      })
    })

    it('draws an entry again when its secrets come or go, never dating it as changed', async () => {
      const entries = mockJournalTidy().entries
      heldBook(entries.map(page => held(page)))
      const shown = {
        ...entries[2],
        html: '<p>He is not what he seems.</p><section class="secret"><p>A spy.</p></section>',
      }
      delete shown.secret

      await applyJournalTidy(
        tx,
        'c1',
        mockJournalTidy({
          entries: entries.map((page, at) => (at === 2 ? shown : page)),
        }),
      )

      const { data } = prismaMock.journalTidyEntry.update.mock.calls[0][0]
      expect(data).toEqual(
        expect.objectContaining({
          secret: false,
          html: '<p>He is not what he seems.</p><section class="secret"><p>A spy.</p></section>',
        }),
      )
      expect(data).not.toHaveProperty('changedAt')
      expect(prismaMock.journalTidyEntry.update).toHaveBeenCalledTimes(1)
    })

    it('deletes the entries no longer sent, a Classic box among them, and keeps those unchanged untouched', async () => {
      const entries = mockJournalTidy().entries
      heldBook(entries.map(page => held(page)))

      await applyJournalTidy(
        tx,
        'c1',
        mockJournalTidy({ entries: entries.slice(1, 3) }),
      )

      expect(prismaMock.journalTidyEntry.deleteMany).toHaveBeenCalledWith({
        where: {
          bookId: 'book-1',
          OR: [
            { source: 'journal', entryId: 'tidyRavenhill01' },
            { source: 'classic', entryId: 'notes3' },
            { source: 'classic', entryId: 'notes' },
          ],
        },
      })
      expect(prismaMock.journalTidyEntry.update).not.toHaveBeenCalled()
      expect(prismaMock.journalTidyEntry.createMany).not.toHaveBeenCalled()
      expect(bookData()).toMatchObject({ version: { increment: 1 } })
    })

    it('empties the book’s entries for none, and bumps nothing where nothing changed', async () => {
      const entries = mockJournalTidy().entries
      heldBook(entries.map(page => held(page)))
      await applyJournalTidy(tx, 'c1', mockJournalTidy())
      expect(bookData()).not.toHaveProperty('version')

      heldBook(entries.map(page => held(page)))
      await applyJournalTidy(tx, 'c1', mockJournalTidy({ entries: [] }))
      expect(prismaMock.journalTidyEntry.deleteMany).toHaveBeenCalledTimes(1)
      expect(bookData()).toMatchObject({ version: { increment: 1 } })
    })

    it('keeps the entries of a journal held back as too large, saying so once', async () => {
      const withheld = {
        reason: 'tooLarge' as const,
        bytes: 5_000_000,
        limit: 4_000_000,
      }
      heldBook(mockJournalTidy().entries.map(page => held(page)))

      await applyJournalTidy(
        tx,
        'c1',
        mockJournalTidy({ entries: [], withheld }),
      )

      expect(prismaMock.journalTidyEntry.deleteMany).not.toHaveBeenCalled()
      expect(prismaMock.journalBook.update).toHaveBeenCalledWith({
        where: { id: 'book-1' },
        data: { tidyWithheld: withheld, version: { increment: 1 } },
      })

      prismaMock.journalBook.update.mockClear()
      heldBook([], { tidyWithheld: withheld })
      await applyJournalTidy(
        tx,
        'c1',
        mockJournalTidy({ entries: [], withheld }),
      )
      expect(prismaMock.journalBook.update).not.toHaveBeenCalled()
    })

    it.each([
      ['a character the campaign doesn’t have', 'balin'],
      ['one of its groups', 'company'],
    ])('ignores the journal of %s', async (_name, actorId) => {
      await applyJournalTidy(tx, 'c1', mockJournalTidy({ actorId }))

      expect(prismaMock.journalBook.upsert).not.toHaveBeenCalled()
    })

    it('keeps the entries drawn ahead, drawing in the transaction only what wasn’t', async () => {
      heldBook([], { tidySyncedAt: null })
      const [first, ...rest] = mockJournalTidy().entries
      const html = new Map([[`journal:${first.id}`, 'drawn ahead']])

      await applyJournalTidy(tx, 'c1', mockJournalTidy(), {
        origin: ORIGIN,
        html,
      })

      expect(made()[0].html).toBe('drawn ahead')
      expect(made()[1].html).toBe('<p>Ask Balin about the map.</p>')
      expect(made()).toHaveLength(rest.length + 1)
    })
  })

  describe('drawTidy, before the transaction', () => {
    it('draws what the book as it is would draw again: new entries and changed ones', async () => {
      const entries = mockJournalTidy().entries
      prismaMock.journalBook.findUnique.mockResolvedValue({
        tidy: [
          held(entries[0]),
          { ...held(entries[1]), revision: 'ffffffffffffff' },
        ],
      } as any)

      const drawings = await drawTidy('c1', mockJournalTidy())

      expect(drawings?.origin).toBe(ORIGIN)
      expect([...drawings!.html.keys()]).toEqual([
        'journal:tidyUntitled002',
        'journal:tidySecrets0003',
        'classic:notes3',
        'classic:notes',
      ])
    })

    it('draws nothing for a journal held back, or with no entries', async () => {
      const withheld = { reason: 'tooLarge' as const, bytes: 1, limit: 0 }
      await expect(
        drawTidy('c1', mockJournalTidy({ entries: [], withheld })),
      ).resolves.toBeUndefined()
      await expect(
        drawTidy('c1', mockJournalTidy({ entries: [] })),
      ).resolves.toBeUndefined()
      expect(prismaMock.journalBook.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('reconcileTidy, on each hello', () => {
    it('empties the Tidy entries of every character the hello doesn’t list as holding some', async () => {
      await reconcileTidy(tx, 'c1', [PARTY.thorin])

      const unlisted = {
        campaignId: 'c1',
        kind: 'personal',
        actorId: { notIn: [PARTY.thorin] },
      }
      expect(prismaMock.journalBook.updateMany).toHaveBeenCalledWith({
        where: {
          ...unlisted,
          OR: [
            { tidy: { some: {} } },
            { tidyWithheld: { not: Prisma.DbNull } },
          ],
        },
        data: { tidyWithheld: Prisma.DbNull, version: { increment: 1 } },
      })
      expect(prismaMock.journalTidyEntry.deleteMany).toHaveBeenCalledWith({
        where: { book: unlisted },
      })
    })
  })
})
