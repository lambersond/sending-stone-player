/* eslint-disable unicorn/no-null -- a note in no chapter has null for it, as the API has */
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { groupsOf } from './contents'
import { JournalCard } from './journal-card'
import { NotePane } from './note-pane'
import { forgetNotes } from '@/hooks/use-notes'
import {
  emptyBook,
  noteChapter,
  noteEntry,
  serveNotes,
} from '@/mocks/notes-server'
import type { NoteEntryView, NotesView } from '@/types/notes'

const API = '/api/characters/char-1'

const ago = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString()

/** Two chapters; a note in none, one in each. */
const book = (fields: Partial<NotesView> = {}) =>
  emptyBook({
    chapters: [
      noteChapter({ title: 'Session 1: The road' }),
      noteChapter({
        id: 'secondChapter001',
        title: 'Session 2: Duskwater mine',
      }),
    ],
    entries: [
      noteEntry({ id: 'rumourNote000001', title: 'A rumour' }),
      noteEntry({ chapterId: 'sessionChapter01' }),
      noteEntry({
        id: 'wolvesNote000001',
        title: 'Wolves',
        chapterId: 'secondChapter001',
      }),
    ],
    ...fields,
  })

type Props = Parameters<typeof NotePane>[0]

/** The note of this id, as its pane in a book shows it. */
const renderPane = (
  id: string,
  view: NotesView = book(),
  props: Partial<Props> = {},
) => {
  const groups = groupsOf(view)
  const order = groups.flatMap(({ entries }) => entries)
  const entry = order.find(note => note.id === id) as NoteEntryView
  const group = groups.find(({ entries }) => entries.includes(entry))!
  const handlers = {
    onPick: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    onMove: jest.fn(),
    onResolve: jest.fn(),
  }
  render(
    <NotePane
      entry={entry}
      group={group}
      order={order}
      chapters={view.chapters}
      role='player'
      canAdd={view.canAdd}
      tooLarge={false}
      contents={<button type='button'>Contents</button>}
      moving={false}
      busy={false}
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

const tool = (name: string) => screen.queryByRole('button', { name })
const tools = (title: string) => ({
  move: tool(`Move ${title} to a chapter`),
  edit: tool(`Edit ${title}`),
  remove: tool(`Delete ${title}`),
})

describe('components/notes/note-pane', () => {
  describe('the tools in its bar, only where the seat may', () => {
    it('offers Move, Edit and Delete for a note the seat may change, with their titles', () => {
      renderPane('goblinCaveNote01')
      const { move, edit, remove } = tools('The goblin cave')
      expect(move).toHaveAttribute('title', 'Move to a chapter')
      expect(edit).toHaveAttribute('title', 'Edit')
      expect(remove).toHaveAttribute('title', 'Delete')
      // A divider after them, gone below 360 px of the bar's own room.
      expect(remove?.nextElementSibling).toHaveClass(
        'w-px',
        '@max-[360px]/bar:hidden',
      )
    })

    it.each([
      ['a book that takes no change', { canAdd: false }, {}],
      [
        'a note the seat may neither change nor delete',
        {},
        { canEdit: false, canDelete: false },
      ],
      ['a note in conflict', {}, { state: 'conflict' as const }],
      ['a note deleted in Foundry', {}, { state: 'gone' as const }],
    ])('offers none of them for %s', (_, fields, note) => {
      renderPane(
        'goblinCaveNote01',
        book({
          ...fields,
          entries: [noteEntry({ chapterId: 'sessionChapter01', ...note })],
        }),
      )
      expect(tools('The goblin cave')).toEqual({
        move: null,
        edit: null,
        remove: null,
      })
      expect(document.querySelector('.w-px')).toBeNull()
    })

    it('offers no Edit nor Move for a note changed only in Foundry, but Delete, with why', () => {
      renderPane(
        'goblinCaveNote01',
        book({
          entries: [
            noteEntry({ chapterId: 'sessionChapter01', foundryOnly: 'html' }),
          ],
        }),
      )
      const { move, edit, remove } = tools('The goblin cave')
      expect(move).toBeNull()
      expect(edit).toBeNull()
      expect(remove).toBeInTheDocument()
      expect(
        screen.getByText('Written in Foundry’s own editor: change it there.'),
      ).toBeInTheDocument()
    })

    it.each([
      ['html', 'Written in Foundry’s own editor: change it there.'],
      ['long', 'Too long to change here: change it in Foundry.'],
      ['secret', 'It holds a Gamemaster’s secret: change it in Foundry.'],
    ] as const)(
      'says why a note is changed only in Foundry: %s',
      (why, words) => {
        renderPane(
          'goblinCaveNote01',
          book({ entries: [noteEntry({ foundryOnly: why })] }),
        )
        expect(screen.getByText(words)).toBeInTheDocument()
      },
    )

    it('offers no Delete for a note being deleted, nor Move, but Edit', () => {
      renderPane(
        'goblinCaveNote01',
        book({ entries: [noteEntry({ state: 'deleting' })] }),
      )
      const { move, edit, remove } = tools('The goblin cave')
      expect(remove).toBeNull()
      expect(move).toBeNull()
      expect(edit).toBeInTheDocument()
    })

    it.each(['synced', 'waiting', 'saving'] as const)(
      'offers Move for a note %s',
      state => {
        renderPane(
          'goblinCaveNote01',
          book({ entries: [noteEntry({ state })] }),
        )
        expect(tools('The goblin cave').move).toBeInTheDocument()
      },
    )

    it('offers no Move for a note whose change the game refused, settled first, though Edit stays', () => {
      renderPane(
        'goblinCaveNote01',
        book({
          entries: [noteEntry({ state: 'failed', reason: 'full' })],
        }),
      )
      expect(tools('The goblin cave').move).toBeNull()
      expect(tools('The goblin cave').edit).toBeInTheDocument()
    })

    it('offers no Move in a book with no chapter to go to', () => {
      renderPane(
        'rumourNote000001',
        book({
          chapters: [],
          entries: [noteEntry({ id: 'rumourNote000001' })],
        }),
      )
      expect(tools('The goblin cave').move).toBeNull()
      expect(tool('Move The goblin cave to a chapter')).toBeNull()
    })

    it('opens the editor from Edit, asks before a delete, and moves from its menu', async () => {
      const user = userEvent.setup()
      const { onEdit, onDelete, onMove } = renderPane('goblinCaveNote01')
      await user.click(tool('Edit The goblin cave')!)
      expect(onEdit).toHaveBeenCalledWith('edit')
      await user.click(tool('Delete The goblin cave')!)
      expect(onDelete).toHaveBeenCalledTimes(1)
      await user.click(tool('Move The goblin cave to a chapter')!)
      await user.click(
        screen.getByRole('menuitemradio', {
          name: 'Session 2: Duskwater mine',
        }),
      )
      expect(onMove).toHaveBeenCalledWith('secondChapter001')
    })
  })

  describe('where it is', () => {
    it('numbers its chapter in the bar, shorter in a narrow bar, with the whole words for a screen reader', () => {
      renderPane('wolvesNote000001')
      const long = screen.getByText('Chapter 2', {
        selector: String.raw`.\@max-\[360px\]\/bar\:hidden`,
      })
      expect(long.parentElement).toHaveClass('uppercase', 'tracking-wider')
      expect(screen.getByText('Ch. 2')).toHaveAttribute('aria-hidden', 'true')
      expect(screen.getByText('Ch. 2')).toHaveClass('@min-[360px]/bar:hidden')
      expect(
        screen.getByText('Chapter 2', { selector: '.sr-only' }),
      ).toHaveClass('@min-[360px]/bar:hidden')
    })

    it('keeps Next in its bar however narrow: what follows Contents goes by its own room, and only the chapter’s number gives way', () => {
      renderPane('wolvesNote000001', book(), {
        contents: (
          <button type='button' data-contents-button>
            Contents
          </button>
        ),
      })
      const next = screen.getByRole('button', { name: 'Next note' })
      // The chapter's number, the tools, the divider, "i of n" and the arrows are the bar's own
      // container, which the Contents button is outside of: below 640 px of the modal it takes
      // its share, and from 640 the contents pane takes the rest.
      const room = next.parentElement as HTMLElement
      expect(room).toHaveClass('@container/bar', 'min-w-0', 'flex-1')
      expect(room).not.toContainElement(
        screen.getByRole('button', { name: 'Contents' }),
      )
      expect(room).toContainElement(screen.getByText('Ch. 2'))
      expect(room).toContainElement(screen.getByText('3 of 3'))
      expect(room).toContainElement(
        screen.getByRole('button', { name: 'Move Wolves to a chapter' }),
      )
      // Every one of them keeps its width but the chapter's number, which shrinks, cut short,
      // before Next would be cut off by the modal's edge.
      const label = screen.getByText('Ch. 2').parentElement as HTMLElement
      expect(label).toHaveClass('min-w-0', 'truncate')
      expect(label).not.toHaveClass('shrink-0')
      const spacer = [...room.children].find(
        child => child.className === 'flex-1',
      )
      const others = [...room.children].filter(
        child => child !== label && child !== spacer,
      )
      // Move, Edit, Delete, the divider, "i of n", Previous and Next.
      expect(others).toHaveLength(7)
      for (const child of others) expect(child).toHaveClass('shrink-0')
    })

    it('numbers no chapter for a note in none', () => {
      renderPane('rumourNote000001')
      expect(screen.queryByText(/^Chapter \d/)).toBeNull()
      expect(screen.queryByText(/^Ch\. \d/)).toBeNull()
    })

    it('says where it is among the book’s notes, from 420 px of the bar’s own room', () => {
      renderPane('goblinCaveNote01')
      expect(screen.getByText('2 of 3')).toHaveClass(
        'hidden',
        '@min-[420px]/bar:inline',
      )
    })

    it('heads its article with its chapter’s title, which opens its page', async () => {
      const user = userEvent.setup()
      const { onPick } = renderPane('wolvesNote000001')
      const article = screen.getByRole('article', { name: 'Wolves' })
      const chapter = within(article).getByRole('button', {
        name: 'Session 2: Duskwater mine',
      })
      expect(chapter).toHaveClass('uppercase')
      // 44 px to tap, its words where they'd be at their own height: its padding is taken back
      // by its margins, in the article's top padding and the gap above the title.
      expect(chapter).toHaveClass(
        'min-h-11',
        'min-w-11',
        'pt-5',
        '-mt-5',
        'pb-2',
        '-mb-2',
        'relative',
      )
      await user.click(chapter)
      expect(onPick).toHaveBeenCalledWith({ group: 'secondChapter001' })
    })

    it('heads a note in no chapter so, opening the page of those', async () => {
      const user = userEvent.setup()
      const { onPick } = renderPane('rumourNote000001')
      await user.click(screen.getByRole('button', { name: 'Not in a chapter' }))
      expect(onPick).toHaveBeenCalledWith({ group: null })
    })
  })

  describe('Previous and Next', () => {
    it('go to the notes either side in reading order, across chapters, named by where they go', async () => {
      const user = userEvent.setup()
      const { onPick } = renderPane('goblinCaveNote01')
      const previous = screen.getByRole('button', { name: 'Previous note' })
      const next = screen.getByRole('button', { name: 'Next note' })
      expect(previous).toHaveAttribute('title', 'Previous: A rumour')
      expect(next).toHaveAttribute('title', 'Next: Wolves')
      await user.click(previous)
      expect(onPick).toHaveBeenLastCalledWith(
        { note: 'rumourNote000001' },
        'previous',
      )
      await user.click(next)
      expect(onPick).toHaveBeenLastCalledWith(
        { note: 'wolvesNote000001' },
        'next',
      )
    })

    it('are off at the ends', () => {
      renderPane('rumourNote000001')
      expect(
        screen.getByRole('button', { name: 'Previous note' }),
      ).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Next note' })).toBeEnabled()
    })

    it('are pinned below too, in a nav of their own, an empty cell where there’s none', async () => {
      const user = userEvent.setup()
      const { onPick } = renderPane('wolvesNote000001')
      const nav = screen.getByRole('navigation', { name: 'Other notes' })
      expect(nav.children).toHaveLength(2)
      expect(nav.lastElementChild).toBeEmptyDOMElement()
      const previous = within(nav).getByRole('button', {
        name: 'Previous The goblin cave',
      })
      await user.click(previous)
      expect(onPick).toHaveBeenLastCalledWith({ note: 'goblinCaveNote01' })
    })

    it('leave no footer for a book’s only note', () => {
      renderPane(
        'rumourNote000001',
        book({ entries: [noteEntry({ id: 'rumourNote000001' })] }),
      )
      expect(
        screen.queryByRole('navigation', { name: 'Other notes' }),
      ).toBeNull()
    })
  })

  describe('its lines, under its title', () => {
    it('say who wrote it and who changed it last, the author always', () => {
      renderPane(
        'goblinCaveNote01',
        book({
          entries: [
            noteEntry({
              author: { name: 'Vex' },
              createdAt: ago(0),
              modifiedAt: ago(0),
              modifiedBy: 'Vex',
            }),
          ],
        }),
      )
      const title = screen.getByRole('heading', {
        level: 3,
        name: 'The goblin cave',
      })
      const lines = title.nextElementSibling as HTMLElement
      expect(lines).toHaveTextContent(
        'Written by Vex, just nowLast changed by Vex, just now',
      )
    })

    it('say a note was written and changed in Foundry', () => {
      renderPane(
        'goblinCaveNote01',
        book({
          entries: [
            noteEntry({
              author: null,
              createdAt: ago(0),
              modifiedAt: ago(0),
              modifiedBy: 'Gamemaster',
              modifiedIn: 'foundry',
            }),
          ],
        }),
      )
      const lines = screen.getByRole('heading', { level: 3 })
        .nextElementSibling as HTMLElement
      expect(lines).toHaveTextContent(
        'Written in Foundry, just nowLast changed by Gamemaster in Foundry, just now',
      )
    })
  })

  it('heads its article by its title, an h3 that takes focus', () => {
    renderPane('goblinCaveNote01')
    const title = screen.getByRole('heading', {
      level: 3,
      name: 'The goblin cave',
    })
    expect(title).toHaveAttribute('tabindex', '-1')
    expect(
      screen.getByRole('article', { name: 'The goblin cave' }),
    ).toContainElement(title)
  })

  it('shows where it stands, and its problem panel, whose Edit opens the editor', async () => {
    const user = userEvent.setup()
    const { onEdit, onResolve } = renderPane(
      'goblinCaveNote01',
      book({
        entries: [
          noteEntry({
            state: 'failed',
            reason: 'full',
            mine: {
              title: 'The goblin cave',
              html: '',
              body: '',
              chapterId: null,
            },
          }),
        ],
      }),
    )
    expect(
      screen.getByText('Not saved to the game', { selector: 'span' }),
    ).toBeInTheDocument()
    const panel = screen.getByRole('group', { name: 'Not saved to the game' })
    await user.click(within(panel).getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledWith('problem-edit')
    await user.click(within(panel).getByRole('button', { name: 'Try again' }))
    expect(onResolve).toHaveBeenCalledWith('mine')
  })

  it('draws its text at the reader’s size, its ### an h4 under its h3, so nothing skips a level', () => {
    renderPane(
      'goblinCaveNote01',
      book({
        entries: [
          noteEntry({
            html: '<h5>Loot</h5><p>30 gp</p><h6>Coins</h6><table><tr><td>1</td></tr></table>',
          }),
        ],
      }),
    )
    const loot = screen.getByRole('heading', { name: 'Loot' })
    expect(loot.localName).toBe('h4')
    expect(screen.getByRole('heading', { name: 'Coins' }).localName).toBe('h5')
    const text = loot.parentElement as HTMLElement
    expect(text).toHaveClass('sheet-text', 'note-text', 'reading', 'lifted')
    expect(text.parentElement).toHaveClass('overflow-x-auto')
  })
})

describe('components/notes/note-pane, in the journal', () => {
  beforeEach(() => {
    forgetNotes()
  })

  afterEach(() => {
    act(() => forgetNotes())
  })

  it('reads on across every note though a search narrows the contents, focus staying on the arrow', async () => {
    const user = userEvent.setup()
    serveNotes({ [API]: book() })
    render(
      <JournalCard
        api={API}
        role='player'
        kind='personal'
        name='Thorin'
        active
        look='sheet'
      />,
    )
    await user.click(
      await screen.findByRole('button', { name: 'Open My Journal' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'My Journal' })
    const nav = await within(dialog).findByRole('navigation', {
      name: 'Contents',
    })
    await user.click(within(nav).getByRole('button', { name: 'A rumour' }))
    await user.type(
      within(dialog).getByRole('searchbox', { name: 'Search notes' }),
      'rumour',
    )
    expect(within(nav).queryByRole('button', { name: 'Wolves' })).toBeNull()

    await user.click(within(dialog).getByRole('button', { name: 'Next note' }))
    expect(within(dialog).getByRole('heading', { level: 3 })).toHaveTextContent(
      'The goblin cave',
    )
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Next note' }),
      ).toHaveFocus(),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Next note' }))
    expect(within(dialog).getByRole('heading', { level: 3 })).toHaveTextContent(
      'Wolves',
    )
    // At the end, Next is off: focus goes to the note's title.
    await waitFor(() =>
      expect(within(dialog).getByRole('heading', { level: 3 })).toHaveFocus(),
    )
    expect(within(dialog).getByText('3 of 3')).toBeInTheDocument()
  })
})
