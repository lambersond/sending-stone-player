/* eslint-disable unicorn/no-null -- a note in no chapter has null for it, as the API has */
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Contents, ContentsButton, groupsOf } from './contents'
import { JournalCard } from './journal-card'
import { forgetNotes } from '@/hooks/use-notes'
import {
  emptyBook,
  noteChapter,
  noteEntry,
  serveNotes,
} from '@/mocks/notes-server'
import type { NotesView } from '@/types/notes'

const API = '/api/characters/char-1'

/**
 * A book whose notes are in an order of their own, not by when they were written: in no chapter,
 * the newer first; in Session 1, the oldest last.
 */
const book = (fields: Partial<NotesView> = {}) =>
  emptyBook({
    chapters: [
      noteChapter({ createdAt: '2026-10-01T10:00:00.000Z' }),
      noteChapter({
        id: 'secondChapter001',
        title: 'Session 2',
        createdAt: '2026-10-02T10:00:00.000Z',
      }),
    ],
    entries: [
      noteEntry({
        id: 'newerLooseNote01',
        title: 'Newer loose',
        createdAt: '2026-10-05T10:00:00.000Z',
      }),
      noteEntry({
        id: 'olderLooseNote01',
        title: 'Older loose',
        createdAt: '2026-10-01T10:00:00.000Z',
      }),
      noteEntry({
        id: 'wolvesNote000001',
        title: 'Wolves',
        chapterId: 'sessionChapter01',
        createdAt: '2026-10-04T10:00:00.000Z',
      }),
      noteEntry({
        chapterId: 'sessionChapter01',
        createdAt: '2026-10-01T11:00:00.000Z',
      }),
    ],
    ...fields,
  })

type Props = Parameters<typeof Contents>[0]

const renderContents = (
  view: NotesView = book(),
  props: Partial<Props> = {},
) => {
  const handlers = {
    onQuery: jest.fn(),
    onCloseDrawer: jest.fn(),
    onPick: jest.fn(),
    onNewNote: jest.fn(),
    onNewChapter: jest.fn(),
  }
  const rendered = render(
    <Contents
      id='contents'
      groups={groupsOf(view)}
      query=''
      canAdd
      narrow={false}
      drawer={false}
      {...handlers}
      {...props}
    />,
  )
  return { ...rendered, ...handlers }
}

const nav = () => screen.getByRole('navigation', { name: 'Contents' })
/** The contents' buttons, groups' and notes', by name, in their order. */
const listed = () =>
  within(nav())
    .getAllByRole('button')
    .filter(button => !button.hasAttribute('aria-expanded'))
    .map(button => button.getAttribute('aria-label'))
const pane = () => document.querySelector('#contents') as HTMLElement
/** A group's button in the contents, by its title. */
const mark = (group: string) =>
  within(nav()).getByRole('button', { name: group })

