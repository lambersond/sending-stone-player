/* eslint-disable unicorn/no-null -- a note in no chapter has null for it, as the API has */
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JournalCard } from './journal-card'
import { forgetNotes, journalOpen, useNotes } from '@/hooks/use-notes'
import {
  emptyBook,
  noteChapter,
  noteEntry,
  serveNotes,
} from '@/mocks/notes-server'
import type { NotesView } from '@/types/notes'

const API = '/api/characters/char-1'
const PARTY_API = '/api/characters/char-1/party/company'

type Props = Parameters<typeof JournalCard>[0]

const renderCard = (props: Partial<Props> = {}) =>
  render(
    <JournalCard
      api={API}
      role='player'
      kind='personal'
      name='Thorin'
      active
      look='sheet'
      {...props}
    />,
  )

const card = () => screen.getByRole('region', { name: 'Journal' })
const ready = (name = 'Open My Journal') =>
  screen.findByRole('button', { name })

/** Thorin's book: two chapters, three notes. */
const book = (fields: Partial<NotesView> = {}) =>
  emptyBook({
    chapters: [
      noteChapter(),
      noteChapter({ id: 'secondChapter001', title: 'Session 2' }),
    ],
    entries: [
      noteEntry(),
      noteEntry({ id: 'wolvesNote000001', title: 'Wolves' }),
      noteEntry({
        id: 'trollsNote000001',
        title: 'Trolls',
        chapterId: 'sessionChapter01',
      }),
    ],
    ...fields,
  })

/** A draft in the store, as one left open in the journal. */
const draft = (fields: Record<string, unknown>) => {
  const { result } = renderHook(() => useNotes(API, { active: false }))
  act(() =>
    result.current.setDraft({
      key: 'new',
      role: 'entry',
      title: '',
      body: '',
      chapterId: null,
      started: { title: '', body: '', chapterId: null },
      opener: 'new',
      ...fields,
    }),
  )
}

