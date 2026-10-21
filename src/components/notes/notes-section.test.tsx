/* eslint-disable unicorn/no-null -- a book with no journal in Foundry has null for it */
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotesSection } from './notes-section'
import { forgetNotes } from '@/hooks/use-notes'
import {
  emptyBook,
  noteChapter,
  noteEntry,
  serveNotes,
} from '@/mocks/notes-server'
import type { NotesView } from '@/types/notes'

const API = '/api/characters/char-1'
const PARTY_API = '/api/characters/char-1/party/company'

type Props = Parameters<typeof NotesSection>[0]

const renderSection = (props: Partial<Props> = {}) =>
  render(
    <NotesSection
      api={API}
      role='player'
      kind='personal'
      name='Thorin'
      active
      look='sheet'
      {...props}
    />,
  )

/** Thorin's book: a chapter with an entry, and one in no chapter. */
const book = (fields: Partial<NotesView> = {}) =>
  emptyBook({
    journal: "Thorin's notes",
    chapters: [noteChapter()],
    entries: [
      noteEntry({ chapterId: 'sessionChapter01' }),
      noteEntry({
        id: 'rumourInFoundry1',
        title: 'A rumour',
        body: 'The dragon sleeps.',
        html: '<p>The dragon sleeps.</p>',
      }),
    ],
    ...fields,
  })

const section = () => screen.getByRole('region', { name: 'Notes' })
const heading = (region: HTMLElement) =>
  within(region).getByRole('heading', { level: 2, name: 'Notes' })
/** A note's row, by its title. */
const row = (title: string) =>
  screen.getByText(title).closest('details') as HTMLElement
const ready = () => screen.findByRole('region', { name: 'Notes' })