describe('components/notes/contents', () => {
  it('lists the notes in no chapter, then each chapter, each group’s notes in the order the book sends them, never by when they were written', () => {
    renderContents()
    expect(listed()).toEqual([
      'Not in a chapter',
      'Newer loose',
      'Older loose',
      'Session 1',
      'Wolves',
      'The goblin cave',
      'Session 2',
    ])
  })

  it('lists the notes in no chapter only where it has some, under Not in a chapter in a book with no chapters too', () => {
    const { unmount } = renderContents(
      book({ entries: [noteEntry({ chapterId: 'sessionChapter01' })] }),
    )
    expect(listed()).not.toContain('Not in a chapter')
    unmount()

    renderContents(book({ chapters: [] }))
    expect(listed().slice(0, 3)).toEqual([
      'Not in a chapter',
      'Newer loose',
      'Older loose',
    ])
  })

  it('takes a note whose chapter it isn’t sent as one in no chapter', () => {
    renderContents(
      book({
        entries: [noteEntry({ chapterId: 'hiddenChapter001', title: 'Hid' })],
      }),
    )
    expect(listed().slice(0, 2)).toEqual(['Not in a chapter', 'Hid'])
  })

  it('shuts a group and opens it again, naming what it does', async () => {
    const user = userEvent.setup()
    renderContents()
    const shut = within(nav()).getByRole('button', {
      name: 'Hide the notes in Session 1',
    })
    expect(shut).toHaveAttribute('aria-expanded', 'true')
    await user.click(shut)
    const open = within(nav()).getByRole('button', {
      name: 'Show the notes in Session 1',
    })
    expect(open).toHaveAttribute('aria-expanded', 'false')
    expect(open.querySelector('svg')).toHaveClass('-rotate-90')
    expect(listed()).not.toContain('Wolves')
    await user.click(open)
    expect(listed()).toContain('Wolves')
  })

  it('marks what the reader shows, a note or a group, and picks what’s chosen', async () => {
    const user = userEvent.setup()
    const { rerender, onPick, ...handlers } = renderContents(book(), {
      shown: { note: 'wolvesNote000001' },
    })
    expect(
      within(nav()).getByRole('button', { name: 'Wolves' }),
    ).toHaveAttribute('aria-current', 'true')
    expect(
      within(nav()).getByRole('button', { name: 'Session 1' }),
    ).not.toHaveAttribute('aria-current')
    rerender(
      <Contents
        id='contents'
        groups={groupsOf(book())}
        query=''
        canAdd
        narrow={false}
        drawer={false}
        {...handlers}
        onPick={onPick}
        shown={{ group: null }}
      />,
    )
    expect(
      within(nav()).getByRole('button', { name: 'Not in a chapter' }),
    ).toHaveAttribute('aria-current', 'true')
    await user.click(within(nav()).getByRole('button', { name: 'Session 2' }))
    expect(onPick).toHaveBeenLastCalledWith({ group: 'secondChapter001' })
    await user.click(within(nav()).getByRole('button', { name: 'Wolves' }))
    expect(onPick).toHaveBeenLastCalledWith({ note: 'wolvesNote000001' })
  })

  describe('its marks', () => {
    it.each([
      [
        'the chapter',
        { chapters: [noteChapter({ state: 'gone' })] },
        'Session 1',
      ],
      [
        'a note in it',
        {
          entries: [
            noteEntry({ chapterId: 'sessionChapter01', state: 'failed' }),
          ],
        },
        'Session 1',
      ],
      [
        'its order',
        {
          groups: [
            { chapterId: null, state: 'conflict' as const, stamp: 'g:1' },
          ],
        },
        'Not in a chapter',
      ],
    ])(
      'warns that a group needs a choice where %s does',
      (_, fields, group) => {
        renderContents(book(fields))
        const warning = within(mark(group)).getByTitle('Needs a choice')
        expect(warning).toHaveClass('text-warning')
        expect(warning).toHaveTextContent('Needs a choice')
        expect(mark(group)).toHaveAccessibleDescription(/Needs a choice/)
      },
    )

    it('takes a delete waiting as waiting, not a choice', () => {
      renderContents(
        book({
          entries: [
            noteEntry({ chapterId: 'sessionChapter01', state: 'deleting' }),
          ],
        }),
      )
      expect(
        within(mark('Session 1')).queryByTitle('Needs a choice'),
      ).toBeNull()
      const note = within(nav()).getByRole('button', {
        name: 'The goblin cave',
      })
      expect(
        within(note).getByTitle('Deleted here, waiting for the game'),
      ).toHaveClass('text-text-secondary')
    })

    it('marks an order on its way', () => {
      renderContents(
        book({
          groups: [
            {
              chapterId: 'sessionChapter01',
              state: 'waiting',
              stamp: 'g:1',
            },
          ],
        }),
      )
      expect(
        within(mark('Session 1')).getByTitle('Order waiting for the game'),
      ).toBeInTheDocument()
      expect(
        within(mark('Session 1')).queryByTitle('Needs a choice'),
      ).toBeNull()
    })

    it('marks a note’s state, and the note its draft changes, its name its title alone', () => {
      renderContents(
        book({
          entries: [
            noteEntry({ state: 'waiting' }),
            noteEntry({ id: 'wolvesNote000001', title: 'Wolves' }),
          ],
        }),
        { draftNote: 'wolvesNote000001' },
      )
      const waiting = within(nav()).getByRole('button', {
        name: 'The goblin cave',
      })
      expect(waiting).toHaveAccessibleDescription('Waiting for the game')
      const drafted = within(nav()).getByRole('button', { name: 'Wolves' })
      expect(within(drafted).getByTitle('Draft not saved yet')).toHaveClass(
        'text-primary-text',
      )
      expect(drafted).toHaveAccessibleDescription('Draft not saved yet')
    })
  })

  it('counts each group’s notes', () => {
    renderContents()
    expect(
      within(nav()).getByRole('button', { name: 'Session 1' }),
    ).toHaveAccessibleDescription('2 notes')
    expect(
      within(nav()).getByRole('button', { name: 'Session 2' }),
    ).toHaveAccessibleDescription('0 notes')
  })

  it('shows only the groups with a hit while searching, open, with their hits and their count', async () => {
    const user = userEvent.setup()
    const { rerender, ...handlers } = renderContents()
    // Shut first: a search opens it.
    await user.click(
      within(nav()).getByRole('button', {
        name: 'Hide the notes in Session 1',
      }),
    )
    rerender(
      <Contents
        id='contents'
        groups={groupsOf(book())}
        query='wol'
        hits={new Set(['wolvesNote000001'])}
        canAdd
        narrow={false}
        drawer={false}
        {...handlers}
      />,
    )
    expect(listed()).toEqual(['Session 1', 'Wolves'])
    expect(
      within(nav()).getByRole('button', { name: 'Session 1' }),
    ).toHaveAccessibleDescription('1 note')
  })

  it('says nothing matches, where nothing does', () => {
    renderContents(book(), { query: ' dragon ', hits: new Set() })
    expect(
      within(nav()).getByText('No notes match “dragon”.'),
    ).toBeInTheDocument()
  })

  it('searches as it’s typed in', async () => {
    const user = userEvent.setup()
    const { onQuery } = renderContents()
    await user.type(
      screen.getByRole('searchbox', { name: 'Search notes' }),
      'w',
    )
    expect(onQuery).toHaveBeenLastCalledWith('w')
    expect(screen.getByRole('searchbox')).toHaveAttribute(
      'placeholder',
      'Search notes',
    )
  })

  it('shows bars in place of the list while the book loads, and no New note', () => {
    render(
      <Contents
        id='contents'
        query=''
        canAdd
        narrow={false}
        drawer={false}
        onQuery={jest.fn()}
        onCloseDrawer={jest.fn()}
        onPick={jest.fn()}
        onNewNote={jest.fn()}
        onNewChapter={jest.fn()}
      />,
    )
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(pane().querySelectorAll('[aria-hidden] > div')).toHaveLength(5)
    expect(screen.queryByRole('button', { name: 'New note' })).toBeNull()
  })

  it.each([
    ['editing', 'Save or cancel to read another note.'],
    ['ordering', 'Save or cancel the new order first.'],
  ] as const)('is locked, inert and dimmed, while %s', (locked, words) => {
    renderContents(book(), { locked })
    expect(pane()).toHaveAttribute('inert')
    expect(pane()).toHaveClass('opacity-50')
    expect(screen.getByText(words)).toHaveClass('text-xs')
  })

  it('is neither locked nor inert otherwise, as a pane', () => {
    renderContents()
    expect(pane()).not.toHaveAttribute('inert')
    expect(pane()).not.toHaveClass('opacity-50')
    expect(screen.queryByText(/^Save or cancel/)).toBeNull()
  })

  it('is inert as a drawer only while it’s closed', () => {
    const { rerender, ...handlers } = renderContents(book(), { narrow: true })
    expect(pane()).toHaveAttribute('inert')
    expect(pane()).toHaveClass('-translate-x-full')
    rerender(
      <Contents
        id='contents'
        groups={groupsOf(book())}
        query=''
        canAdd
        narrow
        drawer
        {...handlers}
      />,
    )
    expect(pane()).not.toHaveAttribute('inert')
    expect(pane()).toHaveClass('translate-x-0')
  })

  it('closes its drawer from its own Close and from the scrim', async () => {
    const user = userEvent.setup()
    const { onCloseDrawer } = renderContents(book(), {
      narrow: true,
      drawer: true,
    })
    await user.click(screen.getByRole('button', { name: 'Close contents' }))
    expect(onCloseDrawer).toHaveBeenCalledTimes(1)
    await user.click(pane().previousElementSibling as HTMLElement)
    expect(onCloseDrawer).toHaveBeenCalledTimes(2)
  })

  describe('New note and New chapter', () => {
    it.each([
      [
        'the open note’s chapter',
        { note: 'wolvesNote000001' },
        'sessionChapter01',
      ],
      ['none for an open note in none', { note: 'olderLooseNote01' }, null],
      [
        'the open group’s chapter',
        { group: 'secondChapter001' },
        'secondChapter001',
      ],
      ['none for the notes in no chapter', { group: null }, null],
      ['the newest chapter with nothing open', undefined, 'secondChapter001'],
    ])('puts a new note in %s', async (_, shown, chapterId) => {
      const user = userEvent.setup()
      const { onNewNote } = renderContents(book(), { shown })
      await user.click(screen.getByRole('button', { name: 'New note' }))
      expect(onNewNote).toHaveBeenCalledWith(chapterId)
    })

    it('puts a new note in none where the book has no chapter', async () => {
      const user = userEvent.setup()
      const { onNewNote } = renderContents(book({ chapters: [] }))
      await user.click(screen.getByRole('button', { name: 'New note' }))
      expect(onNewNote).toHaveBeenCalledWith(null)
    })

    it('starts a chapter from its icon button', async () => {
      const user = userEvent.setup()
      const { onNewChapter } = renderContents()
      const button = screen.getByRole('button', { name: 'New chapter' })
      expect(button).toHaveAttribute('title', 'New chapter')
      // An icon alone, 44 px each way to tap.
      expect(button).toHaveClass('min-h-11', 'min-w-11')
      await user.click(button)
      expect(onNewChapter).toHaveBeenCalledTimes(1)
    })

    it('offers neither where the book takes no change', () => {
      renderContents(book(), { canAdd: false })
      expect(screen.queryByRole('button', { name: 'New note' })).toBeNull()
      expect(screen.queryByRole('button', { name: 'New chapter' })).toBeNull()
    })
  })
})