describe('components/notes/journal-card', () => {
  beforeEach(() => {
    forgetNotes()
  })

  afterEach(() => {
    act(() => forgetNotes())
  })

  it.each([
    ['sheet', ['text-xs', 'uppercase', 'text-text-secondary']],
    ['party', ['text-sm', 'font-semibold']],
  ] as const)(
    'heads itself Journal, an h2, as the %s draws its headings',
    async (look, classes) => {
      serveNotes({ [API]: book() })
      renderCard({ look })
      await ready()
      const heading = within(card()).getByRole('heading', { level: 2 })
      expect(heading).toHaveTextContent('Journal')
      expect(heading).toHaveClass(...classes)
    },
  )

  it.each([
    [
      'a player’s own',
      {},
      'My Journal',
      'Only you and your Gamemaster see these.',
    ],
    [
      'the Gamemaster’s view of a character’s',
      { role: 'gm' as const },
      'Thorin’s Journal',
      'Only Thorin’s player and you see these.',
    ],
    [
      'a party’s',
      {
        api: PARTY_API,
        kind: 'party' as const,
        name: 'The Iron Company',
        look: 'party' as const,
      },
      'The Iron Company’s Journal',
      'Everyone in The Iron Company sees these, here and in Foundry.',
    ],
  ])('names %s journal, and who sees it', async (_, props, title, who) => {
    serveNotes({ [(props as Partial<Props>).api ?? API]: book() })
    renderCard(props)
    expect(await ready(`Open ${title}`)).toBeInTheDocument()
    expect(within(card()).getByText(title)).toHaveClass('font-semibold')
    expect(within(card()).getByText(who)).toBeInTheDocument()
  })

  it('says it’s loading before the book comes', () => {
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
    renderCard()
    expect(within(card()).getByText('Loading notes…')).toBeInTheDocument()
  })

  it('says so while the book can’t be read', async () => {
    globalThis.fetch = jest.fn(() => Promise.reject(new TypeError('offline')))
    renderCard()
    expect(
      await within(card()).findByText(
        'Notes couldn’t be loaded. Trying again…',
      ),
    ).toBeInTheDocument()
  })

  it('says a book with nothing in it has no notes yet', async () => {
    serveNotes({ [API]: emptyBook() })
    renderCard()
    expect(await within(card()).findByText('No notes yet')).toBeInTheDocument()
  })

  it.each([
    [book(), '2 chapters · 3 notes'],
    [
      book({ chapters: [noteChapter()], entries: [noteEntry()] }),
      '1 chapter · 1 note',
    ],
    [book({ chapters: [] }), '0 chapters · 3 notes'],
  ])('counts what it holds: %#', async (view, words) => {
    serveNotes({ [API]: view })
    renderCard()
    expect(await within(card()).findByText(words)).toBeInTheDocument()
  })

  it('says who changed it last, and when, where it has been', async () => {
    serveNotes({
      [API]: book({
        lastChange: { by: 'Gamemaster', at: new Date().toISOString() },
      }),
    })
    renderCard()
    const line = await within(card()).findByText(/2 chapters · 3 notes/)
    expect(line).toHaveTextContent(
      '2 chapters · 3 notes · Last changed by Gamemaster, just now',
    )
  })

  describe('what’s not saved yet', () => {
    it.each([
      ['its title, trimmed', { title: '  Wolves  ' }, 'Unsaved: Wolves'],
      ['a new note with none', {}, 'Unsaved: new note'],
      [
        'a new chapter with none',
        { key: 'new-chapter', role: 'chapter' },
        'Unsaved: new chapter',
      ],
    ])('names a draft by %s', async (_, fields, words) => {
      serveNotes({ [API]: book() })
      draft(fields)
      renderCard()
      await ready()
      expect(within(card()).getByText(words)).toBeInTheDocument()
    })

    it('says nothing where nothing is being written', async () => {
      serveNotes({ [API]: book() })
      renderCard()
      await ready()
      expect(within(card()).queryByText(/^Unsaved/)).toBeNull()
    })
  })

  it.each([
    [
      'one thing',
      book({
        entries: [noteEntry({ state: 'conflict' }), noteEntry({ id: 'b' })],
      }),
      '1 needs a choice',
    ],
    [
      'notes, chapters and orders in conflict, gone or failed, and never a delete waiting',
      book({
        chapters: [noteChapter({ state: 'failed' })],
        entries: [
          noteEntry({ state: 'conflict' }),
          noteEntry({ id: 'goneNote00000001', state: 'gone' }),
          noteEntry({ id: 'failedNote000001', state: 'failed' }),
          noteEntry({ id: 'deletingNote0001', state: 'deleting' }),
          noteEntry({ id: 'waitingNote00001', state: 'waiting' }),
        ],
        groups: [
          { chapterId: null, state: 'conflict', stamp: 'g:1' },
          { chapterId: 'sessionChapter01', state: 'failed', stamp: 'g:2' },
          { chapterId: 'secondChapter001', state: 'waiting', stamp: 'g:3' },
        ],
      }),
      '6 need a choice',
    ],
  ])('counts what waits on a choice: %s', async (_, view, words) => {
    serveNotes({ [API]: view })
    renderCard()
    await ready()
    expect(within(card()).getByText(words)).toBeInTheDocument()
  })

  it('counts nothing where only a delete waits', async () => {
    serveNotes({
      [API]: book({ entries: [noteEntry({ state: 'deleting' })] }),
    })
    renderCard()
    await ready()
    expect(within(card()).queryByText(/a choice$/)).toBeNull()
  })

  it('lists no note, however many the journal holds, so the page never grows with it', async () => {
    const entries = Array.from({ length: 40 }, (_, at) =>
      noteEntry({
        id: `manyNotes${String(at).padStart(7, '0')}`,
        title: `Note number ${at}`,
      }),
    )
    serveNotes({ [API]: book({ entries }) })
    renderCard()
    await ready()
    expect(
      within(card()).getByText('2 chapters · 40 notes'),
    ).toBeInTheDocument()
    expect(within(card()).queryByText(/Note number/)).toBeNull()
    expect(within(card()).queryByRole('list')).toBeNull()
    expect(within(card()).getAllByRole('button')).toHaveLength(1)
  })

  it('opens the journal from Open, and the button is the card’s only one', async () => {
    const user = userEvent.setup()
    serveNotes({ [API]: book() })
    renderCard()
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(await ready())
    expect(
      screen.getByRole('dialog', { name: 'My Journal' }),
    ).toBeInTheDocument()
    expect(journalOpen(API)).toBe(true)
  })

  it('shows the journal open at once where the store has it open, as when the card is mounted elsewhere', async () => {
    serveNotes({ [API]: book() })
    const { result } = renderHook(() => useNotes(API, { active: false }))
    act(() => result.current.setOpen(true))
    renderCard({ active: false })
    expect(
      await screen.findByRole('dialog', { name: 'My Journal' }),
    ).toBeInTheDocument()
    // Polled while it's open, though the card isn't in view.
    expect(fetch).toHaveBeenCalledWith(`${API}/notes`, expect.anything())
  })

  it('isn’t read while it’s neither in view nor open', () => {
    serveNotes({ [API]: book() })
    renderCard({ active: false })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('shows nothing at all, its heading neither, for a book no longer the seat’s', async () => {
    serveNotes({})
    const { container } = renderCard()
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('gives focus back to Open as the journal closes, where it was mounted again meanwhile', async () => {
    const user = userEvent.setup()
    serveNotes({ [API]: book() })
    const { unmount } = renderCard()
    await user.click(await ready())
    // The sheet arrives: the card is mounted elsewhere, the journal open in it.
    unmount()
    renderCard()
    const dialog = await screen.findByRole('dialog', { name: 'My Journal' })
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(
      screen.getByRole('button', { name: 'Open My Journal' }),
    ).toHaveFocus()
    expect(journalOpen(API)).toBe(false)
  })
})