describe('components/notes/notes-section', () => {
  beforeEach(() => {
    forgetNotes()
  })

  afterEach(() => {
    act(() => forgetNotes())
  })

  it.each([
    [
      'a player, before the journal is known',
      { journal: null },
      {},
      'Only you and your Gamemaster see these.',
    ],
    [
      'a player, in a journal Foundry named',
      {},
      {},
      "Only you and your Gamemaster see these. In Foundry they’re in “Thorin's notes”.",
    ],
    [
      'the Gamemaster, at the character',
      {},
      { role: 'gm' as const },
      'Only Thorin’s player and you see these.',
    ],
    [
      'a party',
      { kind: 'party' as const },
      {
        api: PARTY_API,
        kind: 'party' as const,
        name: 'The Iron Company',
        look: 'party' as const,
      },
      'Everyone in The Iron Company sees these, here and in Foundry.',
    ],
  ])('says who sees the notes, for %s', async (_, fields, props, words) => {
    serveNotes({ [(props as Partial<Props>).api ?? API]: book(fields) })
    renderSection(props)
    await screen.findByText(words)
    expect(screen.getByText(words).previousElementSibling).toHaveTextContent(
      'Notes',
    )
  })

  it.each([
    [
      'its character gone from the campaign',
      { connected: false, canAdd: false, enabled: false },
      'Thorin is no longer one of the campaign’s characters, so these notes can’t be changed.',
    ],
    [
      'a module too old to take notes',
      { enabled: false },
      'Notes are kept here for now. They reach Foundry once your Gamemaster’s game connects with Sending Stone 0.34.0 or later.',
    ],
    [
      'a journal too large to send',
      { withheld: { reason: 'tooLarge' as const } },
      "“Thorin's notes” is too large to send from Foundry, so changes made there don’t show here.",
    ],
    [
      'a party no player may see',
      { withheld: { reason: 'private' as const }, canAdd: false },
      'No player can see Thorin in Foundry, so its notes aren’t shared.',
    ],
  ])('shows one banner, for %s, with no role', async (_, fields, words) => {
    serveNotes({ [API]: book(fields) })
    renderSection()
    const banner = await screen.findByText(words)
    expect(banner).not.toHaveAttribute('role')
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('heads itself Notes, an h2, as the sheet’s sections are and as the party’s', async () => {
    serveNotes({ [API]: book(), [PARTY_API]: book({ kind: 'party' }) })
    render(
      <>
        <NotesSection
          api={API}
          role='player'
          kind='personal'
          name='Thorin'
          active
          look='sheet'
        />
        <NotesSection
          api={PARTY_API}
          role='player'
          kind='party'
          name='The Iron Company'
          active
          look='party'
        />
      </>,
    )
    const [sheet, party] = await screen.findAllByRole('region', {
      name: 'Notes',
    })
    expect(heading(sheet)).toHaveClass('uppercase', 'tracking-wider')
    expect(heading(party)).toHaveClass('text-sm', 'font-semibold')
    expect(heading(party)).not.toHaveClass('uppercase')
    expect(heading(sheet).id).not.toBe(heading(party).id)
    expect(sheet).toHaveAttribute('aria-labelledby', heading(sheet).id)
  })

  it('offers New note and New chapter where the seat may add them', async () => {
    serveNotes({ [API]: book() })
    renderSection()
    await ready()
    expect(screen.getByRole('button', { name: 'New note' })).toHaveAttribute(
      'data-note-opener',
      'new',
    )
    expect(
      screen.getByRole('button', { name: 'New chapter' }),
    ).toBeInTheDocument()
  })

  it('is read only where the book takes no change: nothing that would be refused is offered', async () => {
    const user = userEvent.setup()
    serveNotes({
      [PARTY_API]: book({
        kind: 'party',
        canAdd: false,
        withheld: { reason: 'private' },
        entries: [
          noteEntry({ chapterId: 'sessionChapter01' }),
          noteEntry({
            id: 'failedEntry00001',
            title: 'Refused',
            state: 'failed',
            reason: 'not-member',
            mine: {
              title: 'Refused',
              html: '<p>x</p>',
              body: 'x',
              chapterId: null,
              by: 'Vex',
            },
          }),
        ],
      }),
    })
    renderSection({
      api: PARTY_API,
      kind: 'party',
      role: 'gm',
      name: 'The Iron Company',
    })
    await screen.findByText(
      'No player can see The Iron Company in Foundry, so its notes aren’t shared.',
    )
    // Every row opened, as a reader may.
    for (const row of document.querySelectorAll('summary')) {
      if (!row.parentElement?.hasAttribute('open')) await user.click(row)
    }
    for (const name of [
      /^New note/,
      'New chapter',
      /^Rename/,
      'Edit',
      'Delete',
    ]) {
      expect(screen.queryAllByRole('button', { name })).toEqual([])
    }
    // The problem panel's other choices stay.
    const problem = screen.getByRole('group', { name: 'Not saved to the game' })
    expect(
      within(problem)
        .getAllByRole('button')
        .map(button => button.textContent),
    ).toEqual(['Try again', 'Discard theirs'])
  })

  it('searches its notes by title and text, once there’s one to search', async () => {
    const user = userEvent.setup()
    serveNotes({ [API]: book() })
    renderSection()
    await ready()

    const search = screen.getByRole('searchbox', { name: 'Search notes' })
    await user.type(search, 'dragon')
    expect(
      within(section())
        .getAllByRole('heading', { level: 4 })
        .map(heading => heading.textContent),
    ).toEqual(['A rumour'])
    // A chapter with no note matching is left out while searching.
    expect(screen.queryByRole('region', { name: 'Session 1' })).toBeNull()

    await user.clear(search)
    await user.type(search, 'goblin')
    expect(
      within(section())
        .getAllByRole('heading', { level: 4 })
        .map(heading => heading.textContent),
    ).toEqual(['The goblin cave'])

    await user.clear(search)
    await user.type(search, 'owlbear')
    expect(screen.getByText('No notes match “owlbear”.')).toBeInTheDocument()
  })

  it('searches what a note draws, where the seat has no Markdown of it', async () => {
    const user = userEvent.setup()
    serveNotes({
      [API]: book({
        entries: [
          noteEntry({
            body: undefined,
            html: '<p>The <strong>owlbear</strong> den.</p>',
          }),
        ],
      }),
    })
    renderSection()
    await ready()
    await user.type(screen.getByRole('searchbox'), 'owlbear den')
    expect(
      screen.getByRole('heading', { level: 4, name: 'The goblin cave' }),
    ).toBeInTheDocument()
  })

  it('says, in a line, there are no notes yet: no search, and nothing pushing the tab’s sections down', async () => {
    serveNotes({ [API]: emptyBook() })
    renderSection()
    const line = await screen.findByText(
      'No notes yet. Write down what happened, what you found and who you met.',
    )
    expect(line.tagName).toBe('P')
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(section().querySelector('.py-16')).toBeNull()
    expect(within(section()).getAllByRole('heading')).toHaveLength(1)
  })

  it('lists a book with chapters and no notes yet', async () => {
    serveNotes({ [API]: emptyBook({ chapters: [noteChapter()] }) })
    renderSection()
    expect(
      await screen.findByRole('region', { name: 'Session 1' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/^No notes yet/)).toBeNull()
    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('says it’s loading, busy, until its book first comes, with no role', async () => {
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => {}))
    renderSection()
    expect(section()).toHaveAttribute('aria-busy', 'true')
    const loading = within(section()).getByText('Loading notes…')
    expect(loading).not.toHaveAttribute('role')
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('button', { name: 'New note' })).toBeNull()
  })

  it('says so where its book can’t be read, while it tries again', async () => {
    globalThis.fetch = jest.fn(() => Promise.reject(new TypeError('down')))
    renderSection()
    expect(
      await screen.findByText('Notes couldn’t be loaded. Trying again…'),
    ).toBeInTheDocument()
  })

  it('draws nothing, its heading included, once the book isn’t the seat’s', async () => {
    serveNotes({})
    const { container } = renderSection()
    await waitFor(() => expect(container).toBeEmptyDOMElement())
    expect(fetch).toHaveBeenCalledWith(`${API}/notes`, expect.anything())
  })

  describe('its status line', () => {
    it.each([
      [true, 'Saved.'],
      [
        false,
        'Saved. It goes to Foundry when your Gamemaster’s game is next open.',
      ],
    ])(
      'says a note is saved, the game live: %s, and has no role',
      async (live, words) => {
        const user = userEvent.setup()
        serveNotes({ [API]: book({ live }) })
        renderSection()
        await ready()
        await user.click(screen.getByRole('button', { name: 'New chapter' }))
        await user.type(
          screen.getByRole('textbox', { name: 'Chapter title' }),
          'Session 2',
        )
        await user.click(screen.getByRole('button', { name: 'Save' }))

        const line = await within(section()).findByText(words)
        const status = line.closest('[aria-live]')
        expect(status).toHaveAttribute('aria-live', 'polite')
        expect(status).toHaveAttribute('aria-atomic', 'true')
        expect(status).not.toHaveAttribute('role')
        expect(screen.queryByRole('status')).toBeNull()
      },
    )

    it('says a note is deleted, and clears itself a while after', async () => {
      jest.useFakeTimers()
      try {
        const user = userEvent.setup({
          advanceTimers: jest.advanceTimersByTime,
        })
        serveNotes({ [API]: book() })
        renderSection()
        await user.click(await screen.findByText('A rumour'))
        await user.click(
          within(row('A rumour')).getByRole('button', { name: 'Delete' }),
        )
        const dialog = screen.getByRole('dialog', { name: 'Delete A rumour?' })
        expect(dialog).toHaveTextContent(
          'It’s deleted from Foundry’s journal too.',
        )
        expect(dialog).not.toHaveTextContent('next open')
        await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

        expect(await within(section()).findByText('Deleted.')).toBeVisible()
        await act(async () => {
          await jest.advanceTimersByTimeAsync(6000)
        })
        expect(within(section()).queryByText('Deleted.')).toBeNull()
      } finally {
        jest.useRealTimers()
      }
    })

    it('is always in the section, empty until it has words', async () => {
      serveNotes({ [API]: book() })
      renderSection()
      await ready()
      const status = section().querySelector('[aria-live="polite"]:not([id])')
      expect(status).toBeEmptyDOMElement()
    })
  })

  it('says, as it asks, when a delete reaches Foundry while the game is closed', async () => {
    const user = userEvent.setup()
    serveNotes({ [API]: book({ live: false }) })
    renderSection({ role: 'gm' })
    await user.click(await screen.findByText('A rumour'))
    await user.click(
      within(row('A rumour')).getByRole('button', { name: 'Delete' }),
    )
    expect(
      screen.getByRole('dialog', { name: 'Delete A rumour?' }),
    ).toHaveTextContent(
      'It’s deleted from Foundry’s journal too. That happens when your game is next open.',
    )
  })

  it('says why a delete was refused, and keeps the note', async () => {
    const user = userEvent.setup()
    const server = serveNotes({ [API]: book() })
    server.answer = () => ({ status: 409, body: { reason: 'saving' } })
    renderSection()
    await user.click(await screen.findByText('A rumour'))
    await user.click(
      within(row('A rumour')).getByRole('button', { name: 'Delete' }),
    )
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    )
    expect(
      await within(section()).findByText(
        'Your last change is still on its way to the game. Try again in a moment.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('A rumour')).toBeInTheDocument()
  })

  it('settles a change the game didn’t take, as the seat chooses', async () => {
    const user = userEvent.setup()
    const server = serveNotes({
      [API]: book({
        entries: [
          noteEntry({
            state: 'conflict',
            reason: 'changed',
            stamp: 'w:abc.3',
            mine: {
              title: 'Mine',
              html: '<p>mine</p>',
              body: 'mine',
              chapterId: null,
            },
          }),
        ],
      }),
    })
    renderSection()
    await ready()
    // A row with a problem is open by itself.
    await user.click(screen.getByRole('button', { name: 'Keep Foundry’s' }))
    expect(server.sent.at(-1)).toEqual({
      url: `${API}/notes/goblinCaveNote01`,
      method: 'PATCH',
      body: { resolve: 'theirs', stamp: 'w:abc.3' },
    })
  })
})