describe('components/notes/contents, in the journal', () => {
  const original = globalThis.ResizeObserver
  /** The modal this wide, as its ResizeObserver measures it. */
  const atWidth = (width: number) => {
    globalThis.ResizeObserver = jest.fn(
      (callback: ResizeObserverCallback) =>
        ({
          observe: () =>
            callback(
              [{ contentRect: { width } } as ResizeObserverEntry],
              {} as ResizeObserver,
            ),
          unobserve: jest.fn(),
          disconnect: jest.fn(),
        }) as unknown as ResizeObserver,
    ) as unknown as typeof ResizeObserver
  }

  const openJournal = async () => {
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
    await within(dialog).findByRole('navigation', { name: 'Contents' })
    const contents = within(dialog)
      .getByRole('navigation', { name: 'Contents' })
      .closest('[id]') as HTMLElement
    return { user, dialog, contents }
  }

  beforeEach(() => {
    forgetNotes()
  })

  afterEach(() => {
    act(() => forgetNotes())
    globalThis.ResizeObserver = original
  })

  it('is a drawer at 390 px, inert while it’s closed, its focus to Close contents as it opens and back to Contents as it closes', async () => {
    atWidth(390)
    const { user, dialog, contents } = await openJournal()
    expect(contents).toHaveAttribute('inert')
    const button = within(dialog).getByRole('button', { name: 'Contents' })
    expect(button).toHaveAttribute('aria-controls', contents.id)
    expect(button).toHaveAttribute('aria-expanded', 'false')

    await user.click(button)
    expect(contents).not.toHaveAttribute('inert')
    expect(
      within(contents).getByRole('button', { name: 'Close contents' }),
    ).toHaveFocus()

    await user.click(
      within(contents).getByRole('button', { name: 'Close contents' }),
    )
    expect(contents).toHaveAttribute('inert')
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Contents' }),
      ).toHaveFocus(),
    )
  })

  it('closes the drawer as a note is picked from it, focus back on Contents', async () => {
    atWidth(390)
    const { user, dialog, contents } = await openJournal()
    await user.click(within(dialog).getByRole('button', { name: 'Contents' }))
    await user.click(within(contents).getByRole('button', { name: 'Wolves' }))
    expect(contents).toHaveAttribute('inert')
    expect(within(dialog).getByRole('heading', { level: 3 })).toHaveTextContent(
      'Wolves',
    )
    await waitFor(() =>
      expect(
        within(dialog).getByRole('button', { name: 'Contents' }),
      ).toHaveFocus(),
    )
  })

  it('closes the drawer as the modal grows to 640 px or more, a pane again', async () => {
    let resize: ResizeObserverCallback | undefined
    globalThis.ResizeObserver = jest.fn((callback: ResizeObserverCallback) => {
      resize = callback
      return {
        observe: () =>
          callback(
            [{ contentRect: { width: 390 } } as ResizeObserverEntry],
            {} as ResizeObserver,
          ),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as ResizeObserver
    }) as unknown as typeof ResizeObserver
    const { user, dialog, contents } = await openJournal()
    await user.click(within(dialog).getByRole('button', { name: 'Contents' }))
    expect(contents).toHaveClass('translate-x-0')

    act(() =>
      resize?.(
        [{ contentRect: { width: 700 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      ),
    )
    expect(contents).toHaveClass('-translate-x-full')
    expect(contents).not.toHaveAttribute('inert')
    expect(
      within(dialog).getByRole('button', { name: 'Contents' }),
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('is a pane at 700 px, never inert unless it’s locked', async () => {
    atWidth(700)
    const { user, dialog, contents } = await openJournal()
    expect(contents).not.toHaveAttribute('inert')
    await user.click(within(contents).getByRole('button', { name: 'Wolves' }))
    // Picked from the pane, focus stays on it.
    expect(
      within(contents).getByRole('button', { name: 'Wolves' }),
    ).toHaveFocus()
    await user.click(
      within(dialog).getByRole('button', { name: 'Edit Wolves' }),
    )
    expect(contents).toHaveAttribute('inert')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(contents).not.toHaveAttribute('inert')
  })
})

describe('components/notes/contents, its button in the reader', () => {
  it('is named Contents, the word shown only from 560 px of the modal, where a note’s bar has room for it', () => {
    render(
      <ContentsButton controls='contents' open={false} onOpen={jest.fn()} />,
    )
    const button = screen.getByRole('button', { name: 'Contents' })
    expect(button).toHaveClass('@min-[640px]:hidden')
    expect(within(button).getByText('Contents')).toHaveClass(
      '@max-[560px]:sr-only',
    )
  })
})
